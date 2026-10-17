const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../web/'),dom=new JSDOM(fs.readFileSync(root+'index.html','utf8'),{url:'https://app.test/app',runScripts:'outside-only',virtualConsole:new VirtualConsole()}),w=dom.window,calls=[];
w.scrollTo=()=>{};w.confirm=()=>true;w.fetch=async(url)=>{calls.push(url);throw Error('Unexpected network call');};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.localStorage.setItem('longevity-simulator-v1',JSON.stringify({profile:{name:'Test',age:30,weight:70,height:170},habits:{exercise:200,sleep:8,plants:5},baselineHabits:{exercise:30,sleep:7,plants:4},records:[],route:[],onboardingComplete:false}));
w.eval(['run-math.js','runner.js','journal.js','account.js','features.js','sleep.js','workouts.js','home.js','setup.js','planner.js','coach-rules.js','coach.js','app.js'].map(n=>fs.readFileSync(root+n,'utf8')).join('\n')+'\nensureRunnerMap=async()=>{};window.testState=state;Object.assign(window,{FreeCoach,localDate,plannerDateAdd});');
const $=s=>w.document.querySelector(s),say=text=>{$('#coach-message').value=text;$('#coach-form').dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));};
try{
 assert.equal($('#coach-send').disabled,false);assert($('#coach-connection').textContent.includes('Free'));
 say('I want more energy, but I hate running.');assert.equal(w.document.querySelectorAll('.coach-option').length,0);assert($('#coach-conversation').textContent.includes('How many days'));
 say('Three days a week, swimming sounds fun.');assert.equal(w.document.querySelectorAll('.coach-option').length,3);assert.equal(w.testState.plans.length,0);assert(!$('#coach-options').textContent.toLowerCase().includes('easy run'));assert($('#coach-options').textContent.includes('swimming'));
 $('.coach-option button').click();assert.equal(w.testState.plans.length,1);assert.equal(w.testState.plans[0].source,'free-chat-coach');assert($('#coach-today-actions input'));
 const check=$('#coach-today-actions input');check.checked=true;check.dispatchEvent(new w.Event('change'));assert.equal(Object.keys(w.testState.plans[0].checkins).length,1);assert.equal($('#coach-today-actions input').checked,true);
 say('Make it easier, only 10 minutes.');assert.equal($('#coach-budget').value,'10');assert(w.document.querySelectorAll('.coach-option').length===3);assert.equal(calls.length,0,'Conversation must make zero network requests');
 const today=w.localDate(),start='2026-10-17';let r=w.FreeCoach.reply('I want fitness, only weekends, two days, no running',{}, {budget:20,start,context:{baselineMovement:0}});
 assert.equal(r.options.length,3);for(const p of r.options){const movement=p.tasks.filter(t=>t.category==='move');assert.equal(movement.length,2);assert(movement.every(t=>[0,1].includes(t.dayOffset)));assert(movement.every(t=>t.minutes<=20));assert(!JSON.stringify(p.tasks).includes('run/walk'));}
 r=w.FreeCoach.reply('hello',{}, {budget:20,start});assert.equal(r.options.length,0);assert(r.questions.length);
 r=w.FreeCoach.reply('I have chest pain and want to exercise',{}, {budget:20,start});assert.equal(r.options.length,0);assert(r.reply.includes('urgent'));r=w.FreeCoach.reply('give me a fitness plan',r.prefs,{budget:20,start});assert.equal(r.options.length,0,'Earlier symptom concern is retained');
 const before=w.testState.plans.length;$('#coach-clear').click();assert.equal(w.testState.plans.length,before);assert.equal(w.document.querySelectorAll('.coach-message').length,0);
 say('I want a consistent routine, three days.');assert.equal(w.document.querySelectorAll('.coach-option').length,3);$('#coach-start').value=w.plannerDateAdd(today,2);say('Pick for me');$('.coach-option button').click();assert.equal(w.testState.plans.length,before+1);assert.equal($('#coach-today-actions input'),null);assert($('#coach-today-summary').textContent.includes('starts'));
 $('#coach-open-plan').click();assert.equal($('#planner-draft').hidden,false);
 assert.equal(calls.length,0);console.log('PASS: free chat follow-ups, three plan options, exclusions, time/day preferences, symptom boundaries, explicit adoption, Today progress and zero network calls');
}catch(error){console.error(error);process.exitCode=1;}finally{dom.window.close();}
