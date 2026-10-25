import assert from 'node:assert/strict';
import {token,googleLookup,session} from './helpers/google-auth.mjs';
const {default:worker}=await import('../dist/server/index.js');
const realFetch=globalThis.fetch;let calls=0,lookup=()=>googleLookup();
globalThis.fetch=async(url,options)=>{calls++;assert.match(url,/^https:\/\/identitytoolkit\.googleapis\.com\/v1\/accounts:lookup\?key=/);assert.equal(options.method,'POST');assert.equal(options.redirect,'manual');assert(JSON.parse(options.body).idToken);return lookup();};
try{
 const anonymous=await worker.fetch(new Request('https://site.test/app'));assert.equal(anonymous.status,302);assert.equal(anonymous.headers.get('location'),'/login?returnTo=%2Fapp');
 const platformOnly=await worker.fetch(new Request('https://site.test/api/account',{headers:{'oai-authenticated-user-id':'old-owner','oai-authenticated-user-email':'old@example.test'}}));assert.equal(platformOnly.status,401,'ChatGPT headers do not create a Google identity');
 const loginPage=await worker.fetch(new Request('https://site.test/login'));const loginHTML=await loginPage.text();assert.match(loginHTML,/Continue with Google/);assert(!loginHTML.includes('Continue with ChatGPT'));
 const valid=await session(worker);assert.equal(valid.response.status,200);const setCookie=valid.response.headers.get('set-cookie');assert.match(setCookie,/__Host-longevity-google=/);for(const flag of ['HttpOnly','Secure','SameSite=Lax','Path=/'])assert(setCookie.includes(flag));assert(!setCookie.includes('Domain='));assert(!JSON.stringify(await valid.response.json()).includes(valid.idToken));
 const accountResponse=await worker.fetch(new Request('https://site.test/api/account',{headers:{Cookie:valid.cookie}}));const account=await accountResponse.json();assert.equal(account.provider,'google');assert.equal(account.photoURL,'https://lh3.googleusercontent.com/test-photo');assert.equal(account.email,'test@example.test');assert.match(account.storageKey,/^[a-f0-9]{64}$/);
 const appResponse=await worker.fetch(new Request('https://site.test/app',{headers:{Cookie:valid.cookie}}));assert.equal(appResponse.status,200);assert.match(await appResponse.text(),/window.LONGEVITY_ACCOUNT=/);assert.equal(calls,1,'Only verified tokens are cached for up to 60 seconds');
 const invalidClaims=[{aud:'wrong-project'},{iss:'https://evil.test'},{exp:1},{iat:9999999999},{auth_time:9999999999},{email_verified:false},{firebase:{sign_in_provider:'password'}},{sub:''}];
 for(const claims of invalidClaims){assert.equal((await session(worker,token(claims))).response.status,401);}
 assert.equal(calls,1,'Malformed or mismatched claims are never accepted or sent to Firebase');
 const original=token();const invalidAlgorithm=Buffer.from(JSON.stringify({alg:'none',kid:'test'})).toString('base64url')+'.'+original.split('.').slice(1).join('.');assert.equal((await session(worker,invalidAlgorithm)).response.status,401);
 lookup=()=>new Response(JSON.stringify({error:{message:'INVALID_ID_TOKEN'}}),{status:400});assert.equal((await session(worker,token({sub:'forged-signature'}))).response.status,401,'A plausible but forged JWT is rejected by Firebase verification');
 for(const overrides of [{disabled:true},{emailVerified:false},{localId:'different-user'},{providerUserInfo:[{providerId:'password'}]},{validSince:String(Math.floor(Date.now()/1000)+30)}]){
  lookup=()=>googleLookup(overrides);assert.equal((await session(worker,token({iat:Math.floor(Date.now()/1000)-Math.random()}))).response.status,401);
 }
 lookup=()=>new Response(null,{status:302,headers:{Location:'https://other.test'}});assert.equal((await session(worker,token({iat:11}))).response.status,503,'Verifier redirects are rejected');
 lookup=()=>{throw Error('network down')};assert.equal((await session(worker,token({iat:10}))).response.status,503,'Verification failure never grants access');
 const cross=await worker.fetch(new Request('https://site.test/api/auth/session',{method:'POST',headers:{'Origin':'https://evil.test','Content-Type':'application/json'},body:JSON.stringify({idToken:token()})}));assert.equal(cross.status,403);assert(!cross.headers.has('access-control-allow-origin'));
 const form=await worker.fetch(new Request('https://site.test/api/auth/session',{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'}));assert.equal(form.status,415);
 const large=await worker.fetch(new Request('https://site.test/api/auth/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({padding:'a'.repeat(17000)})}));assert.equal(large.status,413);
 const signout=await worker.fetch(new Request('https://site.test/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://site.test'},body:'{}'}));assert.equal(signout.status,200);assert.match(signout.headers.get('set-cookie'),/Max-Age=0/);
 const duplicate=await worker.fetch(new Request('https://site.test/api/account',{headers:{Cookie:valid.cookie+'; '+valid.cookie}}));assert.equal(duplicate.status,401);
 console.log('PASS: Google-only sessions, Firebase server verification, expiry/project/provider/revocation checks, secure cookies, bounded cache, logout, CSRF and request limits');
}finally{globalThis.fetch=realFetch;}
