const {JSDOM}=require('jsdom'),fs=require('node:fs'),assert=require('node:assert/strict');
const dom=new JSDOM(fs.readFileSync('web/index.html','utf8'),{runScripts:'outside-only'}),w=dom.window,d=w.document;
w.eval(fs.readFileSync('web/account.js','utf8')+'\nwindow.renderAccountAvatar=renderAccountAvatar;');
assert.equal(d.querySelector('#export'),null);
w.renderAccountAvatar({name:'Jane Smith',photoURL:'https://lh3.googleusercontent.com/photo'});
let image=d.querySelector('#account-avatar img');assert(image);assert.equal(image.referrerPolicy,'no-referrer');image.dispatchEvent(new w.Event('error'));assert.equal(d.querySelector('#account-avatar').textContent,'JS');
for(const photoURL of ['https://evil.test/photo','javascript:alert(1)','https://googleusercontent.com.evil.test/photo','https://user:password@lh3.googleusercontent.com/p']){
 w.renderAccountAvatar({name:'Jane',photoURL});assert.equal(d.querySelector('#account-avatar img'),null);
}
w.renderAccountAvatar({name:'Jane Smith'});assert.equal(d.querySelector('#account-avatar').textContent,'JS');
console.log('PASS verified Google avatar display, initials fallback, failed image and untrusted URLs, no menu export');
