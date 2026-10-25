import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut,browserLocalPersistence,setPersistence} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
let auth,done=false;
async function finish(user){
 if(done)return;done=true;
 try{
  if(!user.providerData.some(p=>p.providerId==='google.com'))throw Error('Choose a Google account to continue.');
  await googleSession(await user.getIdToken(true));location.replace('/app');
 }catch(error){done=false;googleAuthMessage(googleErrorMessage(error));googleButton.disabled=false;}
}
export async function prepare(){
 const response=await fetch('/api/auth/config',{cache:'no-store'});if(!response.ok)throw Error('Sign-in configuration could not load.');
 auth=getAuth(initializeApp(await response.json()));await setPersistence(auth,browserLocalPersistence);
 if(location.pathname==='/logout'){
  await signOut(auth);await googleLogout();location.replace('/login?signedOut=1');return;
 }
 await new Promise((resolve,reject)=>{let unsubscribe;unsubscribe=onAuthStateChanged(auth,user=>{if(unsubscribe)unsubscribe();resolve();},reject);});
}
export async function signIn(){
 const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
 const result=await signInWithPopup(auth,provider);await finish(result.user);
}
