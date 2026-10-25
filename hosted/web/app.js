'use strict';
const $ = s => document.querySelector(s);
const KEY = window.LONGEVITY_ACCOUNT ? 'longevity-account-v1:'+window.LONGEVITY_ACCOUNT.storageKey : 'longevity-simulator-v1';
let clearingData=false;
let state = {profile:{age:null,height:null,weight:null,sex:'unspecified'},habits:{exercise:null,sleep:null},records:[],route:[],onboardingComplete:false,baselineHabits:null,baselineRecord:null,dailyGoals:{},activities:[],workouts:[],plans:[],plannerActiveId:null,eegRecordings:[],runDraft:null,runUnit:"mi"};
try {const saved=JSON.parse(localStorage.getItem(KEY));if(saved && typeof saved==='object'){state.routinePromptSeen=saved.routinePromptSeen===true;state.nutrition=saved.nutrition||{};state.futureSelf=saved.futureSelf||null;state.runDraft=saved.runDraft||null;state.runUnit=saved.runUnit==="km"?"km":"mi";state.activities=Array.isArray(saved.activities)?saved.activities:[];state.workouts=Array.isArray(saved.workouts)?saved.workouts:[];state.plans=Array.isArray(saved.plans)?saved.plans:[];state.plannerActiveId=saved.plannerActiveId||null;state.eegRecordings=Array.isArray(saved.eegRecordings)?saved.eegRecordings:[];state.dailyGoals=saved.dailyGoals&&typeof saved.dailyGoals==='object'&&!Array.isArray(saved.dailyGoals)?saved.dailyGoals:{};state.onboardingComplete=saved.onboardingComplete===true;state.baselineHabits=saved.baselineHabits||null;state.baselineRecord=saved.baselineRecord||null;if(saved.profile)Object.assign(state.profile,saved.profile);if(saved.habits)Object.assign(state.habits,saved.habits);if(Array.isArray(saved.records))state.records=saved.records;if(Array.isArray(saved.route))state.route=saved.route;}}catch { /* Keep defaults when storage is unavailable or malformed. */ }
// Fictional demonstration records, exclusively for the shared guest login.
function seedGuestSample(){
 if(window.LONGEVITY_ACCOUNT?.provider!=='judge'||window.LONGEVITY_ACCOUNT.storageKey!=='judge-demo-v1')return;
 const marker=KEY+':sample40-october-v2';try{if(localStorage.getItem(marker))return;}catch{return;}
 const sample=JSON.parse(JSON.stringify(state)),today=new Date();today.setHours(12,0,0,0);
 sample.profile={...sample.profile,age:40,height:175,weight:72,sex:'male',personalGoals:'Fictional sample: stay active and maintain a consistent sleep routine.',lifeGoal:'Keep hiking and traveling at 65.',accessibilityNeeds:'Fictional sample: no adaptations requested.',challengePreference:'standard'};
 sample.baselineHabits={exercise:210,movementIntensity:'moderate',sleep:8,sleepRegularity:'consistent'};sample.habits={exercise:210,sleep:8};sample.baselineRecord={bed:'23:00',wake:'07:00'};
 sample.futureSelf={...sample.futureSelf,factors:{...sample.futureSelf?.factors,smoking:'never',stress:2,energy:4,rested:4,dailyActivities:'manageable'}};
 const minutes=[15,20,0,25,20,0,30,20,25,0,10,30,25,35,30,0,35,20,0,30,35,25,40,0,35,30,25,0,40,30,35];
 const sleep=[6.5,7,6,7.5,7,6.5,7.5,7,7.5,6,6.5,7.5,8,7.5,8,7,7.5,6.5,6,7.5,8,7.5,8,7,7.5,8,7,6.5,8,7.5,8];
 const setbacks={3:'Busy day; skipped the planned walk.',6:'Late work night and a rest day.',10:'Poor sleep after a late evening; took a rest day.',11:'Low energy; chose a shorter walk.',16:'Planned rest day.',18:'Busy schedule; shortened the walk.',19:'Travel day; exercise plan changed.',24:'Rest day after a longer walk.',28:'Late night; took a recovery day.'};
 // Populate October through today; never create future-dated journal entries.
 const last=localDate(today)>='2026-11-01'?31:localDate(today)>='2026-10-01'?today.getDate():0;
 for(let d=1;d<=last;d++){
  const i=d-1,date='2026-10-'+String(d).padStart(2,'0'),existing=sample.records.find(r=>r.date===date);
  if(existing&&!existing.sampleData)continue;
  const week=Math.floor(i/7),rest=minutes[i]===0,burn=Math.round(minutes[i]*4.5),steps=(rest?3800:4500+minutes[i]*85)+[200,-300,500,0,-200,350,-100][i%7];
  const bedMinutes=(7*60-Math.round(sleep[i]*60)+1440)%1440,bed=String(Math.floor(bedMinutes/60)).padStart(2,'0')+':'+String(bedMinutes%60).padStart(2,'0');
  const record={date,bed,wake:'07:00',sleepHours:sleep[i],exerciseType:rest?'Rest day':'Brisk walking',exerciseIntensity:rest?'light':'moderate',duration:minutes[i],exerciseCalories:burn,steps,dailyActiveCalories:burn+180+[20,45,0,60,30,10,40][i%7],activeEnergyIncludesExercise:true,rested:sleep[i]>=7.5?4:sleep[i]>=7?3:2,energy:sleep[i]<7?2:rest?3:4,stress:setbacks[d]?6:Math.max(2,4-Math.floor(week/2)),dailyActivities:'manageable',notes:'FICTIONAL DEMO DATA — not real measurements. '+(setbacks[d]||'Building a consistent routine; normal daily variation.')+' Active-energy total includes exercise; calories are estimates, not targets.',sampleData:true};
  // Occasional example measurements rather than pretending tests happen daily.
  if([1,8,15,22,29].includes(d))Object.assign(record,{heart:[68,67,69,65,66][week],systolic:[120,118,121,117,119][week],diastolic:[78,77,79,76,77][week],glucose:[92,90,94,91,93][week]});
  sample.records=sample.records.filter(r=>r.date!==date);sample.records.push(record);
 }
 sample.records.sort((a,b)=>a.date.localeCompare(b.date));
 sample.onboardingComplete=true;sample.routinePromptSeen=true;
 try{localStorage.setItem(KEY,JSON.stringify(sample));localStorage.setItem(marker,'1');state=sample;}catch{/* Leave existing progress untouched if storage is unavailable. */}
}
seedGuestSample();
// One-time, fictional WHO-5 examples for guest1 only; retain every existing answer.
function seedGuestMentalSample(){
 if(window.LONGEVITY_ACCOUNT?.provider!=='judge'||window.LONGEVITY_ACCOUNT.storageKey!=='judge-demo-v1')return;
 const marker=KEY+':sample-who5-october-v1';try{if(localStorage.getItem(marker))return;}catch{return;}
 const sample=JSON.parse(JSON.stringify(state)),today=localDate();
 const examples=[['2026-10-01',[3,3,3,2,3]],['2026-10-15',[4,4,3,4,4]],['2026-10-29',[4,4,4,4,5]]];
 for(const [date,answers] of examples){
  if(date>today)continue;
  let row=sample.records.find(r=>r.date===date);
  if(row?.who5||row&&!row.sampleData)continue;
  if(!row){row={date,sampleData:true};sample.records.push(row);}
  row.who5={instrument:'WHO-5',version:'2024',recall:'past-two-weeks',answers,sampleData:true};
  row.notes=(row.notes?row.notes+' ':'')+'FICTIONAL WHO-5 DEMO — invented responses, not a real assessment.';
 }
 sample.records.sort((a,b)=>a.date.localeCompare(b.date));
 try{localStorage.setItem(KEY,JSON.stringify(sample));localStorage.setItem(marker,'1');state=sample;}catch{/* Preserve existing state if storage is unavailable. */}
}
seedGuestMentalSample();
if(window.LONGEVITY_ACCOUNT?.provider==='judge'&&state.profile.personalGoals?.startsWith('Fictional sample:')){const note=document.createElement('p');note.className='note';note.textContent='Fictional October sample · age 40 · gradual progress with setbacks · not real measurements';document.querySelector('#home h1')?.after(note);}
let timer, requestId=0, watchId=null;
function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(timer);timer=setTimeout(()=>$('#toast').style.display='none',5000);}
function save(){if(clearingData)return;try{localStorage.setItem(KEY,JSON.stringify(state));if(typeof scheduleRunSync==='function')scheduleRunSync();if(typeof scheduleProgressSync==='function')scheduleProgressSync();}catch{toast('Browser storage unavailable. Export your data before closing.');}}
function escapeHTML(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
let pythonReady;
function getPython(){
 if(!pythonReady) pythonReady=(async()=>{
  toast('Starting the Python simulator…');
  await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js';s.onload=resolve;s.onerror=()=>reject(Error('Python could not load. Check your connection and reload.'));document.head.appendChild(s);});
  const runtime=await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/'});
  const response=await fetch('model.py');if(!response.ok)throw Error('Python model could not load.');
  await runtime.runPythonAsync(await response.text());
  toast('Python is ready. Explore your future self.');return runtime;
 })().catch(err=>{pythonReady=null;throw err;});return pythonReady;
}
async function api(path,data){
 const runtime=await getPython();
 const input=runtime.toPy(data);
 try {runtime.globals.set('_request_data',input);const fn=path==='/api/simulate'?'simulate':path==='/api/activity'?'activity':null;if(!fn)throw Error('Unknown calculation.');return JSON.parse(runtime.runPython('json.dumps('+fn+'(_request_data))'));}
 finally{runtime.globals.delete('_request_data');input.destroy();}
}
function plot(svg,series,labels,max=100){
 const W=680,H=200,left=44,right=15,top=18,bottom=35;
 const y=v=>top+(H-top-bottom)*(1-v/max), x=i=>left+i*(W-left-right)/Math.max(1,labels.length-1);
 let content='';for(let i=0;i<=4;i++){const v=max*i/4;content+=`<line x1="${left}" x2="${W-right}" y1="${y(v)}" y2="${y(v)}" stroke="#e9ede4" stroke-dasharray="3 4"/><text x="${left-9}" y="${y(v)+3}" text-anchor="end" fill="#96a08d" font-size="12">${Math.round(v)}</text>`;}
 labels.forEach((v,i)=>{content+=`<text x="${x(i)}" y="190" text-anchor="middle" fill="#96a08d" font-size="12">${escapeHTML(v)}</text>`;});
 series.forEach((s,k)=>{if(!s.values.length)return;const points=s.values.map((v,i)=>`${x(i)},${y(v)}`).join(' ');content+=`<polyline points="${points}" fill="none" stroke="${s.color}" stroke-width="${k?3:2}" ${s.dashed?'stroke-dasharray="5 5"':''} stroke-linecap="round" stroke-linejoin="round"/>`;s.values.forEach((v,i)=>content+=`<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${s.color}"><title>${escapeHTML(labels[i])}: ${v}</title></circle>`);});svg.innerHTML=content;
}
async function update(){renderFutureSelf();if(!$('#bmi')||!$('#bmr'))return;if(!state.onboardingComplete){$('#bmi').textContent='—';$('#bmr').textContent='—';return;}const id=++requestId;try{const r=await api('/api/simulate',{...state.profile});if(id!==requestId)return;$('#bmi').textContent=r.bmi??'—';$('#bmr').textContent=r.bmr?(r.bmr[0]===r.bmr[1]?r.bmr[0]:r.bmr.join('–')):'—';$('#bmi-note').textContent=state.profile.age<18?'For students, BMI needs age-specific clinical interpretation.':'One measure, never your whole story';$('#bmr-note').textContent=state.profile.age<18?'Adult calorie equation is not used for under-18s.':'Mifflin–St Jeor · adult estimate';}catch(e){toast(e.message);}}

function sync(){refreshScenario();Object.entries(state.profile).forEach(([k,v])=>{const el=$(`#profile [name="${k}"]`);if(el)el.value=v;});Object.entries(state.habits).forEach(([k,v])=>{if($(`#${k}`)){$(`#${k}`).value=v;$(`#${k}-value`).textContent=v;}});}
document.querySelectorAll('nav button').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('nav button,.page').forEach(e=>e.classList.remove('active'));button.classList.add('active');$('#'+button.dataset.page).classList.add('active');window.scrollTo({top:0,behavior:'smooth'});}));
const today=new Date();$('#journal-form [name=date]').value=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
function renderRecords(){const box=$('#records');box.replaceChildren();for(const r of [...state.records].sort((a,b)=>b.date.localeCompare(a.date))){const article=document.createElement('article');article.className='record';const title=document.createElement('strong');title.textContent=r.date;const p=document.createElement('p');p.textContent=(r.sleepHours==null?'Sleep not recorded':formatJournalNumber(Number(r.sleepHours))+' h sleep')+' · '+(r.duration==null||r.duration===''?'Exercise not recorded':formatJournalNumber(Number(r.duration))+' min exercise')+(WHO5.score(r.who5?.answers)?' · WHO-5 '+WHO5.score(r.who5.answers).total+'/100':'');const remove=document.createElement('button');remove.className='text-button';remove.textContent='Remove';remove.onclick=()=>{if(!confirm('Are you sure you want to delete this journal entry?'))return;if(typeof markStepsDayDeleted==='function')markStepsDayDeleted(r.date);state.records=state.records.filter(x=>x.date!==r.date);save();renderRecords();};article.append(title,p,remove);if(r.notes){const note=document.createElement('p');note.textContent=r.notes;article.append(note);}box.append(article);}renderTrend();if(state.onboardingComplete)refreshDashboard();}
function renderTrend(){const k=$('#trend-metric').value;const rows=[...state.records].filter(r=>r[k]!=='' && r[k]!=null && Number.isFinite(Number(r[k]))).sort((a,b)=>a.date.localeCompare(b.date)).slice(-7);if(!rows.length){$('#trend-chart').innerHTML='<text x="340" y="100" text-anchor="middle" fill="#8b9585" font-size="12">Add measurements to see a trend.</text>';return;}plot($('#trend-chart'),[{values:rows.map(r=>Number(r[k])),color:'#75965d'}],rows.map(r=>r.date.slice(5)),Math.max(10,...rows.map(r=>Number(r[k])))*1.2);}
$('#trend-metric').onchange=renderTrend;
$('#journal-form').onsubmit=e=>{e.preventDefault();const form=e.target;if(!form.reportValidity())return;const values=Object.fromEntries(new FormData(form));values.activeEnergyIncludesExercise=form.elements.activeEnergyIncludesExercise.checked;
 const error=message=>{if(typeof dayEditorMessage==='function')dayEditorMessage(message);else toast(message);};
 if(values.activeEnergyIncludesExercise&&!values.dailyActiveCalories){error('Enter the daily active-energy total, or clear its confirmation.');return;}
 if(Boolean(values.bed)!==Boolean(values.wake)){error('Enter both bedtime and wake-up, or leave both blank.');return;}
 const hours=values.bed&&values.wake?sleepHours(values.bed,values.wake):null;if(hours===0){error('Use different bedtime and wake-up times.');return;}
 if(values.systolic&&values.diastolic&&Number(values.diastolic)>=Number(values.systolic)){error('Diastolic pressure must be lower than systolic pressure.');return;}
 if(!Object.entries(values).some(([key,value])=>!['date','exerciseType','exerciseIntensity','dailyActivities','activeEnergyIncludesExercise'].includes(key)&&String(value).trim()!=='')&&!['manageable','sometimes-hard','often-hard','varies'].includes(values.dailyActivities)){error('Add at least one detail before saving, or choose Do later.');return;}
 const prior=state.records,existing=prior.find(record=>record.date===values.date),record={...existing,...values,sleepHours:existing?.inputSources?.sleepHours?.kind==='wearable-import'&&String(values.bed||'')===String(existing.bed||'')&&String(values.wake||'')===String(existing.wake||'')?existing.sleepHours:hours};if(typeof clearChangedImportSources==='function')clearChangedImportSources(record,existing||{},Object.keys(values).concat(values.bed&&values.wake?['sleepHours']:[]));state.records=[...prior.filter(item=>item.date!==record.date),record];save();
 let stored=false;try{stored=JSON.stringify(JSON.parse(localStorage.getItem(KEY))?.records?.find(item=>item.date===record.date))===JSON.stringify(record);}catch{}
 if(!stored){state.records=prior;error('Could not save to this device. Your entries are still here; please retry.');return;}
 form.dataset.dirty='false';renderRecords();if(typeof selectJournalDay==='function')selectJournalDay(record.date);if($('#journal-editor').open)$('#journal-editor').close();toast('Day saved.');};

$('#clear').onclick=()=>{if(!confirm('Clear local app data from this device? Synced progress stays in your account and can download again. Delete individual entries to remove them from your account. Unsynced changes and guest records cannot be recovered.'))return;clearingData=true;stopGPS();try{localStorage.removeItem(KEY);localStorage.removeItem(KEY+':run-sync-v1');localStorage.removeItem(KEY+':progress-sync-v1');localStorage.removeItem(KEY+':steps-enabled');localStorage.removeItem(KEY+':step-source-id');localStorage.removeItem(KEY+':portrait-v1');localStorage.removeItem(KEY+':steps-deleted-days');}catch{}location.reload();};
function distance(a,b){const rad=v=>v*Math.PI/180,R=6371000,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon);const h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(Math.min(1,h)));}
function renderRoute(){const pts=state.route;if(!pts.length)return;const lats=pts.map(p=>p.lat),lons=pts.map(p=>p.lon),minLat=Math.min(...lats),maxLat=Math.max(...lats),minLon=Math.min(...lons),maxLon=Math.max(...lons);const lonScale=Math.max(.01,Math.cos(pts[0].lat*Math.PI/180));const dx=(maxLon-minLon)*lonScale,dy=maxLat-minLat,scale=Math.min(540/(dx||1e-8),240/(dy||1e-8));const coords=pts.map(p=>`${300+((p.lon-(minLon+maxLon)/2)*lonScale)*scale},${150-(p.lat-(minLat+maxLat)/2)*scale}`).join(' ');$('#route').innerHTML=`<polyline points="${coords}" fill="none" stroke="#64894e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${coords.split(' ')[0].split(',')[0]}" cy="${coords.split(' ')[0].split(',')[1]}" r="6" fill="#345d43"/>`;let meters=0,gain=0,hasElevation=false;pts.forEach((p,i)=>{if(i&&!p.breakBefore){meters+=distance(pts[i-1],p);if(p.ele!==null && pts[i-1].ele!==null){hasElevation=true;gain+=Math.max(0,p.ele-pts[i-1].ele);}}});$('#route-status').textContent=`${pts.length} points · ${(meters/1000).toFixed(2)} km · ${hasElevation?Math.round(gain)+' m raw ascent (verify GPS noise)':'Altitude unavailable'}. Coordinate outline; segments may appear connected visually.`;const link=$('#map-link');link.hidden=false;link.href=`https://www.openstreetmap.org/?mlat=${pts[0].lat}&mlon=${pts[0].lon}#map=15/${pts[0].lat}/${pts[0].lon}`;}
$('#gpx').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2_000_000)throw Error('Choose a GPX file smaller than 2 MB.');const xml=new DOMParser().parseFromString(await file.text(),'application/xml');if(xml.querySelector('parsererror'))throw Error('Invalid GPX XML.');let nodes=Array.from(xml.getElementsByTagNameNS('*','trkpt'));if(!nodes.length)nodes=Array.from(xml.getElementsByTagNameNS('*','rtept'));if(nodes.length>10000)throw Error('Route limit is 10,000 points.');const pts=nodes.map((n,i)=>{const altitude=n.getElementsByTagNameNS('*','ele')[0]?.textContent;return {lat:Number(n.getAttribute('lat')),lon:Number(n.getAttribute('lon')),ele:altitude!=null&&Number.isFinite(Number(altitude))?Number(altitude):null,time:n.getElementsByTagNameNS('*','time')[0]?.textContent||null,breakBefore:i>0&&nodes[i-1].parentElement!==n.parentElement};});if(!pts.length||pts.some(p=>!Number.isFinite(p.lat)||Math.abs(p.lat)>90||!Number.isFinite(p.lon)||Math.abs(p.lon)>180))throw Error('GPX has no valid track or route points.');stopGPS();state.route=pts;save();renderRoute();toast('Route imported. Elevation is shown below the map.');}catch(err){toast(err.message);}e.target.value='';};
function stopGPS(){if(watchId!==null)navigator.geolocation.clearWatch(watchId);watchId=null;$('#gps').disabled=false;$('#stop-gps').disabled=true;save();}
$('#gps').onclick=()=>{if(!navigator.geolocation){toast('Geolocation is unavailable in this browser. Try importing GPX.');return;}if(state.route.length&&!confirm('Replace the current route with a new GPS recording?'))return;state.route=[];$('#route').innerHTML='';$('#map-link').hidden=true;$('#gps').disabled=true;$('#stop-gps').disabled=false;$('#route-status').textContent='Waiting for GPS permission and an accurate location…';watchId=navigator.geolocation.watchPosition(pos=>{if(state.route.length>=10000){stopGPS();toast('10,000 point limit reached.');return;}if(pos.coords.accuracy>100){$('#route-status').textContent='Waiting for GPS accuracy better than 100 meters…';return;}const p={lat:pos.coords.latitude,lon:pos.coords.longitude,ele:pos.coords.altitude,time:new Date(pos.timestamp).toISOString(),accuracy:pos.coords.accuracy};const previous=state.route.at(-1);if(!previous||distance(previous,p)>5){state.route.push(p);renderRoute();save();}},err=>{stopGPS();toast('GPS unavailable: '+err.message+'. Try GPX import.');},{enableHighAccuracy:true,maximumAge:0,timeout:20000});};
$('#stop-gps').onclick=()=>{stopGPS();toast('GPS recording stopped. Enter elapsed time before calculating.');};
window.addEventListener('pagehide',()=>{if(typeof runIsActive==='function'&&runIsActive())suspendRunForBackground();else stopGPS();});initializeFutureSelf();sync();renderRecords();renderRoute();initializeSetup();initializeFeatures();initializeSleep();initializeAccount();initializeJournal();initializeRunner();initializeWorkouts();initializeCoach();if(typeof initializeJournalRuns==='function')initializeJournalRuns();if(typeof initializeRunSync==='function')initializeRunSync();if(typeof initializeProgressSync==='function')initializeProgressSync();if(typeof initializeSteps==='function')initializeSteps();
