// Finished-run storage is scoped exclusively to the verified Google identity.
function runStorageError(message,status=400){const error=Error(message);error.status=status;return error;}
async function runJSON(request){requireSameOriginJSON(request);const reader=request.body?.getReader();if(!reader)throw runStorageError('Run data is required.');let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1800000){await reader.cancel();throw runStorageError('This route is too large to sync. Your device copy is kept.',413);}chunks.push(value);}const bytes=new Uint8Array(size);let at=0;for(const part of chunks){bytes.set(part,at);at+=part.length;}try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw runStorageError('Invalid run data.');}}
function validatedRun(raw,id){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.id!==id||!/^\d{4}-\d{2}-\d{2}$/.test(raw.date)||!['walk','run'].includes(raw.mode)||!Number.isFinite(raw.minutes)||raw.minutes<0||raw.minutes>1440||!raw.result||!Array.isArray(raw.route)||raw.route.length>10000)throw runStorageError('Invalid finished run.');
 if(raw.intensity!=null&&!['unknown','light','moderate','vigorous'].includes(raw.intensity))throw runStorageError('Invalid intensity.');
 const run={};for(const key of ['intensity','id','date','mode','minutes','weight','temperature','bpmBefore','bpmAfter','temperatureSource','weather','weatherStatus','humidity','usedRoute','source','startedAt','finishedAt','rejectedPoints','terrainElevation'])if(raw[key]!==undefined)run[key]=raw[key];
 for(const [key,min,max]of [['temperature',-60,65],['bpmBefore',20,300],['bpmAfter',20,300],['weight',0,300]])if(run[key]!=null&&(!Number.isFinite(run[key])||run[key]<min||run[key]>max))throw runStorageError('Invalid '+key+'.');
 run.result={};for(const key of ['calories','flat','uphill','distance','speed','gain','segment_count','unknown_elevation','max_grade']){const value=raw.result[key];if(value!=null&&(!Number.isFinite(value)||value<0||value>10000000))throw runStorageError('Invalid run result.');if(value!==undefined)run.result[key]=value;}run.result.model=typeof raw.result.model==='string'?raw.result.model.slice(0,1000):'';
 run.route=raw.route.map(point=>{if(!point||!Number.isFinite(point.lat)||Math.abs(point.lat)>90||!Number.isFinite(point.lon)||Math.abs(point.lon)>180)throw runStorageError('Invalid route location.');const p={lat:point.lat,lon:point.lon};for(const key of ['ele','gpsEle','altitudeAccuracy','accuracy','elapsed']){const value=point[key];if(value!=null&&(!Number.isFinite(value)||Math.abs(value)>200000))throw runStorageError('Invalid route measurement.');if(value!==undefined)p[key]=value;}if(point.time!=null){if(typeof point.time!=='string'||!Number.isFinite(Date.parse(point.time)))throw runStorageError('Invalid route timestamp.');p.time=point.time;}if(point.breakBefore)p.breakBefore=true;if(point.elevationSource==='terrain')p.elevationSource='terrain';return p;});
 return run;
}
async function runStorage(request,env,user,path){
 if(!user)throw runStorageError('Sign in to see saved runs.',401);if(user.provider!=='google')throw runStorageError('Use Google sign-in for private run syncing across devices.',403);if(!env.DB)throw runStorageError('Run syncing is temporarily unavailable. Your device copy is kept.',503);
 const owner=user.storageKey,match=path.match(/^\/api\/runs(?:\/([A-Za-z0-9_-]{1,100}))?$/);if(!match)throw runStorageError('Run not found.',404);const id=match[1];
 if(request.method==='GET'){
  if(!id){const list=await env.DB.prepare('SELECT run_id AS id, revision, deleted, updated_at FROM run_sessions WHERE owner_key = ? ORDER BY updated_at DESC LIMIT 1000').bind(owner).all();return reply(JSON.stringify({runs:list.results}));}
  const row=await env.DB.prepare('SELECT revision, document, deleted FROM run_sessions WHERE owner_key = ? AND run_id = ?').bind(owner,id).first();if(!row)throw runStorageError('Run not found.',404);return reply(JSON.stringify({id,revision:row.revision,deleted:!!row.deleted,run:row.deleted?null:JSON.parse(row.document)}));
 }
 if(!id||!['PUT','DELETE'].includes(request.method))return reply(JSON.stringify({error:'Method not allowed'}),405,undefined,{Allow:'GET, PUT, DELETE'});
 const body=await runJSON(request);if(!body||!Number.isInteger(body.revision)||body.revision<0)throw runStorageError('A run revision is required.');
 const deleted=request.method==='DELETE',run=deleted?null:validatedRun(body.run,id),revision=body.revision+1,now=Date.now(),document=run?JSON.stringify(run):null;
 let result;
 if(body.revision===0)result=await env.DB.prepare('INSERT INTO run_sessions (owner_key,run_id,revision,document,deleted,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(owner_key,run_id) DO NOTHING').bind(owner,id,revision,document,deleted?1:0,now).run();
 else result=await env.DB.prepare('UPDATE run_sessions SET revision = ?, document = ?, deleted = ?, updated_at = ? WHERE owner_key = ? AND run_id = ? AND revision = ?').bind(revision,document,deleted?1:0,now,owner,id,body.revision).run();
 if(!result.meta?.changes)throw runStorageError('This run changed on another device. Your local version is kept; choose which version to keep in Account.',409);
 return reply(JSON.stringify({id,revision,deleted,updated_at:now}));
}
