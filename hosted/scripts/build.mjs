import {readFile,writeFile,mkdir,readdir,rm,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const types={'.zip':'application/zip','.png':'image/png','.webmanifest':'application/manifest+json','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.csv':'text/csv; charset=utf-8','.py':'text/plain; charset=utf-8','.gpx':'application/gpx+xml'};
const assets={};for(const name of (await readdir(path.join(root,'web'))).sort()){const type=types[path.extname(name)];if(type){const binary=['.png','.zip'].includes(path.extname(name));const bytes=await readFile(path.join(root,'web',name));assets['/'+name]={type,binary,body:bytes.toString(binary?'base64':'utf8')};}}
const source=(await readFile(path.join(root,'worker/server-template.js'),'utf8')).replace('__EMBEDDED_ASSETS__',JSON.stringify(assets)).replace('__FIREBASE_CONFIG__',JSON.stringify(JSON.parse(await readFile(path.join(root,'config/firebase-public.json'),'utf8')))).replace('__FIREBASE_AUTH_RUNTIME__',await readFile(path.join(root,'worker/firebase-auth.js'),'utf8')).replace('__JUDGE_AUTH_RUNTIME__',await readFile(path.join(root,'worker/judge-auth.js'),'utf8')).replace('__PROGRESS_STORAGE_RUNTIME__',await readFile(path.join(root,'worker/progress-storage.js'),'utf8')).replace('__RUN_STORAGE_RUNTIME__',await readFile(path.join(root,'worker/run-storage.js'),'utf8'));
await writeFile(path.join(root,'worker/index.js'),source);
await rm(path.join(root,'dist'),{recursive:true,force:true});
await mkdir(path.join(root,'dist/server'),{recursive:true});await mkdir(path.join(root,'dist/.openai'),{recursive:true});
await writeFile(path.join(root,'dist/server/index.js'),source);
await copyFile(path.join(root,'.openai/hosting.json'),path.join(root,'dist/.openai/hosting.json'));
const worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
if(typeof worker.fetch!=='function')throw Error('Worker must export fetch');
console.log('Built and validated authenticated Worker with '+Object.keys(assets).length+' embedded assets.');

await mkdir(path.join(root,'dist/migrations'),{recursive:true});for(const name of await readdir(path.join(root,'migrations')))await copyFile(path.join(root,'migrations',name),path.join(root,'dist/migrations',name));

await mkdir(path.join(root,'dist/drizzle/meta'),{recursive:true});for(const name of await readdir(path.join(root,'migrations')))await copyFile(path.join(root,'migrations',name),path.join(root,'dist/drizzle',name));await copyFile(path.join(root,'drizzle/meta/_journal.json'),path.join(root,'dist/drizzle/meta/_journal.json'));
