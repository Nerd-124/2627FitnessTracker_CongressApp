'use strict';
function portraitTargetYear(year=new Date().getFullYear()){return year+25;}
// Photo upload is retired. Existing account records are not rewritten to remove unrelated data.
function currentPortrait(){return null;}
function portraitRoutineGrade(){return '—';}
function renderPortrait2050(){const age=FutureSelf.number(state.profile.age,13,100);$('#portrait-actual-age').textContent=age??'—';$('#portrait-report-grade').textContent='—';}
function initializePortrait2050(){
 $('#portrait-report-open').onclick=()=>{renderFutureSelf();$('#portrait-report').showModal();};$('#portrait-report-close').onclick=()=>$('#portrait-report').close();initializeAvatarAppearance();
}
