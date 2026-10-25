'use strict';
// Sleep records share the daily journal. EEG recordings are optional device imports.
let sleepSelected = null;
let eegDemo = null;
const sleepQualityLabels = ['', 'Very tired', 'A little tired', 'Okay', 'Rested', 'Very rested'];
function validSleepDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = journalDayDate(value);
  return Number.isFinite(date.getTime()) && localDate(date) === value;
}
function nightDuration(bed, wake) {
  if (![bed, wake].every(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t || ''))) return null;
  const minutes = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const duration = (minutes(wake) - minutes(bed) + 1440) % 1440;
  return duration ? duration / 60 : null;
}
function sleepEntry(date) { return state.records.find(r => r.date === date); }
function storedSleepHours(row) { return row ? nightDuration(row.bed, row.wake) : null; }
function sleepStorageAvailable() {
  try {
    const probe = KEY + '-sleep-check';
    localStorage.setItem(probe, '1'); localStorage.removeItem(probe); return true;
  } catch { return false; }
}
function selectSleepNight(date) {
  if (!validSleepDate(date)) return;
  const form = $('#sleep-form');
  if (form.dataset.dirty === 'true' && !confirm('Discard the unsaved sleep changes and switch dates?')) return;
  sleepSelected = date;
  const r = sleepEntry(date);
  for (const key of ['date', 'bed', 'wake', 'sleepQuality', 'sleepNotes']) {
    form.elements.namedItem(key).value = key === 'date' ? date : r?.[key] ?? '';
  }
  form.dataset.dirty = 'false';
  $('#sleep-form-title').textContent = storedSleepHours(r) ? 'Edit your night' : 'Record a night';
  updateSleepPreview(); renderSleep();
}
function updateSleepPreview() {
  const form = $('#sleep-form');
  const hours = nightDuration(form.elements.bed.value, form.elements.wake.value);
  $('#sleep-duration-preview').textContent = hours === null ? 'Use different bedtime and wake-up times.' : `${Math.floor(hours)} h ${Math.round(hours % 1 * 60)} min in bed · based on your times`;
}
function sleepBounds() {
  const days = Number($('#sleep-range')?.value || 7);
  const end = journalDayDate(localDate());
  const start = new Date(end); start.setDate(start.getDate() - days + 1);
  return { days, start: localDate(start), end: localDate(end) };
}
// Overrides the original basic history renderer; existing journal hooks call this too.
function renderSleep() {
  if (!$('#sleep-summary')) return;
  const { days, start, end } = sleepBounds();
  const rows = state.records.filter(r => validSleepDate(r.date) && r.date >= start && r.date <= end && storedSleepHours(r) !== null).sort((a, b) => a.date.localeCompare(b.date));
  const hours = rows.map(storedSleepHours);
  const average = hours.length ? hours.reduce((a,b) => a+b, 0) / hours.length : null;
  const stats = [['Nights recorded', `${rows.length} / ${days}`, 'In the selected range'], ['Average time in bed', average === null ? '—' : `${average.toFixed(1)} h`, 'Based on bedtime and wake-up'], ['Latest night', rows.length ? `${hours.at(-1).toFixed(1)} h` : '—', rows.at(-1)?.date || 'Record your first night']];
  const summary = $('#sleep-summary'); summary.replaceChildren();
  for (const [label, value, note] of stats) {
    const card = document.createElement('article');
    card.innerHTML = `<span>${label}</span><strong>${value}</strong><small>${note}</small>`;
    summary.append(card);
  }
  const bubbles = $('#sleep-bubbles'); bubbles.replaceChildren();
  for (let i = 0; i < days; i++) {
    const day = journalDayDate(start); day.setDate(day.getDate() + i);
    const date = localDate(day), value = storedSleepHours(sleepEntry(date));
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'sleep-bubble' + (value !== null ? ' recorded' : '') + (date === sleepSelected ? ' selected' : '');
    button.setAttribute('aria-pressed', String(date === sleepSelected));
    button.setAttribute('aria-label', `${journalDateLabel(date)}: ${value === null ? 'not recorded' : value.toFixed(1) + ' hours in bed'}`);
    button.textContent = day.getDate();
    button.title = button.getAttribute('aria-label');
    const caption = document.createElement('small'); caption.textContent = value === null ? day.toLocaleDateString(undefined,{month:'short'}) : value.toFixed(1) + 'h';
    button.append(caption); button.onclick = () => selectSleepNight(date); bubbles.append(button);
  }
  drawSleepTrend(rows, start, days);
  const box = $('#sleep-history'); box.replaceChildren();
  if (!rows.length) box.innerHTML = '<p class="muted">No nights in this range yet. Save a night to see it here.</p>';
  for (const r of [...rows].reverse()) {
    const el = document.createElement('div'); el.className = 'record';
    el.innerHTML = `<strong>${escapeHTML(r.date)}</strong><p>Bed ${escapeHTML(r.bed)} → wake ${escapeHTML(r.wake)} · ${storedSleepHours(r).toFixed(1)} h in bed</p>`;
    if (sleepQualityLabels[r.sleepQuality]) { const quality = document.createElement('p'); quality.textContent = `Feeling: ${sleepQualityLabels[r.sleepQuality]}`; el.append(quality); }
    if (r.sleepNotes) { const notes = document.createElement('p'); notes.textContent = r.sleepNotes; el.append(notes); }
    const edit = document.createElement('button'); edit.className = 'text-button'; edit.textContent = 'Edit night'; edit.onclick = () => selectSleepNight(r.date);
    const remove = document.createElement('button'); remove.className = 'text-button'; remove.textContent = 'Remove sleep only';
    remove.onclick = () => {
      if (!confirm(`Remove sleep from ${r.date}? Meals and activity will be kept.`)) return;
      if (clearingData || recordsStale || document.body.classList.contains('session-paused')) return;
      if (!sleepStorageAvailable()) { toast('Browser storage is unavailable. Nothing was removed.'); return; }
      const previous=state.records; const clean={...r};
      for (const key of ['bed','wake','sleepHours','sleepQuality','sleepNotes']) delete clean[key];
      state.records=previous.map(row=>row===r?clean:row);
      try { localStorage.setItem(KEY,JSON.stringify(state));if(typeof scheduleProgressSync==='function')scheduleProgressSync(); }
      catch { state.records=previous;toast('Not removed: browser storage is unavailable.');return; }
      renderRecords(); if (sleepSelected === r.date) { $('#sleep-form').dataset.dirty='false'; selectSleepNight(r.date); }
      $('#sleep-save-status').textContent = 'Sleep removed. Other journal information was kept.';
    };
    el.append(edit, remove); box.append(el);
  }
}
function drawSleepTrend(rows, start, days) {
  const svg = $('#sleep-trend'); svg.replaceChildren();
  const NS = 'http://www.w3.org/2000/svg';
  const add = (tag, attrs, text) => { const el = document.createElementNS(NS,tag); for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v)); if(text)el.textContent=text; svg.append(el); return el; };
  const dayIndex = date => Math.round((Date.UTC(...date.split('-').map((v,i)=>Number(v)-(i===1?1:0))) - Date.UTC(...start.split('-').map((v,i)=>Number(v)-(i===1?1:0))))/86400000);
  const x = date => 52 + dayIndex(date) / Math.max(1,days-1) * 710;
  const top = Math.max(12, ...rows.map(r=>Math.ceil(storedSleepHours(r)/4)*4));
  const y = value => 212 - value/top*175;
  for (let value=0;value<=top;value+=4) { add('line',{x1:52,x2:762,y1:y(value),y2:y(value),stroke:'#dfe7d7'}); add('text',{x:44,y:y(value)+4,'text-anchor':'end',fill:'#657b60','font-size':12},`${value}h`); }
  add('text',{x:52,y:242,fill:'#657b60','font-size':12},start.slice(5));
  add('text',{x:762,y:242,'text-anchor':'end',fill:'#657b60','font-size':12},localDate().slice(5));
  rows.forEach((r,i) => {
    if(i && dayIndex(r.date)-dayIndex(rows[i-1].date)===1) add('line',{x1:x(rows[i-1].date),y1:y(storedSleepHours(rows[i-1])),x2:x(r.date),y2:y(storedSleepHours(r)),stroke:'#648950','stroke-width':3});
    const dot = add('circle',{cx:x(r.date),cy:y(storedSleepHours(r)),r:r.date===sleepSelected?8:6,fill:'#527c45',tabindex:0,role:'button','aria-label':`${r.date}: ${storedSleepHours(r).toFixed(1)} hours. Edit night.`});
    const read = () => { $('#sleep-trend-readout').textContent = `${journalDateLabel(r.date)} · ${r.bed} → ${r.wake} · ${storedSleepHours(r).toFixed(1)} hours in bed`; };
    dot.onmouseenter=read; dot.onfocus=read; dot.onclick=()=>{selectSleepNight(r.date);read();}; dot.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();dot.onclick();}};
  });
  $('#sleep-trend-readout').textContent = rows.length ? 'Choose a recorded point to review that night.' : 'Save your first night to start your graph.';
}
function parseEEG(text) {
  if (typeof text !== 'string' || text.length > 1_000_000) throw Error('CSV must be smaller than 1 MB.');
  const lines = text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
  if(lines.length<3 || lines.length>5001) throw Error('CSV needs 2–5,000 data rows.');
  const cells = line => line.split(',').map(cell => {
    cell=cell.trim();
    if(cell.startsWith('"')&&cell.endsWith('"'))cell=cell.slice(1,-1).replace(/""/g,'"');
    if(cell.includes('"'))throw Error('Use a numeric CSV without embedded quotes or commas.');
    return cell;
  });
  const headers=cells(lines.shift()).map(x=>x.toLowerCase());
  const raw=headers.includes('amplitude_uv'); const channels=raw?['amplitude_uv']:['delta','theta','alpha','beta','gamma'];
  if(!headers.includes('time_s')||channels.some(k=>!headers.includes(k))||new Set(headers).size!==headers.length)throw Error('Use time_s,amplitude_uv or time_s,delta,theta,alpha,beta,gamma. Download a format for an example.');
  const rows=lines.map((line,i)=>{
    const values=cells(line); if(values.length!==headers.length)throw Error(`Column count differs on row ${i+2}.`);
    const row={}; for(const key of ['time_s',...channels]){const val=values[headers.indexOf(key)];if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(val)||!Number.isFinite(Number(val)))throw Error(`Missing or invalid ${key} on row ${i+2}.`);row[key]=Number(val);if((key==='time_s'||!raw)&&row[key]<0)throw Error('Time and band power must be nonnegative.');}return row;
  });
  if(rows.some((r,i)=>i&&r.time_s<=rows[i-1].time_s))throw Error('time_s must increase on every row.');
  return {rows,channels,raw};
}
function selectedEEG() { return $('#eeg-recording').value==='__sample__'?eegDemo:state.eegRecordings.find(r=>r.id===$('#eeg-recording').value); }
function renderEEGOptions(selected) {
  const selector=$('#eeg-recording'), previous=selected||selector.value;
  selector.replaceChildren();
  for(const r of [...state.eegRecordings].sort((a,b)=>b.date.localeCompare(a.date))){const opt=document.createElement('option');opt.value=r.id;opt.textContent=`${r.date} · ${r.filename}`;selector.append(opt);}
  if(eegDemo){const opt=document.createElement('option');opt.value='__sample__';opt.textContent='SAMPLE · Computer-generated';selector.append(opt);}
  if(!selector.options.length){const opt=document.createElement('option');opt.value='';opt.textContent='No imports yet';selector.append(opt);}
  if([...selector.options].some(o=>o.value===previous))selector.value=previous;
  selector.disabled=!state.eegRecordings.length&&!eegDemo;
  renderEEG();
}
function renderEEG() {
  const r=selectedEEG(), channel=$('#eeg-channel'), previous=channel.value;
  channel.replaceChildren(); $('#delete-eeg').disabled=!r||r===eegDemo;
  $('#export-eeg').disabled=!r||r===eegDemo; $('#eeg-close-demo').hidden=r!==eegDemo||!r;
  $('#eeg-viewer').hidden=!r; $('#eeg-empty').hidden=!!r; $('#eeg-demo-label').hidden=r!==eegDemo;
  if(!r){$('#eeg-chart').replaceChildren();$('#eeg-caption').textContent='';return;}
  for(const key of r.channels){const opt=document.createElement('option');opt.value=key;opt.textContent=key==='amplitude_uv'?'Raw EEG (µV)':key[0].toUpperCase()+key.slice(1)+' band (device units)';channel.append(opt);}
  if(r.channels.includes(previous))channel.value=previous;
  $('#eeg-start').value=0; $('#eeg-sample').value=0; drawEEG();
}
function eegVisibleRows(r) {
  const first=r.rows[0].time_s, last=r.rows.at(-1).time_s;
  const windowValue=$('#eeg-window').value, span=windowValue==='all'?last-first:Number(windowValue);
  const slider=$('#eeg-start'); slider.min=first; slider.max=Math.max(first,last-span); slider.disabled=span>=last-first;
  const start=Math.max(first,Math.min(Number(slider.value),Number(slider.max))); slider.value=start;
  $('#eeg-start-value').textContent=start.toFixed(2)+' s';
  return r.rows.filter(row=>row.time_s>=start&&row.time_s<=Math.min(last,start+span));
}
function drawEEG() {
  const r=selectedEEG(); if(!r)return;
  const rows=eegVisibleRows(r), channel=$('#eeg-channel').value;
  signalPlot($('#eeg-chart'),rows,'time_s',channel);
  const slider=$('#eeg-sample'); slider.max=Math.max(0,rows.length-1); slider.value=Math.min(Number(slider.value),Number(slider.max)); slider.disabled=!rows.length;
  $('#eeg-caption').textContent=`${rows.length} samples in view · ${r.rows.length} total · ${r.raw?'µV':'device band-power units'} vertically, seconds horizontally. ${rows.length>1000?'Display thinned to at most 1,001 points. ':''}No sleep stages or diagnoses inferred.`;
  inspectEEG();
}
function inspectEEG() {
  const r=selectedEEG();if(!r)return;
  const rows=eegVisibleRows(r), index=Number($('#eeg-sample').value), row=rows[index];
  if(!row){$('#eeg-readout').textContent='No samples in this window. Move the window start or choose Whole recording.';return;}
  const channel=$('#eeg-channel').value;
  $('#eeg-readout').textContent=`${r===eegDemo?'SAMPLE · ':''}${row.time_s.toFixed(3)} s · ${channel}: ${row[channel].toFixed(3)} ${r.raw?'µV':'device units'} · sample ${index+1} of ${rows.length} in view`;
}
function initializeSleep() {
  const form=$('#sleep-form');
  form.elements.date.max=localDate(); $('#eeg-date').max=localDate();
  form.addEventListener('input',event=>{if(event.target.name!=='date')form.dataset.dirty='true';updateSleepPreview();});
  form.elements.date.onchange=()=>{const date=form.elements.date.value;selectSleepNight(date);if(sleepSelected!==date)form.elements.date.value=sleepSelected||'';};
  form.onsubmit=e=>{
    e.preventDefault(); if(clearingData || recordsStale || document.body.classList.contains('session-paused')) { $('#sleep-save-status').textContent='Sign in again or reload before saving.'; return; } if(!form.reportValidity())return;
    const value=Object.fromEntries(new FormData(form)), hours=nightDuration(value.bed,value.wake);
    if(!validSleepDate(value.date)||value.date>localDate()){ $('#sleep-save-status').textContent='Choose today or an earlier wake-up date.';return; }
    if(hours===null){$('#sleep-save-status').textContent='Use different bedtime and wake-up times.';return;}
    if(!sleepStorageAvailable()){$('#sleep-save-status').textContent='Browser storage is unavailable. Export your data or enable storage before saving.';return;}
    const previous=sleepEntry(value.date)||{};
    const record={...previous,...value,sleepHours:previous.inputSources?.sleepHours?.kind==='wearable-import'&&value.bed===previous.bed&&value.wake===previous.wake?previous.sleepHours:Math.round(hours*10)/10};if(typeof clearChangedImportSources==='function')clearChangedImportSources(record,previous,Object.keys(value).concat(['sleepHours']));
    const records=state.records; state.records=[...state.records.filter(r=>r.date!==value.date),record];
    try { localStorage.setItem(KEY,JSON.stringify(state));if(typeof scheduleProgressSync==='function')scheduleProgressSync(); }
    catch { state.records=records; $('#sleep-save-status').textContent='Not saved: browser storage is full or unavailable. Export data and remove an old EEG recording, then try again.';return; }
    sleepSelected=value.date; form.dataset.dirty='false'; renderRecords(); renderSleep();
    $('#sleep-form-title').textContent='Edit your night';$('#sleep-save-status').textContent=`Saved ${value.date} · ${hours.toFixed(1)} h in bed. Your journal and sleep graph are updated.`;
    toast('Night saved. Your journal is updated too.');
  };
  $('#sleep-new').onclick=()=>selectSleepNight(localDate());
  $('#sleep-range').onchange=renderSleep;
  $('#sleep-to-journal').onclick=()=>{openJournalEditor(sleepSelected||localDate());};
  $('#eeg-recording').onchange=()=>{$('#eeg-status').textContent='';renderEEG();};
  $('#eeg-channel').onchange=drawEEG;$('#eeg-window').onchange=drawEEG;$('#eeg-start').oninput=drawEEG;$('#eeg-sample').oninput=inspectEEG;
  $('#eeg-file').onchange=async e=>{
    const input=e.target; input.disabled=true;
    try {
      const file=input.files[0];if(!file)return;
      const date=$('#eeg-date').value;
      if(!validSleepDate(date)||date>localDate())throw Error('Choose today or an earlier recording date.');
      if(file.size>1_000_000)throw Error('CSV must be smaller than 1 MB.');
      if(state.eegRecordings.length>=10)throw Error('Remove an old recording first; this browser keeps up to 10.');
      $('#eeg-status').textContent='Reading and checking your CSV…';
      const parsed=parseEEG(await file.text());
      // Account transitions may lock storage while the asynchronous file is read.
      if(clearingData || recordsStale || document.body.classList.contains('session-paused'))throw Error('Sign in again or reload before importing.');
      const record={id:crypto.randomUUID(),date,filename:file.name,...parsed};
      state.eegRecordings.push(record);
      try { localStorage.setItem(KEY,JSON.stringify(state));if(typeof scheduleProgressSync==='function')scheduleProgressSync(); }
      catch { state.eegRecordings.pop();throw Error('Not imported: browser storage is full or unavailable. Export data and remove an old recording first.'); }
      renderEEGOptions(record.id);$('#eeg-status').textContent=`Imported ${parsed.rows.length} samples. Choose a signal or move the sample slider to explore.`;
    } catch(err) { $('#eeg-status').textContent=err.message; }
    finally {input.value='';input.disabled=false;}
  };
  $('#delete-eeg').onclick=()=>{
    const r=selectedEEG();if(!r||r===eegDemo||clearingData||recordsStale||document.body.classList.contains('session-paused'))return;
    if(!confirm(`Remove ${r.filename}? Export it first if you need a copy.`))return;
    const previous=state.eegRecordings;state.eegRecordings=previous.filter(item=>item.id!==r.id);
    try{localStorage.setItem(KEY,JSON.stringify(state));if(typeof scheduleProgressSync==='function')scheduleProgressSync();}catch{state.eegRecordings=previous;$('#eeg-status').textContent='Could not remove recording: browser storage is unavailable.';return;}
    renderEEGOptions();$('#eeg-status').textContent='Recording removed. Your sleep journal is unchanged.';
  };
  $('#export-eeg').onclick=()=>{
    const r=selectedEEG();if(!r||r===eegDemo)return;
    const keys=['time_s',...r.channels];const text=[keys.join(','),...r.rows.map(row=>keys.map(key=>row[key]).join(','))].join('\n');
    const url=URL.createObjectURL(new Blob([text],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download=`eeg-${r.date}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $('#eeg-demo').onclick=()=>{
    eegDemo={raw:true,channels:['amplitude_uv'],rows:Array.from({length:1201},(_,i)=>({time_s:i/20,amplitude_uv:12*Math.sin(i/20*2*Math.PI*2)+4*Math.sin(i/20*2*Math.PI*7)}))};
    $('#eeg-status').textContent='Viewing a computer-generated sample. Nothing has been added to your records.';
    renderEEGOptions('__sample__');
  };
  $('#eeg-close-demo').onclick=()=>{eegDemo=null;renderEEGOptions();$('#eeg-status').textContent='Sample closed.';};
  selectSleepNight(localDate());renderEEGOptions();
}
