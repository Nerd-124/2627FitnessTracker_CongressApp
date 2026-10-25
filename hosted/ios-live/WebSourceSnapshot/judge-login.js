'use strict';
const judgeForm=document.querySelector('#judge-login-form'),judgeButton=document.querySelector('#judge-signin'),judgeStatus=document.querySelector('#judge-auth-status');
judgeForm.addEventListener('submit',async event=>{event.preventDefault();if(window.JUDGE_SIGNIN_PENDING||!judgeForm.reportValidity())return;
 const values=Object.fromEntries(new FormData(judgeForm)),google=document.querySelector('#google-signin'),wasDisabled=google.disabled;window.JUDGE_SIGNIN_PENDING=true;judgeButton.disabled=true;google.disabled=true;judgeStatus.textContent='Signing in…';
 try{const response=await fetch('/api/auth/judge',{method:'POST',credentials:'same-origin',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:values.username,password:values.password})});const result=await response.json();if(!response.ok)throw Error(result.error||'Could not sign in. Please try again.');judgeForm.elements.password.value='';location.replace('/app');}
 catch(error){judgeStatus.textContent=error.message||'Check your connection and try again.';window.JUDGE_SIGNIN_PENDING=false;judgeButton.disabled=false;google.disabled=wasDisabled;}
});
