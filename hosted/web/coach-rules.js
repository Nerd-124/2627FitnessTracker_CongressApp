'use strict';
// Free, local planning rules. No provider requests or language-model claims.
const FreeCoach=(()=>{
 const normalize=t=>t.toLowerCase().replace(/[’‘]/g,"'").replace(/\bdon't\b/g,'do not').replace(/\bcan't\b/g,'cannot');
 const numbers={one:1,two:2,three:3,four:4,five:5,six:6,seven:7};
 const days=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
 const goals=[
  ['strength',/\b(strong|stronger|strength|muscle|toned|tone up)\b/,'strength'],
  ['stamina',/\b(stamina|endurance|cardio|run farther|run further|5k|10k|marathon)\b/,'stamina'],
  ['energy',/\b(energy|energetic|tired|rested|sleep|fatigue)\b/,'energy and rest'],
  ['consistency',/\b(consistent|consistency|routine|habit|busy|stick to|motivat\w*|discipline)\b/,'consistency'],
  ['mobility',/\b(flexible|flexibility|mobility|stiff|stretch)\b/,'mobility'],
  ['fitness',/\b(fit|fitter|fitness|shape|healthier|healthy|exercise|workout|active|lose weight|weight loss|lose fat|fat loss)\b/,'general fitness']
 ];
 const activities=[
  ['running',/\b(run|running|jog|jogging)\b/],['walking',/\b(walk|walking|hike|hiking)\b/],
  ['swimming',/\b(swim|swimming|pool)\b/],['basketball',/\bbasketball\b/],
  ['cycling',/\b(cycle|cycling|bike|biking)\b/],['dancing',/\b(dance|dancing)\b/],
  ['yoga',/\b(yoga|stretch|stretching|mobility)\b/],['strength',/\b(strength|weights|muscle|bodyweight)\b/]
 ];
 const titles={running:'Run/walk intervals',walking:'Brisk walking intervals',swimming:'Easy swimming',basketball:'Basketball skills',cycling:'Easy cycling',dancing:'Dance session',yoga:'Gentle mobility',strength:'Bodyweight strength',seated:'Seated movement you choose',custom:'An enjoyable activity you choose'};
 const startDay=start=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(start||''))throw Error('Choose a valid start date.');const d=new Date(start+'T12:00:00');if(!Number.isFinite(+d)||d.getFullYear()!==Number(start.slice(0,4))||d.getMonth()+1!==Number(start.slice(5,7))||d.getDate()!==Number(start.slice(8)))throw Error('Choose a valid start date.');return d.getDay();};
 function sessionTitle(activity,minutes,variant){
  const warm=minutes>=10?2:1,cool=minutes>=15?2:1,main=minutes-warm-cool;
  const ending=`${warm}m easy + ${main}m practice + ${cool}m easy`;
  const descriptions={
   running:`Run/walk: ${warm}m walk, ${main}m alternate easy jog/walk, ${cool}m walk`,
   walking:`Walk: ${warm}m easy, ${main}m alternate purposeful/easy pace, ${cool}m easy`,
   swimming:`Easy swimming: ${warm}m easy, ${main}m short lengths with breaks, ${cool}m easy`,
   basketball:`Basketball: ${warm}m warm-up, ${main}m alternate dribbling/shooting, ${cool}m easy walk`,
   cycling:`Cycle: ${warm}m easy, ${main}m steady comfortable pace, ${cool}m easy`,
   dancing:`Dance: ${warm}m warm-up, ${main}m favorite songs with breaks, ${cool}m easy`,
   yoga:`Mobility: ${minutes}m gentle shoulder circles, ankle circles, comfortable reaching; no forced stretches`,
   strength:variant===2?`Strength: ${warm}m warm-up, ${main}m alternate chair sit-to-stands/calf raises with rest, ${cool}m easy`:`Strength: ${warm}m warm-up, ${main}m alternate chair sit-to-stands/wall push-ups with rest, ${cool}m easy`,
   seated:`Seated movement: ${minutes}m comfortable movements already appropriate for you, with breaks`,
   custom:`Enjoyable movement: ${ending}; choose an activity you already know`
  };
  return descriptions[activity]||descriptions.custom;
 }
 function reply(message,previous={},controls={}){
  if(typeof message!=='string'||!message.trim()||message.length>2000)throw Error('Write a message using 1–2,000 characters.');
  const text=normalize(message.trim()),prefs=JSON.parse(JSON.stringify(previous));
  prefs.turn=(prefs.turn||0)+1;
  const safe=text.replace(/\b(no|without|do not have|not having) (?:any )?(chest pain|injuries|injury|pain|dizziness)\b/g,'');
  if(/\b(chest pain|fainting|fainted|cannot breathe)\b/.test(safe)){prefs.healthConcern=true;return {prefs,reply:'I can’t assess these symptoms. If they are happening now or are severe, seek urgent medical help. Please get guidance before exercising.',questions:[],options:[]};}
  if(/\b(injur\w*|pain|hurts|dizzy)\b/.test(safe)){prefs.healthConcern=true;return {prefs,reply:'I can organize a schedule, but I can’t choose exercises for pain or an injury. Ask a qualified health professional what activities are appropriate first.',questions:[],options:[]};}
  if(prefs.healthConcern)return {prefs,reply:'Your earlier symptom concern still matters. Please get guidance about appropriate activity before using workout suggestions.',questions:[],options:[]};
  const age=text.match(/\b(?:i am|i'm|age[d]?)\s*(\d{1,3})\b|\b(\d{1,3})\s*(?:years? old|year-old)\b/);
  if(age){prefs.age=Number(age[1]||age[2]);if(prefs.age<18)prefs.young=true;}
  if(prefs.young)return {prefs,reply:'These exercise templates are designed for adults. A parent, qualified coach, or health professional can help you choose an age-appropriate routine.',questions:[],options:[]};
  if(/\b(switch to|instead (?:i want|let.s do)|replace .+ with)\b/.test(text))prefs.activities=[];
  const information=(answer)=>({prefs,reply:answer,questions:[],options:prefs.lastOptions||[]});
  if(/^(thanks|thank you|great|perfect|that helps)[!.\s]*$/.test(text)&&prefs.lastOptions)return information('You’re welcome. Choose an option when you’re ready; you can edit the saved week in My plan.');
  if(/\b(what (is|does)|explain|how (do|can|should) i|why)\b/.test(text)){
   if(/\b(bpm|heart rate|pulse)\b/.test(text))return information('BPM means beats per minute. Record your own pulse before exercise and again afterward, noting when you measured it. Effort, breaks, and recovery time affect the comparison; these readings do not diagnose fitness or illness.');
   if(/\b(warm.up|cool.down)\b/.test(text))return information('A warm-up starts with easy movement similar to your activity. A cooldown gradually eases the pace at the end. Both are included in each session’s total time—not extra minutes to add.');
   if(/\b(strength|push.up|sit.to.stand)\b/.test(text))return information('For the suggested strength sessions, alternate a few comfortable chair sit-to-stands with wall push-ups, resting between efforts. Use a stable chair and a wall, keep movements controlled, and leave effort in reserve. The timer includes rest; there is no requirement to hit a repetition target.');
   if(/\b(why|start)\b/.test(text)&&prefs.lastOptions)return information('The options fit your time limit and available days. The first uses short, repeatable sessions; the second alternates types of movement; the third changes the activity mix. Pick a manageable week first, then adjust one thing at a time rather than increasing everything together.');
  }
  if(/\b(not what i meant|not helpful|bad advice|wrong plan|do not like (this|that|these))\b/.test(text)&&prefs.lastOptions)return information('What should change: the activities, the difficulty, the time, or the days? Tell me one change and I’ll revise the options.');
  const oldGoals=prefs.goals||[prefs.goal].filter(Boolean),found=goals.filter(([,pattern])=>pattern.test(text)).map(g=>g[0]);
  const all=/^(all|all of (them|it|those|the above)|everything|a bit of everything)[.!\s]*$/.test(text);
  const unsure=/^(i (do not know|dunno)|idk|not sure|anything|whatever|you choose|pick for me|surprise me|yes|sure|okay|ok)[.!\s]*$/.test(text);
  if(all){prefs.goals=['strength','stamina','energy','consistency'];prefs.goalText='Build balanced fitness, strength, energy, and a consistent routine';}
  else if(found.length){prefs.goals=/\b(instead|only focus|just focus|change my goal)\b/.test(text)?found:[...new Set([...oldGoals,...found])];if(!prefs.goalText||!oldGoals.length||/\b(instead|only focus|just focus|change my goal)\b/.test(text))prefs.goalText=message.trim().slice(0,500);}
  else prefs.goals=oldGoals;
  if(/\b(wheelchair|seated|cannot walk)\b/.test(text))prefs.seated=true;
  const excluded=new Set(prefs.excluded||[]),liked=new Set(prefs.activities||[prefs.activity].filter(Boolean));
  for(const [key,pattern]of activities){
   for(const match of text.matchAll(new RegExp(pattern.source,'g'))){
    const before=text.slice(0,match.index).split(/\bbut\b|\bhowever\b|[.!?;]/).at(-1).slice(-55),after=text.slice(match.index+match[0].length,match.index+match[0].length+30);
    const negative=/(?:\bno|not|hate|avoid|dislike|cannot|instead of|do not (?:like|enjoy|want))\s+(?:\w+\s+){0,3}$/.test(before)||/^\s+(?:isn't|is not) (?:available|possible)/.test(after);
    if(negative){excluded.add(key);liked.delete(key);}else if(!['strength','yoga'].includes(key)||/\b(like|love|prefer|enjoy|want to do)\b/.test(before)){liked.add(key);excluded.delete(key);}
   }
  }
  if(/\b(no pool|without (a )?pool|cannot swim)\b/.test(text)){excluded.add('swimming');liked.delete('swimming');}
  if(/\b(no bike|without (a )?bike)\b/.test(text)){excluded.add('cycling');liked.delete('cycling');}
  if(/\b(at home|home only|indoors only|no outdoors|inside only)\b/.test(text))prefs.home=true;
  if(/\b(outdoors is fine|outside is fine|not just at home)\b/.test(text))prefs.home=false;
  if(/\b(no equipment|without equipment|no gym|bodyweight only)\b/.test(text))prefs.noEquipment=true;
  if(/\b(i have (a )?gym|gym access)\b/.test(text))prefs.noEquipment=false;
  prefs.activities=[...liked].filter(k=>!excluded.has(k));prefs.excluded=[...excluded];prefs.activity=prefs.activities[0]||null;
  const minutes=text.match(/\b(\d{1,3})\s*(?:min(?:ute)?s?)\b/);let budget=Number(controls.budget)||prefs.budget||20;
  if(minutes){const value=Number(minutes[1]);if(value<5||value>120)return {prefs,reply:'Choose 5–120 minutes per session, or change the time field above.',questions:[],options:[]};budget=value;}
  if(/\b(half an hour|half hour)\b/.test(text))budget=30;
  prefs.budget=budget;
  const frequency=text.match(/\b([1-7]|one|two|three|four|five|six|seven)\s*(?:days?|times?|sessions?|workouts?)(?:\s+(?:a|per|each)\s+week)?\b/);
  if(frequency)prefs.frequency=Number(frequency[1])||numbers[frequency[1]];
  else if(prefs.lastQuestion==='frequency'&&/^(?:[1-7]|one|two|three|four|five|six|seven)[.!\s]*$/.test(text))prefs.frequency=Number(text.replace(/[.!\s]/g,''))||numbers[text.replace(/[.!\s]/g,'')];
  if(/\b(every day|daily|all days)\b/.test(text))prefs.frequency=7;
  if(/\b(only weekends|weekends only)\b/.test(text))prefs.weekdays=[0,6];
  else if(/\b(only weekdays|weekdays only)\b/.test(text))prefs.weekdays=[1,2,3,4,5];
  else if(/\b(any day|all days|every day)\b/.test(text))prefs.weekdays=[0,1,2,3,4,5,6];
  else{
   const named=days.map((name,i)=>({i,index:text.search(new RegExp('\\b'+name+'s?\\b'))})).filter(d=>d.index>=0);
   if(named.length){const negative=named.filter(d=>/\b(no|not|except|avoid)\s*$/.test(text.slice(Math.max(0,d.index-15),d.index))).map(d=>d.i);prefs.weekdays=negative.length?[0,1,2,3,4,5,6].filter(i=>!negative.includes(i)):named.map(d=>d.i);}
  }
  if(/\b(easier|gentler|shorter|beginner|new to|start small|not active|inactive|out of shape)\b/.test(text))prefs.easy=true;
  if(/\b(more challenging|harder|longer|experienced|already active)\b/.test(text))prefs.easy=false;
  const varied=/\b(variety|varied|different|boring|repetitive|same advice|another|new options|bad advice)\b/.test(text);
  if(varied)prefs.variation=(prefs.variation||0)+1;
  const asksPlan=/\b(make|give|suggest|create|build|show|plan|recommend|pick for me|you choose)\b/.test(text);
  if(!prefs.goals.length&&(prefs.activities.length||prefs.frequency||minutes||unsure||(prefs.lastQuestion==='goal'))){prefs.goals=['fitness','consistency'];prefs.goalText='Build a manageable fitness routine';}
  if(!prefs.goals.length){prefs.lastQuestion='goal';return {prefs,reply:'What would you like to change about your fitness?',questions:['You can name a goal, say “all” for a balanced plan, or “pick for me.”'],options:[]};}
  prefs.goal=prefs.goals[0];
  if(!prefs.frequency&&!prefs.askedDays&&!unsure&&!asksPlan){prefs.askedDays=true;prefs.lastQuestion='frequency';return {prefs,reply:all?'We can combine strength, stamina, and consistency, with time for recovery.':`I’ll focus on ${prefs.goals.map(k=>goals.find(g=>g[0]===k)?.[2]||k).join(' and ')}${prefs.excluded.length?', keeping your activity exclusions':''}.`,questions:['How many days per week work for you? A number is enough, or say “pick for me.”'],options:[]};}
  const day=startDay(controls.start),eligible=Array.from({length:7},(_,o)=>o).filter(o=>(prefs.weekdays||[0,1,2,3,4,5,6]).includes((day+o)%7));
  if(!eligible.length){prefs.lastQuestion='weekdays';return {prefs,reply:'Which days can you use for exercise?',questions:[],options:[]};}
  const context=controls.context||{},baseline=context.movementDays>=5?context.recordedMinutes:context.baselineMovement;
  const low=baseline==null||baseline<60||prefs.easy;
  const limit=Math.min(budget,low?15:35),variation=prefs.variation||0;
  const strengthGoal=prefs.goals.includes('strength'),mobilityGoal=prefs.goals.includes('mobility');
  const allowed=key=>!excluded.has(key)&&(!prefs.seated||['seated','custom'].includes(key))&&(!prefs.home||!['running','swimming','basketball','cycling'].includes(key));
  const fallback=prefs.seated?'seated':allowed('walking')&&!prefs.home?'walking':allowed('dancing')?'dancing':allowed('yoga')?'yoga':allowed('strength')?'strength':'custom';
  const favorites=prefs.activities.filter(allowed);
  const primary=favorites[variation%Math.max(1,favorites.length)]||(strengthGoal&&allowed('strength')?'strength':mobilityGoal&&allowed('yoga')?'yoga':fallback);
  const available=[...new Set([primary,...favorites,...(strengthGoal?['strength']:[]),fallback,'yoga','strength','dancing'])].filter(allowed);
  const pick=(key,alternative=fallback)=>allowed(key)?key:alternative;
  const variants=[
   {title:'A small, repeatable start',count:2,factor:.55,kind:'simple'},
   {title:strengthGoal?'Strength + stamina':mobilityGoal?'Movement + mobility':'A balanced week',count:3,factor:.8,kind:'balanced'},
   {title:favorites.length?'More of what you enjoy':'A week with variety',count:4,factor:1,kind:'variety'}
  ];
  const options=variants.map((variant,index)=>{
   const count=Math.min(eligible.length,prefs.frequency||variant.count),selected=[];
   for(let i=0;i<count;i++)selected.push(eligible[count===1?0:Math.round(i*(eligible.length-1)/(count-1))]);
   const duration=Math.max(5,Math.min(budget,Math.round(limit*variant.factor))),tasks=[],used=[];
   for(const [i,offset]of selected.entries()){
    let activity;
    if(index===0)activity=primary;
    else if(index===1)activity=i%2===0?primary:(primary==='strength'?fallback:strengthGoal?pick('strength'):favorites[1]||pick('yoga'));
    else activity=available[(i+variation)%available.length]||fallback;
    // Avoid consecutive strength sessions; a requested seven-day schedule includes light movement days.
    if(activity==='strength'&&used.at(-1)?.activity==='strength'&&offset-used.at(-1).offset===1)activity=pick('yoga',fallback);
    used.push({activity,offset});
    tasks.push({title:sessionTitle(activity,duration,index),category:'move',dayOffset:offset,minutes:duration});
   }
   if(!selected.includes(0))tasks.push({title:'Choose a time for each planned session',category:'custom',dayOffset:0,minutes:Math.min(5,budget)});
   const rest=Array.from({length:7},(_,i)=>i).find(i=>!selected.includes(i)&&(selected.includes(0)||i!==0));
   if(rest!==undefined)tasks.push({title:prefs.goals.includes('energy')?'A quiet screen-free wind-down before bed':'Recovery day: rest or keep ordinary movement easy',category:'rest',dayOffset:rest,minutes:Math.min(5,budget)});
   const focus=[...new Set(used.map(s=>titles[s.activity]))].join(', ').toLowerCase();
   return {title:variant.title,summary:`${count} sessions × ${duration} min. ${focus[0].toUpperCase()+focus.slice(1)}. Warm-up, breaks, and cooldown fit inside that time.`,why:`Fits your ${budget}-minute limit${prefs.frequency?` and ${prefs.frequency}-day preference`:''}${prefs.weekdays?', on your available days':''}.${low?' Short starting sessions because your recent activity is low or unknown.':''} Repeat a manageable week before adding time.`,tasks:tasks.sort((a,b)=>a.dayOffset-b.dayOffset)};
  });
  prefs.lastQuestion=null;prefs.offered=true;
  const focus=prefs.goals.map(k=>goals.find(g=>g[0]===k)?.[2]||k).join(', ');
  let answer=varied?'I changed the activity mix and session structure.':prefs.offeredBefore?'I updated the options using your latest preferences.':`Here are three ways to work on ${focus}.`;
  prefs.offeredBefore=true;
  if(all)answer='A balanced goal makes sense. These options combine movement and recovery; the middle plan mixes strength and stamina.';
  if(prefs.frequency>eligible.length)answer+=` You named ${prefs.frequency} days, but only ${eligible.length} are available, so I used those.`;
  if(prefs.home)answer+=' These stay at home.';
  if(prefs.seated)answer+=' Use seated movements you already know are appropriate for you.';
  if(context.sleepNights>=3&&context.sleepAverage<6.5)answer+=' Your recorded time in bed is low, so favor the smaller option while you work on rest.';
  if(/\b(weight|fat|slim|skinny)\b/.test(text))answer+=' I can help build a movement routine, but won’t prescribe rapid weight loss or calorie restriction.';
  prefs.lastOptions=options;
  return {prefs,reply:answer,questions:[],options};
 }
 return {reply};
})();

// Local assistant: deterministic record summaries and bounded guidance, no API calls.
const LocalAssistant=(()=>{
 const n=(value,min=0,max=1e7)=>typeof value!=='boolean'&&value!==null&&value!==''&&value!==undefined&&Number.isFinite(Number(value))&&Number(value)>=min&&Number(value)<=max?Number(value):null;
 const fmt=value=>Number.isInteger(value)?String(value):value.toFixed(1);
 function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const d=new Date(value+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value;}
 function add(date,days){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
 function hours(row){if(row.bed&&row.wake&&/^\d\d:\d\d$/.test(row.bed)&&/^\d\d:\d\d$/.test(row.wake)){
  const parts=t=>t.split(':').map(Number);const [bh,bm]=parts(row.bed),[wh,wm]=parts(row.wake);if(bh<24&&wh<24&&bm<60&&wm<60)return ((wh*60+wm-bh*60-bm+1440)%1440)/60;
 }return n(row.sleepHours,0,24);}
 function sessions(context){const seen=new Set();return [...(context.activities||[]),...(context.workouts||[])].filter(row=>{
  if(!validDate(row.date)||row.date>context.today)return false;if(row.id){if(seen.has(row.id))return false;seen.add(row.id);}return true;
 });}
 function summary(context,from,to){
  const rows=new Map();for(const row of context.records||[])if(validDate(row.date)&&row.date>=from&&row.date<=to)rows.set(row.date,row);
  const minutes=new Map(),sleep=[];for(const row of rows.values()){const h=hours(row);if(h!==null)sleep.push(h);const m=n(row.duration,0,1440);if(m!==null)minutes.set(row.date,m);}
  const sessionMinutes=new Map();for(const row of sessions(context))if(row.date>=from&&row.date<=to){const m=n(row.minutes,0,1440);if(m!==null)sessionMinutes.set(row.date,(sessionMinutes.get(row.date)||0)+m);}
  for(const [date,m]of sessionMinutes)minutes.set(date,Math.max(minutes.get(date)||0,m));
  return {movement:[...minutes.values()].reduce((a,b)=>a+b,0),days:minutes.size,sleepNights:sleep.length,sleep:sleep.length?sleep.reduce((a,b)=>a+b,0)/sleep.length:null,entries:rows.size};
 }
 function reply(message,previous={},context={}){
  if(typeof message!=='string'||!message.trim()||message.length>2000)throw Error('Write a message using 1–2,000 characters.');
  if(!validDate(context.today))throw Error('The assistant needs a valid local date.');
  const text=message.toLowerCase().replace(/[’‘]/g,"'"),memory={...previous};
  const answer=(reply,actions=[],mode=null)=>({reply,actions,memory:{...memory,lastMode:mode||memory.lastMode}});
  const safe=text.replace(/\b(no|without|do not have|don't have) (?:any )?(chest pain|pain|injury|injuries|dizziness)\b/g,'');
  if(/\b(chest pain|fainting|fainted|cannot breathe|can't breathe)\b/.test(safe)){memory.healthConcern=true;return answer('I can’t assess these symptoms. If they are happening now or are severe, seek urgent medical help. Do not use a workout suggestion to decide whether it is safe to exercise.');}
  if(/\b(injur\w*|pain|hurts|dizzy)\b/.test(safe)){memory.healthConcern=true;return answer('I can explain records, but I can’t choose exercises for pain or an injury. Ask a qualified health professional what movement is appropriate first.');}
  const go=(label,page,date)=>({label,page,...(date?{date}:{})});
  if(/\b(suicid\w*|hurt myself|kill myself|end my life|self.harm)\b/.test(text))return answer('If you might act on thoughts of harming yourself or feel unsafe, contact emergency help now. In the US, call or text 988; elsewhere use your local crisis service. A trusted person can stay with you while you seek support. A questionnaire cannot assess immediate safety.');
  if(/\b(mental|well.?being|who.?5|questionnaire)\b/.test(text)){const score=typeof WHO5!=='undefined'?WHO5.assess(context,context.today):null;return answer(score?'Your latest WHO-5 well-being score is '+score.total+'/100, assessed '+score.date+'. It summarizes the past two weeks and is not a diagnosis. The app’s A–E bands are not official WHO categories.':'Open Mental health for the optional five-question WHO-5 check-in. Its official score is the sum of five 0–5 answers multiplied by four. Missing answers do not become zero, and the score is not a diagnosis.',[go('Open mental health','mental-health')]);}
  const dayMatch=text.match(/\b\d{4}-\d{2}-\d{2}\b/),date=dayMatch?.[0]||(text.includes('yesterday')?add(context.today,-1):context.today);
  if(dayMatch&&(!validDate(date)||date>context.today))return answer('Choose today or an earlier valid date, in YYYY-MM-DD format.');
  const time=text.match(/\b(\d{1,3})\s*(?:minutes?|mins?|m)\b/);if(time)memory.minutes=Math.min(30,Math.max(1,Number(time[1])));else if(['workout','daily'].includes(memory.lastMode)&&/^\d{1,3}$/.test(text.trim()))memory.minutes=Math.min(30,Math.max(1,Number(text.trim())));
  if(/\b(no equipment|without equipment|at home|indoors?|raining|rainy|too hot|too cold)\b/.test(text))memory.indoor=true;
  if(/\b(outdoors?|outside)\b/.test(text)&&!/\b(no|not|avoid) (?:going )?(outdoors?|outside)\b/.test(text))memory.indoor=false;
  if(/\b(no running|hate running|don't (?:like|enjoy) running|do not (?:like|enjoy) running|avoid running)\b/.test(text))memory.noRunning=true;
  if(/\b(vegetarian|vegan)\b/.test(text))memory.diet=text.includes('vegan')?'vegan':'vegetarian';
  if(/\b(allerg(?:ic|y|ies)|celiac)\b/.test(text))memory.allergyConcern=true;
  if(/\b(?:slept|sleep|sleeping|in bed)\s+(?:for\s+)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/.test(text)){memory.sleepDate=date;memory.reportedSleep=Number(text.match(/\b(?:slept|sleep|sleeping|in bed)\s+(?:for\s+)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/)[1]);}
  const explicitHelp=/\b(where|how do i|how can i|open|find|navigate|help me (?:use|find))\b/.test(text);
  if(explicitHelp&&!/\b(profile|name|weight|height|goals?)\b/.test(text)&&/\b(record|log|edit|journal|yesterday|entry)\b/.test(text)){
   if(/\b(run|workout|exercise|activity)\b/.test(text))return answer('Open Exercise & routes. Use Run to record GPS exercise, Log activity to enter a session, or History to revisit it.',[go('Open exercise','activity')],'help');
   return answer(`Open the daily journal, choose ${text.includes('yesterday')?'yesterday':date}, then tap Record this day or Edit this day. I won’t change your records just because you mention something in chat.`,[go('Open this journal day','journal',date)],'help');
  }
  if(explicitHelp&&/\b(sleep|brainwave|eeg)\b/.test(text)&&/\b(where|open|find)\b/.test(text))return answer('Open Sleep & brainwaves to review your sleep entries and imported brainwave data.',[go('Open sleep','sleep-lab')],'help');
  if(explicitHelp&&/\b(run|route|map|exercise|activity|workout)\b/.test(text))return answer('Exercise & routes contains Run, Log activity, and History. Draw a route there or start recording when you are ready.',[go('Open exercise','activity')],'help');
  if(explicitHelp&&/\b(profile|name|weight|height|goals?)\b/.test(text))return answer('Use My profile to edit your starting information. Changes are saved only when you submit the profile form.',[go('Open my profile','profile')],'help');
  if(/\b(weekly|week|progress|summary|summari[sz]e|what changed|compare)\b/.test(text)&&!/\b(workout|routine|plan|days a week)\b/.test(text)){
   const start=add(context.today,-6),priorStart=add(context.today,-13),priorEnd=add(context.today,-7);
   const current=summary(context,start,context.today),prior=summary(context,priorStart,priorEnd);
   let lines=[`Your recorded week · ${start} to ${context.today}`,`Movement: ${fmt(current.movement)} minutes across ${current.days}/7 recorded days. Journal and session totals on the same day are not added twice.`,current.sleepNights?`Time in bed: ${fmt(current.sleep)} hours on average across ${current.sleepNights}/7 logged nights.`:'Sleep: no nights recorded in this period.'];
   if(current.days&&prior.days)lines.push(`Previous seven days: ${fmt(prior.movement)} movement minutes across ${prior.days}/7 days. Recorded total changed by ${current.movement-prior.movement>=0?'+':''}${fmt(current.movement-prior.movement)} minutes; different logging coverage can explain part of the change.`);
   if(current.sleepNights&&prior.sleepNights)lines.push(`Previous time-in-bed average: ${fmt(prior.sleep)} hours across ${prior.sleepNights}/7 nights. This is logged time, not measured sleep quality.`);
   lines.push('Unlogged days are unknown, not rest days. These records do not show what caused a change.');return answer(lines.join('\n\n'),[go('Open journal','journal')],'summary');
  }
  if(/\b(pace|bpm|heart rate|elevation|altitude|ascent|review|explain|session)\b/.test(text)&&(/\b(run|walk|workout|session|exercise|record|bpm|pace|elevation|altitude|ascent)\b/.test(text))){
   const list=sessions(context).filter(row=>!dayMatch||row.date===date).filter(row=>!/\b(?:last|latest) run\b/.test(text)||row.mode==='run'||/running/i.test(row.customName||row.sport||''));
   list.sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));const row=list[0];
   const definition='Pace is minutes per kilometer: a smaller number is faster. BPM means beats per minute. Ascent adds the uphill portions; it is not the final altitude minus the starting altitude.';
   if(!row)return answer(definition+'\n\nThere is no matching saved session to review yet. Record a run or log an activity first.',[go('Open exercise','activity')],'session');
   const distance=n(row.result?.distance??row.distance),minutes=n(row.minutes),gain=n(row.result?.gain),before=n(row.bpmBefore,20,300),after=n(row.bpmAfter,20,300),temp=n(row.temperature,-60,65);
   const lines=[`Latest matching session · ${row.date}: ${row.mode==='run'?'Run':row.mode==='walk'?'Walk':row.customName||row.sport||'Activity'}`,minutes!==null?`${fmt(minutes)} recorded minutes.`:'Duration was not recorded.'];
   if(distance!==null&&distance>0){lines.push(`${fmt(distance)} km${minutes!==null?` · average pace ${Math.floor(Math.round(minutes/distance*60)/60)}:${String(Math.round(minutes/distance*60)%60).padStart(2,'0')} min/km`:''}.`);}else lines.push('No distance recorded, so I can’t calculate pace.');
   if(gain!==null)lines.push(`Recorded ascent: ${fmt(gain)} m. ${row.terrainElevation?'Terrain elevations are approximate and may differ from bridge or building heights.':'GPS elevation can be noisy; this is not a precise survey.'}`);
   if(row.result?.unknown_elevation)lines.push('Parts of the route have missing elevations; the ascent is incomplete.');
   lines.push(before!==null?`Before exercise: ${before} bpm.`:'Before-exercise BPM not recorded.',after!==null?`After exercise: ${after} bpm.`:'After-exercise BPM not recorded.');
   if(before!==null&&after!==null)lines.push(`After minus before: ${after-before>=0?'+':''}${after-before} bpm. Two readings do not establish fitness, heart health, or recovery rate; timing and measurement method matter.`);
   if(temp!==null)lines.push(`Air temperature: ${temp} °C${row.temperatureSource==='open-meteo'?' (weather estimate, not body temperature)':''}.`);
   lines.push(definition);return answer(lines.join('\n\n'),[go('Open session history','activity')],'session');
  }

  if(/\b(photo|picture|camera|scan)\b/.test(text))return answer('Photo uploads are not available. You can customize the illustrative character instead.');
  if(/\b(meal|food|nutrition|protein|fiber|fibre)\b/.test(text))return answer('This app now focuses on exercise, mental well-being and sleep. I can help you review those records.');

  const workout=!!time||['workout','daily'].includes(memory.lastMode)&&/^\d{1,3}$/.test(text.trim())||/\b(workout|exercise|movement|routine|strength|stamina|stretch|mobility|indoors?|outside|raining|rainy|alternative|instead|equipment|swim|cycling|dance|run|walk)\b/.test(text);
  const daily=/\b(check.in|today|tired|exhausted|sleep|slept|rest|feel|feeling|energy|motivated|motivation)\b/.test(text);
  if(daily&&(!workout||/\b(tired|exhausted|slept|check.in|feel|feeling)\b/.test(text))){
   const entry=(context.records||[]).find(row=>row.date===date),h=(memory.sleepDate===date?n(memory.reportedSleep,0,24):null)??(entry?hours(entry):null),movement=summary(context,date,date);
   const lines=[`Check-in · ${date}`,h!==null?`${memory.sleepDate===date&&memory.reportedSleep!=null?'You mentioned':'Your journal shows'} ${fmt(h)} hours ${memory.sleepDate===date&&memory.reportedSleep!=null?'of sleep':'in bed'}.`:'No sleep amount is available for this day.'];
   if(memory.healthConcern)lines.push('Because of the symptoms you mentioned earlier, get appropriate health guidance before choosing exercise.');
   else if(h!==null&&h<7||/\b(tired|exhausted|low energy)\b/.test(text))lines.push('Keep the next step gentle: rest if you need it, or try a few minutes of comfortable movement if you feel able. Skip a hard session when you feel unwell or too tired.');
   else lines.push('Choose one manageable action that fits how you feel: a short comfortable walk, a movement break, or a calm wind-down. You don’t need to make today perfect.');
   lines.push(movement.days?`${fmt(movement.movement)} movement minutes are recorded for this day.`:'No movement is recorded for this day; that does not mean you were inactive.');
   lines.push('Tell me how much time you have, whether you are indoors, and what you enjoy for a specific suggestion. Chat messages do not save journal entries.');return answer(lines.join('\n\n'),[go('Open this journal day','journal',date)],'daily');
  }
  if(workout||memory.lastMode==='workout'&&(/\b(\d+|easier|harder|different|another|yes|no|pick)\b/.test(text))){
   if(memory.healthConcern)return answer('Your earlier symptom concern still matters. Ask a qualified health professional which activities are appropriate before using a workout suggestion.',[],'workout');
   const age=text.match(/\b(?:i am|i'm|age)\s*(\d{1,3})\b/);if(age&&Number(age[1])<18||n(context.profile?.age,0,120)!==null&&Number(context.profile.age)<18)return answer('These activity suggestions are written for adults. Ask a trusted adult or qualified coach for an age-appropriate activity instead; I won’t prescribe calorie restriction or adult training targets.',[],'workout');
   if(!memory.minutes)return answer('How many minutes do you have? You can reply “10 minutes indoors, no equipment” or tell me an activity you enjoy.',[],'workout');
   if(/\b(easier|gentle|lighter)\b/.test(text))memory.minutes=Math.max(1,Math.floor(memory.minutes/2));
   const total=memory.minutes,warm=total>=8?2:1,cool=total>=8?2:1,main=Math.max(0,total-warm-cool),variation=(memory.variation||0)+(/\b(different|another|alternative|instead|boring)\b/.test(text)?1:0);memory.variation=variation;
   let kind=memory.indoor?(variation%2?'gentle mobility':'comfortable indoor walking or marching'):'a comfortable walk';
   if(/\b(strength|muscle)\b/.test(text))kind='familiar bodyweight movements, such as wall push-ups and chair sit-to-stands, with breaks';
   if(/\b(mobility|stretch)\b/.test(text))kind='gentle shoulder and ankle movements within a comfortable range';
   if(/\b(swim|swimming)\b/.test(text)&&!memory.indoor)kind='easy swimming in a supervised setting, only if you already swim confidently';
   if(/\b(dance|dancing)\b/.test(text))kind='easy dancing to music you enjoy';
   const structure=total<4?`${total} minute${total===1?'':'s'} of ${kind}, at an easy pace.`:`${warm} minutes easy warm-up\n${main} minutes of ${kind}, taking breaks as needed\n${cool} minutes easy cooldown`;
   return answer(`${total}-minute idea${memory.indoor?' · indoors':''}\n\n${structure}\n\nKeep the effort comfortable enough to talk. Rest is allowed; stop if you feel unwell. This is a suggestion, not a saved schedule.`,[go('Open exercise log','activity')],'workout');
  }
  if(/\b(thanks|thank you)\b/.test(text))return answer('You’re welcome. You can keep chatting, or minimize me and continue using the app.');
  if(/\b(help|what can you do|hello|hi|hey|all)\b/.test(text))return answer('I’m your free built-in assistant. I can summarize your recorded week, review a saved run, suggest a short workout or indoor alternative, check in on your day, help you find things in the app.\n\nTry “summarize my week,” “review my last run,” or “where do I record yesterday’s sleep?” I use local rules and your saved records, not an AI service.');
  return answer('I didn’t recognize that request. I can help with a daily check-in, recorded progress, workout ideas, a saved session, finding a feature. Try one specific question, such as “summarize my week.”');
 }
 return {reply,summary};
})();
