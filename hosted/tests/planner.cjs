const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../web/');
function create(seed){
 const dom=new JSDOM(fs.readFileSync(root+'index.html','utf8'),{url:'https://app.test/app',runScripts:'outside-only',virtualConsole:new VirtualConsole()});
 const w=dom.window;w.scrollTo=()=>{};w.confirm=()=>true;w.fetch=async()=>({ok:true,json:async()=>({})});w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.localStorage.setItem('longevity-simulator-v1',JSON.stringify(seed||{profile:{name:'Test',age:30,height:170,weight:70},habits:{exercise:500,sleep:12,plants:10},baselineHabits:{exercise:30,sleep:6,plants:2},records:[],onboardingComplete:false}));
 w.eval(['run-math.js','runner.js','journal.js','account.js','features.js','sleep.js','workouts.js','home.js','setup.js','planner.js','app.js'].map(n=>fs.readFileSync(root+n,'utf8')).join('\n')+'\nensureRunnerMap=async()=>{};window.testState=state;Object.assign(window,{plannerDateAdd,plannerPeriodEnd,validatePlannerSettings,plannerCurrentStatus,suggestPlanner,plannerTaskScheduled,plannerCheckin,localDate});');
 return {dom,w,$:s=>w.document.querySelector(s)};
}
const apps=[];const use=seed=>{const a=create(seed);apps.push(a);return a;};
try{
 const app=use(),w=app.w,$=app.$,today=w.localDate();
 assert.equal(w.plannerPeriodEnd('2024-02-26','week'),'2024-03-03');
 assert.equal(w.plannerPeriodEnd('2024-01-01','year'),'2024-12-31');
 assert.equal(w.plannerPeriodEnd('2026-10-17','month'),'2026-11-16');
 const settings=w.validatePlannerSettings({title:'My goal',goal:'Be consistent',horizon:'week',start:today,budget:20,movementGoal:'',focus:['move','rest'],days:[1,3,5],activity:'Swimming'});
 assert.throws(()=>w.validatePlannerSettings({...settings,horizon:'custom',end:w.plannerDateAdd(today,366)}));
 assert.throws(()=>w.validatePlannerSettings({...settings,days:[]}));
 let draft=w.suggestPlanner(settings);assert.equal(draft.tasks.find(t=>t.category==='move').minutes,20,'Uses saved baseline 30, not what-if value 500');assert(draft.reasons.some(r=>r.includes('starting routine')));
 for(let i=0;i<5;i++){const date=w.plannerDateAdd(today,-i);w.testState.records.push({date,bed:'23:00',wake:'07:00',duration:'20'});w.testState.workouts.push({id:'w'+i,date,minutes:15});}
 const status=w.plannerCurrentStatus();assert.equal(status.sleepAverage,8);assert.equal(status.recordedMinutes,100,'Journal and workout minutes not added twice');assert.equal(status.movementDays,5);assert.equal(status.movement,100);
 const form=$('#planner-form');form.elements.title.value='My week';form.elements.goal.value='Build a routine <img src=x onerror=alert(1)>';
 const submit=()=>form.dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));submit();assert.equal($('#planner-draft').hidden,false);assert.equal(w.testState.plans.length,0,'Suggestion is a draft until saved');assert.equal($('#planner-draft-reasons img'),null);
 $('#planner-add-task').click();let editors=[...w.document.querySelectorAll('.planner-task-editor')],custom=editors.at(-1);custom.querySelector('[name=title]').value='<b>Stretch gently</b>';custom.querySelector('[name=schedule]').value='once';custom.querySelector('[name=date]').value=today;
 $('#planner-save').click();assert.equal(w.testState.plans.length,1);assert.equal($('#planner-active').hidden,false);assert.equal($('#planner-builder').hidden,true);assert.equal(w.document.querySelectorAll('#planner-days>article').length,7);assert.equal($('#planner-days b'),null);assert($('#planner-days').textContent.includes('<b>Stretch gently</b>'));
 const plan=w.testState.plans[0],firstInput=$('#planner-days input:not(:disabled)');assert(firstInput);firstInput.checked=true;firstInput.dispatchEvent(new w.Event('change'));assert.equal(Object.keys(w.testState.plans[0].checkins).length,1);assert($('#planner-progress').textContent.includes('1 of'));
 assert(w.document.querySelectorAll('#planner-days input:disabled').length>0,'Future actions cannot be checked in');
 const current=w.testState.plans[0],future=w.plannerDateAdd(today,1);assert.throws(()=>w.plannerCheckin(current,current.tasks.find(t=>t.schedule==='daily'),future,true));
 $('#planner-edit').click();const title=w.document.querySelector('.planner-task-editor [name=title]');title.value='My edited movement';$('#planner-save').click();assert.equal(w.testState.plans.length,1);assert.equal(Object.keys(w.testState.plans[0].checkins).length,1,'Editing title preserves check-in');assert.equal(w.testState.plans[0].tasks[0].title,'My edited movement');
 $('#planner-edit').click();$('#planner-back').click();form.elements.title.value='My updated name';$('#planner-keep-actions').click();$('#planner-save').click();assert.equal(w.testState.plans[0].title,'My updated name');assert.equal(Object.keys(w.testState.plans[0].checkins).length,1,'Changing goals without regenerating preserves actions');
 // Monthly and yearly plans remain short on screen and keep earlier plans.
 for(const horizon of ['month','year']){$('#planner-new').click();form.elements.title.value=horizon+' plan';form.elements.goal.value='Keep a steady routine';form.elements.horizon.value=horizon;form.elements.horizon.dispatchEvent(new w.Event('change'));submit();$('#planner-save').click();assert.equal(w.document.querySelectorAll('#planner-days>article').length,7);}
 assert.equal(w.testState.plans.length,3);assert.equal($('#planner-select').options.length,3);
 const exported=JSON.parse(w.localStorage.getItem('longevity-simulator-v1'));const reload=use(exported);assert.equal(reload.w.testState.plans.length,3);assert.equal(reload.$('#planner-builder').hidden,true);assert.equal(reload.$('#planner-name').textContent,'year plan');
 // Draft dates and weekly days are validated before any write.
 $('#planner-edit').click();const weekly=[...w.document.querySelectorAll('.planner-task-editor')].find(el=>el.querySelector('[name=schedule]').value==='weekly');weekly.querySelectorAll('[name=days]').forEach(i=>i.checked=false);$('#planner-save').click();assert($('#planner-status').textContent.includes('weekday'));assert.equal(w.testState.plans.length,3);$('#planner-cancel').click();
 // Storage failure rolls back check-ins; other records stay intact.
 const old=JSON.stringify(w.testState.plans),set=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(){throw Error('quota');};const check=$('#planner-days input:not(:disabled)');check.checked=true;check.dispatchEvent(new w.Event('change'));assert.equal(JSON.stringify(w.testState.plans),old);assert($('#planner-status').textContent.includes('Not saved'));w.Storage.prototype.setItem=set;
 w.confirm=()=>false;$('#planner-delete').click();assert.equal(w.testState.plans.length,3);w.confirm=()=>true;$('#planner-delete').click();assert.equal(w.testState.plans.length,2);assert.equal(w.testState.records.length,5);assert.equal(w.testState.workouts.length,5);
 console.log('PASS: status-based suggestions, no movement double count, week/month/year ranges, editable drafts/custom actions, schedule validation, check-ins, persistence, and safe deletion/storage rollback');
}catch(error){console.error(error);process.exitCode=1;}finally{for(const app of apps)app.dom.window.close();}
