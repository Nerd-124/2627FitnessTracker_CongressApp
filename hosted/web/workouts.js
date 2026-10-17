'use strict';
// Broad educational MET presets, not individually measured expenditure.
const workoutTypes = {
 swimming:{label:'Swimming',met:{light:5.8,moderate:8,vigorous:9.8}},
 basketball:{label:'Basketball',met:{light:4.5,moderate:6,vigorous:8}},
 cycling:{label:'Cycling',met:{light:4,moderate:6.8,vigorous:10}},
 strength:{label:'Strength training',met:{light:3,moderate:3.5,vigorous:6}},
 soccer:{label:'Soccer',met:{light:5,moderate:7,vigorous:10}},
 tennis:{label:'Tennis',met:{light:5,moderate:7.3,vigorous:8}},
 yoga:{label:'Yoga / stretching',met:{light:2,moderate:2.5,vigorous:4}},
 rowing:{label:'Rowing',met:{light:3.5,moderate:7,vigorous:8.5}},
 dancing:{label:'Dancing',met:{light:3,moderate:5,vigorous:7.3}},
 other:{label:'Other activity',met:null}
};
let workoutEditing=null;
function exerciseCanSave(){return !clearingData&&!recordsStale&&!document.body.classList.contains('session-paused');}
function workoutEstimate(sport,intensity,minutes,weight){
 const met=workoutTypes[sport]?.met?.[intensity];
 if(!Number.isFinite(met)||!Number.isFinite(minutes)||minutes<1||minutes>600||!Number.isFinite(weight)||weight<30||weight>300)return null;
 return Math.round(met*3.5*weight/200*minutes);
}
function typedWorkoutType(text){
 const value=String(text||'').trim().toLowerCase();
 const aliases={swim:'swimming',bike:'cycling',biking:'cycling',weights:'strength',yoga:'yoga',stretching:'yoga',dance:'dancing'};
 return aliases[value]||Object.keys(workoutTypes).find(key=>key!=='other'&&(key===value||workoutTypes[key].label.toLowerCase()===value))||'other';
}
function validateWorkout(values){
 const typedName=String(values.sport||'').trim();if(!typedName||typedName.length>60)throw Error('Type an activity name using 1–60 characters.');const sport=typedWorkoutType(typedName);
 if(!validSleepDate(values.date)||values.date>localDate())throw Error('Choose today or an earlier date.');
 const minutes=Number(values.minutes);if(!values.minutes||!Number.isFinite(minutes)||minutes<1||minutes>600)throw Error('Enter a duration from 1 to 600 minutes.');
 if(!['light','moderate','vigorous'].includes(values.intensity))throw Error('Choose an intensity.');
 const customName=(typedName.toLowerCase()==='other'&&values.customName?values.customName:typedName).trim();if(sport==='other'&&(!customName||customName.length>60))throw Error('Name your activity using up to 60 characters.');
 const distance=values.distance===''||values.distance==null?null:Number(values.distance);
 if(distance!==null&&(!Number.isFinite(distance)||distance<0||distance>500))throw Error('Distance must be from 0 to 500 km, or left blank.');
 const notes=(values.notes||'').trim();if(notes.length>2000)throw Error('Keep workout notes under 2,000 characters.');
 return {sport,date:values.date,minutes,intensity:values.intensity,customName:sport==='other'?customName:'',distance,notes};
}
function showExerciseTool(tool){
 if(tool==='workouts'&&runIsActive())pauseRun('GPS paused while you log another workout. Return to Outdoor GPS and Resume to continue.');
 $('#exercise-gps-panel').hidden=tool!=='gps';$('#exercise-workouts-panel').hidden=tool!=='workouts';
 for(const kind of ['gps','workouts']){const button=$('#exercise-show-'+kind);button.classList.toggle('active',kind===tool);button.setAttribute('aria-pressed',String(kind===tool));}
 if(tool==='gps')ensureRunnerMap();
}
function previewWorkout(){
 const form=$('#workout-form'),sport=typedWorkoutType(form.elements.sport.value);
 $('#workout-custom-label').hidden=true;form.elements.customName.required=false;
 $('#workout-estimate').disabled=sport==='other';
 const calories=workoutEstimate(sport,form.elements.intensity.value,Number(form.elements.minutes.value),Number(state.profile.weight));
 $('#workout-estimate-preview').textContent=!form.elements.sport.value.trim()?'Type an activity and duration to see available estimates.':sport==='other'?'Saved as a custom activity. No calorie estimate is invented.':!$('#workout-estimate').checked?'Minutes and details will be saved without calories.':calories===null?'Enter duration to preview estimated calories.':`About ${calories} kcal · ${Number(state.profile.weight)} kg profile weight · broad ${workoutTypes[sport].met[form.elements.intensity.value]} MET preset`;
}
function resetWorkoutForm(){
 workoutEditing=null;const form=$('#workout-form');form.reset();form.dataset.dirty='false';form.elements.date.value=localDate();
 $('#workout-cancel-edit').hidden=true;$('#workout-form-title').textContent='Log a workout';previewWorkout();
}
function editWorkout(record){
 if($('#workout-form').dataset.dirty==='true'&&!confirm('Discard unsaved workout changes?'))return;
 workoutEditing=record.id;
 const form=$('#workout-form');
 for(const key of ['sport','date','minutes','intensity','customName','distance','notes'])form.elements.namedItem(key).value=key==='sport'?workoutLabel(record):record[key]??'';
 $('#workout-estimate').checked=record.calories!==null;
 form.dataset.dirty='false';$('#workout-form-title').textContent='Edit your workout';$('#workout-cancel-edit').hidden=false;
 $('#workout-status').textContent='Editing this session. Save to replace it.';previewWorkout();showExerciseTool('workouts');form.scrollIntoView?.({behavior:'smooth',block:'start'});
}
function workoutLabel(record){return record.sport==='other'?record.customName:workoutTypes[record.sport]?.label||'Workout';}
function writeWorkoutList(next){
 if(!exerciseCanSave())throw Error('Reconnect or reload your account before saving.');
 const previous=state.workouts;state.workouts=next;
 try{localStorage.setItem(KEY,JSON.stringify(state));}catch{state.workouts=previous;throw Error('Not saved: browser storage is full or unavailable. Export your data and try again.');}
}
function exerciseDays(){
 const days=[];for(let i=6;i>=0;i--){const d=journalDayDate(localDate());d.setDate(d.getDate()-i);days.push(localDate(d));}return days;
}
function renderExerciseProgress(){
 const days=exerciseDays();
 const sessions=[...state.activities.map(r=>({date:r.date,minutes:Number(r.minutes),calories:r.result?.calories})),...state.workouts];
 const week=sessions.filter(r=>days.includes(r.date)&&Number.isFinite(r.minutes)&&r.minutes>0);
 const count=week.length,total=week.reduce((sum,r)=>sum+r.minutes,0),activeDays=new Set(week.map(r=>r.date)).size;
 const box=$('#exercise-summary');box.replaceChildren();
 for(const [label,value,note] of [['Sessions this week',count,'Saved exercise sessions'],['Minutes this week',Number(total.toFixed(1)),'Walks, runs, and other workouts'],['Active days',`${activeDays} / 7`,'Last 7 calendar days']]){
  const card=document.createElement('article');card.innerHTML=`<span>${label}</span><strong>${value}</strong><small>${note}</small>`;box.append(card);
 }
 const chart=$('#exercise-week-chart');chart.replaceChildren();
 const totals=days.map(date=>week.filter(r=>r.date===date).reduce((sum,r)=>sum+r.minutes,0));const max=Math.max(30,...totals);
 days.forEach((date,index)=>{
  const row=document.createElement('div');row.className='exercise-day-bar';row.setAttribute('role','listitem');row.setAttribute('aria-label',`${journalDateLabel(date)}: ${totals[index].toFixed(1)} minutes`);
  const label=document.createElement('span');label.textContent=journalDayDate(date).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
  const track=document.createElement('div');track.className='exercise-bar-track';const bar=document.createElement('i');bar.style.width=`${totals[index]/max*100}%`;track.append(bar);
  const value=document.createElement('strong');value.textContent=`${Number(totals[index].toFixed(1))} min`;row.append(label,track,value);chart.append(row);
 });
 const history=$('#workout-history');history.replaceChildren();const range=$('#workout-history-range').value;
 let start=null;if(range!=='all'){const d=journalDayDate(localDate());d.setDate(d.getDate()-Number(range)+1);start=localDate(d);}
 const records=[...state.workouts].filter(r=>!start||(r.date>=start&&r.date<=localDate())).sort((a,b)=>b.date.localeCompare(a.date));
 if(!records.length)history.innerHTML='<div class="workout-empty"><strong>Your next workout belongs here.</strong><p>Choose “Log another workout” to add swimming, basketball, or any activity you enjoy.</p></div>';
 for(const r of records){
  const card=document.createElement('article');card.className='record workout-record';
  const heading=document.createElement('div');heading.className='record-head';const name=document.createElement('strong');name.textContent=`${workoutLabel(r)} · ${r.date}`;
  const actions=document.createElement('span');const edit=document.createElement('button');edit.type='button';edit.className='text-button';edit.textContent='Edit';edit.onclick=()=>editWorkout(r);
  const remove=document.createElement('button');remove.type='button';remove.className='text-button';remove.textContent='Remove';remove.onclick=()=>{
   if(!confirm(`Remove ${workoutLabel(r)} on ${r.date}?`))return;
   try{writeWorkoutList(state.workouts.filter(item=>item.id!==r.id));if(workoutEditing===r.id)resetWorkoutForm();renderExerciseProgress();$('#workout-status').textContent='Workout removed.';}catch(error){$('#workout-status').textContent=error.message;}
  };
  actions.append(edit,remove);heading.append(name,actions);
  const details=document.createElement('p');details.textContent=`${r.minutes} min · ${r.intensity} effort${r.distance!==null?' · '+r.distance+' km':''} · ${r.calories==null?'Calories not estimated':r.calories+' estimated kcal'}`;
  card.append(heading,details);
  if(r.notes){const notes=document.createElement('p');notes.textContent=r.notes;card.append(notes);}
  if(r.calories!==null){const note=document.createElement('p');note.className='note';note.textContent=`Estimate uses ${r.met} MET and ${r.weight} kg at the time of saving.`;card.append(note);}
  history.append(card);
 }
}
function initializeWorkouts(){
 const form=$('#workout-form');
 // Activity is a free-text input; no dropdown limits what can be recorded.
 form.elements.date.max=localDate();
 $('#exercise-show-gps').onclick=()=>showExerciseTool('gps');$('#exercise-show-workouts').onclick=()=>showExerciseTool('workouts');
 form.addEventListener('input',()=>{form.dataset.dirty='true';previewWorkout();});form.addEventListener('change',previewWorkout);
 form.onsubmit=e=>{
  e.preventDefault();try{
   if(!form.reportValidity())return;
   const values=validateWorkout(Object.fromEntries(new FormData(form))),weight=Number(state.profile.weight);
   const met=$('#workout-estimate').checked?workoutTypes[values.sport].met?.[values.intensity]??null:null;
   const calories=met===null?null:workoutEstimate(values.sport,values.intensity,values.minutes,weight);
   const previous=state.workouts.find(r=>r.id===workoutEditing),id=workoutEditing||crypto.randomUUID();
   const record={...values,id,weight,met,calories,source:'manual-workout',createdAt:previous?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
   writeWorkoutList([...state.workouts.filter(r=>r.id!==id),record]);
   resetWorkoutForm();form.dataset.dirty='false';renderExerciseProgress();$('#workout-status').textContent=`Saved ${workoutLabel(record)} · ${record.minutes} minutes. Your weekly progress is updated.`;toast('Workout saved.');
  }catch(error){$('#workout-status').textContent=error.message;}
 };
 $('#workout-cancel-edit').onclick=()=>{if(form.dataset.dirty==='true'&&!confirm('Discard unsaved workout changes?'))return;resetWorkoutForm();form.dataset.dirty='false';$('#workout-status').textContent='Editing cancelled.';};
 $('#workout-history-range').onchange=renderExerciseProgress;
 const previous=renderSessions;renderSessions=function(){previous();renderExerciseProgress();};
 resetWorkoutForm();renderExerciseProgress();
}
