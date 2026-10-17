const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('fs');const assert=require('node:assert/strict');
const root=require('path').join(__dirname,'../web/');
const dom=new JSDOM(fs.readFileSync(root+'index.html','utf8'),{url:'https://app.test/app',runScripts:'outside-only',virtualConsole:new VirtualConsole()});
const w=dom.window; w.scrollTo=()=>{};w.confirm=()=>true;
w.LONGEVITY_ACCOUNT={storageKey:'sleep-test',email:'test@example.com',name:'Test'};
w.fetch=async()=>({ok:true,json:async()=>({storageKey:'sleep-test'})});
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
const key='longevity-account-v1:sleep-test';
w.localStorage.setItem(key,JSON.stringify({profile:{name:'Test',age:30,height:170,weight:70},habits:{exercise:150,sleep:8,plants:5},records:[],onboardingComplete:false}));
w.eval(['run-math.js','runner.js','journal.js','account.js','features.js','sleep.js','workouts.js','home.js','setup.js','planner.js','app.js'].map(n=>fs.readFileSync(root+n,'utf8')).join('\n')+'\nwindow.testState=state;Object.assign(window,{selectSleepNight,nightDuration,parseEEG,renderSleep,renderEEGOptions,localDate});');
const $=s=>w.document.querySelector(s);const tick=()=>new Promise(r=>setTimeout(r,0));
const submit=()=>$('#sleep-form').dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));
(async()=>{
 await tick();await tick();
 const today=w.localDate();
 assert.equal(w.nightDuration('23:15','07:00'),7.75);
 assert.equal(w.nightDuration('23:00','23:00'),null);
 assert.equal(w.nightDuration('25:00','07:00'),null);
 assert.equal($('#eeg-viewer').hidden,true);assert.equal($('#eeg-empty').hidden,false);
 assert.equal(w.document.querySelectorAll('.sleep-bubble').length,7);
 w.testState.records.push({date:today,breakfast:'Oats',duration:'25',notes:'keep original journal notes'});
 const form=$('#sleep-form');
 form.elements.bed.value='23:15';form.elements.wake.value='07:00';form.elements.sleepQuality.value='4';form.elements.sleepNotes.value='<img onerror=alert(1)> calm night';submit();
 assert.equal(w.testState.records.length,1);
 assert.equal(w.testState.records[0].breakfast,'Oats');assert.equal(w.testState.records[0].duration,'25');
 assert.equal(w.testState.records[0].notes,'keep original journal notes');
 assert.equal(w.testState.records[0].sleepHours,7.8);assert.equal(w.testState.records[0].sleepQuality,'4');
 assert.equal($('#sleep-history img'),null);assert($('#sleep-history').textContent.includes('<img'));
 assert.equal(w.document.querySelectorAll('#sleep-trend circle').length,1);
 assert.equal(w.document.querySelectorAll('.sleep-bubble.recorded').length,1);
 assert(JSON.parse(w.localStorage.getItem(key)).records[0].sleepNotes.includes('calm night'));
 // Edits replace a night without duplicating it.
 w.selectSleepNight(today);assert.equal(form.elements.bed.value,'23:15');form.elements.wake.value='08:00';submit();assert.equal(w.testState.records.length,1);assert.equal(w.testState.records[0].sleepHours,8.8);
 $('#sleep-range').value='30';$('#sleep-range').dispatchEvent(new w.Event('change'));assert.equal(w.document.querySelectorAll('.sleep-bubble').length,30);
 const other=new Date();other.setDate(other.getDate()-2);const otherDate=w.localDate(other);
 w.testState.records.push({date:otherDate,bed:'22:00',wake:'06:00',sleepHours:8});w.renderSleep();assert.equal(w.document.querySelectorAll('#sleep-trend circle').length,2);assert.equal(w.document.querySelectorAll('#sleep-trend line[stroke-width="3"]').length,0,'Missing nights are not joined');
 // Same-time entry rejected and quota failure never claims success or mutates records.
 form.elements.bed.value='07:00';form.elements.wake.value='07:00';submit();assert($('#sleep-save-status').textContent.includes('different'));
 w.selectSleepNight(today);const before=JSON.stringify(w.testState.records);
 const original=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(k,v){if(k===key)throw new Error('quota');return original.call(this,k,v);};
 form.elements.wake.value='09:00';submit();assert.equal(JSON.stringify(w.testState.records),before);assert($('#sleep-save-status').textContent.includes('Not saved'));
 w.Storage.prototype.setItem=original;
 // Parser handles exported quoted numeric cells and rejects malformed, duplicate, non-finite data.
 assert(w.parseEEG('\uFEFF"time_s","amplitude_uv"\r\n"0","-2"\r\n"1","3"').raw);
 for(const csv of ['time_s,amplitude_uv\n0,\n1,2','time_s,amplitude_uv\n1,2\n1,3','time_s,amplitude_uv\n0,Infinity\n1,2','time_s,amplitude_uv\n0,0x12\n1,2','time_s,time_s,amplitude_uv\n0,0,1\n1,1,2'])assert.throws(()=>w.parseEEG(csv));
 assert.equal(w.parseEEG(fs.readFileSync(root+'eeg-template.csv','utf8')).channels.length,5);
 assert(w.parseEEG(fs.readFileSync(root+'eeg-raw-template.csv','utf8')).raw);
 // Demo is never persisted, remains labeled, and supports windows and sample inspection.
 const saved=w.localStorage.getItem(key);$('#eeg-demo').click();assert.equal(w.testState.eegRecordings.length,0);assert.equal(w.localStorage.getItem(key),saved);assert(!$('#eeg-demo-label').hidden);assert($('#eeg-chart polyline'));assert($('#delete-eeg').disabled);
 $('#eeg-window').value='10';$('#eeg-window').dispatchEvent(new w.Event('change'));$('#eeg-start').value='20';$('#eeg-start').dispatchEvent(new w.Event('input'));$('#eeg-sample').value='10';$('#eeg-sample').dispatchEvent(new w.Event('input'));assert($('#eeg-readout').textContent.includes('20.500'));$('#eeg-close-demo').click();assert($('#eeg-viewer').hidden);
 // Real import uses the actual file handler and survives a fresh render.
 const input=$('#eeg-file');Object.defineProperty(input,'files',{value:[{name:'<real>.csv',size:100,text:async()=>fs.readFileSync(root+'eeg-raw-template.csv','utf8')}],configurable:true});await input.onchange({target:input});
 assert.equal(w.testState.eegRecordings.length,1);assert.equal($('#eeg-viewer').hidden,false);assert.equal($('#eeg-recording').textContent.includes('<real>.csv'),true);assert.equal($('#eeg-recording img'),null);assert(!$('#export-eeg').disabled);assert($('#eeg-chart polyline'));
 assert.equal(JSON.parse(w.localStorage.getItem(key)).eegRecordings.length,1);
 Object.defineProperty(input,'files',{value:[{name:'bad.csv',size:30,text:async()=>'bad'}],configurable:true});await input.onchange({target:input});assert.equal(w.testState.eegRecordings.length,1);assert($('#eeg-status').textContent.includes('rows'));
 // Cancel/confirm deletion, and sleep-only removal preserves the rest of the day.
 w.confirm=()=>false;$('#delete-eeg').click();assert.equal(w.testState.eegRecordings.length,1);w.confirm=()=>true;$('#delete-eeg').click();assert.equal(w.testState.eegRecordings.length,0);assert($('#eeg-viewer').hidden);
 const remove=[...w.document.querySelectorAll('#sleep-history button')].find(b=>b.textContent==='Remove sleep only');remove.click();const r=w.testState.records.find(r=>r.date===today);assert.equal(r.bed,undefined);assert.equal(r.breakfast,'Oats');assert.equal(r.duration,'25');
 console.log('PASS: sleep logging/editing, preservation, persistence, calendar, graph gaps, storage failure, CSV validation/import, sample windows, and removal');dom.window.close();
})().catch(error=>{console.error(error);dom.window.close();process.exitCode=1;});
