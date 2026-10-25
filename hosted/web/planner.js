'use strict';
let plannerDraft=null, plannerViewStart=null;
const plannerWeekdays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const plannerClone=value=>JSON.parse(JSON.stringify(value));
function plannerDateAdd(date,days){const d=journalDayDate(date);d.setDate(d.getDate()+days);return localDate(d);}
function plannerDayNumber(date){const [y,m,d]=date.split('-').map(Number);return Date.UTC(y,m-1,d)/86400000;}
function plannerPeriodEnd(start,horizon,custom){
 if(!validSleepDate(start))throw Error('Choose a valid start date.');
 if(horizon==='custom')return custom;
 if(horizon==='week')return plannerDateAdd(start,6);
 if(!['month','year'].includes(horizon))throw Error('Choose a plan length.');
 const date=journalDayDate(start),day=date.getDate();date.setDate(1);
 date.setMonth(date.getMonth()+(horizon==='month'?1:12));
 const last=new Date(date.getFullYear(),date.getMonth()+1,0,12).getDate();date.setDate(Math.min(day,last));
 return plannerDateAdd(localDate(date),-1);
}
function validatePlannerSettings(raw){
 const title=String(raw.title||'').trim(),goal=String(raw.goal||'').trim();
 if(!title||title.length>80)throw Error('Use a plan name from 1 to 80 characters.');
 if(!goal||goal.length>500)throw Error('Write your goal using up to 500 characters.');
 const end=plannerPeriodEnd(raw.start,raw.horizon,raw.end);
 if(!validSleepDate(end)||end<raw.start||plannerDayNumber(end)-plannerDayNumber(raw.start)>365)throw Error('Choose a period from 1 to 366 days, with the end after the start.');
 const budget=Number(raw.budget);if(!Number.isFinite(budget)||budget<5||budget>180)throw Error('Choose 5–180 minutes available for movement.');
 const movementGoal=raw.movementGoal===''||raw.movementGoal==null?null:Number(raw.movementGoal);
 if(movementGoal!==null&&(!Number.isFinite(movementGoal)||movementGoal<0||movementGoal>1260))throw Error('Weekly movement goal must be 0–1,260 minutes or blank.');
 const focus=[...new Set(raw.focus||[])].filter(x=>['move','rest','food'].includes(x));
 const days=[...new Set((raw.days||[]).map(Number))].filter(x=>Number.isInteger(x)&&x>=0&&x<=6);
 if(focus.includes('move')&&!days.length)throw Error('Choose at least one available day for movement.');
 const activity=String(raw.activity||'').trim(),notes=String(raw.notes||'').trim();
 if(activity.length>60||notes.length>1000)throw Error('Keep activity names under 60 and reminders under 1,000 characters.');
 return {title,goal,horizon:raw.horizon,start:raw.start,end,budget,movementGoal,focus,days,activity,notes};
}
function plannerCurrentStatus(today=localDate()){
 const since=plannerDateAdd(today,-13),weekStart=plannerDateAdd(today,-6);
 const recent=state.records.filter(r=>validSleepDate(r.date)&&r.date>=since&&r.date<=today);
 const sleep=recent.map(r=>nightDuration(r.bed,r.wake)).filter(x=>x!==null);
 const base=state.baselineHabits||{};
 const byDate=new Map(),recordedDays=new Set();
 for(const row of [...state.activities,...state.workouts])if(validSleepDate(row.date)&&row.date>=weekStart&&row.date<=today&&Number.isFinite(Number(row.minutes))&&Number(row.minutes)>=0){byDate.set(row.date,(byDate.get(row.date)||0)+Number(row.minutes));recordedDays.add(row.date);}
 for(const row of recent)if(row.date>=weekStart&&row.duration!==''&&row.duration!=null&&Number.isFinite(Number(row.duration))&&Number(row.duration)>=0){byDate.set(row.date,Math.max(byDate.get(row.date)||0,Number(row.duration)));recordedDays.add(row.date);}
 const recordedMinutes=[...byDate.values()].reduce((a,b)=>a+b,0);
 const baselineMovement=Number.isFinite(Number(base.exercise))&&base.exercise!=null?Number(base.exercise):null;
 return {sleepAverage:sleep.length>=3?sleep.reduce((a,b)=>a+b,0)/sleep.length:null,sleepNights:sleep.length,baselineSleep:Number.isFinite(Number(base.sleep))&&base.sleep!=null?Number(base.sleep):null,baselineMovement,movement:recordedDays.size>=5?recordedMinutes:baselineMovement,recordedMinutes,movementDays:recordedDays.size,baselinePlants:Number.isFinite(Number(base.plants))&&base.plants!=null?Number(base.plants):null};
}
function suggestPlanner(settings,today=localDate()){
 const facts=plannerCurrentStatus(today),tasks=[],reasons=[];
 const task=(title,category,schedule,days,minutes=null)=>({id:crypto.randomUUID(),title,category,schedule,days:[...days],date:settings.start,minutes});
 reasons.push(`Suggestions prepared on ${today}. Your goal: ${settings.goal}`);
 if(facts.movementDays)reasons.push(`${Math.round(facts.recordedMinutes)} movement minutes recorded across ${facts.movementDays} of the last 7 days. For each date, the larger of journal minutes or saved workout minutes is used to limit double counting; missing days are unknown.`);
 if(settings.focus.includes('move')){
  const base=Math.max(0,facts.movement??0);
  const target=settings.movementGoal??Math.min(150,Math.max(30,base+30));
  const step=Math.min(target,base+30);
  const movementDays=settings.days.slice(0,Math.min(settings.days.length,Math.max(1,Math.floor(step))));
  const minutes=Math.min(settings.budget,Math.max(1,Math.floor(step/Math.max(1,movementDays.length))));
  if(target>0){tasks.push(task(settings.activity||'Comfortable movement you choose','move','weekly',movementDays,minutes));
   reasons.push(`${facts.movementDays>=5?'Recent recorded movement':'Your saved starting routine'} ${facts.movement!==null?'is '+Math.round(base)+' min/week':'is not available, so this starts gently'}. The draft schedules ${minutes} minutes on ${movementDays.length} chosen days (${minutes*movementDays.length} min/week), within your ${settings.budget}-minute daily budget. Your ${settings.movementGoal===null?'suggested starting':'chosen'} weekly goal is ${target} minutes; these selected sessions may not cover it fully.`);
  }else reasons.push('You chose a zero-minute movement goal, so no exercise sessions were added. You can add a different action yourself.');
 }
 if(settings.focus.includes('rest')){
  const current=facts.sleepAverage??facts.baselineSleep;
  tasks.push(task('Wind down before bed','rest','daily',[],15));
  reasons.push(facts.sleepAverage!==null?`Your last 14 days include ${facts.sleepNights} recorded nights, averaging ${facts.sleepAverage.toFixed(1)} hours in bed. A consistent wind-down is suggested; time in bed is not measured sleep.`:current!==null?`Your saved routine lists ${current} hours per night. With fewer than 3 recent nights, the planner does not infer a new sleep trend.`:'No recent sleep schedule is available. The plan starts with a simple wind-down; log nights to add context.');
 }
 if(settings.focus.includes('food')){
  tasks.push(task('Include a fruit or vegetable you enjoy with a meal','food','daily',[]));
  reasons.push(facts.baselinePlants!==null?`Your starting routine lists ${facts.baselinePlants} fruit/vegetable servings per day. This suggestion supports variety without setting a calorie or weight target.`:'Meal descriptions do not establish nutrient intake. A simple variety-focused action is suggested without guessing a diet score.');
 }
 tasks.push(task('Review what worked and adjust the coming week','custom','weekly',[journalDayDate(plannerDateAdd(settings.start,6)).getDay()],5));
 reasons.push('Weekly review keeps the routine editable. Longer plans repeat these actions without automatically increasing intensity. Your written preferences are reminders; review each action to fit your situation.');
 if(settings.notes)reasons.push('Your reminders: '+settings.notes);
 return {id:crypto.randomUUID(),...settings,tasks,reasons,checkins:{},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
}
function plannerTaskScheduled(task,date,plan){
 if(date<plan.start||date>plan.end)return false;
 return task.schedule==='daily'||task.schedule==='once'&&task.date===date||task.schedule==='weekly'&&task.days.includes(journalDayDate(date).getDay());
}
function validatePlannerTask(raw,plan){
 const title=String(raw.title||'').trim();if(!title||title.length>160)throw Error('Each action needs a title from 1 to 160 characters.');
 if(!['daily','weekly','once'].includes(raw.schedule))throw Error('Choose daily, weekly, or one-time repetition.');
 const days=[...new Set((raw.days||[]).map(Number))].filter(x=>Number.isInteger(x)&&x>=0&&x<=6);
 if(raw.schedule==='weekly'&&!days.length)throw Error('Choose at least one weekday for each weekly action.');
 if(raw.schedule==='once'&&(!validSleepDate(raw.date)||raw.date<plan.start||raw.date>plan.end))throw Error('One-time actions need a date inside your plan.');
 const minutes=raw.minutes===''||raw.minutes==null?null:Number(raw.minutes);if(minutes!==null&&(!Number.isFinite(minutes)||minutes<1||minutes>180))throw Error('Optional action duration must be 1–180 minutes.');
 return {...raw,id:raw.id||crypto.randomUUID(),title,schedule:raw.schedule,days,minutes,category:['move','rest','food','custom'].includes(raw.category)?raw.category:'custom'};
}
function savePlannerState(plans,activeId){
 if(!exerciseCanSave())throw Error('Reconnect or reload your account before saving your plan.');
 const previous=state.plans,id=state.plannerActiveId;state.plans=plans;state.plannerActiveId=activeId;
 try{localStorage.setItem(KEY,JSON.stringify(state));}catch{state.plans=previous;state.plannerActiveId=id;throw Error('Not saved: browser storage is full or unavailable. Export your data, then try again.');}
}
function activePlanner(){return state.plans.find(p=>p.id===state.plannerActiveId)||state.plans[0]||null;}
function plannerReasons(target,reasons){target.replaceChildren();for(const reason of reasons){const p=document.createElement('p');p.textContent=reason;target.append(p);}}
function plannerReadForm(){const form=$('#planner-form'),data=Object.fromEntries(new FormData(form));data.focus=[...form.querySelectorAll('[name=focus]:checked')].map(i=>i.value);data.days=[...form.querySelectorAll('[name=days]:checked')].map(i=>Number(i.value));return validatePlannerSettings(data);}
function plannerFillForm(settings=null){
 const form=$('#planner-form');form.reset();
 form.elements.title.value=settings?.title||'My next chapter';form.elements.goal.value=settings?.goal||'';form.elements.start.value=settings?.start||localDate();
 for(const key of ['horizon','end','budget','movementGoal','activity','notes'])if(settings?.[key]!=null)form.elements.namedItem(key).value=settings[key];
 form.querySelectorAll('[name=focus]').forEach(i=>i.checked=settings?settings.focus.includes(i.value):['move','rest'].includes(i.value));
 form.querySelectorAll('[name=days]').forEach(i=>i.checked=(settings?.days||[1,3,5]).includes(Number(i.value)));
 plannerEndControl();
}
function plannerEndControl(){const custom=$('#planner-horizon').value==='custom';$('#planner-end-label').hidden=!custom;$('#planner-form [name=end]').required=custom;}
function plannerSyncTaskEditors(){
 if(!plannerDraft)return;
 plannerDraft.tasks=[...$('#planner-task-editors').querySelectorAll('.planner-task-editor')].map(box=>{
  const read=name=>box.querySelector(`[name=${name}]`).value;
  return {id:box.dataset.id,title:read('title'),category:read('category'),schedule:read('schedule'),date:read('date'),minutes:read('minutes'),days:[...box.querySelectorAll('[name=days]:checked')].map(i=>Number(i.value))};
 });
}
function plannerRenderEditors(){
 const box=$('#planner-task-editors');box.replaceChildren();
 for(const [index,task]of plannerDraft.tasks.entries()){
  const el=document.createElement('div');el.className='planner-task-editor';el.dataset.id=task.id;
  el.innerHTML='<div class="panel-heading"><strong></strong><button class="text-button" type="button" data-remove>Remove action</button></div><label>Action<input name="title" maxlength="160" required placeholder="What would you like to do?"></label><div class="field-grid"><label>Repeats<select name="schedule"><option value="weekly">Weekly, on selected days</option><option value="daily">Every day</option><option value="once">Once, on a date</option></select></label><label>Category<select name="category"><option value="move">Movement</option><option value="rest">Rest</option><option value="food">Meals</option><option value="custom">My own action</option></select></label><label>Minutes (optional)<input name="minutes" type="number" min="1" max="180"></label></div><div class="planner-day-options" data-days></div><label data-date>Action date<input name="date" type="date"></label>';
  el.querySelector('strong').textContent='Action '+(index+1);
  for(const key of ['title','schedule','category','minutes','date'])el.querySelector(`[name=${key}]`).value=task[key]??'';
  const date=el.querySelector('[name=date]');date.min=plannerDraft.start;date.max=plannerDraft.end;
  plannerWeekdays.forEach((day,i)=>{const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.name='days';input.value=i;input.checked=task.days.includes(i);label.append(input,document.createTextNode(day));el.querySelector('[data-days]').append(label);});
  const schedule=()=>{el.querySelector('[data-days]').hidden=el.querySelector('[name=schedule]').value!=='weekly';el.querySelector('[data-date]').hidden=el.querySelector('[name=schedule]').value!=='once';};
  el.querySelector('[name=schedule]').onchange=schedule;schedule();
  el.querySelector('[data-remove]').onclick=()=>{plannerSyncTaskEditors();plannerDraft.tasks=plannerDraft.tasks.filter(t=>t.id!==task.id);plannerRenderEditors();};
  box.append(el);
 }
 $('#planner-add-task').disabled=plannerDraft.tasks.length>=15;
}
function plannerShowDraft(){
 $('#planner-builder').hidden=true;$('#planner-active').hidden=true;$('#planner-draft').hidden=false;
 plannerReasons($('#planner-draft-reasons'),plannerDraft.reasons);plannerRenderEditors();
 $('#planner-draft').scrollIntoView?.({behavior:'smooth',block:'start'});
}
function plannerInitialView(plan){const today=localDate();return today<plan.start?plan.start:today>plan.end?(plannerDateAdd(plan.end,-6)<plan.start?plan.start:plannerDateAdd(plan.end,-6)):today;}
function plannerCheckin(plan,task,date,checked){
 if(date>localDate())throw Error('Check in on or after the action date.');
 if(!plannerTaskScheduled(task,date,plan))throw Error('This action is not scheduled for that date.');
 const updated=plannerClone(plan),key=date+':'+task.id;updated.autoCheckins=updated.autoCheckins||{};updated.autoDismissed=updated.autoDismissed||{};delete updated.autoCheckins[key];if(checked)delete updated.autoDismissed[key];else updated.autoDismissed[key]=true;if(checked)updated.checkins[key]=new Date().toISOString();else delete updated.checkins[key];
 updated.updatedAt=new Date().toISOString();savePlannerState(state.plans.map(p=>p.id===plan.id?updated:p),plan.id);renderPlanner();
}
function renderPlanner(){
 if(!$('#planner-select'))return;
 const plan=activePlanner(),selector=$('#planner-select');selector.replaceChildren();
 for(const p of state.plans){const opt=document.createElement('option');opt.value=p.id;opt.textContent=p.title+' · '+p.start;selector.append(opt);}
 if(plan)selector.value=plan.id;
 $('#planner-saved-controls').hidden=!state.plans.length;$('#planner-active').hidden=!plan||!!plannerDraft;
 if(typeof renderCoachToday==='function')renderCoachToday();
 if(!plan)return;
 $('#planner-name').textContent=plan.title;$('#planner-goal').textContent=plan.goal;$('#planner-period').textContent=plan.start+' → '+plan.end;
 plannerReasons($('#planner-active-reasons'),plan.reasons);
 let due=0,completed=0;
 for(let date=plan.start;date<=plan.end&&date<=localDate();date=plannerDateAdd(date,1))for(const task of plan.tasks)if(plannerTaskScheduled(task,date,plan)){due++;if(plan.checkins[date+':'+task.id])completed++;}
 $('#planner-progress').textContent=due?`${completed} of ${due} scheduled actions through today checked off. Future actions are not counted.`:'Your plan starts in the future. Check-ins will be available on each action’s date.';
 if(!plannerViewStart||plannerViewStart<plan.start||plannerViewStart>plan.end)plannerViewStart=plannerInitialView(plan);
 const last=plannerDateAdd(plannerViewStart,6)>plan.end?plan.end:plannerDateAdd(plannerViewStart,6);
 $('#planner-week-title').textContent=plannerViewStart+' → '+last;
 $('#planner-prev').disabled=plannerViewStart<=plan.start;$('#planner-next').disabled=last>=plan.end;
 const box=$('#planner-days');box.replaceChildren();
 for(let date=plannerViewStart;date<=last;date=plannerDateAdd(date,1)){
  const day=document.createElement('article');day.className='planner-day'+(date===localDate()?' is-today':'');
  const title=document.createElement('h3');title.textContent=journalDateLabel(date);day.append(title);
  const tasks=plan.tasks.filter(task=>plannerTaskScheduled(task,date,plan));
  if(!tasks.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='No actions planned. Make room for rest.';day.append(empty);}
  for(const task of tasks){
   const label=document.createElement('label');label.className='planner-checkin';
   const input=document.createElement('input');input.type='checkbox';input.checked=!!plan.checkins[date+':'+task.id];input.disabled=date>localDate();input.setAttribute('aria-label',`${task.title}, ${date}`);
   const text=document.createElement('span');text.textContent=task.title;label.append(input,text);
   if(task.minutes){const small=document.createElement('small');small.textContent=task.minutes+' min'+(plan.autoCheckins?.[date+':'+task.id]?' · Recorded':'');label.append(small);}
   const actionDate=date;input.onchange=()=>{try{plannerCheckin(plan,task,actionDate,input.checked);}catch(error){input.checked=!input.checked;$('#planner-status').textContent=error.message;}};
   day.append(label);
  }
  box.append(day);
 }
}
function initializePlanner(){
 const available=$('#planner-available-days');plannerWeekdays.forEach((day,i)=>{const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.name='days';input.value=i;label.append(input,document.createTextNode(day));available.append(label);});
 plannerFillForm();$('#planner-horizon').onchange=plannerEndControl;
 $('#planner-builder').hidden=!!activePlanner();
 $('#planner-form').onsubmit=event=>{event.preventDefault();try{
  if(!event.target.reportValidity())return;
  const settings=plannerReadForm(),oldId=plannerDraft?.id,old=state.plans.find(p=>p.id===oldId);
  const generated=suggestPlanner(settings);if(old){generated.id=old.id;generated.createdAt=old.createdAt;generated.checkins=plannerClone(old.checkins);}
  plannerDraft=generated;plannerShowDraft();$('#planner-status').textContent='Review these suggestions. Your saved plan is unchanged until you save.';
 }catch(error){$('#planner-status').textContent=error.message;}};
 $('#planner-add-task').onclick=()=>{plannerSyncTaskEditors();if(plannerDraft.tasks.length>=15)return;plannerDraft.tasks.push({id:crypto.randomUUID(),title:'',category:'custom',schedule:'once',days:[...plannerDraft.days],date:plannerDraft.start,minutes:null});plannerRenderEditors();};
 $('#planner-save').onclick=()=>{try{
  if(!plannerDraft)return;plannerSyncTaskEditors();
  if(!plannerDraft.tasks.length||plannerDraft.tasks.length>15)throw Error('Add 1–15 actions before saving your plan.');
  const plan=plannerClone(plannerDraft);plan.tasks=plan.tasks.map(t=>validatePlannerTask(t,plan));
  const ids=new Set(plan.tasks.map(t=>t.id));plan.checkins=Object.fromEntries(Object.entries(plan.checkins).filter(([key])=>{const date=key.slice(0,10),id=key.slice(11),task=plan.tasks.find(t=>t.id===id);return ids.has(id)&&plannerTaskScheduled(task,date,plan);}));
  plan.updatedAt=new Date().toISOString();if(state.plans.length>=20&&!state.plans.some(p=>p.id===plan.id))throw Error('This browser keeps up to 20 plans. Delete an older plan or edit an existing one.');
  const old=state.plans.find(p=>p.id===plan.id),lost=old?Object.keys(old.checkins).length-Object.keys(plan.checkins).length:0;
  if(lost>0&&!confirm(`These schedule changes remove ${lost} check-ins for replaced or unscheduled actions. Save these changes?`))return;
  savePlannerState([...state.plans.filter(p=>p.id!==plan.id),plan],plan.id);
  syncPlannerExercise();plannerDraft=null;plannerViewStart=plannerInitialView(plan);$('#planner-draft').hidden=true;$('#planner-builder').hidden=true;renderPlanner();$('#planner-status').textContent='Your plan is saved. Edit it whenever life changes.';$('#planner-active').scrollIntoView?.({behavior:'smooth',block:'start'});
 }catch(error){$('#planner-status').textContent=error.message;}};
 $('#planner-draft-cancel').onclick=()=>$('#planner-cancel').click();
 $('#planner-keep-actions').onclick=()=>{try{if(!plannerDraft)return;const settings=plannerReadForm();plannerDraft={...plannerDraft,...settings};plannerDraft.reasons.push('Plan goals or dates were edited on '+localDate()+'. Actions were kept for your review.');plannerShowDraft();$('#planner-status').textContent='Goals updated in your draft. Review actions and save when ready.';}catch(error){$('#planner-status').textContent=error.message;}};
 $('#planner-new').onclick=()=>{if(plannerDraft&&!confirm('Discard this unsaved draft and start a new plan?'))return;plannerDraft=null;plannerFillForm();$('#planner-keep-actions').hidden=true;$('#planner-builder').hidden=false;$('#planner-draft').hidden=true;$('#planner-active').hidden=true;$('#planner-cancel').hidden=!state.plans.length;$('#planner-status').textContent='';};
 $('#planner-edit').onclick=()=>{const plan=activePlanner();if(!plan)return;plannerDraft=plannerClone(plan);plannerFillForm(plan);$('#planner-keep-actions').hidden=false;$('#planner-cancel').hidden=false;plannerShowDraft();};
 $('#planner-back').onclick=()=>{plannerSyncTaskEditors();$('#planner-keep-actions').hidden=false;$('#planner-builder').hidden=false;$('#planner-draft').hidden=true;$('#planner-cancel').hidden=!state.plans.length;};
 $('#planner-cancel').onclick=()=>{plannerDraft=null;$('#planner-builder').hidden=!!activePlanner();$('#planner-draft').hidden=true;renderPlanner();$('#planner-status').textContent='Unsaved changes discarded.';};
 $('#planner-select').onchange=()=>{try{if(plannerDraft&&!confirm('Discard unsaved changes and switch plans?')){$('#planner-select').value=activePlanner()?.id||'';return;}savePlannerState(state.plans,$('#planner-select').value);syncPlannerExercise();plannerDraft=null;plannerViewStart=null;$('#planner-builder').hidden=true;$('#planner-draft').hidden=true;renderPlanner();}catch(error){$('#planner-status').textContent=error.message;}};
 $('#planner-delete').onclick=()=>{const plan=activePlanner();if(!plan||!confirm(`Delete ${plan.title} and its check-ins? Your journal and exercise records will be kept.`))return;try{const plans=state.plans.filter(p=>p.id!==plan.id);savePlannerState(plans,plans[0]?.id||null);plannerDraft=null;plannerViewStart=null;$('#planner-builder').hidden=!!plans.length;$('#planner-draft').hidden=true;renderPlanner();$('#planner-status').textContent='Plan deleted. Other health records were kept.';}catch(error){$('#planner-status').textContent=error.message;}};
 $('#planner-prev').onclick=()=>{const plan=activePlanner();plannerViewStart=plannerDateAdd(plannerViewStart,-7);if(plannerViewStart<plan.start)plannerViewStart=plan.start;renderPlanner();};
 $('#planner-next').onclick=()=>{plannerViewStart=plannerDateAdd(plannerViewStart,7);renderPlanner();};
 $('#planner-today').onclick=()=>{plannerViewStart=plannerInitialView(activePlanner());renderPlanner();};
 syncPlannerExercise();renderPlanner();
}

// Automatic check-ins retain provenance so deleting/discarding evidence can undo
// an automatic completion without touching deliberate manual check-ins.
let plannerExerciseSyncing=false;
function plannerExerciseKind(title){
 const text=String(title||'').toLowerCase();
 if(/\b(run|running|jog|jogging)\b/.test(text))return 'running';
 if(/\b(swim|swimming)\b/.test(text))return 'swimming';
 if(/\bbasketball\b/.test(text))return 'basketball';
 if(/\b(cycling|cycle|bike|biking)\b/.test(text))return 'cycling';
 if(/\b(strength|bodyweight|weightlifting|weights)\b/.test(text))return 'strength';
 if(/\b(yoga|mobility|stretch|stretching)\b/.test(text))return 'yoga';
 if(/\b(dance|dancing)\b/.test(text))return 'dancing';
 if(/\b(walk|walking|hike|hiking)\b/.test(text))return 'walking';
 return null;
}
function plannerExerciseRequirement(task){
 if(task.category!=='move')return null;
 const title=String(task.title||'');
 // These need verification beyond the tracker, so leave them to manual check-in.
 if(/\b(under|faster than|pace|bpm|heart rate|reps|sets|continuous|without stopping)\b|\d\s*[:/x×]\s*\d/.test(title))return null;
 const kind=plannerExerciseKind(title);if(!kind)return null;
 let minutes=Number(task.minutes)||0;
 if(!minutes){const match=title.match(/\b(\d+(?:\.\d+)?)\s*(?:min|minutes?)\b/i);if(match)minutes=Number(match[1]);}
 const distance=title.match(/\b(\d+(?:\.\d+)?)\s*(km|k|kilometers?|kilometres?|miles?|mi|meters?|metres?)\b/i);
 const meters=distance?Number(distance[1])*(/^(k|kilo)/i.test(distance[2])?1000:/^(mi)/i.test(distance[2])?RunMath.mile:1):0;
 if(!minutes&&!meters)return null;
 return {kind,minutes,meters};
}
function plannerExerciseEvidence(){
 const map=new Map();
 for(const s of [...state.activities,...state.workouts]){
  const kind=s.mode?(s.mode==='run'?'running':'walking'):plannerExerciseKind(s.sport==='other'?s.customName:s.sport);
  if(!kind||!validSleepDate(s.date)||s.date>localDate()||!Number.isFinite(Number(s.minutes))||Number(s.minutes)<=0)continue;
  const meters=s.mode?(s.route?.length>1?RunMath.analyze(s.route).distance:Number(s.result?.distance||0)*1000):Number(s.distance||0)*1000;
  map.set(s.id,{id:s.id,date:s.date,kind,minutes:Number(s.minutes),meters:Math.max(0,meters||0),live:false});
 }
 if(activeRun?.points?.length){
  const analysis=runAnalysis||RunMath.analyze(activeRun.points,currentRunSeconds());
  // A running timer without a measured route is not evidence of a run.
  if(analysis.distance>=10&&currentRunSeconds()>0&&!map.has(activeRun.id))map.set(activeRun.id,{id:activeRun.id,date:activeRun.date,kind:activeRun.mode==='run'?'running':'walking',minutes:currentRunSeconds()/60,meters:analysis.distance,live:true});
 }
 return [...map.values()];
}
function syncPlannerExercise(){
 // My Plan is retired. Historical plans stay in local storage without updates.
 if(!$('#planner'))return;
 if(plannerExerciseSyncing||!state.plans.length||!exerciseCanSave())return;
 plannerExerciseSyncing=true;
 try{
  const current=activePlanner(),evidence=plannerExerciseEvidence();let changed=false,liveCompleted=false;
  const plans=state.plans.map(original=>{
   const plan=plannerClone(original);plan.autoCheckins=plan.autoCheckins||{};plan.autoDismissed=plan.autoDismissed||{};
   const candidates=new Map();
   const dates=new Set([...evidence.map(e=>e.date),...Object.keys(plan.autoCheckins).map(k=>k.slice(0,10))]);
   for(const date of dates){
    if(date>localDate()||date<plan.start||date>plan.end)continue;
    const pools=new Map();
    for(const entry of evidence.filter(e=>e.date===date)){
     if(!pools.has(entry.kind))pools.set(entry.kind,{minutes:0,meters:0,ids:[],live:false});
     const pool=pools.get(entry.kind);pool.minutes+=entry.minutes;pool.meters+=entry.meters;pool.ids.push(entry.id);pool.live||=entry.live;
    }
    for(const task of plan.tasks){
     const key=date+':'+task.id;
     if(!plannerTaskScheduled(task,date,plan)||plan.autoDismissed[key]||(plan.checkins[key]&&!plan.autoCheckins[key]))continue;
     const requirement=plannerExerciseRequirement(task);if(!requirement)continue;
     const pool=pools.get(requirement.kind);if(!pool)continue;
     const enough=pool.minutes+1e-8>=requirement.minutes&&pool.meters+1e-5>=requirement.meters;
     if(enough&&(plan.id===current?.id||plan.autoCheckins[key])){
      candidates.set(key,{sessionIds:[...pool.ids].sort(),kind:requirement.kind,minutes:requirement.minutes,meters:requirement.meters});
      if(pool.live&&plan.id===current?.id&&date===localDate())liveCompleted=true;
     }
     // Reserve this task's share before another task of the same kind.
     const share=Math.min(1,Math.max(requirement.minutes?requirement.minutes/Math.max(pool.minutes,1e-9):0,requirement.meters?requirement.meters/Math.max(pool.meters,1e-9):0));
     pool.minutes*=1-share;pool.meters*=1-share;
    }
   }
   for(const key of Object.keys(plan.autoCheckins))if(!candidates.has(key)){
    delete plan.autoCheckins[key];delete plan.checkins[key];changed=true;
   }
   for(const [key,match]of candidates){
    if(!plan.checkins[key]){plan.checkins[key]=new Date().toISOString();changed=true;}
    if(JSON.stringify(plan.autoCheckins[key])!==JSON.stringify(match)){plan.autoCheckins[key]=match;changed=true;}
   }
   return plan;
  });
  const notice=$('#run-plan-progress');
  if(notice){notice.hidden=!activeRun||!liveCompleted;notice.textContent='✓ Today’s matching plan task is complete';}
  if(changed){savePlannerState(plans,state.plannerActiveId);renderPlanner();}
 }catch(error){
  const notice=$('#run-plan-progress');if(notice){notice.hidden=false;notice.textContent='Plan check-off could not be saved. Your run can continue.';}
 }finally{plannerExerciseSyncing=false;}
}
