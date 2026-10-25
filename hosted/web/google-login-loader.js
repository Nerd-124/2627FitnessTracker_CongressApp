'use strict';
// Native sign-in does not load Firebase's browser SDK or open Google in a web view.
const googleButton=document.querySelector('#google-signin'),googleStatus=document.querySelector('#google-auth-status'),googleRetry=document.querySelector('#google-auth-retry');
const googleNative=!!window.webkit?.messageHandlers?.nativeAuth;
let googleBrowser;
function googleAuthMessage(message){googleStatus.textContent=message;}
async function googleSession(idToken){
 const response=await fetch('/api/auth/session',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({idToken,switchToGoogle:true})});
 const result=await response.json();if(!response.ok)throw Error(result.error||'Sign-in could not finish. Try again.');
 return result;
}
function googleErrorMessage(error){
 const code=error?.code||'';
 if(code.includes('popup-closed')||code.includes('cancelled-popup'))return 'Sign-in was cancelled. You can try again.';
 if(code.includes('unauthorized-domain'))return 'This website needs to be added to Firebase Authentication’s authorized domains.';
 if(code.includes('popup-blocked'))return 'Allow the Google sign-in popup, then try again.';
 if(code.includes('network'))return 'Check your internet connection and try again.';
 return error?.message||'Google sign-in could not finish. Please try again.';
}
async function googleLogout(){
 const response=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});
 if(!response.ok)throw Error('Could not sign out. Please retry.');
}
async function prepareGoogleLogin(){
 if(location.pathname==='/logout'&&new URLSearchParams(location.search).get('judge')==='1'){try{await googleLogout();location.replace('/login?signedOut=1');}catch(error){googleAuthMessage(error.message);}return;}
 googleRetry.hidden=true;
 try{
  if(googleNative){googleButton.disabled=!!window.JUDGE_SIGNIN_PENDING;googleAuthMessage('Sign in securely with your Google account.');return;}
  googleBrowser=await import('/google-login.js');
  await googleBrowser.prepare();
  googleButton.disabled=!!window.JUDGE_SIGNIN_PENDING;googleAuthMessage('Sign in securely with your Google account.');
 }catch(error){googleAuthMessage(googleErrorMessage(error));googleRetry.hidden=false;}
}
googleButton.onclick=async()=>{
 if(window.JUDGE_SIGNIN_PENDING)return;
 if(googleNative){try{const response=await fetch('/api/auth/leave-judge',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});if(!response.ok)throw Error('Could not switch sign-in methods. Try again.');window.webkit.messageHandlers.nativeAuth.postMessage({action:'signIn'});}catch(error){googleAuthMessage(error.message);}return;}
 googleButton.disabled=true;googleAuthMessage('Opening Google sign-in…');
 try{await googleBrowser.signIn();}catch(error){googleAuthMessage(googleErrorMessage(error));googleButton.disabled=!!window.JUDGE_SIGNIN_PENDING;}
};
googleRetry.onclick=prepareGoogleLogin;
prepareGoogleLogin();
