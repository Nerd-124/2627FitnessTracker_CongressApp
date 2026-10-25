'use strict';
let routeMap=null, routeLayer=null, mapPromise=null, latestActivity=null, gpsStarted=null, recordingTimer=null;
function routeSegments(points){const segments=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(b.breakBefore)continue;const meters=distance(a,b);if(meters<.01)continue;segments.push({distance_m:meters,elevation_delta_m:a.ele!=null&&b.ele!=null?b.ele-a.ele:null});}return segments;}
function signalPlot(svg,rows,xkey,ykey,color='#6d905b'){if(!rows.length){svg.innerHTML='';return;}const w=800,h=220,pad=45;const xs=rows.map(p=>Number(p[xkey])),ys=rows.map(p=>Number(p[ykey]));const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);const x=v=>pad+(v-minX)/(maxX-minX||1)*(w-2*pad),y=v=>h-pad-(v-minY)/(maxY-minY||1)*(h-2*pad);let body='';for(let i=0;i<4;i++){const val=minY+(maxY-minY)*i/3;body+=`<line x1="${pad}" x2="${w-pad}" y1="${y(val)}" y2="${y(val)}" stroke="#e3e9dc"/><text x="${pad-7}" y="${y(val)+3}" text-anchor="end" fill="#85967a" font-size="13">${val.toFixed(1)}</text>`;}const stride=Math.max(1,Math.ceil(rows.length/1000));const drawn=rows.filter((_,i)=>i%stride===0||i===rows.length-1);body+=`<polyline points="${drawn.map(p=>`${x(Number(p[xkey]))},${y(Number(p[ykey]))}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2"/><text x="${pad}" y="205" fill="#85967a" font-size="13">${minX.toFixed(1)}</text><text x="${w-pad}" y="205" text-anchor="end" fill="#85967a" font-size="13">${maxX.toFixed(1)}</text>`;svg.innerHTML=body;}
function runStartTime(run){const value=run.startedAt||(run.route||[]).find(p=>p.time)?.time;return value&&Number.isFinite(Date.parse(value))?value:null;}
function runTimeLabel(run){const value=runStartTime(run);return value?new Date(value).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):'Time not recorded';}
function renderSessions(){const box=$('#activity-history');box.replaceChildren();let lastDate=null;for(const r of [...state.activities].sort((a,b)=>b.date.localeCompare(a.date)||(runStartTime(b)||'').localeCompare(runStartTime(a)||''))){if(r.date!==lastDate){const heading=document.createElement('h3');heading.className='run-day-divider';heading.textContent=journalDateLabel(r.date);box.append(heading);lastDate=r.date;}const el=document.createElement('div');el.className='record';el.dataset.runId=r.id;el.innerHTML=`<div class="record-head"><strong>${r.mode==='run'?'Run':'Walk'} · ${escapeHTML(runTimeLabel(r))}</strong><span><button class="text-button" data-open>View route & time-lapse</button><button class="text-button" data-remove>Remove</button></span></div><p>${RunMath.clock(Number(r.minutes)*60)} · ${Number(r.result.distance||0).toFixed(2)} km · ${Number(r.result.speed||0).toFixed(1)} km/h average · ${r.route&&r.route.filter(p=>Number.isFinite(p.ele)).length<2?'—':Math.round(r.result.gain||0)} m ascent</p><p>${r.result.calories} estimated kcal · ${r.humidity==null?'Humidity not recorded':escapeHTML(r.humidity)+'% humidity'}</p><p>${r.usedRoute?'Route slopes used':'Manual distance and ascent'} · ${escapeHTML(r.weight)} kg at calculation time</p>${(r.route||[]).length<2?'<p class="note">Not enough GPS positions were recorded for a route or time-lapse.</p>':''}`;el.querySelector('[data-open]').onclick=()=>{if(watchId!==null){toast('Stop GPS recording before opening another session.');return;}if(typeof openJournalRunViewer==='function')openJournalRunViewer(r);else showRunReview(r);};el.querySelector('[data-remove]').onclick=()=>{if(!confirm('Are you sure you want to delete this run?'))return;if(typeof queueRunDeletion==='function')queueRunDeletion(r.id);state.activities=state.activities.filter(x=>x.id!==r.id);save();renderSessions();renderJournal();};box.append(el);}if(typeof appendCaliforniaDemos==='function')appendCaliforniaDemos(box);}
let leafletLibraryPromise=null;
async function loadLeafletLibrary(){
 if(window.L)return window.L;
 if(!leafletLibraryPromise)leafletLibraryPromise=(async()=>{
  if(!document.querySelector('link[data-leaflet]')){const css=document.createElement('link');css.dataset.leaflet='true';css.rel='stylesheet';css.href='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';document.head.append(css);}
  await new Promise((resolve,reject)=>{const script=document.createElement('script');const timer=setTimeout(()=>{script.remove();reject(Error('Street map could not load. The recorded route preview still works.'));},15000);script.src='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('Street map unavailable. The recorded route preview still works.'));};document.head.append(script);});return window.L;
 })().catch(error=>{leafletLibraryPromise=null;throw error;});
 return leafletLibraryPromise;
}
async function loadStreetMap(){
 if(routeMap){routeMap.invalidateSize();return routeMap;}
 if(!mapPromise)mapPromise=(async()=>{
  await loadLeafletLibrary();
  if(!routeMap){
   $('#route-map').hidden=false;
   routeMap=L.map('route-map',{minZoom:2,worldCopyJump:false}).setView([20,0],2);
   const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{minZoom:2,maxZoom:19,noWrap:true,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(routeMap);
   tiles.on?.('tileerror',()=>{$('#run-map-status').textContent='Some street tiles could not load. GPS recording and your route are independent of map tiles.';});
   tiles.on?.('load',()=>{$('#run-map-status').textContent='Street map ready · OpenStreetMap';});
   attachRouteDrawing();
   routeMap.on?.('dragstart',()=>{runFollow=false;updateGPSSignal();});
  }
  return routeMap;
 })();
 try{await mapPromise;drawStreetRoute();$('#load-map').textContent='Reload map';return routeMap;}
 catch(err){mapPromise=null;$('#run-map-status').textContent=err.message;toast(err.message);return null;}
}
function drawStreetRoute(){
 if(!routeMap)return;
 if(routeLayer){routeMap.removeLayer(routeLayer);routeLayer=null;}
 const segments=[];let current=[];
 for(const p of state.route){if(p.breakBefore&&current.length){segments.push(current);current=[];}current.push([p.lat,p.lon]);}if(current.length)segments.push(current);
 if(!segments.length)return;
 routeLayer=L.polyline(segments,{color:'#507b43',weight:4}).addTo(routeMap);routeMap.invalidateSize();
 if(!runIsActive())routeMap.fitBounds(routeLayer.getBounds(),{padding:[25,25],maxZoom:17});
 else if(!runnerCentered){const p=state.route.at(-1);routeMap.setView([p.lat,p.lon],16,{animate:false});runnerCentered=true;}
}
function showElevation(){let meters=0;const rows=[];state.route.forEach((p,i)=>{if(i&&!p.breakBefore)meters+=distance(state.route[i-1],p);if(p.ele!=null)rows.push({km:meters/1000,elevation:p.ele});});signalPlot($('#elevation-chart'),rows,'km','elevation');$('#elevation-caption').textContent=rows.length?`Elevation profile · km horizontally, meters vertically. ${rows.length} of ${state.route.length} points have altitude. GPS noise can inflate ascent; no automatic elevation correction applied.`:'No altitude data. Enter elevation gain manually; no terrain height is inferred from a map.';drawStreetRoute();}

function initializeFeatures(){
 window.addEventListener('pagehide',()=>{if(recordingTimer)clearInterval(recordingTimer);recordingTimer=null;});
 $('#eeg-date').value=localDate();renderSleep();renderEEGOptions();renderSessions();
 const originalRender=renderRoute;renderRoute=function(){originalRender();showElevation();};if(state.route.length)renderRoute();
 const originalRecords=renderRecords;renderRecords=function(){originalRecords();renderSleep();};
 $('#load-map').onclick=loadStreetMap;
 const originalStop=stopGPS;stopGPS=function(){if(recordingTimer){clearInterval(recordingTimer);recordingTimer=null;}originalStop();};
 document.querySelector('nav button[data-page="activity"]').addEventListener('click',()=>{if(routeMap)setTimeout(()=>routeMap.invalidateSize(),50);});
}
