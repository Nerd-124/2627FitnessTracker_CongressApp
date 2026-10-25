const {JSDOM}=require('jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict');
const dom=new JSDOM(fs.readFileSync('web/index.html','utf8'),{runScripts:'outside-only',url:'https://site.test/app'});
const w=dom.window,d=w.document;let change;
const media={matches:true,addEventListener:(type,fn)=>change=fn};w.matchMedia=()=>media;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
// Existing listeners must survive moving the controls.
let navigated=false;d.querySelector('[data-page="activity"]').addEventListener('click',()=>navigated=true);
w.eval(fs.readFileSync('web/navigation.js','utf8'));
const drawer=d.querySelector('#mobile-side-menu'),trigger=d.querySelector('#open-side-menu');
assert(drawer.querySelector('nav'));assert(drawer.querySelector('#account-settings'));
trigger.click();assert(drawer.open);assert.equal(trigger.getAttribute('aria-expanded'),'true');assert(d.body.classList.contains('menu-open'));
d.querySelector('[data-page="activity"]').click();assert(navigated);assert(!drawer.open);assert(!d.body.classList.contains('menu-open'));
trigger.click();d.querySelector('#close-side-menu').click();assert(!drawer.open);
trigger.click();media.matches=false;change();assert(!drawer.open);assert(d.body.querySelector(':scope>aside'));assert(d.querySelector('main>header #account-settings'));
media.matches=true;change();assert(drawer.querySelector('#app-sidebar'));assert.equal(d.querySelectorAll('#account-settings').length,1);
console.log('PASS mobile drawer, navigation listener preservation, close/reset, desktop resize and single account controls');
