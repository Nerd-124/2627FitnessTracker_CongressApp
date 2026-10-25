// Guideline comparisons are educational checklist items, never a clinical score.
const RoutineEvidence=(()=>{
 const sources={mental:['WHO-5 official instrument','https://www.who.int/publications/m/item/WHO-UCN-MSD-MHE-2024.01'],movement:['WHO activity guidelines','https://www.who.int/publications/i/item/9789240015128'],sleep:['CDC sleep guidance','https://www.cdc.gov/sleep/about/index.html'],smoking:['CDC benefits of quitting','https://www.cdc.gov/tobacco/about/benefits-of-quitting.html']};
 const num=(v,max=100000)=>v==null||v===''||typeof v==='boolean'?null:Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=max?Number(v):null;
 const date=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T12:00:00Z'))?d:null;
 function assess(data,today){
  const end=new Date(today+'T12:00:00Z'),days=Array.from({length:7},(_,i)=>{const d=new Date(end);d.setUTCDate(d.getUTCDate()-6+i);return d.toISOString().slice(0,10)}),inWeek=r=>date(r.date)&&days.includes(r.date);
  const records=new Map((data.records||[]).filter(inWeek).map(r=>[r.date,r])),sessions=[],seen=new Set();
  for(const r of [...(data.activities||[]),...(data.workouts||[])].filter(inWeek)){if(r.id&&seen.has(r.id))continue;if(r.id)seen.add(r.id);sessions.push(r);}
  const age=FutureSelf.number(data.profile?.age,13,100),teen=age!==null&&age<18,base=data.baselineHabits||(data.onboardingComplete===false?{}:data.habits)||{},factors=data.futureSelf?.factors||{};
  const perDay=days.map(day=>{
   const r=records.get(day)||{},ss=sessions.filter(s=>s.date===day),duration=num(r.duration,1440),logged=ss.map(s=>num(s.minutes,1440)).filter(n=>n!==null),sessionMinutes=logged.reduce((a,b)=>a+b,0);
   const movement=duration===null&&!logged.length?null:Math.max(duration||0,sessionMinutes);
   const kcal=ss.map(s=>num(s.result?.calories??s.calories)).filter(n=>n!==null),explicit=num(r.exerciseCalories),burn=kcal.length||explicit!==null?Math.max(explicit||0,kcal.reduce((a,b)=>a+b,0)):null;
   let sleep=num(r.sleepHours,24);if(r.inputSources?.sleepHours?.kind!=='wearable-import'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(r.bed||'')&&/^([01]\d|2[0-3]):[0-5]\d$/.test(r.wake||'')){const mins=t=>Number(t.slice(0,2))*60+Number(t.slice(3));sleep=((mins(r.wake)-mins(r.bed)+1440)%1440)/60;}
   return {date:day,movement,burn,steps:num(r.steps,200000),sleep};
  });
  const sum=key=>{const v=perDay.map(r=>r[key]).filter(n=>n!==null);return v.length?v.reduce((a,b)=>a+b,0):null},avg=key=>{const v=perDay.map(r=>r[key]).filter(n=>n!==null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null},count=key=>perDay.filter(r=>r[key]!==null).length;
  const movement=sum('movement'),movementDays=count('movement'),sleep=avg('sleep')??num(base.sleep,24),sleepNights=count('sleep'),checks=[];
  const add=(key,title,value,met,detail,action,source,coverage='')=>checks.push({key,title,value,met,detail,action,source:sources[source]||null,coverage});
  const target=teen?420:150,reported=num(base.exercise,10080),movementValue=movement??reported;
  // Mixed/intensity-unknown GPS and manual minutes cannot certify aerobic guidance.
  let qualified=0;const gymDays=new Set();for(const day of days){let sessionQualified=0;for(const s of sessions.filter(s=>s.date===day)){const minutes=num(s.minutes,1440)||0;if(s.sport==='strength'){gymDays.add(s.date);continue;}if(['moderate','vigorous'].includes(s.intensity))sessionQualified+=minutes*(s.intensity==='vigorous'&&!teen?2:1);}const record=records.get(day)||{},manual=['moderate','vigorous'].includes(record.exerciseIntensity)?(num(record.duration,1440)||0)*(record.exerciseIntensity==='vigorous'&&!teen?2:1):0;qualified+=Math.max(sessionQualified,manual);}

  const aerobicMet=age===null?null:qualified>=target?true:movement===null&&reported!==null&&['moderate','vigorous'].includes(base.movementIntensity)?reported*(base.movementIntensity==='vigorous'&&!teen?2:1)>=target:movementDays===7&&movement===0?false:null;
  add('movement','Exercise',movementValue===null?'Not recorded':Math.round(movementValue)+' min '+(movement===null?'reported / week':'logged / 7 days'),aerobicMet,teen?'Reference: about 60 minutes of moderate-to-vigorous activity a day across the week.':'Reference: 150 minutes of moderate activity weekly, or 75 vigorous; light activity is still useful.',movement===null&&reported!==null?'Confirm these routine minutes are moderate or vigorous. Build gradually with activities you enjoy.':qualified>=target?'Keep your routine varied and allow recovery.':'Keep logging activity and intensity. A run or walk’s intensity cannot be inferred reliably from GPS speed alone.','movement',movement===null?`Self-reported routine; ${base.movementIntensity||'unknown'} intensity`:`${movementDays}/7 days with movement entries; ${Math.round(qualified)} intensity-qualified ${teen?'minutes':'moderate-equivalent minutes'}`);
  const min=teen?8:7,max=teen?10:age>=65?8:age>=61?9:null;
  const sleepMet=age===null||sleep===null?null:sleep>=min&&(max===null||sleep<=max);
  add('sleep','Sleep opportunity',sleep===null?'Not entered':sleep.toFixed(1)+' h/night',sleepMet,(age===null?'Add your age to choose a sleep reference.':'Age-specific reference: '+(teen?'8–10 hours':age>=65?'7–8 hours':age>=61?'7–9 hours':'at least 7 hours'))+'. Bed and wake times measure time in bed, not actual sleep.',sleepMet===false?'Keep a consistent sleep schedule. Persistent tiredness deserves a conversation with a health professional.':'Protect regular sleep and note how rested you feel.','sleep',sleepNights?`${sleepNights}/7 logged nights`:'Self-reported routine');
  const smoking=factors.smoking;
  add('smoking','Smoking',({never:'Never',former:'Former',current:'Current'})[smoking]||'Not entered',['never','former'].includes(smoking)?true:smoking==='current'?false:null,'Not smoking supports health. Former smoking still matters; this does not estimate individual risk.',smoking==='current'?'Ask a clinician or quit-support service for help stopping. Students can also talk with a trusted adult.':'Stay smoke-free and avoid secondhand smoke.','smoking');
  const mental=WHO5.assess(data,today);add('mental','Mental health',mental?`WHO-5 ${mental.total}/100`:'Not enough data',mental?mental.total===100:null,'WHO-5 official score: sum five answers (0–25) × 4. App letters and combined grades are not WHO clinical categories.',WHO5.support(mental),'mental',mental?'Assessment '+mental.date+' · past two weeks':'No current complete assessment');checks.sort((a,b)=>['movement','mental','sleep','smoking'].indexOf(a.key)-['movement','mental','sleep','smoking'].indexOf(b.key));
  const known=checks.filter(c=>c.met!==null),met=known.filter(c=>c.met).length;
  const context=[];const push=(title,value,note,action)=>context.push({title,value,note,action});
  push('Estimated exercise energy',sum('burn')===null?'Not recorded':Math.round(sum('burn'))+' estimated kcal',`${count('burn')}/7 days. Exercise estimates exclude resting energy and are not your total daily expenditure.`,'Use this as activity context, not a target for extra exercise.');
  push('Daily steps',avg('steps')===null?'Not recorded':Math.round(avg('steps')).toLocaleString()+' / recorded day',`${count('steps')}/7 days. Steps and exercise minutes overlap; they are not scored twice. There is no universal 10,000-step pass mark.`,'Compare with your own recent routine and build movement gradually.');
  const distance=sessions.map(r=>num(r.result?.distance??r.distance)).filter(v=>v!==null),ascent=sessions.map(r=>num(r.result?.gain)).filter(v=>v!==null),temperatures=sessions.map(r=>r.temperature).filter(v=>typeof v==='number'&&Number.isFinite(v));push('Run and workout detail',sessions.length?`${sessions.length} saved sessions · ${distance.reduce((a,b)=>a+b,0).toFixed(2)} recorded km · ${Math.round(ascent.reduce((a,b)=>a+b,0))} m recorded ascent`:'No saved sessions this week',temperatures.length?`Average recorded outdoor temperature: ${(temperatures.reduce((a,b)=>a+b,0)/temperatures.length).toFixed(1)} °C. This is not body temperature.`:'Missing altitude or weather stays unknown. GPS gaps are not filled in.', 'Review routes, elevation and timing in Exercise → Past log. These describe the session, not future health.');
  const qualities=[...records.values()].filter(r=>r.sleepQuality!=null&&r.sleepQuality!=='');if(qualities.length)push('Sleep quality notes',qualities.length+' nights with self-rated sleep quality','Time in bed alone cannot establish restorative sleep. Your ratings and notes remain in Sleep & brainwaves.','Use your sleep diary to notice patterns and discuss persistent tiredness with a health professional.');
  if((data.eegRecordings||[]).some(inWeek))push('Imported EEG',data.eegRecordings.filter(inWeek).length+' recent recordings','Imported signals are not used to infer health, sleep stages or lifespan.','Review the recording with its device guidance; clinical interpretation needs appropriate expertise.');
  const stress=num(factors.stress,10);push('Stress and other health readings',stress===null?'Stress not entered':stress+' / 10 self-rated stress','Stress, pulse, blood pressure, glucose, EEG and temperature are context, not comparable units for a single health score.',stress!==null&&stress>=7?'Try manageable breaks and support from someone you trust; seek help for persistent distress.':'Review persistent symptoms or unusual health readings with a qualified professional.');
  return {days,perDay,checks,context,known:known.length,met,possible:checks.length,support:known.length?met/known.length:null,sleepNights,movementDays,level:known.length?'review':'unknown'};
 }
 return {assess,sources};
})();

'use strict';
// Visual scenario model only. Keep it independent of clinical or lifespan predictions.
const FutureSelf=(()=>{
 const tones=['#f1d0b5','#dfb18d','#bd8763','#8c5d43','#573b2d'];
 const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
 function number(value,lo,hi){if(value==null||value===''||typeof value==='boolean')return null;const n=Number(value);return Number.isFinite(n)&&n>=lo&&n<=hi?n:null;}
 function settings(raw={},age=28){
  if(!raw||typeof raw!=='object')raw={};const current=number(age,13,100)??13,f=raw.factors||{},targetYear=typeof portraitTargetYear==='function'?portraitTargetYear():new Date().getFullYear()+25,futureYears=Math.max(0,targetYear-new Date().getFullYear()),portrait=raw.portrait&&typeof raw.portrait.dataUrl==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(raw.portrait.dataUrl)&&raw.portrait.dataUrl.length<=240000?{dataUrl:raw.portrait.dataUrl,updatedAt:String(raw.portrait.updatedAt||'')}:null,reported=raw.bodyAgeAssessment,bodyAgeAssessment=reported&&number(reported.age,1,120)!==null&&typeof reported.source==='string'&&reported.source.trim()&&/^\d{4}-\d{2}-\d{2}$/.test(reported.date||'')?{age:Number(reported.age),source:reported.source.trim().slice(0,120),date:reported.date}:null;
  const a=raw.appearance||{};const palette=['#345d43','#4d9275','#526d91','#9a6371','#936f42','#292f35'];const hairColors=['#354b40','#211b18','#704b31','#bc9357','#c3c4be','#a15d3c'];
  return {targetYear,portrait,bodyAgeAssessment,appearance:{background:['meadow','coast','sunset'].includes(a.background)?a.background:'auto',scene:['hiking','travel','garden','dance','family','everyday'].includes(a.scene)?a.scene:'auto',accent:['lavender','sea','rose'].includes(a.accent)?a.accent:'auto',shape:['regular','slender','broad'].includes(a.shape)?a.shape:'regular',accessibility:['none','wheelchair','cane'].includes(a.accessibility)?a.accessibility:'none',outfit:a.outfit==='adventure'?'adventure':'everyday',motion:a.motion==='off'?'off':'on',body:['male','female','neutral'].includes(a.body)?a.body:'male',hair:['short','curly','long','bald'].includes(a.hair)?a.hair:'short',hairColor:hairColors.includes(a.hairColor)?a.hairColor:hairColors[0],shirt:palette.includes(a.shirt)?a.shirt:palette[1]},version:4,futureYears,targetAge:current+futureYears,skin:tones.includes(raw.skin)?raw.skin:tones[1],view:raw.view==='starting'?'starting':'changes',factors:{strength:number(f.strength,0,7),strengthEnabled:f.strengthEnabled===true,stress:number(f.stress,0,10),energy:number(f.energy,1,5),rested:number(f.rested,1,5),dailyActivities:['manageable','sometimes-hard','often-hard','varies'].includes(f.dailyActivities)?f.dailyActivities:'unknown',outdoors:number(f.outdoors,0,720),smoking:['never','former','current'].includes(f.smoking)?f.smoking:'unknown'},logImport:raw.logImport&&typeof raw.logImport==='object'?raw.logImport:null};
 }
 function evaluate(habits={},factors={},age=28){
  const e=RoutineEvidence.assess({profile:{age},baselineHabits:habits,futureSelf:{factors},onboardingComplete:age!==null},new Date().toISOString().slice(0,10));
  return {...e,rows:e.checks,labels:'Routine reference checklist',fatigue:false};
 }
 function effects(habits={},age=28){
  if(age===null)return [{title:'Make this more personal when you’re ready',effect:'Sleep and movement references depend on your age. Add your age in My profile to see tailored routine feedback.',action:'You can still record your routine and meals now. Choose enjoyable movement and a consistent sleep schedule.'}];
  const sleep=number(habits.sleep,0,24),exercise=number(habits.exercise,0,600),plants=number(habits.plants,0,10),teen=age<18,rows=[];
  const add=(title,effect,action)=>rows.push({title,effect,action});
  if(sleep!==null&&sleep<(teen?8:7))add('Short sleep','Regularly short sleep can contribute to daytime tiredness, trouble concentrating and irritability.',`Try a consistent bedtime and wake time, and leave room for ${teen?'8–10':'7–9'} hours of sleep. Wind down and reduce late caffeine.`);
  else if(sleep!==null&&sleep>(teen?10:9))add('Long time in bed','Long time in bed does not necessarily mean restorative sleep. If you still feel sleepy, the hours alone cannot explain why.','Keep a regular schedule. If excessive sleepiness continues, ask a healthcare professional about sleep quality and other causes.');
  if(exercise!==null&&exercise<(teen?420:150))add('Limited movement','Low activity over time may reduce stamina, making everyday activity feel more tiring. Sitting for long stretches may also cause stiffness.',teen?'Start with enjoyable movement such as walking, cycling, dancing or sports. Build gradually toward an average of 60 minutes daily; include vigorous, muscle- and bone-strengthening activity on 3 days a week.':'Start with a manageable walk or another activity you enjoy. Build gradually toward 150 minutes of moderate activity weekly, plus strength activity on 2 days. Break up long sitting periods.');
  if(!rows.length)add(sleep===null&&exercise===null?'Add your routine':'Keep supporting your routine',sleep===null&&exercise===null?'There is not enough entered information to suggest routine-related effects.':'No specific concern is flagged by these simple checks. Meeting them does not rule out symptoms or health conditions.','Update your profile and journal so suggestions reflect your routine. Choose movement you enjoy and maintain a regular sleep schedule.');
  return rows;
 }
 function colorAt(a,b,t){const rgb=x=>x.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16));return '#'+rgb(a).map((v,i)=>Math.round(v+(rgb(b)[i]-v)*t).toString(16).padStart(2,'0')).join('');}
 function avatar(age,result,skin,appearance={}){
  const ageAmount=clamp((age-40)/45,0,1),hair=colorAt(appearance.hairColor||'#354b40','#c3c4be',ageAmount*.65),bodyScale=appearance.shape==='broad'?1.12:appearance.shape==='slender'?.89:1;
  const neutral=true,fatigue=false,low=false;
  const energy=neutral?'unknown':low?'low':fatigue||result.level==='mixed'?'moderate':'high';
  const slump=neutral?0:low?13:fatigue?8:result.level==='mixed'?4:0;
  const shirt=appearance.shirt||'#4d9275';
  const mouth=neutral?'M111 77Q120 84 130 77':energy==='high'?'M109 76Q120 90 132 75':energy==='low'?'M109 82Q120 72 132 82':'M111 79Q121 77 130 80';
  const eyes=fatigue?'<path data-avatar-eyes="tired" d="M103 64Q109 69 115 64M126 64Q132 69 138 64" fill="none" stroke="#354b40" stroke-width="2.6" stroke-linecap="round"/><path d="M103 71Q109 74 115 71M126 71Q132 74 138 71" fill="none" stroke="#795f50" stroke-width="1.4" opacity=".6"/>':'<g data-avatar-eyes="open"><circle cx="109" cy="62" r="2.4" fill="#354b40"/><circle cx="132" cy="62" r="2.4" fill="#354b40"/></g>';
  // Pose and energy symbols illustrate entered habits. Never infer disease,
  // disability, body size, or skin tone from a habit index or BMI.
  return `<title>Custom avatar at age ${age}</title><desc>Custom appearance and artistic age details. This avatar does not estimate health, energy, disability or future appearance.</desc>
  <ellipse cx="120" cy="263" rx="55" ry="9" fill="#cbdccf"/>
  <g data-avatar-shape="${appearance.shape||'regular'}" transform="translate(${120*(1-bodyScale)} 0) scale(${bodyScale} 1)" data-avatar-body="${appearance.body||'male'}" data-avatar-pose="neutral" data-avatar-slump="${slump}"><path d="${appearance.accessibility==='wheelchair'?'M93 174V207Q94 214 105 214H147L158 240H177L161 200Q160 195 151 195H125V174Z':'M98 177L90 246Q94 258 106 250L121 195L132 250Q146 258 149 246L141 174'}" fill="#325d4d"/>
  <g transform="rotate(${slump} 120 180)"><path d="${appearance.body==='female'?'M96 99Q77 105 72 126L55 174Q58 183 66 177L90 132L94 157L85 181Q120 195 154 181L145 156L148 132L171 177Q180 183 183 174L167 124Q161 106 143 99Z':appearance.body==='neutral'?'M93 99Q75 105 70 126L54 174Q57 183 66 177L88 137L88 181Q120 193 151 181L151 137L173 177Q182 183 185 174L169 124Q163 105 146 99Z':'M89 99Q72 103 66 126L51 172Q53 184 65 178L86 139L88 181Q119 196 149 181L151 139L173 178Q185 184 187 172L170 124Q164 103 147 99Z'}" fill="${shirt}"/>
  <g data-avatar-head="true" transform="translate(0 ${low?5:fatigue?3:0})"><rect x="108" y="80" width="25" height="28" rx="10" fill="${skin}"/><ellipse cx="120" cy="62" rx="30" ry="35" fill="${skin}"/>
  <path data-avatar-hair="${appearance.hair||'short'}" d="${appearance.hair==='bald'?'M92 45Q120 16 148 45':appearance.hair==='long'?'M87 93L86 43Q86 18 120 19Q155 17 155 48L157 96L143 87L140 45L130 34Q114 48 96 45L97 91Z':appearance.hair==='curly'?'M87 56Q78 42 88 33Q84 19 100 20Q110 9 122 18Q139 9 145 25Q162 28 153 52L139 43L128 34L99 48Z':'M90 66Q78 27 107 22Q148 10 151 52L140 46L131 33Q113 50 92 45Z'}" fill="${appearance.hair==='bald'?'none':hair}" stroke="${appearance.hair==='bald'?hair:'none'}"/>
  ${eyes}<path data-avatar-brows="${energy}" d="${low?'M102 54L115 57M126 57L139 54':'M103 53Q109 50 115 53M126 53Q132 50 138 53'}" fill="none" stroke="#56675b" stroke-width="1.7" stroke-linecap="round"/>
  <path data-avatar-mouth="${energy}" d="${mouth}" fill="none" stroke="#805b4c" stroke-width="2.3" stroke-linecap="round"/>
  <g data-avatar-age-lines="true" opacity="${ageAmount.toFixed(2)}" fill="none" stroke="#795f50" stroke-width="1.2"><path d="M105 45Q120 41 134 45M108 49Q120 46 132 49M101 65L95 67M139 65L145 67M105 76L103 82M134 76L136 82"/></g></g>
  <path d="M104 104L120 116L137 103" fill="none" stroke="#d9e5db" stroke-width="2"/></g></g>
  ${appearance.accessibility==='wheelchair'?'<g data-avatar-accessibility="wheelchair"><path d="M84 165V214H155L168 239H188" fill="none" stroke="#587580" stroke-width="7" stroke-linejoin="round"/><circle cx="107" cy="226" r="28" fill="#e0e9df" stroke="#587580" stroke-width="5"/><circle cx="107" cy="226" r="5" fill="#587580"/><path d="M107 200V252M82 226H133M89 208L125 244M89 244L125 208" stroke="#8aa0a0" stroke-width="2"/><circle cx="183" cy="249" r="9" fill="#587580"/></g>':appearance.accessibility==='cane'?'<path data-avatar-accessibility="cane" d="M183 180Q197 168 197 184L191 257" fill="none" stroke="#7a654c" stroke-width="5" stroke-linecap="round"/>':''}
  ${appearance.outfit==='adventure'?'<g data-avatar-outfit="adventure"><path d="M95 32L101 14H137L145 32Z" fill="#b99660"/><path d="M87 33H153" stroke="#9a7a4a" stroke-width="7" stroke-linecap="round"/></g>':''}`;
 }
 function routine(data={},today){
  const base=data.baselineHabits||(data.onboardingComplete===false?{}:data.habits)||{},values={exercise:base.exercise??null,sleep:base.sleep??null,};
  const day=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const date=new Date(value+'T12:00:00Z');return Number.isFinite(+date)&&date.toISOString().slice(0,10)===value?date:null;};
  const end=day(today);if(!end)return {values,sleepNights:0,movementDays:0,movementSource:'profile',sleepSource:'profile'};
  const begin=new Date(end);begin.setUTCDate(begin.getUTCDate()-6);const start=begin.toISOString().slice(0,10);
  const rows=new Map(),minutes=new Map(),sessionMinutes=new Map(),ids=new Set(),nights=[];
  for(const row of data.records||[])if(day(row.date)&&row.date>=start&&row.date<=today)rows.set(row.date,row);
  for(const row of rows.values()){
   const duration=number(row.duration,0,1440);if(duration!==null)minutes.set(row.date,duration);
   let hours=null;
   if(/^([01]\d|2[0-3]):[0-5]\d$/.test(row.bed||'')&&/^([01]\d|2[0-3]):[0-5]\d$/.test(row.wake||'')){
    const mins=time=>Number(time.slice(0,2))*60+Number(time.slice(3));hours=((mins(row.wake)-mins(row.bed)+1440)%1440)/60;
   }else hours=number(row.sleepHours,0,24);
   if(hours!==null)nights.push(hours);
  }
  for(const row of [...(data.activities||[]),...(data.workouts||[])]){
   if(!day(row.date)||row.date<start||row.date>today)continue;
   if(row.id){if(ids.has(row.id))continue;ids.add(row.id);}
   const value=number(row.minutes,0,1440);if(value!==null)sessionMinutes.set(row.date,(sessionMinutes.get(row.date)||0)+value);
  }
  for(const [date,value]of sessionMinutes)minutes.set(date,Math.max(minutes.get(date)||0,value));
  const total=[...minutes.values()].reduce((a,b)=>a+b,0);
  // A partial week cannot establish low weekly movement. Use the entered
  // profile until all seven days are logged, or a known 150 minutes is reached.
  const useMovement=minutes.size===7||total>=(data.profile?.age<18?420:150);
  if(useMovement)values.exercise=Math.min(600,total);
  if(nights.length)values.sleep=nights.reduce((a,b)=>a+b,0)/nights.length;
  return {values,sleepNights:nights.length,movementDays:minutes.size,movementSource:useMovement?'logs':'profile',sleepSource:nights.length?'logs':'profile'};
 }

 return {tones,settings,evaluate,avatar,number,routine,effects};
})();
function factorEffects(factors){const rows=[];if(factors.smoking==='current')rows.push({title:'Smoking',effect:'Smoking raises long-term health risks that a simple habit index cannot quantify.',action:'Ask a healthcare professional or a quit-support service for help stopping. Students can also talk with a trusted adult.'});if(FutureSelf.number(factors.stress,0,10)>=7)rows.push({title:'High self-rated stress',effect:'Ongoing stress may affect sleep, concentration and how you feel.',action:'Try a manageable break and reach out to someone you trust. Seek professional support if stress is persistent or hard to manage.'});return rows;}
function futureSelfSettings(){state.futureSelf=FutureSelf.settings(state.futureSelf,FutureSelf.number(state.profile.age,13,100)??13);return state.futureSelf;}
function renderRoutineChart(evidence){
 const svg=$('#chart');if(!svg)return;const key=$('#routine-chart-metric')?.value||'movement',unit={movement:'min',steps:'steps',intake:'recorded kcal',burn:'estimated kcal',sleep:'h'}[key];
 svg.replaceChildren();svg.setAttribute('aria-label',`Last seven days: ${key}. Blank days are missing, not zero.`);const ns='http://www.w3.org/2000/svg',values=evidence.perDay.map(d=>d[key]),max=Math.max(1,...values.filter(v=>v!==null));
 evidence.perDay.forEach((day,i)=>{const value=day[key],x=35+i*91;const rect=document.createElementNS(ns,'rect');for(const [k,v]of Object.entries({x,y:value===null?153:153-value/max*115,width:54,height:value===null?2:Math.max(2,value/max*115),fill:value===null?'#c3ccbd':'#62875a'}))rect.setAttribute(k,v);const title=document.createElementNS(ns,'title');title.textContent=day.date+': '+(value===null?'not recorded':Math.round(value*10)/10+' '+unit);rect.append(title);rect.setAttribute('tabindex','0');rect.setAttribute('aria-label',title.textContent);const label=document.createElementNS(ns,'text');label.setAttribute('x',x+27);label.setAttribute('y','177');label.setAttribute('text-anchor','middle');label.setAttribute('font-size','12');label.textContent=day.date.slice(5);const number=document.createElementNS(ns,'text');number.setAttribute('x',x+27);number.setAttribute('y',value===null?143:Math.max(20,143-value/max*115));number.setAttribute('text-anchor','middle');number.setAttribute('font-size','12');number.textContent=value===null?'—':Math.round(value*10)/10;svg.append(rect,title.cloneNode(true),label,number);});
}
function renderFutureSelf(){
 const svg=$('#home-avatar');if(!svg)return;const config=futureSelfSettings(),today=typeof localDate==='function'?localDate():new Date().toLocaleDateString('en-CA'),evidence=RoutineEvidence.assess(state,today);
 const input=$('#avatar-age');if(input){input.min=0;input.max=100-(FutureSelf.number(state.profile.age,13,100)??13);if(document.activeElement!==input)input.value=config.futureYears;$('#avatar-years-value').textContent=`+${config.futureYears} years`;input.setAttribute('aria-valuetext',config.futureYears+' years into the future');$('#avatar-age-help').textContent=state.onboardingComplete===false?'Add your age in Account for an age-specific preview. Artistic styling is not a forecast.':`Current age ${state.profile.age} → preview age ${config.targetAge}. Artistic styling is not a forecast.`;}

 svg.innerHTML=FutureSelf.avatar(config.targetAge,{level:'unknown',labels:'Custom avatar'},config.skin,config.appearance);svg.setAttribute('aria-label',`Custom avatar at age ${config.targetAge}; not a health forecast.`);
 const card=svg.closest('.home-avatar-card');if(card){card.dataset.support='neutral';card.dataset.energy='neutral';}
 $('#home-avatar-title').textContent=state.onboardingComplete===false?`Avatar · +${config.futureYears} years`:`Your avatar at ${config.targetAge}`;
 const gaps=evidence.checks.filter(c=>c.met===false).map(c=>c.title);$('#home-avatar-routine').textContent=gaps.length?'Focus on: '+gaps.slice(0,2).join(' and '):evidence.known?'Review your routine below':'Add your routine when ready';
 $('#home-avatar-source').textContent=`Last 7 days: ${evidence.movementDays} movement days and ${evidence.sleepNights} logged nights. Missing data stays unknown.`;
 const score=$('#score');if(score)score.textContent=evidence.known?`${evidence.met}/${evidence.possible}`:'—';const note=$('#routine-index-note');if(note)note.textContent=`${evidence.met} reference checks met; ${evidence.known}/${evidence.possible} assessable. Each check counts once. This checklist is not a validated health or longevity score.`;
 const effects=$('#routine-effects');if(effects){effects.replaceChildren();for(const row of evidence.checks){const article=document.createElement('article');article.className='routine-evidence-item';article.dataset.status=row.met===true?'met':row.met===false?'review':'unknown';const h=document.createElement('h3');h.textContent=row.title+' · '+(row.met===true?'Reference met':row.met===false?'Review':'Not assessable');const value=document.createElement('strong');value.textContent=row.value;const detail=document.createElement('p');detail.textContent=row.detail;const coverage=document.createElement('p');coverage.className='muted';coverage.textContent=row.coverage;const action=document.createElement('p');action.textContent='Next step: '+row.action;article.append(h,value,action);const more=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Reference & data used';more.append(summary,detail,coverage);if(row.source){const link=document.createElement('a');link.href=row.source[1];link.textContent=row.source[0];link.target='_blank';link.rel='noopener noreferrer';more.append(link);}article.append(more);effects.append(article);}
 const h=document.createElement('h3');h.textContent='Your other logged data';effects.append(h);for(const row of evidence.context){const a=document.createElement('article'),title=document.createElement('h3'),v=document.createElement('strong'),p=document.createElement('p'),next=document.createElement('p');title.textContent=row.title;v.textContent=row.value;p.textContent=row.note;next.textContent=row.action;a.append(title,v,p,next);const sourceLinks={'Daily steps':['NIH step-count research','https://www.nih.gov/news-events/nih-research-matters/number-steps-day-more-important-step-intensity']};if(sourceLinks[row.title]){const link=document.createElement('a');link.textContent=sourceLinks[row.title][0];link.href=sourceLinks[row.title][1];link.target='_blank';link.rel='noopener noreferrer';a.append(link);}effects.append(a);}}
 renderRoutineChart(evidence);if(typeof renderPortrait2050==='function')renderPortrait2050(evidence);if(typeof renderHabitExperience==='function')renderHabitExperience(evidence);
}
function initializeFutureSelf(){futureSelfSettings();const input=$('#avatar-age');if(input){input.addEventListener('input',()=>{state.futureSelf.futureYears=Number(input.value);renderFutureSelf();});input.addEventListener('change',()=>save());}const metric=$('#routine-chart-metric');if(metric)metric.onchange=renderFutureSelf;if(typeof initializePortrait2050==='function')initializePortrait2050();else initializeAvatarAppearance();initializeRoutineQuickEditor();if(typeof initializeHabitExperience==='function')initializeHabitExperience();renderFutureSelf();}

function initializeAvatarAppearance(){
 const form=$('#avatar-appearance-form'),button=$('#account-avatar-customize');if(!form||!button)return;
 button.onclick=()=>{const config=futureSelfSettings();for(const [key,value]of Object.entries({...config.appearance,skin:config.skin}))if(form.elements.namedItem(key))form.elements.namedItem(key).value=value;$('#account-dialog').close();$('#avatar-appearance-dialog').showModal();preview();};
 const preview=()=>{const values=Object.fromEntries(new FormData(form)),config=FutureSelf.settings({skin:values.skin,appearance:values},state.profile.age);$('#avatar-appearance-preview').innerHTML=FutureSelf.avatar(state.futureSelf.targetAge,{level:'unknown',labels:'Custom avatar'},config.skin,config.appearance);};form.oninput=preview;
 $('#avatar-appearance-cancel').onclick=()=>$('#avatar-appearance-dialog').close();form.onsubmit=event=>{event.preventDefault();if(!form.reportValidity())return;const values=Object.fromEntries(new FormData(form)),config=FutureSelf.settings({...state.futureSelf,skin:values.skin,appearance:values},state.profile.age);const previous=state.futureSelf;state.futureSelf=config;save();try{if(JSON.stringify(JSON.parse(localStorage.getItem(KEY))?.futureSelf)!==JSON.stringify(config))throw Error();renderFutureSelf();$('#avatar-appearance-dialog').close();toast('Avatar appearance saved.');}catch{state.futureSelf=previous;toast('Could not save appearance. Your previous character is kept.');}};
}

const routineQuickFields={
 wellbeing:{title:'Recovery & well-being',daily:true,fields:[['energy','Energy (1–5)','number',1,5],['stress','Stress (0–10)','number',0,10],['dailyActivities','Managing daily activities','activities']]},
 movement:{title:'Exercise',daily:true,fields:[['duration','Exercise time (minutes)','number',0,1440],['exerciseCalories','Estimated exercise calories (kcal)','number',0,100000],['exerciseIntensity','Effort intensity','intensity']]},
 sleep:{title:'Sleep opportunity',daily:true,fields:[['bed','Bedtime','time'],['wake','Wake-up time','time'],['rested','How rested? (1–5) · Optional','number',1,5]]},
 smoking:{title:'Smoking',fields:[['smoking','Smoking status','smoking']]},
};
function fillRoutineQuickEditor(){
 const form=$('#routine-quick-form'),key=form.dataset.category,config=routineQuickFields[key],date=form.elements.namedItem('date')?.value||localDate(),record=state.records.find(r=>r.date===date)||{};
 const source=config.daily?record:state.futureSelf?.factors||{};
 for(const [name,,type]of config.fields){const input=form.elements.namedItem(name);input.value=source[name]??(['intensity','smoking','activities'].includes(type)?'unknown':'');}
 form.dataset.loadedDate=date;form.dataset.dirty='false';$('#routine-quick-error').textContent='';
}
function openRoutineQuickEditor(key){
 const config=routineQuickFields[key];if(!config)return;
 const form=$('#routine-quick-form'),box=$('#routine-quick-fields');form.dataset.category=key;box.replaceChildren();$('#routine-quick-title').textContent=config.title;
 $('#routine-quick-note').textContent=config.daily?'Add this day’s information. It is saved in Daily journal and used in the summary when within the last seven days. Existing steps and other readings are kept.':'Update this part of your usual routine. Your other routine information is kept.';
 const make=(name,title,type,min,max)=>{const label=document.createElement('label');label.append(document.createTextNode(title));let input;
 if(['intensity','smoking','activities'].includes(type)){input=document.createElement('select');for(const [value,text]of type==='activities'?[['unknown','Not entered'],['manageable','Manageable with my usual supports'],['sometimes-hard','Sometimes hard'],['often-hard','Often hard'],['varies','Varies day to day']]:type==='intensity'?[['unknown','Not entered'],['light','Light · easy effort'],['moderate','Moderate · can talk, not sing'],['vigorous','Vigorous · only a few words']]:[['unknown','Not entered'],['never','Never'],['former','Former'],['current','Current']]){const o=document.createElement('option');o.value=value;o.textContent=text;input.append(o);}}
 else{input=document.createElement('input');input.type=type;if(min!==undefined){input.min=min;input.max=max;input.step=['strength','duration','energy','stress','rested'].includes(name)||name.endsWith('Days')?'1':'0.1';}}
 input.name=name;label.append(input);box.append(label);return input;};
 if(config.daily){const date=make('date','Date','date');date.required=true;date.max=localDate();date.value=localDate();date.onchange=()=>{if(form.dataset.dirty==='true'&&!confirm('Switch days and discard unsaved changes?')){date.value=form.dataset.loadedDate;return;}fillRoutineQuickEditor();};}
 for(const args of config.fields)make(...args);fillRoutineQuickEditor();$('#routine-quick-dialog').showModal();box.querySelector('input,select')?.focus({preventScroll:true});
}
function initializeRoutineQuickEditor(){
 const form=$('#routine-quick-form');if(!form)return;
 $('#routine-quick-cancel').onclick=()=>$('#routine-quick-dialog').close();form.oninput=e=>{if(e.target.name!=='date')form.dataset.dirty='true';};
 form.onsubmit=e=>{e.preventDefault();if(clearingData||!form.reportValidity())return;const key=form.dataset.category,config=routineQuickFields[key],values=Object.fromEntries(new FormData(form));const error=message=>$('#routine-quick-error').textContent=message;
 if(config.daily&&(!values.date||values.date>localDate())){error('Choose today or an earlier date.');return;}
 if(key==='sleep'&&(!values.bed||!values.wake||values.bed===values.wake)){error('Enter different bedtime and wake-up times.');return;}
 if(!config.fields.some(([name,,type])=>type==='smoking'||(values[name]!==''&&values[name]!=='unknown'))){error('Add a value before saving, or choose Cancel.');return;}
 const records=state.records,settings=state.futureSelf;
 if(config.daily){const previous=records.find(r=>r.date===values.date)||{},record={...previous,date:values.date};for(const [name,,type]of config.fields)record[name]=type==='number'?(values[name]===''?'':Number(values[name])):values[name];if(key==='movement'&&!record.exerciseType)record.exerciseType='Activity';if(key==='sleep')record.sleepHours=previous.inputSources?.sleepHours?.kind==='wearable-import'&&values.bed===previous.bed&&values.wake===previous.wake?previous.sleepHours:sleepHours(values.bed,values.wake);if(typeof clearChangedImportSources==='function')clearChangedImportSources(record,previous,config.fields.map(f=>f[0]).concat(key==='sleep'?['sleepHours']:[]));state.records=[...records.filter(r=>r.date!==values.date),record];}
 else{const factors={...settings.factors};for(const [name,,type]of config.fields)factors[name]=type==='number'?Number(values[name]):values[name];if(key==='strength')factors.strengthEnabled=true;state.futureSelf={...settings,factors};}
 save();let stored=false;try{const saved=JSON.parse(localStorage.getItem(KEY));stored=JSON.stringify(config.daily?saved.records:saved.futureSelf)===JSON.stringify(config.daily?state.records:state.futureSelf);}catch{}
 if(!stored){state.records=records;state.futureSelf=settings;error('Could not save. Your entries are kept here; try again.');return;}
 form.dataset.dirty='false';renderRecords();renderFutureSelf();$('#routine-quick-dialog').close();toast('Saved '+config.title.toLowerCase()+'.');
 };
}
