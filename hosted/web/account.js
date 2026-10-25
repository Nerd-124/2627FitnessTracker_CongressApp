'use strict';
let accountCheck=null, recordsStale=false,accountLastVerified=0,accountRefreshRequested=0;
function accountConnectionNotice(message=''){const node=document.querySelector('#account-connection-status');if(node){node.textContent=message;node.hidden=!message;}}
function publishAccountLogout(){try{localStorage.setItem('longevity-auth-event',JSON.stringify({type:'logout',storageKey:window.LONGEVITY_ACCOUNT?.storageKey,at:Date.now()}));}catch{}}

function initializeAccount(){const account=window.LONGEVITY_ACCOUNT;if(!account)return;renderAccountAvatar(account);$('#account-email').textContent=account.provider==='judge'?'No personal email required':account.email;const info=$('#account-storage-note');if(info)info.textContent=account.provider==='google'?'Your profile, routine, journal, workouts, and finished runs sync privately with this Google account. Sign in with the same Google account in the app and on the website.':'Guest records stay on this device. Use Google sign-in for private progress syncing across devices.';const providerLabel=$('#account-provider-label');if(providerLabel)providerLabel.textContent=account.provider==='judge'?'Guest account · local records only':'Signed in securely with Google';$('#account-display').textContent=account.name||account.email;$('#account-settings').onclick=()=>{if($('#mobile-side-menu')?.open)$('#mobile-side-menu').close();$('#account-dialog').showModal();};$('#setup-account').onclick=()=>$('#account-dialog').showModal();$('#close-account').onclick=()=>$('#account-dialog').close();$('#account-signout').onclick=async event=>{if(account.provider==='judge'){event.preventDefault();clearingData=true;stopGPS();try{const response=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});if(!response.ok)throw Error('Could not sign out. Please retry.');publishAccountLogout();location.assign('/logout?judge=1');}catch(error){clearingData=false;$('#account-message').textContent=error.message;}return;}publishAccountLogout();clearingData=true;stopGPS();document.body.classList.add('session-paused');};
 const legacy=localStorage.getItem('longevity-simulator-v1');$('#legacy-import').hidden=account.provider==='judge'||!legacy;$('#import-legacy').onclick=()=>{if(account.provider==='judge')return;if(!$('#legacy-confirm').checked){$('#account-message').textContent='Confirm that these older records belong to you before importing.';return;}if((state.onboardingComplete||state.records.length)&&!confirm('Replace this account’s current browser records with the older records? This will overwrite the current records.'))return;try{const old=JSON.parse(legacy);if(!old||typeof old!=='object'||!old.profile||!Array.isArray(old.records))throw Error('Older data could not be recognized.');localStorage.setItem(KEY,JSON.stringify(old));location.assign('/app');}catch(err){$('#account-message').textContent=err.message;}};
 async function verify(force=false){
  if(recordsStale)return;if(accountCheck)return accountCheck;if(!force&&Date.now()-accountLastVerified<15000)return;
  accountCheck=(async()=>{try{const response=await fetch('/api/account',{cache:'no-store',credentials:'same-origin',redirect:'error'});
   if(response.status===401){accountConnectionNotice('Sign-in needs to reconnect for syncing. Your current run keeps recording on this device.');if(window.webkit?.messageHandlers?.nativeAuth&&Date.now()-accountRefreshRequested>30000){accountRefreshRequested=Date.now();window.webkit.messageHandlers.nativeAuth.postMessage({action:'refresh'});}return;}
   if(!response.ok)throw Error('Connection unavailable');const current=await response.json();if(current.storageKey!==account.storageKey){clearingData=true;stopGPS();document.body.classList.add('session-paused');location.replace('/login');return;}
   accountLastVerified=Date.now();accountConnectionNotice();document.body.classList.remove('session-paused');$('#session-message').hidden=true;maybeShowRoutinePrompt();
  }catch{accountConnectionNotice('Connection unavailable. Recording and local saves continue; account sync will retry.');}finally{accountCheck=null;}})();return accountCheck;
 }
 window.addEventListener('focus',()=>verify());window.addEventListener('pageshow',()=>verify());window.addEventListener('online',()=>verify(true));window.addEventListener('longevity-session-refresh-failed',()=>accountConnectionNotice('Account sync will retry. Your run continues on this device.'));window.addEventListener('longevity-session-refreshed',()=>{verify(true);if(typeof scheduleRunSync==='function')scheduleRunSync();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)verify();});
 window.addEventListener('storage',event=>{if(event.key==='longevity-auth-event'){try{const change=JSON.parse(event.newValue);if(change?.type==='logout'&&change.storageKey===account.storageKey){clearingData=true;stopGPS();document.body.classList.add('session-paused');location.replace('/login');}}catch{}return;}if(event.key===KEY&&event.newValue!==JSON.stringify(state)){recordsStale=true;if(typeof runIsActive==='function'&&runIsActive()){accountConnectionNotice('Another tab updated your records. Finish this run before reloading; recording continues.');return;}document.body.classList.add('session-paused');$('#session-message').hidden=false;$('#session-message-text').textContent='Your records changed in another tab. Reload to use the latest version.';}});$('#session-reload').onclick=()=>location.assign('/app');verify();
}

function renderAccountAvatar(account){
 const avatar=document.querySelector('#account-avatar');if(!avatar)return;
 const initials=(account.name||account.email||'Account').trim().split(/\s+/).slice(0,2).map(part=>Array.from(part)[0]||'').join('').toUpperCase();
 avatar.textContent=initials;
 if(!account.photoURL)return;
 try{
  const url=new URL(account.photoURL);
  if(url.protocol!=='https:'||url.username||url.password||url.port||!url.hostname.endsWith('.googleusercontent.com'))return;
  const image=document.createElement('img');image.alt='';image.width=32;image.height=32;image.referrerPolicy='no-referrer';
  image.addEventListener('error',()=>{avatar.textContent=initials;},{once:true});
  image.src=url.href;avatar.replaceChildren(image);
 }catch{}
}
