const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('node:fs'),assert=require('node:assert/strict');
const root=__dirname+'/../web/',dom=new JSDOM(fs.readFileSync(root+'index.html','utf8'),{url:'https://app.test/app',runScripts:'outside-only',virtualConsole:new VirtualConsole()}),w=dom.window,calls=[];
w.scrollTo=()=>{};w.confirm=()=>true;w.fetch=async(url)=>{calls.push(url);throw Error('Unexpected network call')};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
w.localStorage.setItem('longevity-simulator-v1',JSON.stringify({profile:{name:'Test',age:30},habits:{exercise:150,sleep:8,plants:5},baselineHabits:{exercise:150,sleep:8,plants:5},records:[],onboardingComplete:false}));
w.eval(['run-math.js','runner.js','journal.js','account.js','features.js','sleep.js','workouts.js','home.js','setup.js','planner.js','coach-rules.js','coach.js','mental-health.js','future-self.js','app.js'].map(n=>fs.readFileSync(root+n,'utf8')).join('\n')+'\nwindow.testState=state;window.today=localDate();');
const $=s=>w.document.querySelector(s),say=text=>{$('#coach-message').value=text;$('#coach-form').dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}))};
const last=()=>[...w.document.querySelectorAll('.coach-message.assistant')].at(-1);
try{
 for(const id of ['coach-start','coach-budget','coach-use-context'])assert.equal($('#'+id),null);
 assert.equal($('#coach'),null);assert.equal($('nav [data-page="coach"]'),null);const panel=$('#coach-chat-panel'),launcher=$('#coach-launcher');assert(panel.hidden);assert(!$('#coach-send').disabled);
 const current=$('.page.active').id;launcher.click();assert(!panel.hidden);assert.equal(w.document.activeElement.id,'coach-message');assert.equal(launcher.getAttribute('aria-expanded'),'true');
 $('#coach-message').value='Keep my draft';$('#coach-minimize').click();assert(panel.hidden);assert.equal($('#coach-message').value,'Keep my draft');launcher.click();panel.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(panel.hidden);assert.equal(w.document.activeElement,launcher);assert.equal($('.page.active').id,current);launcher.click();
 say('hello');assert(last().textContent.includes('free built-in assistant'));
 say('summarize my week');assert(last().textContent.includes('0/7'));assert(last().querySelector('button'));
 // Fresh context on every turn; user records never leave the browser.
 w.testState.records.push({date:w.today,bed:'23:00',wake:'06:00',duration:20,notes:'Retain my note'});
 say('summarize my week');assert(last().textContent.includes('20 minutes across 1/7'));assert(last().textContent.includes('7 hours on average'));
 const chat=$('#coach-conversation').textContent;$('#coach-minimize').click();launcher.click();assert.equal($('#coach-conversation').textContent,chat);
 say('where do I record yesterday sleep?');const action=last().querySelector('button');assert(action);action.click();assert(panel.hidden);assert.equal($('.page.active').id,'journal');assert.equal(w.testState.records.length,1);
 launcher.click();say('give me a workout');assert(last().textContent.includes('How many minutes'));say('10 minutes indoors, no equipment');assert(last().textContent.includes('10-minute idea'));assert.equal($('.coach-option'),null);assert.equal(w.testState.plans.length,0);
 say('review my last run');assert(last().textContent.includes('no matching saved session'));
 say('review my meal');assert(last().textContent.includes('now focuses on exercise'));
 say('estimate this picture');assert(last().textContent.includes('not available'));
 say('<img src=x onerror=alert(1)>');assert.equal($('#coach-conversation img'),null);assert.equal(w.testState.records[0].notes,'Retain my note');
 $('#coach-clear').click();assert.equal(w.document.querySelectorAll('.coach-message').length,0);assert(!$('#coach-chat-welcome').hidden);assert.equal(w.testState.records.length,1);
 assert.equal(calls.length,0,'Assistant makes zero provider/network calls');
 console.log('PASS assistant chat: removed controls, live local record context, navigation without writes, workout/food/session help, dock focus/draft/history, reset, HTML safety, zero network calls');
}catch(error){console.error(error);process.exitCode=1}finally{dom.window.close()}
