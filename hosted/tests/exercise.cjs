const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../web/');
function create(savedSeed=null){
 const dom=new JSDOM(fs.readFileSync(root+'index.html','utf8'),{url:'https://app.test/app',runScripts:'outside-only',virtualConsole:new VirtualConsole()});
 const w=dom.window;let now=Date.now(),mono=10000,watchers=[],singles=[],clears=[];
 w.Date.now=()=>now;w.performance.now=()=>mono;w.scrollTo=()=>{};w.confirm=()=>true;Object.defineProperty(w,'isSecureContext',{value:true});
 Object.defineProperty(w.navigator,'geolocation',{value:{watchPosition(success,error,opts){watchers.push({success,error,opts});return watchers.length;},clearWatch(id){clears.push(id);},getCurrentPosition(success,error,opts){singles.push({success,error,opts});}}});
 w.fetch=async()=>({ok:true,json:async()=>({})});w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.localStorage.setItem('longevity-simulator-v1',JSON.stringify(savedSeed||{profile:{name:'Test',age:30,height:170,weight:70},habits:{exercise:150,sleep:8,plants:5},records:[],onboardingComplete:false}));
 w.eval(['run-math.js','runner.js','journal.js','account.js','features.js','sleep.js','workouts.js','home.js','setup.js','planner.js','app.js'].map(n=>fs.readFileSync(root+n,'utf8')).join('\n')+'\nwindow.realEnsureRunnerMap=ensureRunnerMap;window.installMapTest=fn=>{loadStreetMap=fn;ensureRunnerMap=window.realEnsureRunnerMap;};window.setMap=map=>routeMap=map;ensureRunnerMap=async()=>{};window.testState=state;Object.assign(window,{tickRunWatch,pauseRun,finishRun,discardRun,locateRunPreview,workoutEstimate,validateWorkout,renderExerciseProgress,currentRunSeconds,localDate,RunMath});');
 return {dom,w,$:s=>w.document.querySelector(s),watchers,singles,clears,advance(s){now+=s*1000;mono+=s*1000;},jumpWall(s){now+=s*1000;},point(lat,accuracy=5,watch=watchers.length-1,speed=null){watchers[watch].success({timestamp:now,coords:{latitude:lat,longitude:0,accuracy,altitude:100,altitudeAccuracy:5,speed}});}};
}
const instances=[];const use=seed=>{const c=create(seed);instances.push(c);return c;};
(async()=>{
 const a=use(),w=a.w,$=a.$;
 $('#run-start').click();assert.equal(a.watchers[0].opts.enableHighAccuracy,true);assert.equal(a.singles[0].opts.maximumAge,0);
 a.advance(8);w.tickRunWatch();assert.equal($('#run-time').textContent,'00:00');assert.equal($('#run-gps-wait').textContent,'00:08');
 a.point(0,30);assert.equal(w.testState.runDraft.points.length,0,'Default 25m limit rejects less precise fixes');
 a.watchers[0].error({code:2});assert($('#run-status').textContent.includes('Waiting'),'Temporary unavailable does not abandon acquisition');
 a.point(0,20);assert($('#run-status').textContent.includes('Recording'));assert.equal($('#run-gps-wait').textContent,'00:00');
 a.advance(6);a.point(.00008,20);assert.equal(w.testState.runDraft.points.length,1,'9m wobble inside uncertainty is not distance');
 a.advance(14);a.point(.0003,20);assert.equal(w.testState.runDraft.points.length,2);assert(Number($('#run-distance').textContent)>0);
 a.jumpWall(300);w.tickRunWatch();assert.equal($('#run-time').textContent,'00:20','Device clock jumps do not change active time');
 a.advance(5);w.pauseRun();assert.equal($('#run-time').textContent,'00:25');a.advance(30);w.tickRunWatch();assert.equal($('#run-time').textContent,'00:25','Paused time excluded');
 $('#run-start').click();const oldCount=w.testState.runDraft.points.length;
 a.point(.02,5,0);assert.equal(w.testState.runDraft.points.length,oldCount,'Previous watch callback ignored after resume');
 a.point(.0003,5);a.advance(10);a.point(.0006,5);a.advance(5);w.finishRun();
 const saved=w.testState.activities[0];assert.equal(saved.minutes,40/60);assert.equal(saved.route[2].breakBefore,true);assert(saved.result.distance<.08,'Resume did not bridge stale point');
 $('#run-scrub').value=1000;$('#run-scrub').dispatchEvent(new w.Event('input'));assert($('#run-replay-readout').textContent.includes('00:40'),'Playback includes stationary tail of session');
 const limit=use();limit.$('#run-accuracy-limit').value='15';limit.$('#run-start').click();limit.point(0,20);assert.equal(limit.w.testState.runDraft.points.length,0);limit.point(0,10);assert.equal(limit.w.testState.runDraft.points.length,1);
 const clock=use();clock.$('#run-start').click();clock.point(0);clock.advance(10);clock.jumpWall(3600);clock.point(.0002);clock.advance(10);clock.jumpWall(-7200);clock.point(.0004);assert.equal(clock.w.testState.runDraft.points.length,3,'Wall-clock corrections do not drop valid movement');assert.equal(clock.w.testState.runDraft.points.filter(p=>p.breakBefore).length,0,'Clock correction is not a GPS gap');assert.equal(clock.$('#run-time').textContent,'00:20');
 // Explicit cancel invalidates callbacks even if an old browser request eventually succeeds.
 const cancel=use();cancel.$('#run-start').click();cancel.w.discardRun();cancel.$('#run-start').click();cancel.point(.02,5,0);assert.equal(cancel.w.testState.runDraft.points.length,0);cancel.point(0);assert.equal(cancel.w.testState.runDraft.points.length,1);
 // Location arrives before the map loader resolves: all callers await the same task.
 const map=use(),mw=map.w;let resolveMap,loads=0,views=[];
 const fake={invalidateSize(){},removeLayer(){},setView(point,zoom){views.push({point,zoom});return this;},panTo(){}};
 mw.fakeMap=fake;mw.loadMapForTest=()=>{loads++;return new Promise(resolve=>{resolveMap=()=>{mw.setMap(fake);resolve(fake);};});};
 mw.L={circle:()=>({addTo(){return this;}}),circleMarker:()=>({addTo(){return this;},setLatLng(){}})};
 mw.installMapTest(mw.loadMapForTest);
 const finding=mw.locateRunPreview();map.singles[0].success({coords:{latitude:40,longitude:-80,accuracy:12},timestamp:Date.now()});
 await Promise.resolve();assert.equal(loads,1);assert.equal(views.length,0);resolveMap();await finding;
 assert(views.some(v=>v.point[0]===40&&v.point[1]===-80&&v.zoom===16),'Delayed map centers on actual fix');assert.equal(map.$('#run-map-placeholder').hidden,true);assert.equal(map.w.testState.route.length,0);
 // Workouts: known independent MET result; CRUD, no journal mutation, custom names safe.
 assert.equal(w.workoutEstimate('basketball','moderate',30,70),221);assert.equal(w.workoutEstimate('other','moderate',30,70),null);
 assert.throws(()=>w.validateWorkout({sport:'swimming',date:w.localDate(),minutes:-1,intensity:'moderate',distance:''}));
 $('#exercise-show-workouts').click();assert.equal($('#exercise-workouts-panel').hidden,false);
 const form=$('#workout-form');assert.equal(form.elements.sport.tagName,'INPUT');assert.equal(form.elements.sport.type,'text');assert.equal($('#exercise-history-details').open,false);assert.equal($('#run-extra-details').open,false);form.elements.sport.value='Swimming';form.elements.date.value=w.localDate();form.elements.minutes.value='30';form.elements.intensity.value='moderate';form.elements.distance.value='1';form.elements.notes.value='<img onerror=alert(1)> 40 laps';
 form.dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));assert.equal(w.testState.workouts.length,1);assert.equal(w.testState.records.length,0,'Workout does not overwrite or duplicate journal');assert.equal(w.testState.workouts[0].calories,294);assert.equal($('#workout-history img'),null);
 // Exact weekly total is 30 + 40/60; UI rounds to 30.7.
 assert($('#exercise-summary').textContent.includes('30.7'));
 $('#workout-history button').click();form.elements.minutes.value='45';form.dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));assert.equal(w.testState.workouts.length,1);assert.equal(w.testState.workouts[0].minutes,45);
 form.elements.sport.value='<b>Volleyball</b>';form.elements.customName.value='';form.elements.minutes.value='20';form.dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));assert.equal(w.testState.workouts.length,2);assert.equal(w.testState.workouts[1].calories,null);assert.equal($('#workout-history b'),null);
 const snapshot=JSON.stringify(w.testState.workouts),set=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(){throw Error('full');};form.elements.minutes.value='25';form.elements.sport.value='Hockey';form.elements.customName.value='';form.dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));assert.equal(JSON.stringify(w.testState.workouts),snapshot);assert($('#workout-status').textContent.includes('Not saved'));w.Storage.prototype.setItem=set;
 const before=w.testState.workouts.length;w.confirm=()=>false;[...$('#workout-history').querySelectorAll('button')].find(b=>b.textContent==='Remove').click();assert.equal(w.testState.workouts.length,before);w.confirm=()=>true;[...$('#workout-history').querySelectorAll('button')].find(b=>b.textContent==='Remove').click();assert.equal(w.testState.workouts.length,before-1);
 const persisted=JSON.parse(w.localStorage.getItem('longevity-simulator-v1'));assert.equal(persisted.workouts.length,1);const reload=use(persisted);assert.equal(reload.w.testState.workouts.length,1);assert(reload.$('#workout-history').textContent.includes('20 min'));assert.equal(w.document.querySelectorAll('#exercise-week-chart [role=listitem]').length,7);
 console.log('PASS: GPS uncertainty, monotonic timing, wait clock, stale callbacks, delayed map centering, playback duration, and workout CRUD/estimates/progress/storage safety');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{for(const instance of instances)instance.dom.window.close();});
