'use strict';
let coachConnected=false,coachBusy=false,coachHistory=[],coachOptions=[],coachOptionsStart=null,coachPreferences={};
function coachContext(){
 if(!$('#coach-use-context').checked)return {};
 const s=plannerCurrentStatus();
 const result={};for(const key of ['baselineMovement','recordedMinutes','movementDays','sleepAverage','sleepNights','baselineSleep'])if(typeof s[key]==='number'&&Number.isFinite(s[key]))result[key]=s[key];
 return result;
}
function renderCoachContext(){
 const context=coachContext(),parts=[];
 if(!$('#coach-use-context').checked){$('#coach-context-preview').textContent='Routine context is off. Suggestions use only what you type and your available time.';return;}
 if(context.baselineMovement!=null)parts.push(`starting movement ${Math.round(context.baselineMovement)} min/week`);
 if(context.movementDays)parts.push(`${Math.round(context.recordedMinutes)} movement minutes recorded across ${context.movementDays}/7 recent days`);
 if(context.sleepAverage!=null)parts.push(`${context.sleepAverage.toFixed(1)} h average time in bed (${context.sleepNights} recent nights)`);
 else if(context.baselineSleep!=null)parts.push(`starting sleep routine ${context.baselineSleep} h/night`);
 $('#coach-context-preview').textContent=parts.length?'Local routine summary: '+parts.join(' · ')+'. Missing days are unknown.':'No routine summary is available yet. The coach will start from your message and available time.';
}
function coachMessage(role,text){
 const p=document.createElement('div');p.className='coach-message '+role;
 const label=document.createElement('strong');label.textContent=role==='user'?'You':'Fitness coach';
 const content=document.createElement('p');content.textContent=text;p.append(label,content);$('#coach-conversation').append(p);p.scrollIntoView?.({behavior:'smooth',block:'nearest'});
}
function coachSetBusy(busy){
 coachBusy=busy;$('#coach-send').disabled=busy||!coachConnected;$('#coach-send').textContent=busy?'Preparing options…':'Send →';
 $('#coach-start').disabled=busy;$('#coach-message').disabled=busy;$('#coach-budget').disabled=busy;$('#coach-use-context').disabled=busy;
 $('#coach-options').querySelectorAll('button').forEach(b=>b.disabled=busy);
}
function checkCoachConnection(){
 coachConnected=true;$('#coach-connection').textContent='Free · built-in rules';
 $('#coach-status').textContent='No API key or paid service needed. Tell me your goal to begin.';coachSetBusy(false);
}
function coachValidateResponse(data){
 if(!data||typeof data.reply!=='string'||data.reply.length>2000||!Array.isArray(data.questions)||data.questions.length>2||data.questions.some(q=>typeof q!=='string'||q.length>300)||!Array.isArray(data.options)||data.options.length>3)throw Error('The coach returned an unreadable reply. Nothing was added.');
 if(data.options.length===1)throw Error('The coach did not provide multiple options. Nothing was added.');
 for(const option of data.options){
  if(!option||typeof option.title!=='string'||!option.title.trim()||option.title.length>80||typeof option.summary!=='string'||option.summary.length>1000||typeof option.why!=='string'||option.why.length>1000||!Array.isArray(option.tasks)||option.tasks.length<1||option.tasks.length>10)throw Error('The coach returned an incomplete plan. Nothing was added.');
  for(const task of option.tasks)if(!task||typeof task.title!=='string'||!task.title.trim()||task.title.length>160||!['move','rest','food','custom'].includes(task.category)||!Number.isInteger(task.dayOffset)||task.dayOffset<0||task.dayOffset>6||(task.minutes!==null&&(!Number.isInteger(task.minutes)||task.minutes<1||task.minutes>120)))throw Error('The coach returned an invalid action. Nothing was added.');
 }
 return data;
}
function renderCoachOptions(){
 const box=$('#coach-options');box.replaceChildren();
 coachOptions.forEach((option,index)=>{
  const card=document.createElement('article');card.className='coach-option';
  const eyebrow=document.createElement('span');eyebrow.className='eyebrow green';eyebrow.textContent='OPTION '+(index+1);
  const title=document.createElement('h3');title.textContent=option.title;
  const summary=document.createElement('p');summary.textContent=option.summary;
  const why=document.createElement('p');why.className='muted';why.textContent=option.why;
  const detail=document.createElement('details'),label=document.createElement('summary');label.textContent='Preview this week';detail.append(label);
  const list=document.createElement('ul');
  for(const task of [...option.tasks].sort((a,b)=>a.dayOffset-b.dayOffset)){const li=document.createElement('li');li.textContent=`Day ${task.dayOffset+1}: ${task.title}${task.minutes!==null?' · '+task.minutes+' min':''}`;list.append(li);}detail.append(list);
  const button=document.createElement('button');button.className='primary';button.type='button';button.textContent='Choose this plan →';button.onclick=()=>{try{adoptCoachPlan(option);button.textContent='✓ Added to your plan';button.disabled=true;}catch(error){$('#coach-status').textContent=error.message;}};
  card.append(eyebrow,title,summary,why,detail,button);box.append(card);
 });
}
function adoptCoachPlan(option){
 if(coachBusy)throw Error('Wait for the coach to finish before choosing a plan.');
 if(state.plans.length>=20)throw Error('You have 20 saved plans. Remove an older one in My plan before adding another.');
 const budget=Number($('#coach-budget').value);if(!Number.isInteger(budget)||budget<5||budget>120)throw Error('Choose 5–120 available minutes.');
 for(let day=0;day<7;day++)if(option.tasks.some(t=>t.minutes!==null&&t.minutes>budget)||option.tasks.filter(t=>t.dayOffset===day&&t.category==='move').reduce((n,t)=>n+(t.minutes||0),0)>budget)throw Error('Your available time changed. Ask the coach for options that fit the new time.');
 const start=$('#coach-start').value;if(coachOptionsStart&&start!==coachOptionsStart)throw Error('Your start date changed. Ask the coach to update the schedule before choosing a plan.');if(!validSleepDate(start))throw Error('Choose a valid start date.');
 const goal=coachPreferences.goalText||[...coachHistory].find(m=>m.role==='user')?.content||'My fitness goal';
 const tasks=option.tasks.map(task=>({id:crypto.randomUUID(),title:task.title,category:task.category,schedule:'once',days:[],date:plannerDateAdd(start,task.dayOffset),minutes:task.minutes}));
 const plan={id:crypto.randomUUID(),title:option.title,goal:goal.slice(0,500),horizon:'week',start,end:plannerDateAdd(start,6),budget,movementGoal:null,focus:[...new Set(tasks.map(t=>t.category).filter(c=>['move','rest','food'].includes(c)))],days:[...new Set(tasks.filter(t=>t.category==='move').map(t=>journalDayDate(t.date).getDay()))],activity:'',notes:'Chosen from the free built-in coach. Review and adjust to your needs.',tasks,reasons:['Built-in coach suggestion: '+option.summary,option.why,'Chosen by you on '+localDate()+'. These are rule-based suggestions, not medical prescriptions.'],checkins:{},source:'free-chat-coach',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 plan.tasks=plan.tasks.map(task=>validatePlannerTask(task,plan));
 // Changing the active plan leaves earlier plans and their check-ins intact.
 savePlannerState([...state.plans,plan],plan.id);
 plannerDraft=null;plannerViewStart=null;$('#planner-builder').hidden=true;$('#planner-draft').hidden=true;renderPlanner();renderCoachToday();
 $('#coach-status').textContent=start===localDate()?'Plan added. Your first actions are on Today; the full week is editable in My plan.':`Plan added for ${start}. Today shows its actions when that date arrives. Edit the full plan in My plan.`;
 $('#coach-today').scrollIntoView?.({behavior:'smooth',block:'start'});
}
function renderCoachToday(){
 if(!$('#coach-today-actions'))return;
 const plan=activePlanner(),box=$('#coach-today-actions');box.replaceChildren();$('#coach-open-plan').textContent=plan?'Edit my plan →':'Make my own plan →';
 if(!plan){$('#coach-today-summary').textContent='Choose a coach option or create your own plan. Its scheduled actions will appear here.';return;}
 const today=localDate();
 $('#coach-today-summary').textContent=plan.title+' · '+(today<plan.start?'starts '+plan.start:today>plan.end?'plan complete · review or make a new plan':'your scheduled actions for today');
 const tasks=plan.tasks.filter(task=>plannerTaskScheduled(task,today,plan));
 if(!tasks.length){const p=document.createElement('p');p.className='muted';p.textContent=today<plan.start?'Your plan hasn’t started yet. Review it in My plan.':today>plan.end?'Your scheduled dates have finished. Keep your check-ins or start a new plan.':'No actions scheduled today. Rest or adjust your plan if you want.';box.append(p);return;}
 for(const task of tasks){const label=document.createElement('label');label.className='planner-checkin';const input=document.createElement('input');input.type='checkbox';input.checked=!!plan.checkins[today+':'+task.id];const text=document.createElement('span');text.textContent=task.title;label.append(input,text);if(task.minutes!==null){const small=document.createElement('small');small.textContent=task.minutes+' min';label.append(small);}input.onchange=()=>{try{plannerCheckin(plan,task,today,input.checked);renderCoachToday();}catch(error){input.checked=!input.checked;$('#coach-status').textContent=error.message;}};box.append(label);}
}
function sendCoach(event){
 event.preventDefault();if(coachBusy||!$('#coach-form').reportValidity())return;
 if(!exerciseCanSave()){$('#coach-status').textContent='Reconnect or reload your account before using the coach.';return;}
 const message=$('#coach-message').value.trim();if(!message)return;
 const budget=Number($('#coach-budget').value),start=$('#coach-start').value;
 if(!Number.isInteger(budget)||budget<5||budget>120){$('#coach-status').textContent='Choose 5–120 available minutes.';return;}
 if(!validSleepDate(start)){$('#coach-status').textContent='Choose a valid start date.';return;}
 coachMessage('user',message);
 try{
  const result=FreeCoach.reply(message,coachPreferences,{budget,start,context:coachContext()});
  const validated=coachValidateResponse(result);coachPreferences=result.prefs;
  if(coachPreferences.budget)$('#coach-budget').value=coachPreferences.budget;
  coachHistory.push({role:'user',content:message},{role:'assistant',content:validated.reply});
  coachOptions=validated.options;coachOptionsStart=start;
  coachMessage('assistant',validated.reply+(validated.questions.length?'\n\n'+validated.questions.join('\n'):''));renderCoachOptions();
  $('#coach-message').value='';$('#coach-message').placeholder='Tell me what to change, or choose a plan above…';
  $('#coach-status').textContent=coachOptions.length?'Nothing is added until you choose a plan. All suggestions were created on this device.':'Reply here to continue. This built-in coach has limited language understanding.';
 }catch(error){$('#coach-status').textContent=error.message;}
}
function initializeCoach(){
 $('#coach-start').value=localDate();$('#coach-form').onsubmit=sendCoach;
 $('#coach-use-context').onchange=renderCoachContext;
 document.querySelectorAll('[data-coach-prompt]').forEach(button=>button.onclick=()=>{$('#coach-message').value=button.dataset.coachPrompt;$('#coach-message').focus();});
 $('#coach-clear').onclick=()=>{if(coachHistory.length&&!confirm('Clear this conversation and plan options? Your saved plans will be kept.'))return;coachHistory=[];coachOptions=[];coachPreferences={};$('#coach-conversation').replaceChildren();$('#coach-options').replaceChildren();coachSetBusy(false);$('#coach-status').textContent=coachConnected?'Tell me what you’d like to accomplish.':'The free coach is ready.';};
 $('#coach-open-plan').onclick=()=>{openAppPage('planner');if(activePlanner())$('#planner-edit').click();};
 document.querySelector('nav [data-page=home]').addEventListener('click',()=>{renderCoachToday();renderCoachContext();});
 renderCoachContext();renderCoachToday();checkCoachConnection();
}
