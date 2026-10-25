'use strict';
let stepsEnabled=false,stepSourceID=null,stepsDeletedDays=new Set();
function markStepsDayDeleted(date){stepsDeletedDays.add(date);try{localStorage.setItem(KEY+':steps-deleted-days',JSON.stringify([...stepsDeletedDays]));}catch{}}
function renderSteps(){const r=state.records.find(r=>r.date===localDate());$('#steps-today').textContent=Number.isInteger(r?.steps)?r.steps.toLocaleString()+' steps today':'— steps today';}
function stepButtons(enabled){$('#steps-enable').hidden=enabled;$('#steps-disable').hidden=!enabled;$('#steps-refresh').hidden=!enabled;}
function requestSteps(enabled=true,enroll=false){
 const bridge=window.__longevityNative;
 if(!bridge?.steps)return;
 if(!bridge.protectedSteps||bridge.bridgeVersion<6){bridge.steps({enabled:false,accountKey:KEY});stepsEnabled=false;stepButtons(false);$('#steps-status').textContent='Update the iPhone app to link steps safely.';return;}
 if(window.LONGEVITY_ACCOUNT?.provider!=='google'){bridge.steps({enabled:false,accountKey:KEY});stepsEnabled=false;stepButtons(false);$('#steps-status').textContent='Use your personal Google account to link steps.';return;}
 stepsEnabled=enabled;stepButtons(enabled);try{localStorage.setItem(KEY+':steps-enabled',String(enabled));}catch{}
 bridge.steps({enabled,accountKey:KEY,enroll,baselineSteps:enroll?(state.records.find(r=>r.date===localDate())?.steps||0):0});
 $('#steps-status').textContent=enabled?'Reading linked iPhone steps…':'Step importing is off.';
}
function receiveNativeSteps(message){
 if(clearingData||!stepsEnabled||message.accountKey!==KEY)return;
 if(message.blocked){stepsEnabled=false;stepSourceID=null;stepButtons(false);try{localStorage.setItem(KEY+':steps-enabled','false');localStorage.removeItem(KEY+':step-source-id');}catch{}$('#steps-status').textContent=message.error;return;}
 if(message.kind==='linked'&&typeof message.sourceID==='string'&&/^[A-Za-z0-9-]{1,100}$/.test(message.sourceID)){stepSourceID=message.sourceID;try{localStorage.setItem(KEY+':step-source-id',stepSourceID);}catch{}return;}
 if(message.error){$('#steps-status').textContent=message.error;return;}
 if(!stepSourceID||message.sourceID!==stepSourceID||stepsDeletedDays.has(message.date))return;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(message.date)||message.date>localDate()||!Number.isInteger(message.steps)||message.steps<0||message.steps>200000)return;
 const date=message.date,previous=state.records.find(r=>r.date===date)||{},steps=Math.max(previous.steps||0,message.steps);
 if(steps!==previous.steps){state.records=[...state.records.filter(r=>r.date!==date),{...previous,date,steps,inputSources:{...previous.inputSources,steps:{kind:'phone',source:'Linked iPhone'}},stepSource:'iphone-motion',stepSourceID,stepsUpdatedAt:new Date().toISOString()}];save();renderRecords();renderJournal();}
 renderSteps();$('#steps-status').textContent='Steps updated.';
}
function initializeSteps(){
 $('#steps-enable').textContent='Link my iPhone';
 $('#steps-enable').onclick=()=>{if(!window.__longevityNative?.protectedSteps){requestSteps();return;}if(!confirm('Link this iPhone as your step source? Only confirm if this is your own phone. Steps from before linking will not be imported.'))return;stepsDeletedDays.clear();try{localStorage.removeItem(KEY+':steps-deleted-days');}catch{}requestSteps(true,true);};
 $('#steps-refresh').onclick=()=>requestSteps();$('#steps-disable').onclick=()=>requestSteps(false);
 const old=renderRecords;renderRecords=function(){old();renderSteps();};renderSteps();window.addEventListener('longevity-steps',event=>receiveNativeSteps(event.detail));
 try{stepsDeletedDays=new Set(JSON.parse(localStorage.getItem(KEY+':steps-deleted-days'))||[]);stepsEnabled=localStorage.getItem(KEY+':steps-enabled')==='true';}catch{}
 // Always get a fresh native acknowledgement; browser storage cannot approve a phone.
 stepSourceID=null;
 if(window.__longevityNative?.steps)requestSteps(stepsEnabled);else{$('#steps-enable').hidden=true;$('#steps-status').textContent='Synced steps from your linked iPhone.';}
}
