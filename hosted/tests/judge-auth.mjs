import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {token,googleLookup,session} from './helpers/google-auth.mjs';
const {default:worker}=await import('../dist/server/index.js');
const env={JUDGE_SESSION_SECRET:randomBytes(48).toString('base64url')},origin='https://site.test';
const post=(path,body={},extra={},runtime=env)=>worker.fetch(new Request(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...extra},body:JSON.stringify(body)}),runtime);
const get=(path,cookie,runtime=env)=>worker.fetch(new Request(origin+path,{headers:cookie?{Cookie:cookie}:{}}),runtime);
const realFetch=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return googleLookup()};
try{
assert.equal((await get('/app')).status,302);assert.equal((await get('/api/account')).status,401);
for(const body of [{username:'guest1',password:'bad'},{username:'admin',password:'1234'},{username:[],password:'1234'},null])assert.equal((await post('/api/auth/judge',body)).status,401);
assert.equal((await post('/api/auth/judge',{username:'guest1',password:'1234'},{},{})).status,503,'No insecure signing-key fallback');
const r=await post('/api/auth/judge',{username:'guest1',password:'1234'});assert.equal(r.status,200);const account=(await r.json()).account;assert.equal(account.provider,'judge');assert.equal(account.email,null);assert.equal(account.storageKey,'judge-demo-v1');
const cookies=r.headers.getSetCookie();assert.equal(cookies.length,2);const cookie=cookies.find(c=>c.startsWith('__Host-longevity-judge=')).split(';')[0];for(const flag of ['Secure','HttpOnly','SameSite=Lax','Path=/'])assert(cookies[0].includes(flag));assert(cookies.some(c=>c.startsWith('__Host-longevity-google=')&&c.includes('Max-Age=0')));
assert.equal((await get('/app',cookie)).status,200);const rendered=await (await get('/app',cookie)).text();assert(rendered.includes('"provider":"judge"'));assert(!rendered.includes(env.JUDGE_SESSION_SECRET));assert.equal((await (await get('/api/account',cookie)).json()).storageKey,account.storageKey);assert.equal((await get('/api/coach/status',cookie)).status,200);assert.equal(calls,0,'Judge authentication never needs Google verification');
assert.equal((await get('/api/account',cookie+'; '+cookie)).status,401);assert.equal((await get('/api/account',cookie+'x')).status,401);assert.equal((await get('/api/account',cookie,{JUDGE_SESSION_SECRET:'another-independent-key-that-is-long-enough'})).status,401);
const now=Date.now;Date.now=()=>now()+8*86400000;assert.equal((await get('/api/account',cookie)).status,401,'Expired signed session rejected');Date.now=now;
const cross=await post('/api/auth/judge',{username:'guest1',password:'1234'},{Origin:'https://evil.test'});assert.equal(cross.status,403);assert.equal((await post('/api/auth/judge',{username:'guest1',password:'1234'},{'Sec-Fetch-Site':'cross-site'})).status,403);assert.equal((await post('/api/auth/judge',{padding:'x'.repeat(17000)})).status,413);
const google=await session(worker,token());assert.equal(google.response.status,200);const googleUser=await (await get('/api/account',google.cookie)).json();assert.equal(googleUser.provider,'google');assert.notEqual(googleUser.storageKey,account.storageKey);assert.equal((await (await get('/api/account',cookie+'; '+google.cookie)).json()).provider,'judge','Automatic native Google refresh cannot switch the active demo identity');
const explicit=await post('/api/auth/session',{idToken:token(),switchToGoogle:true});assert(explicit.headers.getSetCookie().some(c=>c.startsWith('__Host-longevity-judge=')&&c.includes('Max-Age=0')));
const leave=await post('/api/auth/leave-judge');assert(leave.headers.get('set-cookie').includes('__Host-longevity-judge='));assert.equal((await post('/api/auth/leave-judge',{}, {Origin:'https://evil.test'})).status,403);
const logout=await post('/api/auth/logout');assert.equal(logout.headers.getSetCookie().length,2);assert(logout.headers.getSetCookie().every(c=>c.includes('Max-Age=0')));
console.log('PASS judge credentials, signed/expired/tampered cookies, CSRF, Google isolation/switching, no signing-key fallback and dual logout');
}finally{globalThis.fetch=realFetch;}
