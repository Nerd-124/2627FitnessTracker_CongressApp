'use strict';
let coachConnected=false,coachBusy=false,coachHistory=[],coachOptions=[],coachOptionsStart=null,coachPreferences={};
function coachContext(){
 // Read only the metadata needed for local answers, never route coordinates.
 return {today:localDate(),profile:{age:state.profile.age},records:state.records,
  activities:state.activities,workouts:state.workouts};
}
function coachMessage(role,text){
 const p=document.createElement('div');p.className='coach-message '+role;
 const label=document.createElement('strong');label.textContent=role==='user'?'You':'Assistant';
 const content=document.createElement('p');content.textContent=text;p.append(label,content);$('#coach-conversation').append(p);$('#coach-clear').hidden=false;$('#coach-chat-welcome').hidden=true;scrollCoachChat();
}
function coachSetBusy(busy){
 coachBusy=busy;$('#coach-send').disabled=busy||!coachConnected;$('#coach-send').textContent=busy?'Preparing reply…':'Send →';
 $('#coach-message').disabled=busy;
 $('#coach-options').querySelectorAll('button').forEach(b=>b.disabled=busy);
}
function checkCoachConnection(){
 coachConnected=true;
 $('#coach-status').textContent='';coachSetBusy(false);
}
function coachValidateResponse(data){
 if(!data||typeof data.reply!=='string'||!data.reply||data.reply.length>6000||!Array.isArray(data.actions)||data.actions.length>3)throw Error('The assistant could not prepare a reply.');
 for(const action of data.actions)if(!['home','journal','activity','mental-health','sleep-lab','profile'].includes(action.page)||typeof action.label!=='string'||action.label.length>80||(action.date&&!validSleepDate(action.date)))throw Error('The assistant returned an invalid link.');
 return data;
}
function coachAction(action){
 if(!exerciseCanSave()){$('#coach-status').textContent='Reconnect or reload your account first.';return;}
 $('#coach-minimize').click();
 if(action.page==='profile'){$('#edit-profile').click();return;}
 openAppPage(action.page);
 if(action.page==='journal'&&action.date){selectJournalDay(action.date);$('#journal-edit-day').focus({preventScroll:true});}
 if(action.page==='activity'&&action.label.toLowerCase().includes('history'))showExerciseTool('history');
}
function appendCoachActions(actions){
 if(!actions.length)return;
 const group=document.createElement('div');group.className='coach-answer-actions';
 for(const action of actions){const button=document.createElement('button');button.type='button';button.className='pill';button.textContent=action.label+' →';button.onclick=()=>coachAction(action);group.append(button);}
 $('#coach-conversation').lastElementChild.append(group);
}
// Retained as a no-op for older exercise integrations; planning UI was removed.
function renderCoachToday(){}

function sendCoach(event){
 event.preventDefault();if(coachBusy||!$('#coach-form').reportValidity())return;
 if(!exerciseCanSave()){$('#coach-status').textContent='Reconnect or reload your account before using the assistant.';return;}
 const message=$('#coach-message').value.trim();if(!message)return;
 coachMessage('user',message);
 try{
  const result=coachValidateResponse(LocalAssistant.reply(message,coachPreferences,coachContext()));
  coachPreferences=result.memory;coachHistory.push({role:'user',content:message},{role:'assistant',content:result.reply});
  coachMessage('assistant',result.reply);appendCoachActions(result.actions);scrollCoachChat();
  $('#coach-message').value='';$('#coach-message').placeholder='Ask a follow-up…';$('#coach-status').textContent='';
 }catch(error){$('#coach-status').textContent=error.message;}
}
function initializeCoach(){
 $('#coach-form').onsubmit=sendCoach;


 $('#coach-clear').onclick=()=>{if(coachHistory.length&&!confirm('Clear this conversation?'))return;coachHistory=[];coachOptions=[];coachPreferences={};$('#coach-conversation').replaceChildren();$('#coach-options').replaceChildren();coachSetBusy(false);$('#coach-status').textContent='';$('#coach-message').placeholder='Ask about exercise, well-being, sleep, or the app…';$('#coach-clear').hidden=true;$('#coach-chat-welcome').hidden=false;};

 initializeCoachDock();renderCoachToday();checkCoachConnection();
}

function scrollCoachChat(){
 const box=$('#coach-chat-scroll');if(box)box.scrollTop=box.scrollHeight;
}
function initializeCoachDock(){
 const panel=$('#coach-chat-panel'),launcher=$('#coach-launcher');
 function minimize(){panel.hidden=true;launcher.setAttribute('aria-expanded','false');launcher.focus({preventScroll:true});}
 launcher.onclick=()=>{
  if(!panel.hidden){minimize();return;}
  panel.hidden=false;launcher.setAttribute('aria-expanded','true');scrollCoachChat();
  $('#coach-message').focus({preventScroll:true});
 };
 $('#coach-minimize').onclick=minimize;
 panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();minimize();}});
 // Keep the composer above the iPhone keyboard without changing the page scroll.
 function fitViewport(){
  const viewport=window.visualViewport;if(!viewport)return;
  const offset=Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop);
  panel.style.setProperty('--coach-keyboard-offset',offset+'px');
  panel.style.setProperty('--coach-visible-height',viewport.height+'px');
 }
 window.visualViewport?.addEventListener('resize',fitViewport);
 window.visualViewport?.addEventListener('scroll',fitViewport);fitViewport();
}
