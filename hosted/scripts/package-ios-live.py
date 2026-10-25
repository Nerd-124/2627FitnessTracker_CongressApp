"""Package the editable Xcode live-site shell, without credentials or user data."""
from pathlib import Path
import json,subprocess,zipfile,shutil,hashlib
root=Path(__file__).resolve().parent.parent
source=root/'ios-live';snapshot=source/'WebSourceSnapshot'
snapshot.mkdir(exist_ok=True)
for old in snapshot.iterdir():
    if old.is_file(): old.unlink()
# The exported web snapshot contains application source, never this ZIP or its download page.
for p in (root/'web').iterdir():
    if p.is_file() and p.suffix in {'.html','.js','.css','.png','.py','.csv','.gpx','.webmanifest'} and p.name!='xcode-export.html':
        shutil.copyfile(p,snapshot/p.name)
web_hash=hashlib.sha256()
for p in sorted(snapshot.iterdir()):
    web_hash.update(p.name.encode()+b'\0'+p.read_bytes())
(source/'EXPORT_METADATA.json').write_text(json.dumps({
    'app':'Longevity Simulator','edition':'iPhone live website shell',
    'website_url':'https://longevity-simulator-lab.idealapple4.chatgpt.site/app',
    'web_snapshot_sha256':web_hash.hexdigest(),
    'minimum_ios':'17.0','contains_secrets':False,
    'validation':'JavaScript bridge and source/project structure checked; Xcode build and device testing still required.'
},indent=2)+'\n')
archive=root/'web/LongevitySimulator-Xcode.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for p in sorted(source.rglob('*')):
        if not p.is_file() or any(x in p.parts for x in ['xcuserdata','DerivedData','__pycache__','.git']): continue
        if p.name=='.DS_Store': continue
        info=zipfile.ZipInfo('LongevitySimulator-Xcode/'+p.relative_to(source).as_posix(),date_time=(2026,10,18,0,0,0))
        info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16
        z.writestr(info,p.read_bytes())
print(f'Packaged {archive.name}: {archive.stat().st_size:,} bytes')
