// Run with MINIFLARE_MODULE pointing to an installed miniflare entrypoint.
const {Miniflare}=await import(process.env.MINIFLARE_MODULE||'miniflare');
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {token,googleLookup} from './helpers/google-auth.mjs';
let mode='valid',calls=0;
const mf=new Miniflare({modules:true,script:readFileSync(new URL('../dist/server/index.js',import.meta.url),'utf8'),compatibilityDate:'2025-09-01',outboundService:async request=>{calls++;assert.equal(new URL(request.url).hostname,'identitytoolkit.googleapis.com');if(mode==='redirect')return new Response(null,{status:302,headers:{Location:'https://untrusted.test'}});return googleLookup();}});
try{
const submit=async iat=>mf.dispatchFetch('https://site.test/api/auth/session',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://site.test'},body:JSON.stringify({idToken:token({iat})})});
const r=await submit(10);assert.equal(r.status,200,await r.text());assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.equal(calls,1);
mode='redirect';const denied=await submit(11);assert.equal(denied.status,503);assert.equal(calls,2);console.log('PASS actual workerd: verified session created, redirect rejected without forwarding token');
}finally{await mf.dispose()}
