const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const origin='https://longevity-simulator-lab.idealapple4.chatgpt.site',file=path.join(__dirname,'../ios-live/LongevityLive/NativeBridge.js');
const script=fs.readFileSync(file,'utf8').replaceAll('__WEBSITE_ORIGIN__',origin),instances=[];
function create(url=origin+'/app'){
 const dom=new JSDOM('<!doctype html>',{url,runScripts:'outside-only'});instances.push(dom);const w=dom.window,messages=[];
 w.webkit={messageHandlers:{nativeLocation:{postMessage:m=>messages.push(m)}}};w.navigator.permissions={query:d=>Promise.resolve({state:'original',name:d.name})};w.eval(script);return {w,messages};
}
(async()=>{
 const {w,messages}=create(),native=w.__longevityNative,geo=w.navigator.geolocation;
 assert.equal(messages[0].action,'permission');
 let position=null;geo.getCurrentPosition(p=>position=p,null,{timeout:12000});let req=messages.at(-1);assert.equal(req.watch,false);assert.equal(req.timeout,12000);
 native.receive({id:req.id,position:{coords:{latitude:32,longitude:-93,accuracy:5,altitude:null},timestamp:1234}});assert.equal(position.coords.accuracy,5);
 position=null;native.receive({id:req.id,position:{coords:{latitude:1}}});assert.equal(position,null,'One-shot callbacks are removed');
 let fixes=0,error=null;const watch=geo.watchPosition(()=>fixes++,e=>error=e,{timeout:15000});
 native.receive({id:watch,position:{coords:{latitude:32}}});native.receive({id:watch,position:{coords:{latitude:33}}});assert.equal(fixes,2);
 native.receive({id:watch,error:{code:3,message:'Timeout'}});assert.equal(error.TIMEOUT,3);native.receive({id:watch,position:{coords:{latitude:34}}});assert.equal(fixes,3,'Watch survives transient timeout');
 geo.clearWatch(watch);assert.equal(messages.at(-1).action,'clear');native.receive({id:watch,position:{}});assert.equal(fixes,3,'Cleared watch ignores stale native fixes');
 const denied=geo.watchPosition(()=>fixes++,e=>error=e);native.receive({id:denied,error:{code:1,message:'Denied'}});native.receive({id:denied,position:{}});assert.equal(fixes,3,'Permission-denied watch is removed');
 const permission=await w.navigator.permissions.query({name:'geolocation'});assert.equal(permission.state,'prompt');let changes=0;permission.addEventListener('change',()=>changes++);native.permission('granted');assert.equal(permission.state,'granted');assert.equal(changes,1);assert.equal((await w.navigator.permissions.query({name:'notifications'})).state,'original','Other permission types remain untouched');
 let suspended=0,resumed=0;w.suspendRunForBackground=()=>suspended++;w.resumeRunFromBackground=()=>resumed++;native.background();assert.equal(suspended,1);native.foreground();assert.equal(resumed,1);assert.equal(native.backgroundTracking,true);let replayed=null;const buffered=geo.watchPosition(p=>replayed=p);const ack=native.receiveBatch([{_sequence:12,id:buffered,position:{coords:{latitude:30},timestamp:100}},{_sequence:13,id:99999,position:{coords:{latitude:30},timestamp:100}}]);assert.equal(JSON.stringify(ack),'[12]','Only packets delivered to a live callback are acknowledged');assert.equal(native.bridgeVersion,7);assert.equal(native.protectedSteps,true);assert.equal(replayed.backgroundReplay,true);assert.equal(w.__longevityNativeBatch,false);
 let stepsEvent;w.addEventListener('longevity-steps',e=>stepsEvent=e.detail);native.steps({enabled:true,accountKey:'account-test'});assert.equal(messages.at(-1).action,'steps');native.receiveSteps({accountKey:'account-test',date:'2026-10-24',steps:123});assert.equal(stepsEvent.steps,123);
 native.runStatus({runID:'test-run',phase:'recording',elapsed:20,distanceMeters:100});assert.equal(messages.at(-1).action,'runStatus');assert.equal(messages.at(-1).elapsed,20);
 assert.throws(()=>geo.watchPosition(null),/callback/);
 const foreign=create('https://example.com/app');assert.equal(foreign.w.__longevityNative,undefined);assert.equal(foreign.messages.length,0,'Native API is never installed on external sign-in/research origins');
 console.log('PASS: native bridge callback lifecycle, GPS timeout/denial, clear/stale fixes, permission state, background lifecycle/batch replay and origin isolation');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>instances.forEach(d=>d.window.close()));
