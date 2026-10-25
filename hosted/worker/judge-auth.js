// Deliberately shared judging credentials. This grants only a separate, local demo.
// The signing key belongs in Sites runtime secrets, never source or browser assets.
const JUDGE_COOKIE='__Host-longevity-judge';
const JUDGE_LIFETIME=7*24*60*60;
function judgeCookie(token='',expiresAt=0){return JUDGE_COOKIE+'='+token+'; Path=/; Max-Age='+Math.max(0,Math.min(JUDGE_LIFETIME,Math.floor((expiresAt-Date.now())/1000)))+'; Secure; HttpOnly; SameSite=Lax';}
function authReply(data,cookies){const response=reply(JSON.stringify(data));for(const cookie of cookies)response.headers.append('Set-Cookie',cookie);return response;}
function base64url(bytes){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
function unbase64url(value){if(!/^[A-Za-z0-9_-]+$/.test(value))throw Error();return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));}
async function judgeKey(env){if(typeof env.JUDGE_SESSION_SECRET!=='string'||env.JUDGE_SESSION_SECRET.length<32)throw authError('Username sign-in is temporarily unavailable. Please try again.',503);return crypto.subtle.importKey('raw',new TextEncoder().encode(env.JUDGE_SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
function judgeAccount(expiresAt){return {provider:'judge',name:'Guest account',email:null,photoURL:null,storageKey:'judge-demo-v1',expiresAt};}
async function judgeSignIn(body,env){
 if(!body||typeof body.username!=='string'||typeof body.password!=='string'||body.username.length>64||body.password.length>128||body.username.trim().toLowerCase()!=='guest1'||body.password!=='1234')throw authError('Incorrect username or password.',401);
 const now=Math.floor(Date.now()/1000),claims={v:1,kind:'judge',iat:now,exp:now+JUDGE_LIFETIME,nonce:crypto.randomUUID()};
 const payload=base64url(new TextEncoder().encode(JSON.stringify(claims))),signature=await crypto.subtle.sign('HMAC',await judgeKey(env),new TextEncoder().encode(payload));
 return {account:judgeAccount(claims.exp*1000),token:payload+'.'+base64url(new Uint8Array(signature))};
}
async function judgeIdentity(request,env){
 const cookies=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(JUDGE_COOKIE+'='));if(cookies.length!==1)return null;
 try{const token=cookies[0].slice(JUDGE_COOKIE.length+1);if(token.length>2048)return null;const parts=token.split('.');if(parts.length!==2)return null;
 const valid=await crypto.subtle.verify('HMAC',await judgeKey(env),unbase64url(parts[1]),new TextEncoder().encode(parts[0]));if(!valid)return null;
 const claims=JSON.parse(new TextDecoder().decode(unbase64url(parts[0]))),now=Math.floor(Date.now()/1000);
 if(claims.v!==1||claims.kind!=='judge'||typeof claims.nonce!=='string'||!Number.isInteger(claims.iat)||!Number.isInteger(claims.exp)||claims.iat>now+60||claims.exp<=now||claims.exp-claims.iat!==JUDGE_LIFETIME)return null;
 return judgeAccount(claims.exp*1000);
 }catch{return null;}
}
