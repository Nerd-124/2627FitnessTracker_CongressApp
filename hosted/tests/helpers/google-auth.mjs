import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
export const projectId='longevity-simulator-f9e34';
export function token(extra={}){
 const now=Math.floor(Date.now()/1000),encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 return encode({alg:'RS256',kid:'test-only-key'})+'.'+encode({iss:'https://securetoken.google.com/'+projectId,aud:projectId,sub:'test-google-uid',iat:now,exp:now+3600,auth_time:now-10,email_verified:true,firebase:{sign_in_provider:'google.com'},...extra})+'.testSignature';
}
export function googleLookup(overrides={}){return new Response(JSON.stringify({users:[{localId:'test-google-uid',email:'test@example.test',emailVerified:true,displayName:'Test',photoUrl:'https://lh3.googleusercontent.com/test-photo',validSince:'1',providerUserInfo:[{providerId:'google.com'}],...overrides}]}),{status:200,headers:{'Content-Type':'application/json'}});}
export async function session(worker,idToken=token()){
 const response=await worker.fetch(new Request('https://site.test/api/auth/session',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://site.test'},body:JSON.stringify({idToken})}));
 return {response,cookie:response.headers.get('set-cookie')?.split(';')[0],idToken};
}
