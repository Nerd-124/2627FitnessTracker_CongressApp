from pathlib import Path
import json,zipfile,xml.etree.ElementTree as ET,re,plistlib
root=Path(__file__).resolve().parent.parent
source=root/'ios-live';project=source/'LongevityLive.xcodeproj'
text=(project/'project.pbxproj').read_text()
ids=re.findall(r'^([A-F0-9]{24}) = ',text,re.M)
assert len(ids)==len(set(ids)), 'Duplicate Xcode IDs'
for item in (source/'LongevityLive').iterdir():
    if item.suffix in {'.swift','.js'}: assert 'path = '+item.name+';' in text, item.name
assert 'NativeBridge.js' in text and 'PBXResourcesBuildPhase' in text
scheme=ET.parse(project/'xcshareddata/xcschemes/LongevityLive.xcscheme')
for ref in scheme.findall('.//BuildableReference'):
    assert ref.attrib['BlueprintIdentifier'] in ids
assert 'IPHONEOS_DEPLOYMENT_TARGET = 17.0' in text
assert 'NSLocationWhenInUseUsageDescription' in text
assert 'NSAllowsArbitraryLoads' not in text
assert 'NSLocationAlways' not in text
assert plistlib.loads((source/'LongevityLive/Info.plist').read_bytes())['NSSupportsLiveActivities'] is True
assert 'RunActivityWidget.appex' in text and 'com.apple.product-type.app-extension' in text
assert 'PBXCopyFilesBuildPhase' in text and 'Embed Run Activity' in text
assert 'RunActivityAttributes.swift' in text and 'RunLiveActivityController.swift' in text
assert 'ActivityConfiguration' in (source/'RunActivityWidget/RunActivityWidget.swift').read_text()
assert 'DynamicIsland' in (source/'RunActivityWidget/RunActivityWidget.swift').read_text()
assert plistlib.loads((source/'LongevityLive/Info.plist').read_bytes())['UIBackgroundModes']==['location']
bridge=(source/'LongevityLive/NativeLocationBridge.swift').read_text()
assert 'manager.allowsBackgroundLocationUpdates = true' in bridge
assert 'manager.showsBackgroundLocationIndicator = true' in bridge
assert 'bufferedLocations.removeAll()' in bridge and 'flushBufferedLocations()' in bridge
with zipfile.ZipFile(root/'web/LongevitySimulator-Xcode.zip') as z:
    assert z.testzip() is None
    assert all(n.startswith('LongevitySimulator-Xcode/') and '..' not in n.split('/') for n in z.namelist())
    for p in source.rglob('*'):
        if p.is_file():
            name='LongevitySimulator-Xcode/'+p.relative_to(source).as_posix()
            assert z.read(name)==p.read_bytes(),name
    assert not any('xcuserdata' in n or '.git/' in n or n.endswith('.env') for n in z.namelist())
for p in (source/'WebSourceSnapshot').iterdir():
    assert p.read_bytes()==(root/'web'/p.name).read_bytes(), p.name
assert not (source/'WebSourceSnapshot/LongevitySimulator-Xcode.zip').exists()
assert json.loads((source/'EXPORT_METADATA.json').read_text())['minimum_ios']=='17.0'
print('PASS: Xcode file/scheme references, iPhone configuration, current web snapshot, archive integrity and safe paths. Xcode build still required.')
