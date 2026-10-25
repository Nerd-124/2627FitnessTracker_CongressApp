const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../web/'),source=fs.readFileSync(root+'google-login-loader.js','utf8');
const dom=new JSDOM(fs.readFileSync(root+'google-login.html','utf8'),{url:'https://app.test/login',runScripts:'outside-only'}),w=dom.window,messages=[];
w.webkit={messageHandlers:{nativeAuth:{postMessage:m=>messages.push(m)}}};w.fetch=async path=>{assert.equal(path,'/api/auth/leave-judge');return {ok:true};};
w.eval(source+'\nwindow.testAuthError=googleErrorMessage;');
(async()=>{
try{
 const button=w.document.querySelector('#google-signin');assert.equal(button.disabled,false);assert.match(button.textContent,/Continue with Google/);await button.onclick();assert.equal(messages.length,1);assert.equal(messages[0].action,'signIn');assert.equal(w.document.querySelector('#google-auth-retry').hidden,true);
 assert.match(w.testAuthError({code:'auth/popup-blocked'}),/popup/);assert.match(w.testAuthError({code:'auth/unauthorized-domain'}),/authorized domains/);assert.match(w.testAuthError({code:'auth/popup-closed-by-user'}),/cancelled/);
 console.log('PASS: native Google button uses native SDK channel; browser popup cancellation/domain/network errors have clear messages');
}finally{w.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
