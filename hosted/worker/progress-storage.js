// Private progress documents; account ownership always comes from verified identity.
async function progressStorage(request,env,user,path){
 if(!user)throw runStorageError('Sign in to sync progress.',401);
 if(user.provider!=='google')throw runStorageError('Use your Google account to sync private progress.',403);
 if(!env.DB)throw runStorageError('Progress sync is unavailable. Your device copy is kept.',503);
 try{path=decodeURIComponent(path);}catch{throw runStorageError('Invalid entry URL.');}
 const match=path.match(/^\/api\/progress(?:\/([A-Za-z0-9_.:-]{1,160}))?$/);if(!match)throw runStorageError('Entry not found.',404);
 const id=match[1],owner=user.storageKey;
 if(request.method==='GET'){
  if(!id){const rows=await env.DB.prepare('SELECT document_id AS id, revision, deleted FROM account_progress WHERE owner_key = ?').bind(owner).all();return reply(JSON.stringify({documents:rows.results}));}
  const row=await env.DB.prepare('SELECT revision, document, deleted FROM account_progress WHERE owner_key = ? AND document_id = ?').bind(owner,id).first();if(!row)throw runStorageError('Entry not found.',404);return reply(JSON.stringify({id,revision:row.revision,value:row.deleted?null:JSON.parse(row.document),deleted:!!row.deleted}));
 }
 if(!id||!['PUT','DELETE'].includes(request.method))return reply(JSON.stringify({error:'Method not allowed'}),405);
 const body=await runJSON(request);if(!Number.isInteger(body?.revision)||body.revision<0)throw runStorageError('An entry revision is required.');
 const deleted=request.method==='DELETE';if(!deleted&&(body.value===undefined||body.value===null))throw runStorageError('Entry data is required.');
 if(!/^(profile:|habits:|nutrition:|dailyGoals:|record:|workout:|eeg:|futureSelf$|baselineHabits$|baselineRecord$|onboardingComplete$|routinePromptSeen$)/.test(id))throw runStorageError('Unknown progress entry.');
 if(!deleted){const [group,key]=id.split(':');const value=body.value;
 if(['__proto__','constructor','prototype'].includes(key))throw runStorageError('Invalid entry key.');
 if(['record','workout','eeg'].includes(group)&&(!value||typeof value!=='object'||Array.isArray(value)||value[group==='record'?'date':'id']!==key))throw runStorageError('Invalid entry.');
 if(group==='record'&&!/^\d{4}-\d{2}-\d{2}$/.test(key))throw runStorageError('Invalid journal date.');
 if(['profile','habits','nutrition','dailyGoals'].includes(group)&&(!key||typeof value==='object'))throw runStorageError('Invalid profile field.');
 if(['futureSelf','baselineHabits','baselineRecord'].includes(id)&&(typeof value!=='object'||Array.isArray(value)))throw runStorageError('Invalid routine.');
 if(['onboardingComplete','routinePromptSeen'].includes(id)&&typeof value!=='boolean')throw runStorageError('Invalid preference.');
 }
 const document=deleted?null:JSON.stringify(body.value),revision=body.revision+1;
 let result;if(body.revision===0)result=await env.DB.prepare('INSERT INTO account_progress (owner_key,document_id,revision,document,deleted,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(owner_key,document_id) DO NOTHING').bind(owner,id,revision,document,deleted?1:0,Date.now()).run();
 else result=await env.DB.prepare('UPDATE account_progress SET revision = ?, document = ?, deleted = ?, updated_at = ? WHERE owner_key = ? AND document_id = ? AND revision = ?').bind(revision,document,deleted?1:0,Date.now(),owner,id,body.revision).run();
 if(!result.meta?.changes)throw runStorageError('This entry changed on another device. Sync again to review it.',409);
 return reply(JSON.stringify({id,revision,deleted}));
}
