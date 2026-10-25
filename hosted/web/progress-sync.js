'use strict';
let progressAvatarLocal=false,progressReady=false,progressBusy=false,progressAgain=false,progressTimer=null,progressMeta=Object.create(null),progressConflicts=new Map();
const progressEncode=value=>value===undefined?null:JSON.stringify(value);
function progressSnapshot(){
 const docs=Object.create(null);
 for(const group of ['profile','habits','nutrition','dailyGoals'])for(const [key,value]of Object.entries(state[group]||{})){if(!/^[A-Za-z0-9_-]+$/.test(key)||value==null||value===''||(group==='profile'&&key==='sex'&&value==='unspecified'))continue;docs[group+':'+key]=value;}
 for(const key of ['futureSelf','baselineHabits','baselineRecord','onboardingComplete','routinePromptSeen'])if(state[key]&&(key!=='futureSelf'||progressAvatarLocal||progressMeta.futureSelf))docs[key]=state[key];
 for(const [group,prefix,key]of [['records','record','date'],['workouts','workout','id'],['eegRecordings','eeg','id']])for(const row of state[group]||[])if(row[key])docs[prefix+':'+row[key]]=row;
 return docs;
}
function progressApply(id,value){
 const [group,key]=id.split(':');if(['__proto__','constructor','prototype'].includes(key))return;
 const lists={record:['records','date'],workout:['workouts','id'],eeg:['eegRecordings','id']};
 if(group==='record'&&value===undefined&&typeof markStepsDayDeleted==='function')markStepsDayDeleted(key);
 if(lists[group]){const [name,field]=lists[group];state[name]=state[name].filter(row=>row[field]!==key);if(value!==undefined&&value&&typeof value==='object'&&value[field]===key)state[name].push(value);}
 else if(['profile','habits','nutrition','dailyGoals'].includes(group)&&key&&/^[A-Za-z0-9_-]+$/.test(key)){state[group]??={};if(value===undefined)delete state[group][key];else state[group][key]=value;}
 else if(['futureSelf','baselineHabits','baselineRecord','onboardingComplete','routinePromptSeen'].includes(id))state[id]=value;
}
function progressStatus(message){const el=document.getElementById('account-progress-status');if(el)el.textContent=message;const b=document.getElementById('progress-resolve');if(b)b.hidden=!progressConflicts.size;}
function progressPersist(){localStorage.setItem(KEY,JSON.stringify(state));localStorage.setItem(KEY+':progress-sync-v1',JSON.stringify(progressMeta));}
function progressRefresh(){renderRecords();renderSessions();if(typeof renderSleep==='function')renderSleep();if(typeof refreshDashboard==='function')refreshDashboard();if(typeof renderFutureSelf==='function')renderFutureSelf();}
function scheduleProgressSync(localChange=true){if(!progressReady||clearingData||window.LONGEVITY_ACCOUNT?.provider!=='google')return;if(localChange===true)progressAvatarLocal=true;clearTimeout(progressTimer);progressTimer=setTimeout(syncProgress,1000);}
function progressMerge(base,local,remote){
 if(!base||!local||!remote||[base,local,remote].some(v=>typeof v!=='object'||Array.isArray(v)))return null;
 const merged={};for(const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){if(['__proto__','constructor','prototype'].includes(key))return null;const b=progressEncode(base[key]),l=progressEncode(local[key]),r=progressEncode(remote[key]);if(l!==b&&r!==b&&l!==r)return null;const value=l!==b?local[key]:remote[key];if(value!==undefined)merged[key]=value;}return merged;
}
async function syncProgress(){
 if(!progressReady||clearingData||window.LONGEVITY_ACCOUNT?.provider!=='google')return;
 if(progressBusy){progressAgain=true;return;}progressBusy=true;progressStatus('Syncing profile and journal…');
 try{
 const {documents}=await runCloudRequest('/api/progress');if(clearingData)return;const remote=new Map(documents.map(row=>[row.id,row]));
 for(const id of new Set([...Object.keys(progressSnapshot()),...Object.keys(progressMeta),...remote.keys()])){
  if(clearingData)return;if(progressConflicts.has(id))continue;
  let local=progressSnapshot()[id],encoded=progressEncode(local),meta=progressMeta[id],row=remote.get(id),revision=row?.revision||0;
  if(row&&(!meta||row.revision!==meta.revision)){
   const cloud=await runCloudRequest('/api/progress/'+encodeURIComponent(id));if(clearingData)return;local=progressSnapshot()[id];encoded=progressEncode(local);const value=cloud.deleted?undefined:cloud.value,cloudEncoded=progressEncode(value);
   if(encoded===cloudEncoded){progressMeta[id]={revision:cloud.revision,base:cloudEncoded};continue;}
   if((!meta&&local===undefined)||(meta&&encoded===meta.base)){
    progressApply(id,value);progressMeta[id]={revision:cloud.revision,base:cloudEncoded};continue;
   }
   const merged=meta&&progressMerge(meta.base===null?undefined:JSON.parse(meta.base),local,value);
   if(merged){progressApply(id,merged);local=merged;encoded=progressEncode(local);revision=cloud.revision;}
   else{progressConflicts.set(id,{revision:cloud.revision,value});continue;}
  }
  if(encoded===(meta?.base??null))continue;
  try{const response=await runCloudRequest('/api/progress/'+encodeURIComponent(id),{method:local===undefined?'DELETE':'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,value:local})});if(clearingData)return;progressMeta[id]={revision:response.revision,base:encoded};}
  catch(error){if(error.status!==409)throw error;progressAgain=true;}
 }
 if(clearingData)return;progressPersist();progressRefresh();progressStatus(progressConflicts.size?'Some entries changed on both devices. Review them below.':'Profile and journal are synced with your Google account.');
 }catch(error){try{progressPersist();progressRefresh();}catch{}progressStatus('Not synced yet. Your device copy is kept. '+error.message);}
 finally{progressBusy=false;if(progressAgain){progressAgain=false;scheduleProgressSync();}}
}
function showProgressConflicts(){
 const dialog=document.getElementById('progress-conflicts'),box=document.getElementById('progress-conflicts-list');box.replaceChildren();
 for(const [id,remote]of progressConflicts){const article=document.createElement('article'),title=document.createElement('h3');title.textContent=id.replace(':',' · ');article.append(title);
  const local=progressSnapshot()[id];for(const [label,value]of [['This device',local],['Account',remote.value]]){const p=document.createElement('p');p.textContent=label+': '+(value===undefined?'Deleted':JSON.stringify(value));article.append(p);}
  for(const [label,keepLocal]of [['Keep this device’s entry',true],['Use account entry',false]]){const b=document.createElement('button');b.className='pill';b.textContent=label;b.onclick=async()=>{b.disabled=true;try{if(keepLocal){const value=progressSnapshot()[id],result=await runCloudRequest('/api/progress/'+encodeURIComponent(id),{method:value===undefined?'DELETE':'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:remote.revision,value})});progressMeta[id]={revision:result.revision,base:progressEncode(value)};}else{progressApply(id,remote.value);progressMeta[id]={revision:remote.revision,base:progressEncode(remote.value)};}progressConflicts.delete(id);progressPersist();progressRefresh();if(progressConflicts.size)showProgressConflicts();else{dialog.close();progressStatus('Profile and journal are synced with your Google account.');scheduleProgressSync();}}catch(error){progressStatus(error.message);b.disabled=false;}};article.append(b);}box.append(article);
 }
 document.getElementById('account-dialog').close();if(!dialog.open)dialog.showModal();
}
function initializeProgressSync(){
 if(window.LONGEVITY_ACCOUNT?.provider!=='google'){progressStatus('Guest progress stays on this device. Sign in with Google to sync privately.');document.getElementById('progress-sync-now').hidden=true;return;}
 try{progressMeta=Object.assign(Object.create(null),JSON.parse(localStorage.getItem(KEY+':progress-sync-v1'))||{});}catch{}
 progressAvatarLocal=!!(state.onboardingComplete||state.profile.name);progressReady=true;document.getElementById('progress-sync-now').onclick=()=>{syncProgress();syncFinishedRuns();};document.getElementById('progress-resolve').onclick=showProgressConflicts;document.getElementById('progress-conflicts-close').onclick=()=>document.getElementById('progress-conflicts').close();
 for(const event of ['focus','online'])window.addEventListener(event,scheduleProgressSync);document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleProgressSync();});setInterval(()=>{if(!document.hidden)scheduleProgressSync(false);},10000);return syncProgress();
}
