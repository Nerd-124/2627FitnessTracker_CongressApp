import {readFile,writeFile,mkdir,readdir,rm,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const types={'.png':'image/png','.webmanifest':'application/manifest+json','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.csv':'text/csv; charset=utf-8','.py':'text/plain; charset=utf-8','.gpx':'application/gpx+xml'};
const assets={};for(const name of (await readdir(path.join(root,'web'))).sort()){const type=types[path.extname(name)];if(type){const binary=path.extname(name)==='.png';const bytes=await readFile(path.join(root,'web',name));assets['/'+name]={type,binary,body:bytes.toString(binary?'base64':'utf8')};}}
const source=(await readFile(path.join(root,'worker/server-template.js'),'utf8')).replace('__EMBEDDED_ASSETS__',JSON.stringify(assets));
await writeFile(path.join(root,'worker/index.js'),source);
await rm(path.join(root,'dist'),{recursive:true,force:true});
await mkdir(path.join(root,'dist/server'),{recursive:true});await mkdir(path.join(root,'dist/.openai'),{recursive:true});
await writeFile(path.join(root,'dist/server/index.js'),source);
await copyFile(path.join(root,'.openai/hosting.json'),path.join(root,'dist/.openai/hosting.json'));
const worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
if(typeof worker.fetch!=='function')throw Error('Worker must export fetch');
console.log('Built and validated authenticated Worker with '+Object.keys(assets).length+' embedded assets.');
