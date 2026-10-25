const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('web/progress-sync.js','utf8');let docs=new Map(),offline=false;
function device(initial={},provider='google'){
 const nodes=new Map(),storage=new Map();let context;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,textContent:'',open:false,close(){this.open=false},showModal(){this.open=true}});return nodes.get(id)};
 const state={profile:{age:null,sex:'unspecified'},habits:{sleep:null},records:[],workouts:[],eegRecordings:[],futureSelf:{targetAge:50},...initial};
 context=vm.createContext({state,window:{LONGEVITY_ACCOUNT:{provider},addEventListener(){}},document:{hidden:false,getElementById:node,addEventListener(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},KEY:'account-a',clearingData:false,setTimeout:()=>1,clearTimeout(){},setInterval(){},renderRecords(){},renderSessions(){},syncFinishedRuns(){},runCloudRequest:async(path,options={})=>{if(offline)throw Error('offline');const id=decodeURIComponent(path.split('/')[3]||'');if(!id)return{documents:[...docs].map(([id,r])=>({id,revision:r.revision,deleted:r.deleted}))};const row=docs.get(id);if(!options.method)return JSON.parse(JSON.stringify(row));const body=JSON.parse(options.body);if(body.revision!==(row?.revision||0)){let e=Error('Conflict');e.status=409;throw e;}const next={id,revision:body.revision+1,deleted:options.method==='DELETE',value:body.value??null};docs.set(id,next);return next;}});
 vm.runInContext(source+';globalThis.api={syncProgress,initializeProgressSync,progressSnapshot,scheduleProgressSync,conflicts:progressConflicts,apply:progressApply};',context);
 return{state,api:context.api,nodes,context};
}
(async()=>{
 const a=device({profile:{name:'Runner',age:20},onboardingComplete:true,records:[{date:'2026-10-24',notes:'Hi',sleepHours:8}],workouts:[{id:'gym-1',minutes:20}]});await a.api.initializeProgressSync();await a.api.syncProgress();
 const b=device();await b.api.initializeProgressSync();await b.api.syncProgress();assert.equal(b.state.profile.name,'Runner');assert.equal(b.state.records[0].notes,'Hi');assert.equal(b.state.workouts[0].id,'gym-1');assert.equal(b.api.conflicts.size,0,'Fresh app defaults never conflict with account data');
 a.state.records[0].notes='Edited on phone';b.state.records[0].sleepHours=9;await a.api.syncProgress();await b.api.syncProgress();assert.equal(b.state.records[0].notes,'Edited on phone');assert.equal(b.state.records[0].sleepHours,9);await a.api.syncProgress();assert.equal(a.state.records[0].sleepHours,9,'Disjoint changes on same day merge');
 a.state.records[0].notes='A';b.state.records[0].notes='B';await a.api.syncProgress();await b.api.syncProgress();assert.equal(b.api.conflicts.size,1);assert.equal(b.state.records[0].notes,'B','Conflicting local edit kept for choice');b.api.conflicts.clear();b.state.records[0].notes='A';await b.api.syncProgress();
 a.state.records=[];await a.api.syncProgress();await b.api.syncProgress();assert.equal(b.state.records.length,0,'Deletions sync and do not resurrect');assert.equal(b.state.workouts.length,1);
 offline=true;a.state.profile.name='Offline edit';await a.api.syncProgress();assert.equal(a.state.profile.name,'Offline edit');offline=false;await a.api.syncProgress();await b.api.syncProgress();assert.equal(b.state.profile.name,'Offline edit');
 const guest=device({profile:{name:'Guest'}},'judge'),count=docs.size;guest.api.initializeProgressSync();await guest.api.syncProgress();assert.equal(docs.size,count);assert(guest.nodes.get('account-progress-status').textContent.includes('Guest'));
 console.log('PASS two-device profile/journal/workout sync, fresh defaults, disjoint day merges, conflict preservation, tombstone deletes, offline retry and guest exclusion');
})().catch(e=>{console.error(e);process.exitCode=1});
