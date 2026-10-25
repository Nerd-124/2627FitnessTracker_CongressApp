import assert from 'node:assert/strict';
import {session,googleLookup} from './helpers/google-auth.mjs';
const {default:worker}=await import('../dist/server/index.js');
const saved=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return googleLookup();};
try{
 const signedIn=await session(worker);assert.equal(signedIn.response.status,200);calls=0;
 const headers={Cookie:signedIn.cookie,'Content-Type':'application/json'};
 const status=await worker.fetch(new Request('https://site.test/api/coach/status',{headers}),{OPENAI_API_KEY:'unused-test-placeholder'});
 const data=await status.json();assert.equal(data.mode,'free-rules');assert.equal(data.paidApiEnabled,false);
 const old=await worker.fetch(new Request('https://site.test/api/coach',{method:'POST',headers,body:'{}'}),{OPENAI_API_KEY:'unused-test-placeholder'});assert.equal(old.status,410);assert.equal(calls,0);
 assert.equal((await worker.fetch(new Request('https://site.test/api/coach/status'))).status,401);
 console.log('PASS: Google-authenticated free coach, paid endpoint disabled, zero AI provider calls');
}finally{globalThis.fetch=saved;}
