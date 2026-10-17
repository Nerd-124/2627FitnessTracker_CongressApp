'use strict';
// A small, deterministic conversation engine. It never calls an AI provider.
const FreeCoach=(()=>{
 const normalize=text=>text.toLowerCase().replace(/[’‘]/g,"'").replace(/\bdon't\b/g,'do not').replace(/\bcan't\b/g,'cannot');
 const activities=[['running',/\b(run|running|jog|jogging)\b/,'An easy run/walk at a comfortable effort'],['walking',/\b(walk|walking|hike|hiking)\b/,'A comfortable walk'],['swimming',/\b(swim|swimming|pool)\b/,'Easy swimming with breaks'],['basketball',/\bbasketball\b/,'Easy basketball skills practice'],['cycling',/\b(cycle|cycling|bike|biking)\b/,'Comfortable cycling'],['dancing',/\b(dance|dancing)\b/,'Easy dancing to music you enjoy'],['yoga',/\b(yoga|stretch|stretching)\b/,'Gentle mobility within a comfortable range'],['strength',/\b(strength|weights|muscle|bodyweight)\b/,'Easy familiar bodyweight movements with rest']];
 const goals=[['strength',/\b(strong|stronger|strength|muscle)\b/,'Build strength consistently'],['stamina',/\b(stamina|endurance|cardio|run farther|run further)\b/,'Build a steadier movement routine'],['energy',/\b(energy|energetic|tired|rested|sleep)\b/,'Make room for movement and rest'],['consistency',/\b(consistent|consistency|routine|habit|busy|stick to)\b/,'Build a routine that fits my week'],['fitness',/\b(fit|fitter|fitness|shape|healthier|healthy|exercise|workout|active|lose weight|weight loss)\b/,'Start a manageable fitness routine']];
 const dayNames=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
 const numbers={one:1,two:2,three:3,four:4,five:5,six:6,seven:7};
 function reply(message,previous={},controls={}){
  if(typeof message!=='string'||!message.trim()||message.length>2000)throw Error('Write a message using 1–2,000 characters.');
  const text=normalize(message),prefs=JSON.parse(JSON.stringify(previous));
  const safeText=text.replace(/\b(no|without) (chest pain|injury|pain|dizziness)\b/g,'');
  if(/\b(chest pain|fainting|fainted|cannot breathe|can't breathe)\b/.test(safeText)){prefs.healthConcern=true;return {prefs,reply:'I can’t assess symptoms or suggest a workout for them. If these symptoms are happening now or are severe, seek urgent medical help. Otherwise, speak with a health professional before exercising.',questions:[],options:[]};}
  if(/\b(injur\w*|pain|hurts|dizzy)\b/.test(safeText)){prefs.healthConcern=true;return {prefs,reply:'I can help organize a routine, but I can’t choose exercises for pain or an injury. Ask a qualified health professional which activities are appropriate first.',questions:[],options:[]};}
  if(prefs.healthConcern)return {prefs,reply:'I’ve kept your earlier pain or symptom concern in mind. I can’t design a workout around that. Please get guidance on appropriate activities before making an exercise plan.',questions:[],options:[]};
  if(/\b(1[0-7])\s*(years? old|year-old)\b/.test(text))return {prefs,reply:'This version uses adult fitness guidance. A parent, coach, or health professional can help you find an age-appropriate routine.',questions:[],options:[]};
  const found=goals.find(([,pattern])=>pattern.test(text));if(found){prefs.goal=found[0];prefs.goalText=message.trim().slice(0,500);}
  const limited=/\b(wheelchair|seated|cannot walk)\b/.test(text);if(limited)prefs.seated=true;
  const excluded=new Set(prefs.excluded||[]);let chosen=null;
  for(const [key,pattern]of activities){
   const matches=[...text.matchAll(new RegExp(pattern.source,'g'))];
   for(const match of matches){const before=text.slice(Math.max(0,match.index-45),match.index),after=text.slice(match.index+match[0].length,match.index+match[0].length+25);
    const negative=/(?:\bno|not|hate|avoid|dislike|cannot|instead of|do not (?:like|enjoy|want))\s+(?:\w+\s+){0,3}$/.test(before)||/^\s+(?:isn't|is not) (?:available|possible)/.test(after);
    if(negative)excluded.add(key);else {chosen=key;excluded.delete(key);}
   }
  }
  if(chosen)prefs.activity=chosen;
  if(prefs.activity&&excluded.has(prefs.activity))delete prefs.activity;
  prefs.excluded=[...excluded];
  const minutes=text.match(/\b(\d{1,3})\s*(?:min(?:ute)?s?)\b/);let budget=Number(controls.budget)||20;
  if(minutes){const value=Number(minutes[1]);if(value<5||value>120)return {prefs,reply:'This planner supports sessions from 5 to 120 minutes. What amount in that range feels manageable?',questions:[],options:[]};budget=value;}
  prefs.budget=budget;
  const frequency=text.match(/\b([1-7]|one|two|three|four|five|six|seven)\s*(?:days?|times?|sessions?|workouts?)(?:\s+(?:a|per|each)\s+week)?\b/);
  if(frequency)prefs.frequency=Number(frequency[1])||numbers[frequency[1]];
  if(/\b(only weekends|weekends only)\b/.test(text))prefs.weekdays=[0,6];
  else if(/\b(only weekdays|weekdays only)\b/.test(text))prefs.weekdays=[1,2,3,4,5];
  else if(/\b(any day|all days|every day)\b/.test(text))prefs.weekdays=[0,1,2,3,4,5,6];
  else{
   const named=dayNames.map((name,i)=>({i,index:text.indexOf(name)})).filter(d=>d.index>=0);
   if(named.length){const negative=named.filter(d=>/\b(no|not|except|avoid)\s*$/.test(text.slice(Math.max(0,d.index-15),d.index))).map(d=>d.i);prefs.weekdays=negative.length?[0,1,2,3,4,5,6].filter(i=>!negative.includes(i)):named.map(d=>d.i);}
  }
  prefs.easy=/\b(easier|gentler|shorter|beginner|new to|start small)\b/.test(text)?true:prefs.easy||false;
  if(/\b(more challenging|harder|longer)\b/.test(text))prefs.easy=false;
  if(!prefs.goal&&(chosen||prefs.frequency||minutes))prefs.goal='fitness';
  if(!prefs.goal)return {prefs,reply:'I’m a free, built-in coach, so I understand a limited set of goals and preferences rather than everything a language model can. What would you most like to work on?',questions:['For example: feeling fitter, more energy, strength, stamina, or a consistent routine.'],options:[]};
  if(!prefs.frequency&&!prefs.askedDays){prefs.askedDays=true;return {prefs,reply:`Let’s make a manageable plan for ${goals.find(g=>g[0]===prefs.goal)?.[2].toLowerCase()||'your routine'}.`,questions:['How many days per week feel realistic? You can also say “pick for me.” Tell me an activity you enjoy or want to avoid.'],options:[]};}
  const start=controls.start,day=new Date(start+'T12:00:00').getDay();if(!/^\d{4}-\d{2}-\d{2}$/.test(start||'')||!Number.isFinite(day))throw Error('Choose a valid start date.');
  const eligible=Array.from({length:7},(_,offset)=>offset).filter(offset=>(prefs.weekdays||[0,1,2,3,4,5,6]).includes((day+offset)%7));
  if(!eligible.length)return {prefs,reply:'I couldn’t find an available day. Which weekdays work for you?',questions:[],options:[]};
  const baseline=controls.context?.baselineMovement,low=baseline==null||baseline<60;
  const primary=activities.find(([key])=>key===prefs.activity&&!excluded.has(key));
  const generic=prefs.seated?'Comfortable seated movement you choose':!excluded.has('walking')?'A comfortable walk':'Comfortable low-impact movement you choose';
  const favorite=primary?.[2]||generic;
  const strength=excluded.has('strength')?generic:'Easy familiar bodyweight movements with rest';
  const variants=[{title:'Start small',count:2,factor:.5},{title:'Build a steady routine',count:3,factor:.75},{title:'Keep it varied',count:4,factor:1}];
  const options=variants.map((variant,index)=>{
   const count=Math.min(eligible.length,prefs.frequency||variant.count),selected=[];
   for(let i=0;i<count;i++){const at=count===1?0:Math.round(i*(eligible.length-1)/(count-1));if(!selected.includes(eligible[at]))selected.push(eligible[at]);}
   const minutes=Math.max(5,Math.min(budget,Math.floor(Math.min(budget,low?20:30)*variant.factor*(prefs.easy ? 0.75 : 1))));
   const tasks=[];
   for(const [i,offset]of selected.entries()){
    let title=favorite;
    if(prefs.goal==='strength'&&!prefs.activity)title=strength;
    else if(index===2&&!prefs.activity&&i%2===1)title=excluded.has('yoga')?generic:'Gentle mobility within a comfortable range';
    tasks.push({title,category:'move',dayOffset:offset,minutes});
   }
   // Day zero is always present; when unavailable for exercise, it is a planning action.
   if(!selected.includes(0))tasks.push({title:'Choose times and prepare for your planned sessions',category:'custom',dayOffset:0,minutes:Math.min(5,budget)});
   const restDay=Array.from({length:7},(_,i)=>i).find(i=>!selected.includes(i)&&(selected.includes(0)||i!==0));
   if(restDay!==undefined)tasks.push({title:prefs.goal==='energy'?'Take a quiet wind-down break':'Rest and notice how your routine feels',category:'rest',dayOffset:restDay,minutes:Math.min(5,budget)});
   return {title:variant.title,summary:`${selected.length} movement sessions of ${minutes} minutes this week${index===2?' with a little variety':''}. Keep the effort comfortable and take breaks.`,why:`Built-in rules used your ${budget}-minute limit, ${prefs.frequency?'chosen frequency':'a suggested frequency'}, ${prefs.weekdays?'available weekdays':'flexible days'}${prefs.activity?', activity preference':''}${prefs.excluded.length?', activities to avoid':''}${low?', and a gentle starting duration because baseline movement is low or unknown':''}.`,tasks:tasks.sort((a,b)=>a.dayOffset-b.dayOffset)};
  });
  const weightGoal=/\b(weight|fat|slim|skinny)\b/.test(text);
  return {prefs,reply:(weightGoal?'I can suggest consistent movement, but not rapid weight-loss targets or calorie restrictions. ':'')+'Here are three free, rule-based options. Choose one, or tell me what to change—for example “10 minutes,” “three days,” “only weekends,” or “no running.”',questions:[],options};
 }
 return {reply};
})();
