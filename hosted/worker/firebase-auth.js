// Authentication is verified by Firebase's official accounts:lookup service.
// Decoding a JWT below is only input validation; it never establishes identity.
const SESSION_COOKIE='__Host-longevity-google';
const verifiedTokens=new Map();
function authError(message,status=401){const e=Error(message);e.status=status;return e;}
function tokenClaims(token){
 try{
  if(typeof token!=='string'||token.length>12000)throw Error();
  const parts=token.split('.');if(parts.length!==3||parts.some(p=>!/^[A-Za-z0-9_-]+$/.test(p)))throw Error();
  const decode=s=>JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0))));
  const header=decode(parts[0]),claims=decode(parts[1]),now=Math.floor(Date.now()/1000);
  if(header.alg!=='RS256'||typeof header.kid!=='string'||!header.kid||claims.aud!==FIREBASE_CONFIG.projectId||claims.iss!=='https://securetoken.google.com/'+FIREBASE_CONFIG.projectId||typeof claims.sub!=='string'||!claims.sub||claims.sub.length>128||!Number.isFinite(claims.exp)||claims.exp<=now||!Number.isFinite(claims.iat)||claims.iat>now+60||!Number.isFinite(claims.auth_time)||claims.auth_time>now+60||claims.auth_time<=0||claims.email_verified!==true||claims.firebase?.sign_in_provider!=='google.com')throw Error();
  return claims;
 }catch{throw authError('Google sign-in is required. Please sign in again.');}
}
async function verifyGoogleToken(token){
 const claims=tokenClaims(token),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 const cacheKey=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
 const cached=verifiedTokens.get(cacheKey);if(cached&&cached.until>Date.now())return cached.value;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 let response;
 try{response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(FIREBASE_CONFIG.apiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token}),redirect:'manual',signal:controller.signal});}
 catch{throw authError('Google sign-in verification is temporarily unavailable. Try again.',503);}
 finally{clearTimeout(timer);}
 // Never forward the identity token to a redirected destination.
 if(response.status>=300&&response.status<400)throw authError('Google sign-in verification is temporarily unavailable.',503);
 if(!response.ok)throw authError(response.status>=500?'Google sign-in verification is temporarily unavailable.':'Google sign-in expired or could not be verified.',response.status>=500?503:401);
 let account;try{account=(await response.json()).users?.[0];}catch{throw authError('Google sign-in verification is temporarily unavailable.',503);}
 if(!account||account.localId!==claims.sub||account.disabled||account.emailVerified!==true||typeof account.email!=='string'||!account.providerUserInfo?.some(p=>p.providerId==='google.com')||(Number(account.validSince)||0)>claims.auth_time)throw authError('This Google session is no longer valid. Sign in again.');
 const userHash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('firebase:'+account.localId));
 let photoURL=null;
 try{const photo=new URL(account.photoUrl);if(photo.protocol==='https:'&&!photo.username&&!photo.password&&!photo.port&&photo.hostname.endsWith('.googleusercontent.com'))photoURL=photo.href;}catch{}
 const value={photoURL,email:account.email,name:typeof account.displayName==='string'?account.displayName:account.email,storageKey:Array.from(new Uint8Array(userHash),n=>n.toString(16).padStart(2,'0')).join(''),provider:'google',expiresAt:claims.exp*1000};
 if(verifiedTokens.size>=256)verifiedTokens.delete(verifiedTokens.keys().next().value);
 verifiedTokens.set(cacheKey,{value,until:Math.min(claims.exp*1000,Date.now()+60000)});
 return value;
}
async function identity(request){
 const cookies=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(SESSION_COOKIE+'='));
 if(cookies.length!==1)return null;
 try{return await verifyGoogleToken(cookies[0].slice(SESSION_COOKIE.length+1));}catch(error){if(error.status===503)throw error;return null;}
}
function requireSameOriginJSON(request){
 const origin=request.headers.get('Origin');
 if(origin&&origin!==new URL(request.url).origin||request.headers.get('Sec-Fetch-Site')==='cross-site')throw authError('Request origin is not allowed.',403);
 if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))throw authError('JSON is required.',415);
}
async function authJSON(request){
 requireSameOriginJSON(request);
 if(Number(request.headers.get('Content-Length'))>16384)throw authError('Request too large.',413);
 const reader=request.body?.getReader();if(!reader)throw authError('Request body is required.',400);
 const chunks=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16384){await reader.cancel();throw authError('Request too large.',413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw authError('Invalid JSON.',400);}
}
function sessionCookie(token,expiresAt){const age=Math.max(0,Math.min(3600,Math.floor((expiresAt-Date.now())/1000)));return SESSION_COOKIE+'='+token+'; Path=/; Max-Age='+age+'; Secure; HttpOnly; SameSite=Lax';}
