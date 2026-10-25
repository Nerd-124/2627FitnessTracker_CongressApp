const ASSETS = __EMBEDDED_ASSETS__;
const securityHeaders = {
 'Cache-Control':'private, no-store',
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'strict-origin-when-cross-origin',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=(self)'
};
function reply(body,status=200,type='application/json; charset=utf-8',extra={}){return new Response(body,{status,headers:{...securityHeaders,'Content-Type':type,...extra}});}
const FIREBASE_CONFIG = __FIREBASE_CONFIG__;
__FIREBASE_AUTH_RUNTIME__
__JUDGE_AUTH_RUNTIME__
__RUN_STORAGE_RUNTIME__
__PROGRESS_STORAGE_RUNTIME__
export default {
 async fetch(request,env={}){
  try{
  const url=new URL(request.url);const path=url.pathname;
  if(path==='/api/coach'&&request.method==='POST')return reply(JSON.stringify({error:'The coach runs free in your browser.',code:'free_coach'}),410);
  if(path==='/api/auth/judge'&&request.method==='POST'){const result=await judgeSignIn(await authJSON(request),env);return authReply({account:result.account},[judgeCookie(result.token,result.account.expiresAt),sessionCookie('',0)]);}
  if(path==='/api/auth/leave-judge'&&request.method==='POST'){await authJSON(request);return authReply({ok:true},[judgeCookie()]);}
  if(path==='/api/auth/session'&&request.method==='POST'){
   const body=await authJSON(request),user=await verifyGoogleToken(body.idToken);
   return authReply({account:user},[sessionCookie(body.idToken,user.expiresAt),...(body.switchToGoogle===true?[judgeCookie()]:[])]);
  }
  if(path==='/api/auth/logout'&&request.method==='POST'){
   await authJSON(request);return authReply({signedOut:true},[sessionCookie('',0),judgeCookie()]);
  }
  if(path==='/api/progress'||path.startsWith('/api/progress/'))return await progressStorage(request,env,await judgeIdentity(request,env)||await identity(request),path);
  if(path==='/api/runs'||path.startsWith('/api/runs/')){const user=await judgeIdentity(request,env)||await identity(request);return await runStorage(request,env,user,path);}
  if(!['GET','HEAD'].includes(request.method))return reply(JSON.stringify({error:'Method not allowed'}),405,undefined,{'Allow':'GET, HEAD'});
  if(path==='/api/auth/config')return reply(JSON.stringify(FIREBASE_CONFIG));
  const protectedPage=['/app','/app/','/index.html'].includes(path),protectedAPI=['/api/account','/api/coach/status'].includes(path);
  const user=protectedPage||protectedAPI?(await judgeIdentity(request,env)||await identity(request)):null;
  if(path==='/api/account')return user?reply(JSON.stringify(user)):reply(JSON.stringify({error:'Sign-in required'}),401);
  if(path==='/api/coach/status')return user?reply(JSON.stringify({configured:true,mode:'free-rules',paidApiEnabled:false})):reply(JSON.stringify({error:'Sign-in required'}),401);
  if(protectedPage&&!user)return reply(null,302,undefined,{'Location':'/login?returnTo=%2Fapp'});
  const assetPath=protectedPage?'/index.html':path==='/login'||path==='/logout'?'/google-login.html':path==='/'||path==='/welcome'?'/welcome.html':path;
  const asset=ASSETS[assetPath];
  if(!asset)return reply('Not found',404,'text/plain; charset=utf-8');
  if(path==='/LongevitySimulator-Xcode.zip')return reply(request.method==='HEAD'?null:Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)),200,'application/zip',{'Content-Disposition':'attachment; filename="LongevitySimulator-Xcode.zip"'});
  let body=asset.binary?Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)):asset.body;let headers={};
  if(asset.type.startsWith('text/html')){
   const nonce=crypto.randomUUID().replaceAll('-','');
   if(user){const bootstrap=JSON.stringify(user).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');body=body.replace('</head>',`<script nonce="${nonce}">window.LONGEVITY_ACCOUNT=${bootstrap};</script></head>`);}
   headers['Content-Security-Policy']=`default-src 'self'; script-src 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net https://www.gstatic.com https://apis.google.com 'unsafe-eval' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: blob: https://*.googleusercontent.com https://tile.openstreetmap.org https://cdn.jsdelivr.net https://www.gstatic.com; connect-src 'self' https://cdn.jsdelivr.net https://www.gstatic.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://longevity-simulator-f9e34.firebaseapp.com https://api.open-meteo.com https://archive-api.open-meteo.com https://valhalla1.openstreetmap.de; frame-src https://longevity-simulator-f9e34.firebaseapp.com https://accounts.google.com; worker-src 'self' blob:; base-uri 'self'; object-src 'none'; form-action 'self'`;
  }
  return reply(request.method==='HEAD'?null:body,200,asset.type,headers);
  }catch(error){return reply(JSON.stringify({error:error.status?error.message:'Request could not be completed.'}),error.status||500);}
 }
};
