'use strict';
// Reuse the same navigation and account controls on desktop and phone.
(()=>{
 const sidebar=document.querySelector('#app-sidebar'),dialog=document.querySelector('#mobile-side-menu');
 const open=document.querySelector('#open-side-menu'),close=document.querySelector('#close-side-menu');
 const actions=document.querySelector('main>header .header-actions');
 const sidebarSlot=document.createComment('Desktop sidebar'),actionsSlot=document.createComment('Desktop account controls');
 sidebar.before(sidebarSlot);actions.before(actionsSlot);
 const phone=window.matchMedia('(max-width:850px)');
 function dismiss(){if(dialog.open)dialog.close();}
 function sync(){
  dismiss();
  if(phone.matches){dialog.append(sidebar);sidebar.querySelector('nav').after(actions);}
  else{sidebarSlot.after(sidebar);actionsSlot.after(actions);}
 }
 open.addEventListener('click',()=>{if(!phone.matches)return;dialog.showModal();open.setAttribute('aria-expanded','true');document.body.classList.add('menu-open');});
 close.addEventListener('click',dismiss);
 dialog.addEventListener('close',()=>{open.setAttribute('aria-expanded','false');document.body.classList.remove('menu-open');});
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dismiss();}});
 sidebar.addEventListener('click',event=>{if(event.target.closest('nav button,.header-actions button,.brand'))dismiss();});
 phone.addEventListener('change',sync);sync();
})();
