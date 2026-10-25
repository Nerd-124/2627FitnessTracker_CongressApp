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
 w.eval(['run-math.js','runner.js','journal.js','account.js','features.js','sleep.js','workouts.js','home.js','setup.js','planner.js','coach-rules.js','coach.js','mental-health.js','future-self.js','app.js'].map(n=>fs.readFileSync(root+n,'utf8')).join('\n')+'\nwindow.realEnsureRunnerMap=ensureRunnerMap;window.installMapTest=fn=>{loadStreetMap=fn;ensureRunnerMap=window.realEnsureRunnerMap;};window.setMap=map=>routeMap=map;ensureRunnerMap=async()=>{};window.testState=state;Object.assign(window,{tickRunWatch,pauseRun,finishRun,discardRun,locateRunPreview,workoutEstimate,validateWorkout,renderExerciseProgress,currentRunSeconds,localDate,RunMath,drawElevationProfile,saveImportedRoute,renderRoute,fetchRunWeather,selectJournalDay,journalExerciseRecords,validateExerciseVitals,syncPlannerExercise,plannerCheckin,setRoutePlanning,appendPlannedPoint,loadPlannedElevation,renderPlannedRoute,validatePlannedPath,plannedCalorieEstimate,analyzePlannedTerrain,validatePedestrianRoute,decodePlannedPolyline});window.resetTerrainCache=()=>plannedElevationCache.clear();window.plannedSnapshot=()=>({points:plannedPoints.map(p=>({...p})),planning:routePlanning,pace:plannedPace,verified:plannedRouteVerified});');
 return {dom,w,$:s=>w.document.querySelector(s),watchers,singles,clears,advance(s){now+=s*1000;mono+=s*1000;},jumpWall(s){now+=s*1000;},point(lat,accuracy=5,watch=watchers.length-1,speed=null){watchers[watch].success({timestamp:now,coords:{latitude:lat,longitude:0,accuracy,altitude:100,altitudeAccuracy:5,speed}});}};
}
const instances=[];const use=seed=>{const c=create(seed);instances.push(c);return c;};
(async()=>{
 const a=use(),w=a.w,$=a.$;
 $('#run-bpm-before').value='72';$('#run-start').click();assert.equal(a.watchers[0].opts.enableHighAccuracy,true);assert.equal(a.singles[0].opts.maximumAge,0);
 a.advance(8);w.tickRunWatch();assert.equal($('#run-time').textContent,'00:00');assert.equal($('#run-gps-wait').textContent,'00:08');
 a.point(0,30);assert.equal(w.testState.runDraft.points.length,0,'Default 25m limit rejects less precise fixes');
 a.watchers[0].error({code:2});assert($('#run-status').textContent.includes('Waiting'),'Temporary unavailable does not abandon acquisition');
 a.point(0,20);assert($('#run-status').textContent.includes('Recording'));assert.equal($('#run-gps-wait').textContent,'00:00');
 a.advance(6);a.point(.00008,20);assert.equal(w.testState.runDraft.points.length,1,'9m wobble inside uncertainty is not distance');
 a.advance(14);a.point(.0003,20);assert.equal(w.testState.runDraft.points.length,2);assert.equal(Number($('#run-distance').textContent),0);assert.equal(w.testState.runDraft.points.at(-1).breakBefore,true,'Missing GPS interval cannot count a straight-line shortcut');
 a.jumpWall(300);w.tickRunWatch();assert.equal($('#run-time').textContent,'00:20','Device clock jumps do not change active time');
 a.advance(5);w.pauseRun();assert.equal($('#run-time').textContent,'00:25');a.advance(30);w.tickRunWatch();assert.equal($('#run-time').textContent,'00:25','Paused time excluded');
 $('#run-start').click();const oldCount=w.testState.runDraft.points.length;
 a.point(.02,5,0);assert.equal(w.testState.runDraft.points.length,oldCount,'Previous watch callback ignored after resume');
 a.point(.0003,5);a.advance(10);a.point(.0006,5);a.advance(5);w.finishRun();
 const saved=w.testState.activities[0];assert.equal(saved.bpmBefore,72);$('#run-bpm-after').value='142';$('#run-bpm-after').dispatchEvent(new w.Event('input'));$('#run-save-vitals').click();assert.equal(w.testState.activities[0].bpmAfter,142);w.selectJournalDay(saved.date);assert($('#activity-history').textContent.includes('After: 142 bpm'));assert.equal(saved.minutes,40/60);assert.equal(saved.route[2].breakBefore,true);assert(saved.result.distance<.08,'Resume did not bridge stale point');
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
 const form=$('#workout-form');assert.equal(form.elements.sport.tagName,'INPUT');assert.equal(form.elements.sport.type,'text');assert.equal($('#exercise-history-details').hidden,true);assert.equal($('#run-extra-details'),null);assert.equal($('#activity details'),null);assert.equal($('#activity-form'),null);form.elements.sport.value='Swimming';form.elements.date.value=w.localDate();form.elements.minutes.value='30';form.elements.intensity.value='moderate';form.elements.distance.value='1';form.elements.notes.value='<img onerror=alert(1)> 40 laps';
 form.dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));assert.equal(w.testState.workouts.length,1);assert.equal(w.testState.records.length,0,'Workout does not overwrite or duplicate journal');assert.equal(w.testState.workouts[0].calories,294);assert.equal($('#workout-history img'),null);
 // Exact weekly total is 30 + 40/60; UI rounds to 30.7.
 assert($('#exercise-summary').textContent.includes('30.7'));
 $('#workout-history button').click();form.elements.minutes.value='45';form.dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));assert.equal(w.testState.workouts.length,1);assert.equal(w.testState.workouts[0].minutes,45);
 form.elements.sport.value='<b>Volleyball</b>';form.elements.customName.value='';form.elements.minutes.value='20';form.dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));assert.equal(w.testState.workouts.length,2);assert.equal(w.testState.workouts[1].calories,null);assert.equal($('#workout-history b'),null);
 const snapshot=JSON.stringify(w.testState.workouts),set=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(){throw Error('full');};form.elements.minutes.value='25';form.elements.sport.value='Hockey';form.elements.customName.value='';form.dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));assert.equal(JSON.stringify(w.testState.workouts),snapshot);assert($('#workout-status').textContent.includes('Not saved'));w.Storage.prototype.setItem=set;
 const before=w.testState.workouts.length;w.confirm=()=>false;[...$('#workout-history').querySelectorAll('button')].find(b=>b.textContent==='Remove').click();assert.equal(w.testState.workouts.length,before);w.confirm=()=>true;[...$('#workout-history').querySelectorAll('button')].find(b=>b.textContent==='Remove').click();assert.equal(w.testState.workouts.length,before-1);
 const persisted=JSON.parse(w.localStorage.getItem('longevity-simulator-v1'));assert.equal(persisted.workouts.length,1);const reload=use(persisted);assert.equal(reload.w.testState.workouts.length,1);assert(reload.$('#workout-history').textContent.includes('20 min'));assert.equal(w.document.querySelectorAll('#exercise-week-chart [role=listitem]').length,7);
 // Elevation is visible under the map, and missing heights/paused legs stay disconnected.
 const elevation=use(),ew=elevation.w;
 const profile=[{lat:0,lon:0,ele:0},{lat:.001,lon:0,ele:6},{lat:.002,lon:0,ele:null},{lat:.003,lon:0,ele:12},{lat:.004,lon:0,ele:15},{lat:.006,lon:0,ele:18,breakBefore:true},{lat:.007,lon:0,ele:21}];
 ew.drawElevationProfile(ew.RunMath.analyze(profile,600));
 assert.equal(elevation.$('.compact-map-stage').nextElementSibling.className,'route-elevation');
 assert.equal(elevation.w.document.querySelectorAll('[data-elevation-segment]').length,3,'No bridges across missing altitude or GPS pauses');
 assert(elevation.$('#elevation-caption').textContent.includes('6 of 7'));
 ew.testState.runUnit='km';ew.drawElevationProfile(ew.RunMath.analyze(profile,600));
 assert(elevation.$('#elevation-axis-labels').textContent.includes('Altitude (m)'));
 ew.drawElevationProfile(ew.RunMath.analyze([{lat:0,lon:0,ele:null}],0));
 assert.equal(elevation.$('#elevation-chart polyline'),null);assert(elevation.$('#elevation-caption').textContent.includes('No elevation is invented'));
 ew.drawElevationProfile(ew.RunMath.analyze([{lat:0,lon:0,ele:0},{lat:.001,lon:0,ele:0}],20));
 assert(!elevation.$('#elevation-chart').innerHTML.includes('NaN'),'Flat sea-level altitude is valid');
 // Direct tabs and button choices: no menu needs opening to find saved sessions or change units.
 elevation.$('#exercise-show-history').click();assert.equal(elevation.$('#exercise-history-details').hidden,false);assert.equal(elevation.w.document.querySelector('.page.active').id,'exercise-log');
 elevation.$('#exercise-show-gps').click();assert.equal(elevation.$('#exercise-history-details').hidden,true);
 elevation.$('[data-exercise-choice="run-unit"][data-value="km"]').click();assert.equal(ew.testState.runUnit,'km');
 assert([...ew.document.querySelectorAll('#activity select')].every(s=>s.hidden));
 // GPX preview with no timestamps: don't assume a 45-minute workout or estimate calories.
 ew.testState.route=profile;ew.renderRoute();assert(elevation.$('#imported-route-status').textContent.includes('no elapsed time'));
 assert.equal(elevation.$('#run-pace').textContent,'—');assert.equal(elevation.$('#run-calories').textContent,'—');
 elevation.$('#imported-route-minutes').value='0';ew.saveImportedRoute();assert.equal(ew.testState.activities.length,0);
 elevation.$('#imported-route-minutes').value='25';ew.saveImportedRoute();assert.equal(ew.testState.activities.length,1);assert.equal(ew.testState.activities[0].minutes,25);
 ew.saveImportedRoute();assert.equal(ew.testState.activities.length,1,'Imported routes save only once');
 // Optional session readings round-trip to history and the correct journal date,
 // without replacing a day's general pulse, meals, or sleep.
 const vitals=use(),vw=vitals.w,vf=vitals.$('#workout-form');
 const day=vw.localDate();vw.testState.records.push({date:day,heart:'65',sleepHours:8,breakfast:'Toast'});
 vf.elements.sport.value='Swimming';vf.elements.date.value=day;vf.elements.minutes.value='30';
 vf.elements.temperature.value='0';vf.elements.bpmBefore.value='70';vf.elements.bpmAfter.value='130';
 vf.dispatchEvent(new vw.Event('submit',{cancelable:true,bubbles:true}));
 assert.equal(vw.testState.workouts[0].temperature,0,'Zero Celsius is a real reading');
 assert.equal(vw.testState.workouts[0].bpmBefore,70);assert.equal(vw.testState.workouts[0].bpmAfter,130);
 vw.selectJournalDay(day);assert(vitals.$('#workout-history').textContent.includes('After: 130 bpm'));
 assert.equal(vw.testState.records[0].heart,'65');assert.equal(vw.testState.records[0].breakfast,'Toast');assert.equal(vw.testState.records[0].sleepHours,8);
 assert.throws(()=>vw.validateExerciseVitals({bpmBefore:'0'}));assert.throws(()=>vw.validateExerciseVitals({bpmAfter:'301'}));assert.throws(()=>vw.validateExerciseVitals({bpmAfter:'70.5'}));assert.throws(()=>vw.validateExerciseVitals({temperature:'NaN'}));
 vitals.$('#workout-history button').click();assert.equal(vf.elements.bpmBefore.value,'70');vf.elements.bpmAfter.value='120';vf.dispatchEvent(new vw.Event('submit',{cancelable:true,bubbles:true}));
 vw.selectJournalDay(day);assert(vitals.$('#workout-history').textContent.includes('After: 120 bpm'));assert(!vitals.$('#workout-history').textContent.includes('After: 130 bpm'));
 // Weather lookup chooses the route's hour, records provenance, and never invents BPM.
 const start=new Date((Math.round(Date.now()/3600000)-1)*3600000).toISOString(),target=Date.parse(start)/1000;
 const weatherSession={id:'weather-run',date:day,startedAt:start,minutes:20,mode:'run',route:[{lat:40,lon:-80,ele:10}],temperature:null,temperatureSource:null,result:{calories:100}};
 vw.testState.activities.push(weatherSession);let requested;
 vw.fetch=async url=>{requested=url;return {ok:true,json:async()=>({hourly:{time:[target-3600,target,target+3600],temperature_2m:[5,12,30]}})};};
 await vw.fetchRunWeather(weatherSession);
 assert.equal(weatherSession.temperature,12);assert.equal(weatherSession.temperatureSource,'open-meteo');assert.equal(weatherSession.bpmBefore,undefined);
 assert(requested.includes('latitude=40'));assert(requested.includes('start_date='));assert.equal(weatherSession.weather.provider,'Open-Meteo');
 weatherSession.temperature=18;weatherSession.temperatureSource='manual';weatherSession.weatherRequested=false;
 await vw.fetchRunWeather(weatherSession);assert.equal(weatherSession.temperature,18,'Automatic weather cannot overwrite a manual correction');
 weatherSession.weatherRequested=false;vw.fetch=async()=>{throw Error('offline');};await vw.fetchRunWeather(weatherSession);
 assert.equal(weatherSession.temperature,18);assert(weatherSession.weatherStatus.includes('Weather unavailable'));
 // A delayed response cannot replace a temperature typed while it was loading.
 let deliver;weatherSession.temperatureSource=null;weatherSession.temperature=null;weatherSession.weatherRequested=false;
 vw.fetch=()=>new Promise(resolve=>{deliver=()=>resolve({ok:true,json:async()=>({hourly:{time:[target],temperature_2m:[10]}})});});
 const pending=vw.fetchRunWeather(weatherSession);weatherSession.temperature=22;weatherSession.temperatureSource='manual';deliver();await pending;assert.equal(weatherSession.temperature,22);
 // Removing a session removes its linked journal readings, without deleting the journal.
 vw.testState.workouts=[];vw.renderExerciseProgress();vw.selectJournalDay(day);assert(!vitals.$('#workout-history').textContent.includes('After: 120 bpm'));assert.equal(vw.testState.records[0].heart,'65');
 // Pedestrian network validation replaces raw sketches before any estimate.
 function encodePolyline(points){let lastLat=0,lastLon=0,result='';const encode=n=>{let value=n<0?~(n<<1):n<<1,out='';while(value>=32){out+=String.fromCharCode((32|(value&31))+63);value>>>=5;}return out+String.fromCharCode(value+63);};for(const p of points){const lat=Math.round(p.lat*1e6),lon=Math.round(p.lon*1e6);result+=encode(lat-lastLat)+encode(lon-lastLon);lastLat=lat;lastLon=lon;}return result;}
 function routed(points,extra={}){return {trip:{status:0,legs:[{shape:encodePolyline(points),maneuvers:[{type:1,travel_mode:'pedestrian',instruction:'Walk'}],...extra}]}};}
 const drawing=use(),dw=drawing.w;let dragging=true;
 const container=drawing.$('#route-map'),mockMap={getContainer:()=>container,mouseEventToLatLng:e=>({lat:e.clientY/10000,lng:e.clientX/10000}),dragging:{disable(){dragging=false;},enable(){dragging=true;}},doubleClickZoom:{disable(){},enable(){}},invalidateSize(){},removeLayer(){},fitBounds(){}};
 dw.setMap(mockMap);dw.L={polyline:points=>({addTo(){return this;},getBounds(){return points;}})};
 await dw.setRoutePlanning(true);assert.equal(dragging,false);assert.equal(drawing.$('#route-map').hidden,false);
 const pointer=(type,y)=>{const e=new dw.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:0,clientY:y});Object.defineProperty(e,'pointerId',{value:1});container.dispatchEvent(e);};
 pointer('pointerdown',0);pointer('pointermove',10);pointer('pointerup',10);
 assert.equal(drawing.$('#planned-distance').textContent,'—','Unchecked straight lines are not route estimates');
 const path=[{lat:0,lon:0},{lat:.001,lon:0}];let request;
 dw.fetch=async url=>{request=url;return {ok:true,json:async()=>routed(path)};};await dw.validatePlannedPath();
 assert(dw.plannedSnapshot().verified);assert(request.includes('valhalla1.openstreetmap.de'));const query=JSON.parse(new URL(request).searchParams.get('json'));assert.equal(query.costing,'pedestrian');assert.equal(query.costing_options.pedestrian.exclude_ferries,true);
 assert.equal(dw.testState.route.length,0);assert.equal(dw.testState.activities.length,0);assert.equal(dw.testState.workouts.length,0);
 drawing.$('[data-exercise-choice="run-unit"][data-value="km"]').click();assert.equal(drawing.$('#planned-distance').textContent,'0.11');
 const flatKcal=Number(drawing.$('#planned-calories').textContent.replace('~',''));assert(flatKcal>0&&flatKcal<30);
 drawing.$('#planned-pace').value='7';drawing.$('#planned-pace').dispatchEvent(new dw.Event('input'));assert.equal(Number(drawing.$('#planned-calories').textContent.replace('~','')),flatKcal,'Slower running pace does not add resting calories to active estimate');
 drawing.$('#planned-pace').value='20';drawing.$('#planned-pace').dispatchEvent(new dw.Event('input'));assert(drawing.$('#planned-calories').textContent.startsWith('~'),'Walking pace automatically selects the walking estimate');assert.equal(drawing.$('#planned-gait-walk'),null);
 let elevationRequests=[];dw.fetch=async url=>{elevationRequests.push(url);const coords=new URL(url).searchParams.get('latitude').split(',').map(Number);return {ok:true,json:async()=>({elevation:coords.map(lat=>lat*10000)})};};await dw.loadPlannedElevation();
 assert(elevationRequests.length);assert.equal(dw.plannedSnapshot().points.at(-1).ele,10);assert(drawing.$('#elevation-chart polyline'));
 let hoverPoint=null,hoverRemoved=false;dw.L.circleMarker=(p)=>{hoverPoint=p;return {addTo(){return this;}};};mockMap.removeLayer=()=>{hoverRemoved=true;};
 const graph=drawing.$('#elevation-chart');graph.getBoundingClientRect=()=>({left:0,width:800});graph.onpointermove(new dw.MouseEvent('pointermove',{clientX:776}));assert(Math.abs(hoverPoint[0]-.001)<.000001);assert(graph.querySelector('[data-elevation-hover]'));graph.onpointerleave(new dw.Event('pointerleave'));assert(hoverRemoved);assert(!graph.querySelector('[data-elevation-hover]'));
 const rough=[{lat:0,lon:.002},{lat:.001,lon:.002}];assert(dw.validatePedestrianRoute(routed(path),rough).length>1,'A sketch 222 m off the path snaps instead of failing');assert.equal(query.locations[0].search_cutoff,500);

 const savedPlan=JSON.parse(dw.localStorage.getItem('longevity-simulator-v1'));assert.equal(savedPlan.plannedRoute.routingProvider,'valhalla-pedestrian');const restored=use(savedPlan);assert(restored.w.plannedSnapshot().verified);
 // Explicitly reject ferry crossings, disconnected paths and snapping far from a sketch.
 assert.throws(()=>dw.validatePedestrianRoute(routed(path,{maneuvers:[{type:28,travel_mode:'pedestrian'}]}),path),/Ferry/);
 assert.throws(()=>dw.validatePedestrianRoute(routed(path,{maneuvers:[{type:1,travel_mode:'drive'}]}),path),/pedestrian/);
 assert.throws(()=>dw.validatePedestrianRoute(routed(path),[{lat:1,lon:1},{lat:1.001,lon:1}]),/500 m/);
 assert.throws(()=>dw.validatePedestrianRoute({trip:{status:442}},path));assert.throws(()=>dw.decodePlannedPolyline('~'));
 // A mapped footbridge detour is allowed instead of drawing across open water.
 const bridge=[{lat:0,lon:0},{lat:0,lon:.001},{lat:.001,lon:.001},{lat:.001,lon:0}];const bridgePath=dw.validatePedestrianRoute(routed(bridge),path);assert(dw.analyzePlannedTerrain(bridgePath).distance>300);
 // Coordinate-based terrain values are identical on the return journey.
 const loop=[{lat:0,lon:0,ele:0},{lat:.001,lon:0,ele:10},{lat:.002,lon:0,ele:20},{lat:.001,lon:0,ele:10},{lat:0,lon:0,ele:0}];
 const loopAnalysis=dw.analyzePlannedTerrain(loop);assert.equal(loopAnalysis.gain,20);assert.equal(loopAnalysis.down,20);assert.equal(loopAnalysis.points[1].height,loopAnalysis.points[3].height);
 // Independent ACSM check: 70kg / 1km flat run = 70 active kcal; rest raises total only.
 const flat={distance:1000,gain:0,excluded:0,altitudePoints:1};const fast=dw.plannedCalorieEstimate(flat,5,70,'run'),slow=dw.plannedCalorieEstimate(flat,7,70,'run');assert.equal(fast.active,70);assert.equal(slow.active,70);assert(slow.total>fast.total);
 assert.equal(dw.plannedCalorieEstimate(flat,8,70,'run').active,70,'Transition pace keeps an approximate calorie estimate');assert.equal(dw.plannedCalorieEstimate({...flat,excluded:1,gain:200},6,70,'run').active,70,'Uncertain terrain falls back to level-ground calories');
 assert.equal(dw.plannedCalorieEstimate(flat,20,70,'run').active,null);assert.equal(dw.plannedCalorieEstimate(flat,20,70,'walk').active,35);
 // Failure is closed: no route number is presented without pedestrian validation.
 drawing.$('#route-draw-toggle').click();assert.equal(dragging,true);drawing.$('#route-draw-toggle').click();pointer('pointerdown',20);pointer('pointerup',20);
 dw.fetch=async()=>{throw Error('routing offline');};await dw.validatePlannedPath();assert.equal(dw.plannedSnapshot().verified,false);assert.equal(drawing.$('#planned-distance').textContent,'—');
 drawing.$('#route-draw-undo').click();assert(dw.plannedSnapshot().verified,'Undo restores the prior verified route');drawing.$('#route-draw-clear').click();assert.equal(dw.plannedSnapshot().points.length,0);
 // End-to-end out-and-back elevation lookup deduplicates coordinates, not route indices.
 pointer('pointerdown',0);pointer('pointermove',20);pointer('pointerup',0);
 dw.fetch=async()=>({ok:true,json:async()=>routed(loop)});await dw.validatePlannedPath();dw.resetTerrainCache();
 let uniqueCount=0;dw.fetch=async url=>{const query=new URL(url).searchParams,lat=query.get('latitude').split(',').map(Number),lon=query.get('longitude').split(',').map(Number);const keys=lat.map((v,i)=>v+','+lon[i]);assert.equal(new Set(keys).size,keys.length);uniqueCount+=keys.length;return {ok:true,json:async()=>({elevation:lat.map(v=>v*10000)})};};await dw.loadPlannedElevation();
 const returned=dw.plannedSnapshot().points;assert(uniqueCount<returned.length);const terrain=dw.analyzePlannedTerrain(returned);assert(Math.abs(terrain.gain-terrain.down)<1e-9);assert.equal(terrain.points[0].height,terrain.points.at(-1).height);
 drawing.$('#route-draw-clear').click();
 // Long zigzag sketches keep their turns and use bounded requests.
 for(let i=0;i<60;i++)dw.appendPlannedPoint({lat:i*.001,lon:(i%2)*.001});
 let routeCalls=0;
 dw.fetch=async url=>{const q=JSON.parse(new URL(url).searchParams.get('json'));assert(q.locations.length<=8);routeCalls++;drawing.advance(2);return {ok:true,json:async()=>routed(q.locations)};};
 await dw.validatePlannedPath();assert(routeCalls>1);assert(dw.plannedSnapshot().verified);assert(Number(drawing.$('#planned-distance').textContent)>3);
 dw.resetTerrainCache();let terrainCalls=0;
 dw.fetch=async url=>{terrainCalls++;if(terrainCalls>1)throw Error('temporary outage');const n=new URL(url).searchParams.get('latitude').split(',').length;return {ok:true,json:async()=>({elevation:Array(n).fill(10)})};};
 await dw.loadPlannedElevation();const partial=dw.plannedSnapshot().points.filter(p=>p.ele!==null).length;assert(partial>=100);assert(partial<dw.plannedSnapshot().points.length);assert.match(drawing.$('#planned-route-status').textContent,/resume/);
 let resumed=0;dw.fetch=async url=>{const n=new URL(url).searchParams.get('latitude').split(',').length;resumed+=n;return {ok:true,json:async()=>({elevation:Array(n).fill(10)})};};
 await dw.loadPlannedElevation();assert(dw.plannedSnapshot().points.every(p=>p.ele===10));assert(resumed<dw.plannedSnapshot().points.length,'retry skips saved samples');
 drawing.$('#route-draw-clear').click();
 await dw.setRoutePlanning(true);await dw.setRoutePlanning(false);assert.equal(drawing.$('.run-actions').hidden,false);
 console.log('PASS: GPS uncertainty, monotonic timing, wait clock, stale callbacks, delayed map centering, playback duration, and workout CRUD/estimates/progress/storage safety');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{for(const instance of instances)instance.dom.window.close();});
