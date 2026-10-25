'use strict';
// WHO-5 content © World Health Organization 2024, CC BY-NC-SA 3.0 IGO.
// Official questions and score are unchanged. App letter bands are not WHO categories.
const WHO5=(()=>{
 const source='https://www.who.int/publications/m/item/WHO-UCN-MSD-MHE-2024.01';
 const questions=['I have felt cheerful and in good spirits','I have felt calm and relaxed','I have felt active and vigorous','I woke up feeling fresh and rested','My daily life has been filled with things that interest me'];
 const choices=['At no time','Some of the time','Less than half of the time','More than half of the time','Most of the time','All of the time'];
 function score(answers){if(!Array.isArray(answers)||answers.length!==5||answers.some(v=>typeof v!=='number'||!Number.isInteger(v)||v<0||v>5))return null;const raw=answers.reduce((n,v)=>n+v,0);return{raw,total:raw*4};}
 function assess(data,today){const end=new Date(today+'T12:00:00Z');end.setUTCDate(end.getUTCDate()-13);const since=end.toISOString().slice(0,10);const row=[...(data.records||[])].filter(r=>typeof r.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&Number.isFinite(Date.parse(r.date+'T12:00:00Z'))&&new Date(r.date+'T12:00:00Z').toISOString().slice(0,10)===r.date&&r.date>=since&&r.date<=today&&score(r.who5?.answers)).sort((a,b)=>b.date.localeCompare(a.date))[0];return row?{...score(row.who5.answers),date:row.date,answers:[...row.who5.answers]}:null;}
 function support(result){return !result?'Complete the optional five-question check-in when you are ready. Missing answers do not lower your score.':result.total<50?'You reported lower well-being over the past two weeks. Consider talking with a qualified health professional or someone you trust. This score alone cannot diagnose a condition.':'Notice what supports your well-being. A higher score does not rule out difficulties, and you can seek support at any score.';}
 return{source,questions,choices,score,assess,support};
})();
function renderMentalHealth(){
 const result=WHO5.assess(state,localDate());$('#who5-score').textContent=result?result.total+' / 100':'Not enough data';$('#who5-date').textContent=result?'Latest complete check-in: '+result.date+' · past-two-weeks recall':'Five questions · past two weeks · optional';$('#who5-feedback').textContent=WHO5.support(result);
 const rows=$('#who5-history');rows.replaceChildren();for(const r of [...state.records].filter(r=>WHO5.score(r.who5?.answers)).sort((a,b)=>b.date.localeCompare(a.date))){const item=document.createElement('p'),edit=document.createElement('button');item.textContent=r.date+' · WHO-5 '+WHO5.score(r.who5.answers).total+'/100 ';edit.type='button';edit.className='text-button';edit.textContent='Review / correct';edit.onclick=()=>openWHO5(r.date);item.append(edit);rows.append(item);}if(!rows.children.length)rows.textContent='Your completed check-ins will appear here.';
}
function openWHO5(date=localDate()){
 const form=$('#who5-form'),row=state.records.find(r=>r.date===date);form.reset();form.elements.date.value=date;form.elements.date.max=localDate();WHO5.questions.forEach((q,i)=>{const answer=row?.who5?.answers?.[i];if(Number.isInteger(answer))form.elements['q'+i].value=String(answer);});$('#who5-error').textContent='';$('#who5-dialog').showModal();
}
function initializeMentalHealth(){
 const fields=$('#who5-questions');WHO5.questions.forEach((question,i)=>{const label=document.createElement('label');label.textContent=(i+1)+'. '+question;const select=document.createElement('select');select.name='q'+i;select.required=true;select.add(new Option('Choose an answer',''));for(let n=5;n>=0;n--)select.add(new Option(WHO5.choices[n]+' · '+n,n));label.append(select);fields.append(label);});
 $('#who5-open').onclick=()=>openWHO5();$('#journal-who5-open').onclick=()=>{const date=$('#journal-form').elements.date.value||localDate();$('#journal-editor').close();openWHO5(date);};$('#who5-close').onclick=()=>$('#who5-dialog').close();
 $('#who5-form').onsubmit=event=>{event.preventDefault();const form=event.target;if(!form.reportValidity())return;const date=form.elements.date.value,answers=WHO5.questions.map((_,i)=>Number(form.elements['q'+i].value));if(!WHO5.score(answers)||!validSleepDate(date)||date>localDate()){$('#who5-error').textContent='Complete all five questions and choose today or an earlier valid date.';return;}const previous=state.records,record={...previous.find(r=>r.date===date),date,who5:{instrument:'WHO-5',version:'2024',recall:'past-two-weeks',answers}};state.records=[...previous.filter(r=>r.date!==date),record];save();try{if(JSON.stringify(JSON.parse(localStorage.getItem(KEY))?.records?.find(r=>r.date===date)?.who5)!==JSON.stringify(record.who5))throw Error();$('#who5-dialog').close();renderRecords();renderMentalHealth();toast('WHO-5 check-in saved.');}catch{state.records=previous;$('#who5-error').textContent='Could not save. Your answers are still here; please retry.';}};
 renderMentalHealth();
}
