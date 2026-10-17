import assert from 'node:assert/strict';
const {default:worker}=await import('../dist/server/index.js');
const headers={'oai-authenticated-user-id':'test-owner','oai-authenticated-user-email':'test@example.com','Content-Type':'application/json'};
const saved=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('No external requests allowed');};
try{
 const status=await worker.fetch(new Request('https://app.test/api/coach/status',{headers}),{OPENAI_API_KEY:'unused-test-placeholder'});
 const data=await status.json();assert.equal(data.mode,'free-rules');assert.equal(data.paidApiEnabled,false);
 const old=await worker.fetch(new Request('https://app.test/api/coach',{method:'POST',headers,body:'{}'}),{OPENAI_API_KEY:'unused-test-placeholder'});assert.equal(old.status,410);assert.equal(calls,0);
 const anonymous=await worker.fetch(new Request('https://app.test/api/coach/status'),{});assert.equal(anonymous.status,401);
 console.log('PASS: paid coach endpoint disabled, free status authenticated, zero provider calls even if a key exists');
}finally{globalThis.fetch=saved;}
