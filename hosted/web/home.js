'use strict';
let returnToRoutine=false;
function localDate(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function refreshHome(){renderFutureSelf();}
function refreshScenario(){renderFutureSelf();}
function fillRoutineForm(){const form=$('#home-routine-form');form.reset();const values={...state.baselineRecord,...state.baselineHabits,...state.futureSelf?.factors,age:state.profile.age,personalGoals:state.profile.personalGoals,lifeGoal:state.profile.lifeGoal,goalFocus:state.profile.goalFocus==='wellbeing'?'mental':state.profile.goalFocus||'auto',accessibilityNeeds:state.profile.accessibilityNeeds,challengePreference:state.profile.challengePreference};for(const [key,value]of Object.entries(values)){const input=form.elements.namedItem(key);if(input){if(input.type==='checkbox')input.checked=value===true;else input.value=value??(input.tagName==='SELECT'?input.options[0].value:'');}}}
function openRoutine(){if($('#account-dialog').open)$('#account-dialog').close();fillRoutineForm();$('#home-routine-status').textContent='';if(!$('#routine-dialog').open)$('#routine-dialog').showModal();}
function finishRoutinePrompt(){state.routinePromptSeen=true;save();$('#routine-dialog').close();}
function maybeShowRoutinePrompt(){if(!state.routinePromptSeen&&!$('#routine-dialog').open&&!document.body.classList.contains('session-paused')&&!$('#account-dialog').open&&!document.body.classList.contains('setting-up'))openRoutine();}
function initializeHome(){
 document.querySelector('nav [data-page="home"]').addEventListener('click',()=>{refreshHome();renderJournal();});
 const form=$('#home-routine-form');fillRoutineForm();
 $('#routine-later').onclick=finishRoutinePrompt;$('#routine-close').onclick=finishRoutinePrompt;
 $('#routine-dialog').addEventListener('cancel',event=>{event.preventDefault();finishRoutinePrompt();});
 $('#account-routine').onclick=openRoutine;
 form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;const v=Object.fromEntries(new FormData(form));if(Boolean(v.bed)!==Boolean(v.wake)){$('#home-routine-status').textContent='Enter both bedtime and wake-up, or leave both blank.';return;}
 if(v.bed&&v.bed===v.wake){$('#home-routine-status').textContent='Use different bedtime and wake-up times, or leave both blank.';return;}
 const optional=key=>v[key]==null||v[key]===''?null:Number(v[key]);const hours=sleepHours(v.bed,v.wake);
 const previous={profile:state.profile,baselineHabits:state.baselineHabits,habits:state.habits,baselineRecord:state.baselineRecord,futureSelf:state.futureSelf,nutrition:state.nutrition,onboardingComplete:state.onboardingComplete,routinePromptSeen:state.routinePromptSeen};
 state.profile={...state.profile,age:optional('age'),personalGoals:v.personalGoals.trim(),lifeGoal:v.lifeGoal.trim(),goalFocus:v.goalFocus,accessibilityNeeds:v.accessibilityNeeds.trim(),challengePreference:v.challengePreference};
 if(state.profile.age===null)state.onboardingComplete=false;
 state.baselineHabits={exercise:optional('exercise'),sleep:hours,movementIntensity:v.movementIntensity,sleepRegularity:v.sleepRegularity};state.habits={...state.baselineHabits};state.baselineRecord={...state.baselineRecord,bed:v.bed,wake:v.wake};
 const config=futureSelfSettings();config.factors={...config.factors,stress:optional('stress'),rested:optional('rested'),energy:optional('energy'),dailyActivities:v.dailyActivities,smoking:v.smoking??config.factors.smoking};delete config.factors.breaks;
 state.routinePromptSeen=true;save();let stored=false;try{const saved=JSON.parse(localStorage.getItem(KEY));stored=Object.keys(previous).every(key=>JSON.stringify(saved?.[key])===JSON.stringify(state[key]));}catch{}if(!stored){Object.assign(state,previous);$('#home-routine-status').textContent='Could not save. Your entries are still here; try again.';return;}$('#routine-dialog').close();renderFutureSelf();update();toast('Your routine is saved. You can edit it from Account.');});
 refreshHome();
}
