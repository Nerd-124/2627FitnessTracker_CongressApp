'use strict';
let activeRun=null, runTick=null, runWake=null, runAnalysis=null, reviewSession=null, replayTimer=null, replayFraction=0, runnerMarker=null, replayLayer=null, installPrompt=null, lastGPSNotice='', runnerMapLoading=false, runnerSaveWarning=false, reviewAnalysis=null;
let gpsLocating=false, gpsLocateToken=0, gpsHelpAction='preview', gpsPreviewCircle=null;
let plannerRunProgressSignature='';
let runBackground=null, lastRunBackground=null;
let runnerMapTask=null, gpsWatchToken=0, gpsMapFix=null, runFollow=true, runnerCentered=false;
function runUnitMeters(){return state.runUnit==='km'?1000:RunMath.mile;}
function currentRunSeconds(now=Date.now()){
 if(!activeRun)return 0;
 if(activeRun.phase==='recording'&&runBackground?.id===activeRun.id)return runBackground.seconds+Math.max(0,(now-runBackground.wall)/1000);
 const extra=activeRun.phase==='recording'&&activeRun.activeSince!=null
  ? (Number.isFinite(activeRun.activeSincePerf)?Math.max(0,(performance.now()-activeRun.activeSincePerf)/1000):Math.max(0,(now-activeRun.activeSince)/1000)) : 0;
 return (activeRun.seconds||0)+extra;
}
function gpsWaitSeconds(){if(activeRun?.phase!=='acquiring')return 0;return Number.isFinite(activeRun.acquiringSincePerf)?Math.max(0,(performance.now()-activeRun.acquiringSincePerf)/1000):Math.max(0,(Date.now()-(activeRun.acquiringSince||Date.now()))/1000);}
function gpsAccuracyLimit(){return Number($('#run-accuracy-limit')?.value)||25;}
function runIsActive(){return activeRun&&['acquiring','recording'].includes(activeRun.phase);}
function persistRun(){if(!activeRun)return;state.runDraft={...activeRun,points:activeRun.points.map(p=>({...p})),seconds:currentRunSeconds(),checkpointAt:Date.now(),activeSince:null,activeSincePerf:null,phase:activeRun.phase};save();try{const stored=JSON.parse(localStorage.getItem(KEY));if(!stored?.runDraft||stored.runDraft.id!==activeRun.id)throw Error();runnerSaveWarning=false;}catch{runnerSaveWarning=true;$('#run-feedback').textContent='This browser could not save the run draft. Keep this page open and export GPX after finishing.';}}
function suspendRunForBackground(){
 if(!activeRun||!runIsActive()||runBackground)return;
 if(activeRun.phase==='acquiring'){if(activeRun.points.length)pauseRun('GPS search paused. Resume outdoors when you return.');else cancelGPSAcquisition();return;}
 runBackground={id:activeRun.id,phase:activeRun.phase,seconds:currentRunSeconds(),wall:Date.now()};
 persistRun();releaseRunWake();
 if(!window.__longevityNative?.backgroundTracking){activeRun.needsBreak=activeRun.points.length>0;stopRunWatch();}
}
function resumeRunFromBackground(){
 if(!activeRun||!runBackground||runBackground.id!==activeRun.id)return;
 const anchor=runBackground;lastRunBackground={...anchor,end:Date.now()};
 if(activeRun.phase==='recording'){activeRun.seconds=anchor.seconds+Math.max(0,(Date.now()-anchor.wall)/1000);activeRun.activeSince=Date.now();activeRun.activeSincePerf=performance.now();}
 if(activeRun.phase==='acquiring'){activeRun.acquiringSince=Date.now();activeRun.acquiringSincePerf=performance.now();}
 runBackground=null;
 if(watchId===null&&runIsActive())beginRunWatch();requestRunWake();updateRunStats();persistRun();
 $('#run-feedback').textContent='Timer continued while you were away. GPS records only received locations; missing sections are marked as gaps.';
}

async function requestRunWake(){try{if(navigator.wakeLock&&document.visibilityState!=='hidden')runWake=await navigator.wakeLock.request('screen');}catch{lastGPSNotice='Screen-awake support unavailable. Keep the screen on manually.';}}
function releaseRunWake(){runWake?.release().catch(()=>{});runWake=null;}
function stopRunWatch(){gpsWatchToken++;if(watchId!==null){navigator.geolocation?.clearWatch(watchId);watchId=null;}if(runTick){clearInterval(runTick);runTick=null;}releaseRunWake();}
function runResult(a,seconds,kg,mode){const calories=RunMath.energy(a,seconds,kg,mode);return{calories,flat:calories===null?null:Math.round(((mode==='walk'?.1:.2)*a.distance+3.5*seconds/60)*kg/1000*5),uphill:calories===null?null:Math.round((mode==='walk'?1.8:.9)*a.gain*kg/1000*5),distance:Number((a.distance/1000).toFixed(3)),speed:seconds?Number((a.distance/seconds*3.6).toFixed(2)):0,gain:Number(a.gain.toFixed(1)),segment_count:a.segments.length,unknown_elevation:a.unknown,max_grade:0,model:'On-device ACSM-style research-equation estimate with filtered ascent; not a measured calorie total.'};}
function publishNativeRunStatus(){
 if(!window.__longevityNative?.runStatus||window.__longevityNative.drainingLocations)return;
 const run=activeRun,a=runAnalysis,seconds=run?currentRunSeconds():0,point=run?.points.at(-1);
 window.__longevityNative.runStatus({runID:run?.id||'',phase:run?.phase||'idle',mode:run?.mode||'run',elapsed:seconds,distanceMeters:a?.distance||0,calories:run&&a?RunMath.energy(a,seconds,run.weight,run.mode):null,ascentMeters:a?.altitudePoints>1?a.gain:null,weight:run?.weight||0,lastPoint:point?{lat:point.lat,lon:point.lon,ele:point.ele,accuracy:point.accuracy,timestamp:Date.parse(point.time)}:null});
}
function updateRunStats(){const unit=runUnitMeters(),seconds=activeRun?currentRunSeconds():reviewSession?Number(reviewSession.minutes)*60:0;const points=activeRun?.points||reviewSession?.route||[];const a=RunMath.analyze(points,seconds);runAnalysis=a;const waiting=activeRun?.phase==='acquiring',waitSeconds=gpsWaitSeconds();$('#run-time-label').textContent='ACTIVE TIME';$('#run-time').textContent=RunMath.clock(seconds);$('#run-gps-wait').textContent=RunMath.clock(waitSeconds);$('#run-distance-label').textContent=state.runUnit==='km'?'KILOMETERS':'MILES';$('#run-distance').textContent=(a.distance/unit).toFixed(2);$('#run-pace-label').textContent='AVG PACE / '+(state.runUnit==='km'?'KM':'MI');$('#run-pace').textContent=a.distance>=10&&seconds>0?RunMath.clock(seconds/(a.distance/unit)):'—';$('#run-calories').textContent=reviewSession&&!reviewSession.minutes?'—':points.length?RunMath.energy(a,seconds,Number(activeRun?.weight||reviewSession?.weight||state.profile.weight),activeRun?.mode||reviewSession?.mode||'run')??'—':0;$('#run-ascent-label').textContent='ASCENT · '+(state.runUnit==='km'?'M':'FT');$('#run-ascent').textContent=a.altitudePoints>1?Math.round(a.gain*(state.runUnit==='km'?1:3.28084)):'—';$('#run-mode').disabled=!!activeRun;$('#run-accuracy-limit').disabled=!!activeRun;$('#run-unit').value=state.runUnit;syncExerciseChoices();
 const phase=activeRun?.phase;$('#run-status').textContent=phase==='acquiring'?'◎ Waiting for GPS…':phase==='recording'?'● Recording live':phase==='paused'?(activeRun.gpsError?'GPS unavailable — not recording':'Ⅱ Paused — route preserved'):reviewSession?'✓ Saved session':'Ready when you are';$('#run-start').textContent=phase==='paused'?(activeRun.gpsError?'Retry GPS':'● Resume'):phase==='acquiring'?'Getting GPS…':phase==='recording'?'● Recording live':reviewSession?'Restart':`● Start ${$('#run-mode').value==='run'?'run':'walk'}`;$('#run-start').disabled=phase==='recording'||phase==='acquiring';$('#run-pause').disabled=!runIsActive();$('#run-finish').disabled=!activeRun||!activeRun.points.length||seconds<=0||!!window.__longevityNative?.drainingLocations;$('#run-clear').hidden=true;$('#run-discard').hidden=!activeRun&&!reviewSession&&!state.route.length;$('#run-discard').textContent='Delete';$('#run-locate').disabled=runIsActive()||gpsLocating;$('#run-locate').textContent=gpsLocating?'Finding location…':'◎ Find my location';$('#run-pause').textContent=phase==='acquiring'?'Cancel search':'Pause';$('#gpx').disabled=!!activeRun;
 if(phase==='recording'&&Date.now()-(activeRun.lastFixAt||Date.now())>20000)$('#run-feedback').textContent='GPS signal is weak. The timer is running, but no distance is invented. Gaps will be marked on your saved route.';
 updateGPSSignal();const planSignature=[activeRun?.id||'',activeRun?.phase||'',Math.floor(seconds),a.distance].join(':');if(planSignature!==plannerRunProgressSignature){plannerRunProgressSignature=planSignature;syncPlannerExercise();}publishNativeRunStatus();return a;
}
function syncGPSMapVisibility(){
 const ready=!!routeMap&&(routePlanning||state.route.length>0||!!gpsMapFix);
 $('#route-map').hidden=!ready;
 $('#run-map-placeholder').hidden=ready;
 $('#run-map-placeholder-text').textContent=runnerMapLoading?'Loading street map…':state.route.length?'Street map unavailable. Your route outline is shown below.':'Your map will center here when location is available. No location has been guessed.';
}
function centerGPSMap(point,accuracy,coarse=false){
 if(!routeMap||!point)return;
 if(gpsPreviewCircle)routeMap.removeLayer(gpsPreviewCircle);
 if(window.L?.circle&&Number.isFinite(accuracy))gpsPreviewCircle=L.circle([point.lat,point.lon],{radius:Math.max(1,accuracy),color:'#77945f',fillOpacity:.08,weight:1}).addTo(routeMap);
 syncGPSMapVisibility();routeMap.invalidateSize();
 if(runFollow||!runnerCentered){routeMap.setView([point.lat,point.lon],coarse?Math.max(3,Math.min(14,Math.floor(16-Math.log2(Math.max(35,accuracy)/35)))):16,{animate:false});runnerCentered=true;}
 runMarker(point);
}
async function ensureRunnerMap(){
 if(runnerMapTask)return runnerMapTask;
 runnerMapLoading=true;syncGPSMapVisibility();
 runnerMapTask=(async()=>{try{
  await loadStreetMap();
  if(routeMap){
   syncGPSMapVisibility();routeMap.invalidateSize();$('#route').hidden=true;
   if(state.route.length){drawStreetRoute();runMarker(state.route.at(-1));}
   else if(gpsMapFix)centerGPSMap(gpsMapFix,gpsMapFix.accuracy,gpsMapFix.accuracy>35);
  }
 }finally{runnerMapLoading=false;runnerMapTask=null;syncGPSMapVisibility();}})();
 return runnerMapTask;
}
function updateGPSSignal(){
 const fix=activeRun?.lastObservedFix||gpsMapFix;
 $('#run-gps-accuracy').textContent=fix?`±${Math.round(fix.accuracy)} m`:'No fix yet';
 $('#run-gps-age').textContent=fix?`${Math.max(0,Math.floor((Date.now()-fix.receivedAt)/1000))} s ago`:'Waiting for device';
 $('#run-gps-points').textContent=String(activeRun?.points.length||reviewSession?.route.length||0);
 $('#run-locate-cancel').hidden=!gpsLocating;
 $('#run-follow').textContent=runFollow?'◎ Following you':'◎ Follow my position';
 $('#run-follow').setAttribute('aria-pressed',String(runFollow));
}
function cancelMapLookup(){gpsLocateToken++;gpsLocating=false;updateRunStats();$('#run-feedback').textContent='Location search cancelled. No route was recorded.';}
function runMarker(point){if(!point)return;if(routeMap&&window.L){if(!runnerMarker)runnerMarker=(L.marker&&L.divIcon?L.marker([point.lat,point.lon],{icon:L.divIcon({className:'run-person-marker',html:'<span aria-label="Runner">🏃</span>',iconSize:[34,34],iconAnchor:[17,24]})}):L.circleMarker([point.lat,point.lon],{radius:8,color:'#fff',weight:3,fillColor:'#335f42',fillOpacity:1})).addTo(routeMap);else runnerMarker.setLatLng([point.lat,point.lon]);if(runIsActive()&&runFollow)routeMap.panTo([point.lat,point.lon],{animate:false});}else{const svg=$('#route');if(!svg.dataset.projection)return;const p=JSON.parse(svg.dataset.projection);let marker=svg.querySelector('[data-run-marker]');if(!marker){marker=document.createElementNS('http://www.w3.org/2000/svg','circle');marker.dataset.runMarker='true';for(const[k,v]of Object.entries({r:7,fill:'#345d43',stroke:'#fff','stroke-width':3}))marker.setAttribute(k,v);svg.append(marker);}marker.setAttribute('cx',300+(point.lon-p.lon)*p.scale);marker.setAttribute('cy',150-(point.lat-p.lat)*p.scale);}}
function drawRunRoute(){state.route=activeRun?activeRun.points.map(p=>({...p})):reviewSession?reviewSession.route.map(p=>({...p})):state.route;drawStreetRoute();syncGPSMapVisibility();const pts=state.route;if(routeMap&&pts.length)runMarker(pts.at(-1));const a=RunMath.analyze(pts,activeRun?currentRunSeconds():Number(reviewSession?.minutes||0)*60);if(!routePlanning)drawElevationProfile(a);$('#route-status').textContent=pts.length?`${pts.length} GPS points · ${(a.distance/runUnitMeters()).toFixed(2)} ${state.runUnit} · ${a.gaps} marked ${a.gaps===1?'gap':'gaps'}. Paused sections are not joined.`:'No route yet. Start GPS or import a GPX file.';
 if(!routeMap){const lats=pts.map(p=>p.lat),lons=pts.map(p=>p.lon);if(pts.length){const minLat=Math.min(...lats),maxLat=Math.max(...lats),minLon=Math.min(...lons),maxLon=Math.max(...lons),scale=Math.min(540/(maxLon-minLon||1e-8),240/(maxLat-minLat||1e-8));$('#route').dataset.projection=JSON.stringify({lon:(minLon+maxLon)/2,lat:(minLat+maxLat)/2,scale});let groups=[[]];for(const p of pts){if(p.breakBefore)groups.push([]);groups.at(-1).push(`${300+(p.lon-(minLon+maxLon)/2)*scale},${150-(p.lat-(minLat+maxLat)/2)*scale}`);}$('#route').innerHTML=groups.map(g=>`<polyline points="${g.join(' ')}" fill="none" stroke="#5e874b" stroke-width="4"/>`).join('');$('#route').hidden=false;runMarker(pts.at(-1));}else{$('#route').innerHTML='<text x="300" y="150" text-anchor="middle" fill="#879c77">Your route will appear here.</text>';delete $('#route').dataset.projection;}}if(!pts.length){if(runnerMarker&&routeMap){routeMap.removeLayer(runnerMarker);runnerMarker=null;}if(replayLayer&&routeMap){routeMap.removeLayer(replayLayer);replayLayer=null;}}
}
function acceptRunPosition(position){if(!runIsActive())return false;const c=position.coords,stamp=Number(position.timestamp)||Date.now(),now=Date.now(),replayAnchor=lastRunBackground?.id===activeRun.id&&stamp>=lastRunBackground.wall&&stamp<=lastRunBackground.end?lastRunBackground:runBackground?.id===activeRun.id?runBackground:(activeRun.nativeClock??={wall:activeRun.activeSince,seconds:activeRun.seconds||0}),buffered=position.backgroundReplay===true&&Number.isFinite(replayAnchor.wall)&&stamp>=replayAnchor.wall&&stamp<=now&&now-stamp<=86400000;activeRun.lastAccuracy=Number.isFinite(c.accuracy)?c.accuracy:null;
 const spatial=Number.isFinite(c.latitude)&&Number.isFinite(c.longitude)&&Math.abs(c.latitude)<=90&&Math.abs(c.longitude)<=180&&Number.isFinite(c.accuracy)&&c.accuracy>=0;
 if(spatial&&now-stamp<=15000&&stamp-now<=5000){activeRun.lastObservedFix={lat:c.latitude,lon:c.longitude,accuracy:c.accuracy,receivedAt:now};updateGPSSignal();if(!activeRun.points.length){gpsMapFix=activeRun.lastObservedFix;ensureRunnerMap().then(()=>{if(runIsActive()&&gpsMapFix&&(!runnerCentered||!activeRun.points.length))centerGPSMap(gpsMapFix,gpsMapFix.accuracy,gpsMapFix.accuracy>35);});}}
 if(!Number.isFinite(c.latitude)||!Number.isFinite(c.longitude)||Math.abs(c.latitude)>90||Math.abs(c.longitude)>180||!Number.isFinite(c.accuracy)||c.accuracy<0||c.accuracy>(activeRun?.accuracyLimit||gpsAccuracyLimit())||(!buffered&&now-stamp>15000)||stamp-now>5000){$('#run-feedback').textContent=(Number.isFinite(c.accuracy)?'Location accuracy is ±'+Math.round(c.accuracy)+' m. ':'Location data is invalid. ')+(activeRun.phase==='acquiring'?`Waiting for a fresh fix within ${activeRun.accuracyLimit||gpsAccuracyLimit()} m; the active timer has not started.`:'This point was not added; the active timer continues.');return false;}
 if(activeRun.phase==='acquiring'&&gpsWaitSeconds()>=45){tickRunWatch();return false;}
 if(activeRun.phase==='acquiring'){activeRun.phase='recording';activeRun.activeSince=now;activeRun.activeSincePerf=performance.now();activeRun.nativeClock={wall:now,seconds:activeRun.seconds||0};activeRun.gpsError=false;$('#gps-help').hidden=true;requestRunWake();}
 const previous=activeRun.points.at(-1),wallOffset=now-performance.now(),clockShift=Number.isFinite(activeRun.wallOffset)&&Math.abs(wallOffset-activeRun.wallOffset)>5000;if(previous&&stamp<=Date.parse(previous.time)&&!clockShift)return false;
 const hasAltitude=typeof c.altitude==='number'&&Number.isFinite(c.altitude)&&(c.altitudeAccuracy==null||(Number.isFinite(c.altitudeAccuracy)&&c.altitudeAccuracy>=0&&c.altitudeAccuracy<=30));
 const point={lat:c.latitude,lon:c.longitude,ele:hasAltitude?c.altitude:null,time:new Date(stamp).toISOString(),accuracy:c.accuracy,altitudeAccuracy:c.altitudeAccuracy??null,elapsed:buffered?replayAnchor.seconds+Math.max(0,(stamp-replayAnchor.wall)/1000):currentRunSeconds(now),breakBefore:!!activeRun.needsBreak};
 if(buffered&&point.elapsed>currentRunSeconds(now)+1){activeRun.seconds=point.elapsed+Math.max(0,(now-stamp)/1000);activeRun.activeSince=now;activeRun.activeSincePerf=performance.now();}
 const gap=previous?Math.max(0,point.elapsed-(previous.elapsed??point.elapsed)):0,meters=previous?RunMath.meters(previous,point):0;
 if(previous&&!point.breakBefore&&gap<=10){if(gap<=0||meters/gap>(activeRun.mode==='walk'?6:12)){activeRun.rejected=(activeRun.rejected||0)+1;$('#run-feedback').textContent='An implausible location jump was ignored.';return false;}if(meters<Math.max(4,Math.min(25,((previous.accuracy||c.accuracy)+c.accuracy)/2))||(Number.isFinite(c.speed)&&c.speed>=0&&c.speed<.5&&meters<Math.max(8,c.accuracy))){activeRun.lastFixAt=now;runMarker(point);updateRunStats();return false;}}
 if(previous&&gap>10)point.breakBefore=true;
 if(activeRun.points.length>=10000){pauseRun('Point limit reached. Finish and save this session.');return false;}
 activeRun.needsBreak=false;activeRun.wallOffset=wallOffset;activeRun.points.push(point);activeRun.lastFixAt=now;state.route=activeRun.points;if(!activeRun.weatherRequested)fetchRunWeather(activeRun);lastGPSNotice=`GPS ±${Math.round(c.accuracy)} m · ${hasAltitude?'altitude available':'altitude unavailable or inaccurate'}`;$('#run-feedback').textContent=lastGPSNotice;if(!window.__longevityNativeBatch){drawRunRoute();updateRunStats();persistRun();}return true;
}
function completeNativeRunBatch(){if(activeRun){drawRunRoute();updateRunStats();persistRun();}}
function gpsErrorText(error){switch(Number(error?.code)){case 1:return 'Location permission is blocked. Allow location for this site and enable Location Services for your browser in your device settings.';case 2:return 'Your browser could not determine your location. Check device Location Services, move outdoors, or try a GPS-equipped phone.';case 3:return 'Location lookup timed out. Check location permissions and try again outdoors.';default:return 'The browser did not return a usable location. Check your device location settings, then retry.';}}
async function showGPSHelp(message,action='preview'){gpsHelpAction=action;$('#gps-help-title').textContent=action==='record'?'GPS is not ready — run not recording':'Could not find a usable location';$('#gps-help-text').textContent=message;$('#gps-help').hidden=false;$('#gps-retry').textContent=action==='record'?'Retry start with GPS':'Retry finding location';$('#gps-cancel').hidden=!activeRun;$('#gps-permission-state').textContent='';try{if(navigator.permissions?.query){const permission=await navigator.permissions.query({name:'geolocation'});$('#gps-permission-state').textContent='Browser location permission: '+permission.state+'. Device-level settings can also block location.';}}catch{}}
function failRunGPS(message){if(!activeRun)return;pauseRun(message);activeRun.gpsError=true;persistRun();updateRunStats();showGPSHelp(message,'record');}
function runGPSError(error){
 if(!runIsActive())return;
 if(Number(error.code)===1){failRunGPS(gpsErrorText(error));return;}
 // POSITION_UNAVAILABLE and TIMEOUT can be temporary. Keep the watch alive
 // until the acquisition deadline, or retain an active route during signal loss.
 $('#run-feedback').textContent=activeRun.phase==='acquiring'
  ? 'Still looking for precise GPS. The wait clock continues, with a 45-second limit. Check location settings and move outdoors.'
  : 'GPS signal is temporarily unavailable. Active time continues; distance waits for a usable fix. Long gaps are not connected.';
}
function tickRunWatch(){if(!activeRun)return;if(activeRun.phase==='acquiring'&&gpsWaitSeconds()>=45){const quality=activeRun.lastAccuracy!=null?' Latest reported accuracy: ±'+Math.round(activeRun.lastAccuracy)+' m ('+(activeRun.accuracyLimit||gpsAccuracyLimit())+' m or better required).':'';failRunGPS('No accurate GPS fix arrived within 45 seconds.'+quality+' Check precise-location settings or retry outdoors on a phone.');return;}updateRunStats();if(activeRun&&Math.floor(currentRunSeconds())%5===0)persistRun();}
function beginRunWatch(){
 const token=++gpsWatchToken;
 const success=position=>{if(token===gpsWatchToken&&runIsActive())acceptRunPosition(position);};
 const failure=error=>{if(token===gpsWatchToken&&runIsActive())runGPSError(error);};
 try{
  const id=navigator.geolocation.watchPosition(success,failure,{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  if(token!==gpsWatchToken||!runIsActive()){navigator.geolocation.clearWatch(id);return;}
  watchId=id;runTick=setInterval(()=>{if(token===gpsWatchToken)tickRunWatch();},1000);
  // Some browsers refresh getCurrentPosition more promptly than watchPosition.
  // Both are guarded by the same token and timestamp validation.
  navigator.geolocation.getCurrentPosition?.(success,failure,{enableHighAccuracy:true,maximumAge:0,timeout:12000});
 }catch(error){if(token===gpsWatchToken)failRunGPS(gpsErrorText(error));}
}
function cancelGPSAcquisition(){if(activeRun?.points.length){pauseRun('GPS search cancelled. Your existing route is paused and preserved.');}else{stopRunWatch();activeRun=null;state.runDraft=null;save();updateRunStats();$('#run-feedback').textContent='GPS search cancelled. Nothing was recorded.';}$('#gps-help').hidden=true;}
function gpsPreviewAttempt(options){return new Promise((resolve,reject)=>{let finished=false;const timer=setTimeout(()=>{if(!finished){finished=true;reject({code:3});}},options.timeout+1000);const complete=(fn,value)=>{if(finished)return;finished=true;clearTimeout(timer);fn(value);};try{navigator.geolocation.getCurrentPosition(p=>complete(resolve,p),e=>complete(reject,e),options);}catch(e){complete(reject,e);}});}
async function locateRunPreview(){if(runIsActive()||gpsLocating)return;if(!navigator.geolocation){showGPSHelp('This browser does not provide geolocation. Use a GPS-equipped phone or import GPX.');return;}if(!window.isSecureContext&&location.hostname!=='localhost'){showGPSHelp('Location requires HTTPS. Open the secure app link directly in your browser.');return;}const token=++gpsLocateToken;gpsLocating=true;$('#gps-help').hidden=true;updateRunStats();ensureRunnerMap();$('#run-feedback').textContent='Finding your location for the map only. This does not start a run or its active timer.';try{let position,approximate=false;try{position=await gpsPreviewAttempt({enableHighAccuracy:true,maximumAge:0,timeout:12000});}catch(error){if(error.code===1)throw error;if(token!==gpsLocateToken)return;$('#run-feedback').textContent='Precise GPS is unavailable. Trying a network-based location for the map only…';position=await gpsPreviewAttempt({enableHighAccuracy:false,maximumAge:60000,timeout:8000});approximate=true;}if(token!==gpsLocateToken)return;const c=position.coords;if(!Number.isFinite(c.latitude)||!Number.isFinite(c.longitude)||Math.abs(c.latitude)>90||Math.abs(c.longitude)>180||!Number.isFinite(c.accuracy)||c.accuracy<0)throw {code:2};const point={lat:c.latitude,lon:c.longitude,accuracy:c.accuracy,receivedAt:Date.now()};gpsMapFix=point;approximate=approximate||c.accuracy>(activeRun?.accuracyLimit||gpsAccuracyLimit());$('#run-feedback').textContent=`${approximate?'Approximate map location':'Location found'} · accuracy ±${Math.round(c.accuracy)} m. ${approximate?'This fix is not used for run distance. Enable precise location on a phone outdoors.':'Press Start to begin recording; standing still will not stop the timer once GPS is ready.'}`;if(approximate)showGPSHelp('Your browser supplied a rough location, which can center the map but cannot accurately track a run. Try precise location on a phone outdoors.','preview');await ensureRunnerMap();if(token===gpsLocateToken&&routeMap)centerGPSMap(point,c.accuracy,approximate);}catch(error){if(token!==gpsLocateToken)return;const message=gpsErrorText(error);$('#run-feedback').textContent=message;showGPSHelp(message,'preview');}finally{if(token===gpsLocateToken){gpsLocating=false;updateRunStats();}}}
function startRun(){if(routePlanning)setRoutePlanning(false);if(runIsActive())return;if(reviewSession)populateRunVitals({});let startingVitals;try{startingVitals=readRunVitals();}catch(error){$('#run-vitals-status').textContent=error.message;return;}gpsLocateToken++;gpsLocating=false;$('#gps-help').hidden=true;if(!navigator.geolocation){toast('This browser does not support GPS. Use GPX import instead.');return;}if(!window.isSecureContext&&location.hostname!=='localhost'){toast('GPS requires HTTPS. Open the secure app link in your phone browser.');return;}runFollow=true;runnerCentered=false;stopReplay();if(replayLayer&&routeMap){routeMap.removeLayer(replayLayer);replayLayer=null;}reviewAnalysis=null;reviewSession=null;$('#run-review-details').hidden=true;$('#run-review').hidden=true;$('#run-playback').hidden=true;if(!activeRun){runBackground=null;lastRunBackground=null;activeRun={...startingVitals,temperatureSource:startingVitals.temperature===null?null:'manual',id:crypto.randomUUID(),phase:'acquiring',points:[],seconds:0,activeSince:null,mode:$('#run-mode').value,accuracyLimit:gpsAccuracyLimit(),weight:Number(state.profile.weight),startedAt:new Date().toISOString(),date:localDate(),needsBreak:false,rejected:0,acquiringSince:Date.now(),acquiringSincePerf:performance.now(),gpsError:false};state.route=[];}else{activeRun.phase='acquiring';activeRun.needsBreak=activeRun.points.length>0;activeRun.activeSince=null;activeRun.activeSincePerf=null;activeRun.acquiringSince=Date.now();activeRun.acquiringSincePerf=performance.now();activeRun.gpsError=false;activeRun.lastAccuracy=null;}$('#run-save-vitals').hidden=true;$('#run-feedback').textContent='Allow location access. Waiting for an accurate outdoor GPS fix before the timer starts.';drawRunRoute();ensureRunnerMap();beginRunWatch();updateRunStats();persistRun();}
function pauseRun(message='Paused. Resume when you are ready; paused time and distance are excluded.'){if(!activeRun)return;if(/background|left the foreground/i.test(message)){if(document.hidden)suspendRunForBackground();else resumeRunFromBackground();return;}activeRun.seconds=currentRunSeconds();runBackground=null;activeRun.activeSince=null;activeRun.activeSincePerf=null;activeRun.phase='paused';activeRun.needsBreak=true;stopRunWatch();persistRun();updateRunStats();$('#run-feedback').textContent=message;}
function finishRun(){
 if(!activeRun)return;if(window.__longevityNative?.drainingLocations){$('#run-feedback').textContent='Restoring your background GPS points. Finish & save will be available when they have loaded.';return;}try{Object.assign(activeRun,readRunVitals());}catch(error){$('#run-vitals-status').textContent=error.message;return;}
 pauseRun();const seconds=currentRunSeconds(),a=RunMath.analyze(activeRun.points,seconds);
 if(!activeRun.points.length||seconds<=0){$('#run-feedback').textContent='Wait for GPS to start the timer before finishing, or cancel this search.';return;}
 const session={id:activeRun.id,date:activeRun.date,mode:activeRun.mode,minutes:seconds/60,weight:activeRun.weight,intensity:activeRun.intensity||'unknown',temperature:activeRun.temperature??null,bpmBefore:activeRun.bpmBefore??null,bpmAfter:activeRun.bpmAfter??null,temperatureSource:activeRun.temperatureSource??null,weather:activeRun.weather??null,weatherStatus:activeRun.weatherStatus??null,humidity:null,usedRoute:true,source:'live-gps',route:activeRun.points.map(p=>({...p})),result:runResult(a,seconds,activeRun.weight,activeRun.mode),startedAt:activeRun.startedAt,finishedAt:new Date().toISOString(),rejectedPoints:activeRun.rejected||0};
 const prior=state.activities,draft=state.runDraft;state.activities=[...prior.filter(r=>r.id!==session.id),session];state.runDraft=null;save();
 let saved=false;try{saved=JSON.parse(localStorage.getItem(KEY))?.activities?.some(r=>r.id===session.id&&r.finishedAt===session.finishedAt);}catch{}
 if(!saved){state.activities=prior;state.runDraft=draft;$('#run-feedback').textContent='Not saved: device storage is unavailable or full. Your run is paused. Retry Finish & save, or export the GPX before leaving.';return;}
 activeRun=null;runBackground=null;lastRunBackground=null;renderSessions();renderJournal();showRunReview(session);
 $('#run-feedback').textContent='Saved automatically to Daily journal. Today’s runs add together. Press Restart to clear the recorder for a new run. Your saved run stays in Past log.';
}
function clearSavedRunView(){
 if(activeRun)return;stopReplay();reviewSession=null;reviewAnalysis=null;runAnalysis=null;runBackground=null;lastRunBackground=null;populateRunVitals({});state.route=[];save();
 $('#run-review').hidden=true;$('#run-review-details').hidden=true;$('#run-playback').hidden=true;$('#gps-help').hidden=true;$('#run-replay-readout').textContent='';$('#run-splits').replaceChildren();drawRunRoute();updateRunStats();
 $('#run-feedback').textContent='Recorder cleared. Your saved runs are still in Past log. Start a new run from zero.';
}

function discardRun(){
 const savedID=!activeRun?reviewSession?.id:null;
 if(!activeRun&&!reviewSession&&!state.route.length)return;
 if(!confirm(savedID?'Delete this saved run from Past log and your exercise totals?':'Delete this unfinished run?'))return;
 stopRunWatch();stopReplay();activeRun=null;state.runDraft=null;
 if(savedID){if(typeof queueRunDeletion==='function')queueRunDeletion(savedID);state.activities=state.activities.filter(r=>r.id!==savedID);}
 clearSavedRunView();renderSessions();renderJournal();$('#run-feedback').textContent='';
}
function showRunReview(session){if(routePlanning)setRoutePlanning(false);if(activeRun){toast('Finish or discard the unfinished run before opening a saved session.');return;}stopReplay();reviewSession=session;populateRunVitals(session);state.route=session.route.map(p=>({...p}));$('#run-mode').value=session.mode;$('#run-review').hidden=false;$('#run-review-title').textContent=`${session.id==='import-preview'?'Imported route · ':''}${session.mode==='walk'?'Walk':'Run'} · ${session.date}`;const a=RunMath.analyze(session.route,Number(session.minutes)*60);reviewAnalysis=a;runAnalysis=a;$('#run-review-note').textContent=`${session.minutes?RunMath.clock(a.duration)+' active time':'Duration not recorded'} · ${(a.distance/runUnitMeters()).toFixed(2)} ${state.runUnit} · ${session.result.calories??'—'} estimated kcal. ${session.terrainElevation?'Heights use approximate terrain elevations. ':''}${a.gaps} route gaps. ${a.altitudePoints>1?'Filtered GPS elevation is shown below.':'Elevation is unavailable for this route.'}`;$('#run-split-title').textContent=state.runUnit==='km'?'Kilometer splits':'Mile splits';const box=$('#run-splits');box.replaceChildren();const splits=RunMath.splits(a,runUnitMeters());if(!splits.length)box.innerHTML='<p class="muted">No distance splits are available.</p>';splits.forEach((s,i)=>{const row=document.createElement('div');row.className='run-split-row';const label=document.createElement('strong');label.textContent=`${i+1}${s.partial?' · partial':''}`;const length=document.createElement('span');length.textContent=(s.distance/runUnitMeters()).toFixed(2)+' '+state.runUnit;const time=document.createElement('span');time.textContent=RunMath.clock(s.seconds);const pace=document.createElement('span');pace.textContent=RunMath.clock(s.seconds/(s.distance/runUnitMeters()))+' / '+state.runUnit;row.append(label,length,time,pace);box.append(row);});$('#run-playback').hidden=session.id!=='import-preview'||session.route.length<2;$('#imported-route-save').hidden=session.id!=='import-preview';$('#imported-route-minutes').value=session.minutes||'';$('#imported-route-status').textContent=session.minutes?'Duration read from GPX timestamps.':'This GPX has no elapsed time. Enter it before saving; pace and calories are unavailable until then.';$('#run-replay-kind').textContent=a.timed?'Timestamp-based playback':'Distance-based playback · timestamps missing';$('#run-scrub').value=0;replayFraction=0;drawRunRoute();updateRunStats();ensureRunnerMap().then(()=>replayRunAt(0));replayRunAt(0);$('#run-review-details').hidden=false;showExerciseTool('gps');openAppPage('activity');}
function stopReplay(){if(replayTimer){clearInterval(replayTimer);replayTimer=null;}if($('#run-play'))$('#run-play').textContent='▶ Play time-lapse';}
function replayRunAt(fraction){if(!reviewSession)return;replayFraction=Math.max(0,Math.min(1,fraction));const a=reviewAnalysis||RunMath.analyze(reviewSession.route,Number(reviewSession.minutes)*60),point=RunMath.at(a,replayFraction);if(!point)return;$('#run-scrub').value=Math.round(replayFraction*1000);$('#run-replay-readout').textContent=`${RunMath.clock(point.elapsed)} · ${(point.meters/runUnitMeters()).toFixed(2)} ${state.runUnit} · ~${RunMath.energy({...a,distance:point.meters,gain:point.ascent||0},point.elapsed,Number(reviewSession.weight),reviewSession.mode)} kcal${point.inGap?' · GPS gap (holding last fix)':''} · elevation ${point.height===null?'unavailable':Math.round(point.height*(state.runUnit==='km'?1:3.28084))+' '+(state.runUnit==='km'?'m':'ft')}`;runMarker(point);if(routeMap&&window.L){if(replayLayer)routeMap.removeLayer(replayLayer);const groups=[[]];for(let i=0;i<point.index;i++){const p=a.points[i];if(p.breakBefore)groups.push([]);groups.at(-1).push([p.lat,p.lon]);}if(point.breakBefore)groups.push([]);groups.at(-1).push([point.lat,point.lon]);replayLayer=L.polyline(groups,{color:'#b2c987',weight:6}).addTo(routeMap);runnerMarker?.bringToFront?.();}const svg=$('#elevation-chart');svg.querySelector('[data-replay-cursor]')?.remove();if(a.distance>0&&a.altitudePoints>0){const cursor=document.createElementNS('http://www.w3.org/2000/svg','line');cursor.dataset.replayCursor='true';const x=Number(svg.dataset.profileLeft||58)+point.meters/a.distance*Number(svg.dataset.profileWidth||718);for(const[k,v]of Object.entries({x1:x,x2:x,y1:20,y2:176,stroke:'#345d43','stroke-width':2,'stroke-dasharray':'4 3'}))cursor.setAttribute(k,v);svg.append(cursor);}}
function playRun(){if(replayTimer){stopReplay();return;}if(!reviewSession)return;if(replayFraction>=1)replayFraction=0;const duration=(reviewAnalysis||RunMath.analyze(reviewSession.route,Number(reviewSession.minutes)*60)).duration||Number(reviewSession.minutes)*60;if(duration<=0){replayRunAt(1);return;}let previous=performance.now();$('#run-play').textContent='Ⅱ Pause playback';replayTimer=setInterval(()=>{const now=performance.now(),step=(now-previous)/1000;previous=now;replayRunAt(replayFraction+step*Number($('#run-replay-speed').value)/duration);if(replayFraction>=1)stopReplay();},100);}
function exportRunGPX(){const points=reviewSession?.route||activeRun?.points||state.route;if(!points.length)return;const blob=new Blob([RunMath.toGPX(points)],{type:'application/gpx+xml'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`longevity-${reviewSession?.date||localDate()}.gpx`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function lookupRunTerrain(){if(!reviewSession||reviewSession.route.length<2)return;if(!confirm('Send sampled route coordinates to Open-Meteo and replace displayed heights with approximate ground elevations? GPS heights will be retained in the JSON export.'))return;const session=reviewSession;$('#run-terrain').disabled=true;$('#run-terrain-note').textContent='Looking up approximate ground elevations…';try{const raw=session.route,n=raw.length;const indices=[...new Set(Array.from({length:Math.min(100,n)},(_,i)=>Math.round(i*(n-1)/(Math.min(100,n)-1))))];const url='https://api.open-meteo.com/v1/elevation?latitude='+indices.map(i=>raw[i].lat).join(',')+'&longitude='+indices.map(i=>raw[i].lon).join(',');const response=await fetch(url);if(!response.ok)throw Error('Elevation service unavailable. Your original route is unchanged.');const data=await response.json();if(!Array.isArray(data.elevation)||data.elevation.length!==indices.length||data.elevation.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw Error('Elevation service returned incomplete data.');const heights=new Map(indices.map((index,j)=>[index,data.elevation[j]]));let sample=0;const route=raw.map((p,i)=>{while(sample<indices.length-2&&i>indices[sample+1])sample++;let ele=heights.get(i);if(ele==null){const lo=indices[sample],hi=indices[sample+1];const gap=raw.slice(lo+1,hi+1).some(v=>v.breakBefore);if(!gap)ele=data.elevation[sample]+(data.elevation[sample+1]-data.elevation[sample])*(i-lo)/(hi-lo);}return {...p,gpsEle:p.gpsEle??p.ele,ele:ele??null,elevationSource:'terrain'};});const a=RunMath.analyze(route,Number(session.minutes)*60);const updated={...session,route,terrainElevation:true,result:runResult(a,Number(session.minutes)*60,Number(session.weight),session.mode)};const existing=state.activities.findIndex(s=>s.id===session.id);if(existing>=0)state.activities[existing]=updated;state.route=route;save();renderSessions();renderJournal();showRunReview(updated);$('#run-terrain-note').textContent='Approximate terrain elevations applied, with interpolation between samples. Actual running height can differ (for example on bridges). Original GPS heights remain in the JSON export.';}catch(err){$('#run-terrain-note').textContent=err.message;}finally{$('#run-terrain').disabled=false;}}
function initializeRunner(){
 const nativeNote=document.querySelector('#activity .compact-screen-note');if(nativeNote&&window.__longevityNative){nativeNote.textContent=window.__longevityNative.bridgeVersion>=4?'iPhone recorder 4: native GPS continues while locked or in another app. Check Run recording status in iPhone app options.':'Install the latest iPhone Xcode build for the updated background recorder and Lock Screen / Dynamic Island status. Reloading the website alone cannot install these native features.';}

 state.runUnit=state.runUnit==='km'?'km':'mi';$('#run-unit').value=state.runUnit;syncExerciseChoices();$('#run-terrain').onclick=lookupRunTerrain;$('#run-start').onclick=()=>{if(reviewSession&&!activeRun){clearSavedRunView();return;}startRun();};$('#run-pause').onclick=()=>activeRun?.phase==='acquiring'?cancelGPSAcquisition():pauseRun();$('#run-finish').onclick=finishRun;if($('#run-open-journal'))$('#run-open-journal').onclick=()=>{if(reviewSession&&typeof openJournalRunViewer==='function')openJournalRunViewer(reviewSession);};$('#run-clear').onclick=clearSavedRunView;$('#run-discard').onclick=discardRun;$('#run-mode').onchange=updateRunStats;$('#run-unit').onchange=()=>{state.runUnit=$('#run-unit').value;save();if(routePlanning){renderPlannedRoute();}else if(reviewSession)showRunReview(reviewSession);else{updateRunStats();drawRunRoute();}};$('#run-play').onclick=playRun;$('#run-restart').onclick=()=>{stopReplay();replayRunAt(0);};$('#run-scrub').oninput=()=>{stopReplay();replayRunAt(Number($('#run-scrub').value)/1000);};$('#run-export').onclick=exportRunGPX;$('#run-new').onclick=clearSavedRunView;
 window.addEventListener('resize',()=>{if($('#activity').classList.contains('active')){if(routePlanning)renderPlannedRoute();else drawRunRoute();}});
 $('#load-map').onclick=ensureRunnerMap;
 $('#run-locate').onclick=locateRunPreview;$('#run-map-locate').onclick=locateRunPreview;$('#run-locate-cancel').onclick=cancelMapLookup;$('#run-follow').onclick=()=>{runFollow=!runFollow;if(runFollow&&routeMap){const p=activeRun?.points.at(-1)||gpsMapFix;if(p){routeMap.setView([p.lat,p.lon],16);runMarker(p);}}updateGPSSignal();};$('#gps-retry').onclick=()=>gpsHelpAction==='record'?startRun():locateRunPreview();$('#gps-cancel').onclick=cancelGPSAcquisition;

 const oldStop=stopGPS;stopGPS=function(){if(activeRun)pauseRun('Recording paused because the session is closing. Your route draft is preserved.');else oldStop();};
 const oldRender=renderSessions;renderSessions=function(){oldRender();const sorted=[...state.activities].sort((a,b)=>b.date.localeCompare(a.date));$('#activity-history').querySelectorAll('.record').forEach((card,i)=>{const session=state.activities.find(r=>r.id===card.dataset.runId)||sorted[i];const button=card.querySelector('[data-open]');if(button){button.textContent='View route & time-lapse';button.onclick=()=>typeof openJournalRunViewer==='function'?openJournalRunViewer(session):showRunReview(session);}const weather=card.querySelectorAll('p')[1];if(weather&&session.temperature==null)weather.textContent=`${session.result.calories??'—'} estimated kcal`;appendExerciseVitals(card,session);});};renderSessions();
 const oldRoute=renderRoute;renderRoute=function(){oldRoute();if(!activeRun&&state.route.length>1){const mode=$('#run-mode').value,imported=RunMath.analyze(state.route,0),seconds=imported.timed&&imported.duration>0?imported.duration:0;reviewSession={id:'import-preview',mode,date:localDate(),minutes:seconds/60,weight:Number(state.profile.weight),route:state.route.map(p=>({...p})),result:{calories:null}};const a=RunMath.analyze(reviewSession.route,seconds);reviewSession.result=runResult(a,a.duration,reviewSession.weight,mode);if(!seconds)reviewSession.result.calories=null;showRunReview(reviewSession);}};
 document.querySelector('nav button[data-page="activity"]').addEventListener('click',()=>{ensureRunnerMap();drawRunRoute();autoLocateExercise();});document.querySelectorAll('[data-destination="activity"]').forEach(el=>el.addEventListener('click',ensureRunnerMap));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)suspendRunForBackground();else resumeRunFromBackground();});window.addEventListener('pagehide',()=>{suspendRunForBackground();stopReplay();});window.addEventListener('pageshow',resumeRunFromBackground);window.addEventListener('beforeunload',event=>{if(runIsActive()){event.preventDefault();event.returnValue='';}});
 if(state.runDraft?.points&&Array.isArray(state.runDraft.points)){
 const draft=state.runDraft,running=draft.phase==='recording'&&Number.isFinite(draft.checkpointAt)&&draft.checkpointAt<=Date.now();
 activeRun={...draft,seconds:(draft.seconds||0)+(running?Math.max(0,(Date.now()-draft.checkpointAt)/1000):0),phase:running?'recording':'paused',activeSince:running?Date.now():null,activeSincePerf:running?performance.now():null,needsBreak:draft.points.length>0};state.route=activeRun.points;
 $('#run-feedback').textContent=running?'Your running timer was recovered. GPS gaps stay marked. Finish and save when you are done.':'An unfinished paused run was recovered. Resume, finish it, or discard it.';drawRunRoute();populateRunVitals(activeRun);if(running)beginRunWatch();
 }

 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});$('#install-run-app').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;}else $('#install-dialog').showModal();};$('#close-install').onclick=()=>$('#install-dialog').close();$('#save-imported-route').onclick=saveImportedRoute;initializeRunVitals();initializeRoutePlanning();if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});updateRunStats();drawRunRoute();
}

async function autoLocateExercise(){
 if(activeRun||reviewSession||state.route.length||gpsLocating||gpsMapFix)return;
 try{if(navigator.permissions?.query){const permission=await navigator.permissions.query({name:'geolocation'});if(permission.state==='granted'&&$('#activity').classList.contains('active'))locateRunPreview();}}catch{}
}

// Button choices keep common settings visible without opening menus.
function syncExerciseChoices(){
 document.querySelectorAll('#activity [data-exercise-choice]').forEach(button=>{
  const select=document.getElementById(button.dataset.exerciseChoice);
  button.setAttribute('aria-pressed',String(select.value===button.dataset.value));
  button.disabled=select.disabled;
 });
}
function initializeExerciseChoices(){
 document.querySelectorAll('#activity select').forEach((select,index)=>{
  if(!select.id)select.id='exercise-setting-'+index;
  const parent=select.parentElement,group=document.createElement('div');group.className='exercise-choice-buttons';
  group.setAttribute('role','group');group.setAttribute('aria-label',parent.firstChild?.textContent?.trim()||'Options');
  for(const option of select.options){
   const button=document.createElement('button');button.type='button';button.textContent=option.textContent.split(' · ')[0];
   button.dataset.exerciseChoice=select.id;button.dataset.value=option.value;
   button.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));syncExerciseChoices();};
   group.append(button);
  }
  select.hidden=true;parent.append(group);
  if(parent.tagName==='LABEL'){
   const wrapper=document.createElement('div');wrapper.className='exercise-choice-field';
   while(parent.firstChild)wrapper.append(parent.firstChild);
   parent.replaceWith(wrapper);
  }
 });
 syncExerciseChoices();
}
let elevationHoverMarker=null,elevationHoverMap=null;
function clearElevationHover(){
 if(elevationHoverMarker)elevationHoverMap?.removeLayer?.(elevationHoverMarker);
 elevationHoverMarker=null;elevationHoverMap=null;
 $('#elevation-chart')?.querySelectorAll('[data-elevation-hover]').forEach(el=>el.remove());
}
function drawElevationProfile(analysis){
 clearElevationHover();
 const svg=$('#elevation-chart'),caption=$('#elevation-caption'),metric=state.runUnit==='km';
 const width=Math.max(320,Math.min(800,svg.clientWidth||800)),left=58,right=24,top=24,bottom=176;
 svg.onpointermove=null;svg.onpointerleave=clearElevationHover;svg.onkeydown=null;
 svg.setAttribute('viewBox',`0 0 ${width} 220`);svg.replaceChildren();
 const ns='http://www.w3.org/2000/svg';
 const add=(tag,attrs,text)=>{const el=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;svg.append(el);return el;};
 const valid=analysis.points.filter(p=>Number.isFinite(p.height)),factor=metric?1:3.28084;
 const altUnit=metric?'m':'ft',distanceUnit=metric?'km':'mi';
 $('#elevation-axis-labels').children[0].textContent=`Altitude (${altUnit})`;
 $('#elevation-axis-labels').children[1].textContent=`Distance (${distanceUnit})`;
 $('#elevation-range').textContent=valid.length?`Ascent ${Math.round(analysis.gain*factor)} ${altUnit}`:'Waiting for altitude';
 add('title',{},'Route elevation profile');
 if(!valid.length){
  add('line',{x1:left,x2:width-right,y1:bottom,y2:bottom,stroke:'#dce5d5'});
  add('text',{x:width/2,y:100,'text-anchor':'middle',fill:'#60745d','font-size':16},analysis.points.length?'Altitude unavailable':'Elevation appears as you move');
  caption.textContent=analysis.points.length?'Your device or GPX file has no usable altitude. No elevation is invented.':'Record a run or import GPX to see altitude along your route.';
  return;
 }
 let min=Infinity,max=-Infinity;for(const p of valid){min=Math.min(min,p.height*factor);max=Math.max(max,p.height*factor);}
 const pad=Math.max(metric?2:6,(max-min)*.15),low=min-pad,high=max+pad;
 const x=p=>left+(analysis.distance?p.meters/analysis.distance:0)*(width-left-right);
 const y=p=>bottom-(p.height*factor-low)/(high-low)*(bottom-top);
 svg.dataset.profileLeft=String(left);svg.dataset.profileWidth=String(width-left-right);
 add('desc',{},`Altitude ranges from ${Math.round(min)} to ${Math.round(max)} ${altUnit}. Gaps in GPS or altitude are not connected.`);
 for(let i=0;i<3;i++){
  const height=low+(high-low)*i/2,py=bottom-(bottom-top)*i/2;
  add('line',{x1:left,x2:width-right,y1:py,y2:py,stroke:'#e3e9dd'});
  add('text',{x:left-9,y:py+5,'text-anchor':'end',fill:'#60745d','font-size':14},height.toFixed(Math.abs(high-low)<5?1:0));
 }
 // Separate missing-altitude and paused segments before drawing any paths.
 let group=[];const groups=[];
 for(const p of analysis.points){
  if(p.breakBefore||!Number.isFinite(p.height)){if(group.length)groups.push(group);group=[];}
  if(Number.isFinite(p.height))group.push(p);
 }
 if(group.length)groups.push(group);
 for(const points of groups){
  const step=Math.max(1,Math.ceil(points.length/1000)),drawn=points.filter((p,i)=>i%step===0||i===points.length-1);
  if(drawn.length===1){add('circle',{cx:x(drawn[0]),cy:y(drawn[0]),r:4,fill:'#47784e'});continue;}
  const line=drawn.map(p=>`${x(p).toFixed(2)},${y(p).toFixed(2)}`).join(' ');
  add('polygon',{points:`${x(drawn[0])},${bottom} ${line} ${x(drawn.at(-1))},${bottom}`,fill:'#e8f0df','data-elevation-area':'true'});
  add('polyline',{points:line,fill:'none',stroke:'#47784e','stroke-width':2.5,'stroke-linecap':'round','stroke-linejoin':'round','data-elevation-segment':'true'});
 }
 for(let i=0;i<3;i++)add('text',{x:left+(width-left-right)*i/2,y:204,'text-anchor':'middle',fill:'#60745d','font-size':14},(analysis.distance/runUnitMeters()*i/2).toFixed(2));
 // The graph and marker use the exact same route sample, including on return legs.
 let hoverIndex=0;
 const inspect=index=>{
  clearElevationHover();hoverIndex=Math.max(0,Math.min(analysis.points.length-1,index));
  const p=analysis.points[hoverIndex],px=x(p);
  add('line',{x1:px,x2:px,y1:top,y2:bottom,stroke:'#345d43','stroke-width':2,'data-elevation-hover':'true'});
  const label=`${(p.meters/runUnitMeters()).toFixed(2)} ${distanceUnit} · ${Number.isFinite(p.height)?Math.round(p.height*factor)+' '+altUnit:'Altitude unavailable'}`;
  add('text',{x:Math.max(left+90,Math.min(width-right-90,px)),y:16,'text-anchor':'middle',fill:'#234338','font-size':14,'data-elevation-hover':'true'},label);
  if(routeMap&&window.L?.circleMarker&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)){
   elevationHoverMap=routeMap;elevationHoverMarker=L.circleMarker([p.lat,p.lon],{radius:8,color:'#fff',weight:3,fillColor:'#345d43',fillOpacity:1,interactive:false}).addTo(routeMap);
  }
 };
 svg.setAttribute('tabindex','0');svg.setAttribute('aria-label','Route elevation profile. Hover or drag to locate a point on the map. Use arrow keys when focused.');
 svg.onpointermove=event=>{
  const rect=svg.getBoundingClientRect();if(!rect.width)return;
  const target=Math.max(0,Math.min(1,((event.clientX-rect.left)*width/rect.width-left)/(width-left-right)))*analysis.distance;
  let nearest=0;for(let i=1;i<analysis.points.length;i++)if(Math.abs(analysis.points[i].meters-target)<Math.abs(analysis.points[nearest].meters-target))nearest=i;
  inspect(nearest);
 };
 svg.onkeydown=event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();inspect(hoverIndex+(event.key==='ArrowRight'?1:-1));}};
 svg.onblur=clearElevationHover;
 caption.textContent=`${valid.length} of ${analysis.points.length} points have altitude. GPS heights are smoothed; missing heights and paused sections stay separate.${analysis.excluded?' Implausible slopes are excluded from ascent.':''}${valid.length===1?' Keep moving to build a profile.':''}`;
}
function saveImportedRoute(){
 if(!reviewSession||reviewSession.id!=='import-preview'||activeRun)return;
 if(!exerciseCanSave()){$('#imported-route-status').textContent='Reconnect or reload your account before saving.';return;}
 const minutes=Number($('#imported-route-minutes').value);
 if(!Number.isFinite(minutes)||minutes<1||minutes>600){$('#imported-route-status').textContent='Enter the actual duration, from 1 to 600 minutes.';return;}
 const route=reviewSession.route.map(p=>({...p})),a=RunMath.analyze(route,minutes*60);
 let vitals;try{vitals=readRunVitals();}catch(error){$('#imported-route-status').textContent=error.message;return;}
 const session={...reviewSession,...vitals,temperatureSource:reviewSession.temperatureSource??(vitals.temperature===null?null:'manual'),id:crypto.randomUUID(),minutes,result:runResult(a,minutes*60,reviewSession.weight,reviewSession.mode),source:'gpx-import'};
 const old=state.activities;state.activities=[...old,session];save();
 try{if(!JSON.parse(localStorage.getItem(KEY))?.activities?.some(s=>s.id===session.id))throw Error();}
 catch{state.activities=old;$('#imported-route-status').textContent='Not saved: browser storage is unavailable. Export your GPX and try again.';return;}
 renderSessions();renderJournal();showRunReview(session);toast('Imported route saved.');
}

function readRunVitals(){return {...validateExerciseVitals({temperature:$('#run-temperature').value,bpmBefore:$('#run-bpm-before').value,bpmAfter:$('#run-bpm-after').value}),intensity:$('#run-intensity')?.value||'unknown'};}
function populateRunVitals(session){
 if($('#run-intensity'))$('#run-intensity').value=session.intensity||'unknown';
 $('#run-temperature').value=session.temperature??'';$('#run-bpm-before').value=session.bpmBefore??'';$('#run-bpm-after').value=session.bpmAfter??'';
 $('#run-weather-status').textContent=session.weatherStatus||(session.temperatureSource==='manual'?'Manually entered air temperature.':session.weather?'Open-Meteo hourly outdoor temperature near this route.':'');
 $('#run-save-vitals').hidden=!session.id||session.id==='import-preview'||!!activeRun;
 $('#run-temperature').dataset.dirty='false';$('#run-vitals-status').textContent='';
}
function initializeRunVitals(){
 for(const id of ['run-temperature','run-bpm-before','run-bpm-after'])$('#'+id).addEventListener('input',()=>{
  try{
   if(id==='run-temperature')$('#run-temperature').dataset.dirty='true';
   const vitals=readRunVitals();$('#run-vitals-status').textContent='';
   if(activeRun){Object.assign(activeRun,vitals);if(id==='run-temperature'){activeRun.temperatureSource=vitals.temperature===null?null:'manual';activeRun.weatherStatus='Manually edited air temperature.';}persistRun();}
   else if(reviewSession&&reviewSession.id==='import-preview'){Object.assign(reviewSession,vitals);if(id==='run-temperature')reviewSession.temperatureSource=vitals.temperature===null?null:'manual';}
   if(!activeRun&&reviewSession&&reviewSession.id!=='import-preview')$('#run-vitals-status').textContent='Tap Save readings to journal to keep your changes.';
  }catch(error){$('#run-vitals-status').textContent=error.message;}
 });
 $('#run-save-vitals').onclick=()=>{
  if(!reviewSession||reviewSession.id==='import-preview'||!exerciseCanSave())return;
  try{
   const vitals=readRunVitals(),old=state.activities,existing=old.find(s=>s.id===reviewSession.id);if(!existing)throw Error('This session was removed.');
   const changed=vitals.temperature!==existing.temperature;
   const updated={...existing,...vitals,temperatureSource:changed?(vitals.temperature===null?null:'manual'):existing.temperatureSource,weatherStatus:changed?'Manually edited air temperature.':existing.weatherStatus};
   state.activities=old.map(s=>s.id===updated.id?updated:s);save();
   try{const saved=JSON.parse(localStorage.getItem(KEY))?.activities?.find(s=>s.id===updated.id);if(!saved||['temperature','bpmBefore','bpmAfter'].some(k=>saved[k]!==updated[k]))throw Error();}
   catch{state.activities=old;throw Error('Not saved: browser storage is unavailable.');}
   reviewSession=updated;$('#run-temperature').dataset.dirty='false';renderSessions();renderJournal();$('#run-vitals-status').textContent='Readings saved to this session and Daily journal.';
  }catch(error){$('#run-vitals-status').textContent=error.message;}
 };
 $('#run-weather-retry').onclick=()=>{
  const session=activeRun||reviewSession;
  if(!session?.route?.length&&!session?.points?.length){$('#run-weather-status').textContent='Start a run or open a saved route first. You can enter temperature manually.';return;}
  fetchRunWeather(session,true);
 };
}
const runWeatherPending=new Set();
async function fetchRunWeather(session,force=false){
 if(runWeatherPending.has(session.id)||(!force&&session.weatherRequested))return;
 const point=(session.points||session.route||[])[0];if(!point)return;
 const accountKey=KEY,id=session.id;
 const target=Date.parse(session.startedAt||point.time||session.date+'T12:00:00');
 if(!Number.isFinite(target))return;
 session.weatherRequested=true;runWeatherPending.add(id);
 session.weatherStatus='Fetching outdoor temperature for the route time…';
 if(activeRun?.id===id||reviewSession?.id===id)$('#run-weather-status').textContent=session.weatherStatus;
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
 try{
  const date=new Date(target).toISOString().slice(0,10),days=(Date.now()-target)/86400000;
  const endpoint=days>5?'https://archive-api.open-meteo.com/v1/archive':'https://api.open-meteo.com/v1/forecast';
  const query=new URLSearchParams({latitude:String(point.lat),longitude:String(point.lon),start_date:date,end_date:date,hourly:'temperature_2m',temperature_unit:'celsius',timezone:'UTC',timeformat:'unixtime'});
  const response=await fetch(endpoint+'?'+query,{signal:controller.signal});if(!response.ok)throw Error('Weather service unavailable');
  const data=await response.json(),times=data.hourly?.time,temperatures=data.hourly?.temperature_2m;
  if(!Array.isArray(times)||!Array.isArray(temperatures)||times.length!==temperatures.length)throw Error('Weather data missing');
  let index=-1,best=Infinity;
  for(let i=0;i<times.length;i++){const delta=Math.abs(Number(times[i])*1000-target);if(delta<best){best=delta;index=i;}}
  const temperature=temperatures[index];
  if(index<0||best>3600000||typeof temperature!=='number'||!Number.isFinite(temperature)||temperature < -60||temperature >65)throw Error('No temperature for this time');
  if(!globalThis.document?.body||KEY!==accountKey||!exerciseCanSave())return;
  const live=activeRun?.id===id?activeRun:state.activities.find(s=>s.id===id)||(id==='import-preview'&&reviewSession?.id===id?reviewSession:null);
  if(!live)return; // An abandoned or deleted run must not receive late results.
  // Preserve both explicit manual entries and unsaved manual corrections.
  let unsavedManual=false;
  if(reviewSession?.id===id)unsavedManual=$('#run-temperature').dataset.dirty==='true';
  if(force||(!unsavedManual&&live.temperatureSource!=='manual')){live.temperature=temperature;live.temperatureSource='open-meteo';}
  live.weather={provider:'Open-Meteo',sampleTime:new Date(times[index]*1000).toISOString(),requestedTime:new Date(target).toISOString(),fetchedAt:new Date().toISOString(),temperatureC:temperature};
  live.weatherStatus=live.temperatureSource==='manual'?'Your entered temperature is kept. Weather estimate is available in the session export.':`Open-Meteo weather estimate · ${temperature} °C · hourly data near the route start time.`;
  if(activeRun?.id===id)persistRun();else save();
  if(activeRun?.id===id||reviewSession?.id===id){
   if(!unsavedManual||force){$('#run-temperature').value=live.temperature??'';$('#run-temperature').dataset.dirty='false';}
   $('#run-weather-status').textContent=live.weatherStatus;
  }
  renderSessions();renderJournal();
 }catch(error){
  const live=activeRun?.id===id?activeRun:state.activities.find(s=>s.id===id)||(id==='import-preview'&&reviewSession?.id===id?reviewSession:null);
  if(!globalThis.document?.body||KEY!==accountKey||!live||!exerciseCanSave())return;
  live.weatherStatus='Weather unavailable for this time. Enter air temperature manually, or tap Refresh weather.';
  if(activeRun?.id===id)persistRun();else save();
  if(activeRun?.id===id||reviewSession?.id===id)$('#run-weather-status').textContent=live.weatherStatus;
 }finally{clearTimeout(timeout);runWeatherPending.delete(id);}
}

// Planned paths never enter state.route, activities, or completion evidence.
let routePlanning=false,routeDrawing=true,plannedPoints=[],plannedPace=6,plannedLayer=null;
let plannedRouteVerified=false,plannedRouteAbort=null,plannedRouteVersion=0,lastPlannedRouteRequest=0,plannedGait='run';
const plannedElevationCache=new Map();
let routeUndo=[],drawStroke=null,drawingMap=null,plannedElevationTimer=null,plannedElevationAbort=null,plannedElevationVersion=0,plannedElevationMessage='';
function initializeRoutePlanning(){
 const saved=(()=>{try{return JSON.parse(localStorage.getItem(KEY))?.plannedRoute;}catch{return null;}})();
 if(saved&&Array.isArray(saved.points)&&saved.points.length<=10000){
  plannedPoints=saved.points.filter(p=>Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&Number.isFinite(p.lon)&&Math.abs(p.lon)<=180).map(p=>({lat:p.lat,lon:p.lon,ele:Number.isFinite(p.ele)?p.ele:null}));
  plannedRouteVerified=saved.routingProvider==='valhalla-pedestrian';plannedGait=saved.gait==='walk'?'walk':'run';
  if(Number.isFinite(saved.paceMinutesPerKm)&&saved.paceMinutesPerKm>=3&&saved.paceMinutesPerKm<=20)plannedPace=saved.paceMinutesPerKm;
  state.plannedRoute={points:plannedPoints.map(p=>({...p})),paceMinutesPerKm:plannedPace,gait:plannedGait,routingProvider:plannedRouteVerified?'valhalla-pedestrian':null};
 }
 $('#route-mode-record').onclick=()=>setRoutePlanning(false);$('#route-mode-plan').onclick=()=>setRoutePlanning(true);
 $('#route-draw-toggle').onclick=()=>{routeDrawing=!routeDrawing;applyRouteDrawingMode();};
 $('#route-draw-undo').onclick=()=>{
  if(!plannedPoints.length)return;cancelPlannedRouting();invalidatePlannedElevation();const snapshot=routeUndo.pop();plannedPoints=snapshot?.points||plannedPoints.slice(0,-1);plannedRouteVerified=!!snapshot?.verified;
  renderPlannedRoute();persistPlannedRoute();if(!plannedRouteVerified)schedulePlannedRouting();
 };
 $('#route-draw-clear').onclick=()=>{
  if(plannedPoints.length&&!confirm('Clear the planned route? Recorded workouts will be kept.'))return;
  cancelPlannedRouting();invalidatePlannedElevation();plannedPoints=[];routeUndo=[];plannedRouteVerified=false;renderPlannedRoute();persistPlannedRoute();
 };
 $('#route-elevation-retry').onclick=loadPlannedElevation;$('#route-path-retry').onclick=validatePlannedPath;
 $('#planned-pace').oninput=()=>{
  const value=Number($('#planned-pace').value),perKm=state.runUnit==='km'?value:value/1.609344;
  if(!Number.isFinite(perKm)||perKm<3||perKm>20){$('#planned-route-status').textContent='Choose a pace between 3 and 20 min/km (4.8–32.2 min/mi).';return;}
  plannedPace=perKm;renderPlannedRoute(false);persistPlannedRoute();
 };
}
async function setRoutePlanning(enabled){
 if(routePlanning===enabled)return;
 if(enabled&&runIsActive())pauseRun('Run paused while planning. Return to Record run and Resume when ready.');
 routePlanning=enabled;
 for(const [id,active]of [['route-mode-record',!enabled],['route-mode-plan',enabled]])$('#'+id).setAttribute('aria-pressed',String(active));
 $('#route-planner').hidden=!enabled;
 for(const selector of ['.compact-timer','.run-actions','.run-live-stats','#run-vitals','#run-feedback','#gps-help','.compact-screen-note','.run-diagnostics','#run-review-details','#run-plan-progress']){
  const element=$(selector);if(!element)continue;
  if(enabled){element.dataset.planningWasHidden=String(element.hidden);element.hidden=true;}
  else if(element.dataset.planningWasHidden!==undefined){element.hidden=element.dataset.planningWasHidden==='true';delete element.dataset.planningWasHidden;}
 }
 $('#elevation-title').textContent=enabled?'Planned elevation':'Elevation';
 if(enabled){
  await ensureRunnerMap();if(!routePlanning)return;
  attachRouteDrawing();syncGPSMapVisibility();if(routeMap){routeMap.invalidateSize();if(plannedPoints.length>1&&plannedLayer)routeMap.fitBounds(plannedLayer.getBounds(),{padding:[25,25],maxZoom:17});else if(gpsMapFix)centerGPSMap(gpsMapFix,gpsMapFix.accuracy,gpsMapFix.accuracy>35);}
  renderPlannedRoute();if(plannedPoints.length>1&&!plannedRouteVerified)validatePlannedPath();
 }else{applyRouteDrawingMode();drawRunRoute();updateRunStats();}
}
function applyRouteDrawingMode(){
 const active=routePlanning&&routeDrawing;
 if(routeMap){if(active){routeMap.dragging?.disable();routeMap.doubleClickZoom?.disable();}else{routeMap.dragging?.enable();routeMap.doubleClickZoom?.enable();}routeMap.getContainer?.().classList.toggle('route-cursor-draw',active);}
 $('#route-draw-toggle').textContent=routeDrawing?'✎ Drawing on':'Move map';$('#route-draw-toggle').setAttribute('aria-pressed',String(routeDrawing));
}
function attachRouteDrawing(){
 if(!routeMap||!routeMap.getContainer)return;
 if(drawingMap===routeMap){renderPlannedLine();applyRouteDrawingMode();return;}
 drawingMap=routeMap;const container=routeMap.getContainer();
 const point=event=>{const p=routeMap.mouseEventToLatLng(event);return {lat:p.lat,lon:p.lng,ele:null};};
 container.addEventListener('pointerdown',event=>{
  if(!routePlanning||!routeDrawing||plannedRouteAbort||event.button!==0||event.target.closest('.leaflet-control'))return;
  event.preventDefault();event.stopPropagation();routeUndo.push({points:plannedPoints.map(p=>({...p})),verified:plannedRouteVerified});invalidatePlannedElevation();
  drawStroke={pointerId:event.pointerId,start:plannedPoints.length};try{container.setPointerCapture(event.pointerId);}catch{}
  appendPlannedPoint(point(event));
 },true);
 container.addEventListener('pointermove',event=>{
  if(!drawStroke||event.pointerId!==drawStroke.pointerId||!routePlanning||!routeDrawing)return;
  event.preventDefault();event.stopPropagation();appendPlannedPoint(point(event));
 },true);
 const finish=event=>{
  if(!drawStroke||event.pointerId!==drawStroke.pointerId)return;
  event.preventDefault();event.stopPropagation();if(event.type!=='pointercancel')appendPlannedPoint(point(event));
  const changed=plannedPoints.length!==drawStroke.start;if(!changed){const snapshot=routeUndo.pop();if(snapshot){plannedPoints=snapshot.points;plannedRouteVerified=snapshot.verified;}}drawStroke=null;
  try{container.releasePointerCapture(event.pointerId);}catch{}
  persistPlannedRoute();if(changed)schedulePlannedRouting();else renderPlannedRoute();
 };
 container.addEventListener('pointerup',finish,true);container.addEventListener('pointercancel',finish,true);
 renderPlannedLine();applyRouteDrawingMode();
}
function appendPlannedPoint(p){
 if(!Number.isFinite(p.lat)||Math.abs(p.lat)>90||!Number.isFinite(p.lon)||Math.abs(p.lon)>180)return false;
 if(plannedPoints.length>=10000){plannedElevationMessage='Route limit reached. Undo or clear to redraw.';renderPlannedRoute();return false;}
 if(plannedPoints.length&&RunMath.meters(plannedPoints.at(-1),p)<5)return false;
 plannedRouteVerified=false;plannedPoints.push({lat:p.lat,lon:p.lon,ele:null});renderPlannedRoute(false);return true;
}
function renderPlannedLine(){
 if(!routeMap||!window.L?.polyline)return;
 if(plannedLayer){routeMap.removeLayer(plannedLayer);plannedLayer=null;}
 if(plannedPoints.length)plannedLayer=L.polyline(plannedPoints.map(p=>[p.lat,p.lon]),{color:plannedRouteVerified?'#5d6f9e':'#b26b53',weight:4,dashArray:plannedRouteVerified?'8 7':'3 7',interactive:false}).addTo(routeMap);
}
function renderPlannedRoute(updatePace=true){
 renderPlannedLine();if(!routePlanning)return;
 const metric=state.runUnit==='km',analysis=analyzePlannedTerrain(plannedPoints),seconds=analysis.distance/1000*plannedPace*60;
 plannedGait=plannedPace>=10?'walk':'run';
 const estimate=plannedCalorieEstimate(analysis,plannedPace,Number(state.profile.weight),plannedGait);
 const ready=plannedRouteVerified&&plannedPoints.length>1;
 $('#planned-distance-label').textContent='Distance · '+(metric?'km':'mi');$('#planned-distance').textContent=ready?(analysis.distance/runUnitMeters()).toFixed(2):'—';
 $('#planned-time').textContent=ready?RunMath.clock(seconds):'—';
 $('#planned-calories').textContent=ready&&estimate.active!==null?'~'+estimate.active:'—';
 $('#planned-calorie-detail').textContent=ready?estimate.reason+(estimate.total!==null?' Total including resting energy: ~'+estimate.total+' kcal.':''):'Route estimates appear after the pedestrian path is checked.';
 $('#planned-pace-label').textContent='Pace · min/'+(metric?'km':'mi')+' (higher = slower)';
 $('#planned-pace').min=metric?'3':'4.8';$('#planned-pace').max=metric?'20':'32.2';
 if(updatePace)$('#planned-pace').value=(plannedPace*(metric?1:1.609344)).toFixed(1);
 $('#route-draw-undo').disabled=!plannedPoints.length;$('#route-draw-clear').disabled=!plannedPoints.length;
 $('#route-path-retry').disabled=plannedPoints.length<2||!!plannedRouteAbort;
 $('#route-elevation-retry').disabled=!ready||!!plannedElevationAbort||!!plannedRouteAbort;
 drawElevationProfile(ready?analysis:analyzePlannedTerrain([]));
 $('#elevation-caption').textContent=ready?(analysis.altitudePoints?`${analysis.unknown?'Partial terrain · ': 'Terrain estimate · '}ascent ${Math.round(analysis.gain*(metric?1:3.28084))} / descent ${Math.round(analysis.down*(metric?1:3.28084))} ${metric?'m':'ft'}. Copernicus 90 m grid; not surveyed road or bridge height.`:plannedElevationAbort?'Fetching consistent terrain samples…':'Elevation unavailable. A level-ground calorie estimate is shown.'):plannedRouteAbort?'Finding a mapped pedestrian path…':'No unchecked shortcut is used for distance or elevation.';
 $('#planned-route-status').textContent=plannedElevationMessage||(ready?'Mapped pedestrian route · planned, not recorded':plannedPoints.length>1?'Path not verified. Tap Check path.':'Draw along roads or paths; unsupported crossings will be rejected.');
}
function persistPlannedRoute(){
 if(!exerciseCanSave())return;
 state.plannedRoute={points:plannedPoints.map(p=>({...p})),paceMinutesPerKm:plannedPace,gait:plannedGait,routingProvider:plannedRouteVerified?'valhalla-pedestrian':null,updatedAt:new Date().toISOString()};save();
}
function invalidatePlannedElevation(){
 plannedElevationVersion++;clearTimeout(plannedElevationTimer);plannedElevationTimer=null;
 plannedElevationAbort?.abort();plannedElevationAbort=null;plannedElevationMessage='';
 for(const point of plannedPoints)point.ele=null;
}
function schedulePlannedElevation(){clearTimeout(plannedElevationTimer);if(plannedPoints.length>1)plannedElevationTimer=setTimeout(loadPlannedElevation,700);}
async function plannedLookupJSON(url,signal){
 for(let attempt=0;attempt<2;attempt++){
  if(signal.aborted)throw new DOMException('Cancelled','AbortError');
  const request=new AbortController(),cancel=()=>request.abort();signal.addEventListener('abort',cancel,{once:true});
  const timeout=setTimeout(()=>request.abort(),25000);
  try{
   const response=await fetch(url,{signal:request.signal});
   if(!response.ok){const error=Error(response.status===429?'Service is busy. Please retry in a moment.':'Lookup service unavailable. Please retry.');error.retryable=response.status>=500;throw error;}
   return await response.json();
  }catch(error){if(signal.aborted||attempt||error.retryable===false)throw error;await new Promise(resolve=>setTimeout(resolve,1100));}
  finally{clearTimeout(timeout);signal.removeEventListener('abort',cancel);}
 }
}
async function loadPlannedElevation(){
 clearTimeout(plannedElevationTimer);if(plannedPoints.length<2||!plannedRouteVerified||plannedElevationAbort)return;
 // Retain successful samples across retries and reloads.
 for(const p of plannedPoints)if(Number.isFinite(p.ele))plannedElevationCache.set(plannedElevationKey(p),p.ele);
 const controller=new AbortController();plannedElevationAbort=controller;
 const version=++plannedElevationVersion,key=KEY,raw=plannedPoints.map(p=>({...p}));
 const unique=new Map(raw.map(p=>[plannedElevationKey(p),p]));
 const missing=[...unique.keys()].filter(k=>!plannedElevationCache.has(k));
 const current=()=>version===plannedElevationVersion&&key===KEY&&globalThis.document?.body&&exerciseCanSave();
 const publish=()=>{if(!current())return;plannedPoints=raw.map(p=>({...p,ele:plannedElevationCache.get(plannedElevationKey(p))??null}));persistPlannedRoute();renderPlannedRoute();};
 try{
  publish();
  for(let offset=0;offset<missing.length;offset+=100){
   if(!current()||controller.signal.aborted)return;
   plannedElevationMessage=`Loading elevation · ${unique.size-missing.length+offset} / ${unique.size} samples`;renderPlannedRoute();
   const keys=missing.slice(offset,offset+100),coords=keys.map(k=>k.split(',').map(Number));
   const url='https://api.open-meteo.com/v1/elevation?latitude='+coords.map(p=>p[0]).join(',')+'&longitude='+coords.map(p=>p[1]).join(',');
   const data=await plannedLookupJSON(url,controller.signal);
   if(!Array.isArray(data.elevation)||data.elevation.length!==keys.length||data.elevation.some(v=>typeof v!=='number'||!Number.isFinite(v)||v < -500||v >9000))throw Error('Elevation data incomplete');
   if(!current())return;
   keys.forEach((k,i)=>plannedElevationCache.set(k,data.elevation[i]));publish();
  }
  if(current()){plannedElevationMessage='';publish();}
 }catch(error){if(current())plannedElevationMessage='Elevation lookup interrupted. Tap Refresh elevation to resume saved samples. Distance and time are still available.';}
 finally{if(version===plannedElevationVersion&&globalThis.document?.body){plannedElevationAbort=null;renderPlannedRoute();}}
}

function plannedElevationKey(p){return p.lat.toFixed(5)+','+p.lon.toFixed(5);}
function analyzePlannedTerrain(raw){
 const points=[],segments=[];let distance=0,gain=0,down=0,unknown=0,excluded=0;
 for(let i=0;i<raw.length;i++){
  const p=raw[i],height=Number.isFinite(p.ele)?p.ele:null;
  if(i){
   const length=RunMath.meters(raw[i-1],p),previous=points[i-1].height;
   const delta=height!==null&&previous!==null?height-previous:null;
   distance+=length;if(delta===null)unknown++;else{gain+=Math.max(0,delta);down+=Math.max(0,-delta);if(length>0&&Math.abs(delta/length)>.3)excluded++;}
   segments.push({distance_m:length,elevation_delta_m:delta});
  }
  points.push({...p,height,meters:distance,ascent:gain,elapsed:0});
 }
 return {points,segments,distance,gain,down,unknown,excluded,gaps:0,altitudePoints:points.filter(p=>p.height!==null).length,duration:0,timed:false};
}
function plannedCalorieEstimate(a,pace,kg,gait){
 const empty=reason=>({active:null,total:null,reason});
 if(!(a.distance>0))return empty('Choose a mapped route first.');
 if(!Number.isFinite(kg)||kg<30||kg>300)return empty('Set your profile weight to calculate calories.');
 if(!Number.isFinite(pace)||pace<3||pace>20)return empty('Enter a valid pace.');
 if(gait==='run'&&pace>=10)return empty('That is outside this running model’s supported pace. Use a walking pace of 10–20 min/km for a walking estimate.');
 if(gait==='walk'&&(pace<10||pace>20))return empty('This walking estimate supports 10–20 min/km. Use a running pace of 3–7.5 min/km for a running estimate.');
 const approximatePace=gait==='run'&&pace>7.5;
 const useTerrain=!!a.altitudePoints&&!a.unknown&&!a.excluded&&!approximatePace;
 const seconds=a.distance/1000*pace*60;
 const netOxygen=(gait==='walk'?.1:.2)*a.distance+(gait==='walk'?1.8:.9)*(useTerrain?a.gain:0);
 const active=netOxygen*kg/1000*5,rest=3.5*(seconds/60)*kg/1000*5;
 return {active:Math.round(active),total:Math.round(active+rest),reason:`Active energy excludes rest; on the same route it changes little with pace. ${useTerrain?'Uphill cost included; downhill treated as level ground.':approximatePace?'Rough level-ground jogging estimate; walking versus jogging changes energy use.':'Level-ground estimate; terrain is incomplete or uncertain.'} Individual energy use varies.`};
}
function cancelPlannedRouting(){plannedRouteVersion++;plannedRouteAbort?.abort();plannedRouteAbort=null;clearTimeout(plannedElevationTimer);}
function schedulePlannedRouting(){clearTimeout(plannedElevationTimer);if(plannedPoints.length>1)plannedElevationTimer=setTimeout(validatePlannedPath,1100);}
function distanceToPlannedSegment(p,a,b){
 const latitude=p.lat*Math.PI/180,k=111195,cos=Math.cos(latitude);
 const ax=(a.lon-p.lon)*cos*k,ay=(a.lat-p.lat)*k,bx=(b.lon-p.lon)*cos*k,by=(b.lat-p.lat)*k;
 const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));
 return Math.hypot(ax+t*dx,ay+t*dy);
}
function simplifyPlannedWaypoints(raw,tolerance=12){
 if(raw.length<=2)return raw;
 function simplify(points){
  if(points.length<=2)return points;let farthest=0,index=0;
  for(let i=1;i<points.length-1;i++){const d=distanceToPlannedSegment(points[i],points[0],points.at(-1));if(d>farthest){farthest=d;index=i;}}
  if(farthest<=tolerance)return [points[0],points.at(-1)];
  return [...simplify(points.slice(0,index+1)).slice(0,-1),...simplify(points.slice(index))];
 }
 return simplify(raw);
}
function decodePlannedPolyline(encoded){
 if(typeof encoded!=='string'||encoded.length>1000000)throw Error('Routing geometry is missing.');
 let index=0,lat=0,lon=0;const result=[];
 function coordinate(){let value=0,shift=0,byte;
  do{if(index>=encoded.length||shift>30)throw Error('Routing geometry is invalid.');byte=encoded.charCodeAt(index++)-63;if(byte<0||byte>63)throw Error('Routing geometry is invalid.');value|=(byte&31)<<shift;shift+=5;}while(byte>=32);
  return value&1?~(value>>1):value>>1;
 }
 while(index<encoded.length){lat+=coordinate();lon+=coordinate();const p={lat:lat/1e6,lon:lon/1e6,ele:null};if(Math.abs(p.lat)>90||Math.abs(p.lon)>180)throw Error('Routing coordinates are invalid.');result.push(p);if(result.length>50000)throw Error('Route is too complex.');}
 return result;
}
function validatePedestrianRoute(data,requested){
 const trip=data?.trip;if(!trip||trip.status!==0||!Array.isArray(trip.legs)||!trip.legs.length)throw Error('No mapped pedestrian connection. Try points on a road, path, or bridge.');
 let points=[];
 for(const leg of trip.legs){
  if(!Array.isArray(leg.maneuvers)||!leg.maneuvers.length||leg.maneuvers.some(m=>m.travel_mode!=='pedestrian'))throw Error('Routing did not confirm pedestrian access.');
  if(leg.summary?.has_ferry||trip.summary?.has_ferry||(leg.maneuvers||[]).some(m=>[28,29].includes(m.type)||m.travel_type==='ferry'||/ferry/i.test(m.instruction||'')||m.travel_mode&&m.travel_mode!=='pedestrian'))throw Error('Ferry or non-pedestrian crossing rejected. Choose a walkable bridge or another route.');
  const shape=decodePlannedPolyline(leg.shape);if(shape.length<2)throw Error('Route geometry is incomplete.');
  if(points.length&&RunMath.meters(points.at(-1),shape[0])>5)throw Error('Route contains a disconnected section.');
  points.push(...(points.length?shape.slice(1):shape));
 }
 for(const p of requested){
  let nearest=Infinity;for(let i=1;i<points.length;i++)nearest=Math.min(nearest,distanceToPlannedSegment(p,points[i-1],points[i]));
  if(nearest>500)throw Error('No pedestrian path within 500 m of part of the sketch. Draw closer to a road or trail.');
 }
 const length=analyzePlannedTerrain(points).distance;if(length<=0||length>100000)throw Error('Plan a route between a few meters and 100 km.');
 // Insert positions at no more than 50 m spacing, independent of cursor speed.
 const sampled=[points[0]];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],steps=Math.max(1,Math.ceil(RunMath.meters(a,b)/50));
  for(let j=1;j<=steps;j++)sampled.push({lat:a.lat+(b.lat-a.lat)*j/steps,lon:a.lon+(b.lon-a.lon)*j/steps,ele:null});
 }
 if(sampled.length>10000)throw Error('Route is too detailed. Plan a shorter section.');
 return sampled;
}
async function validatePlannedPath(){
 clearTimeout(plannedElevationTimer);if(plannedPoints.length<2||plannedRouteAbort)return;
 invalidatePlannedElevation();const raw=plannedPoints.map(p=>({...p}));plannedRouteVerified=false;
 const controller=new AbortController();plannedRouteAbort=controller;const version=++plannedRouteVersion,key=KEY;
 plannedElevationMessage='Checking mapped roads and pedestrian paths…';renderPlannedRoute();
 try{
  if(analyzePlannedTerrain(raw).distance>100000)throw Error('The route planner supports routes up to 100 km.');
  const requested=simplifyPlannedWaypoints(raw),sections=[];
  let section=[requested[0]],length=0;
  for(let i=1;i<requested.length;i++){
   const distance=RunMath.meters(requested[i-1],requested[i]);
   // Add anchors along long straight segments to bound pedestrian requests.
   const steps=Math.max(1,Math.ceil(distance/5000));
   for(let j=1;j<=steps;j++){
    const a=requested[i-1],b=requested[i],p={lat:a.lat+(b.lat-a.lat)*j/steps,lon:a.lon+(b.lon-a.lon)*j/steps};
    const d=RunMath.meters(section.at(-1),p);
    if(section.length>=8||length+d>10000){if(section.length>1)sections.push(section);section=[section.at(-1)];length=0;}
    section.push(p);length+=d;
   }
  }
  if(section.length>1)sections.push(section);
  let routed=[];
  for(let index=0;index<sections.length;index++){
   const requested=sections[index];
   plannedElevationMessage=`Checking pedestrian path · section ${index+1} / ${sections.length}`;renderPlannedRoute();
   const wait=Math.max(0,1100-(Date.now()-lastPlannedRouteRequest));if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
   if(controller.signal.aborted||version!==plannedRouteVersion||!globalThis.document?.body)return;
   lastPlannedRouteRequest=Date.now();
   const query={locations:requested.map(p=>({lat:p.lat,lon:p.lon,type:'break',radius:500,search_cutoff:500})),costing:'pedestrian',costing_options:{pedestrian:{use_ferry:0,exclude_ferries:true,exclude_private:true}},units:'kilometers'};
   const data=await plannedLookupJSON('https://valhalla1.openstreetmap.de/route?json='+encodeURIComponent(JSON.stringify(query)),controller.signal);
   const part=validatePedestrianRoute(data,requested);
   if(routed.length&&RunMath.meters(routed.at(-1),part[0])>5)throw Error('Mapped sections do not connect. Adjust the joining point and retry.');
   routed.push(...(routed.length?part.slice(1):part));
   if(routed.length>10000||analyzePlannedTerrain(routed).distance>100000)throw Error('The mapped route exceeds the 100 km planner limit.');
  }
  if(version!==plannedRouteVersion||key!==KEY||!globalThis.document?.body||!exerciseCanSave())return;
  plannedPoints=routed;plannedRouteVerified=true;plannedElevationMessage='';persistPlannedRoute();
 }catch(error){if(version===plannedRouteVersion)plannedElevationMessage=error.name==='AbortError'?'Route lookup timed out. Tap Check path to retry.':error.message;}
 finally{
  if(version===plannedRouteVersion&&globalThis.document?.body){plannedRouteAbort=null;renderPlannedRoute();if(plannedRouteVerified)schedulePlannedElevation();else persistPlannedRoute();}
 }
}
