import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../image-animation.js',import.meta.url),'utf8')+'\n'+readFileSync(new URL('../app.js',import.meta.url),'utf8');
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
function fixture({hash='',hidden=false,reduced=false,playError=null,playPromise=null,readyState=4,imageFetch=()=>Promise.resolve({ok:true,blob:()=>Promise.resolve({})})}={}){
  const timers=new Map(),windowEvents=new Map(),documentEvents=new Map(),elements=new Map();
  let timerId=0;
  function element(){
    const classes=new Set(),events=new Map();
    return {
      hidden:true,inert:false,textContent:'',offsetTop:0,offsetHeight:1000,scrollHeight:10000,
      classList:{add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n)),contains:n=>classes.has(n),toggle:(n,on)=>on?classes.add(n):classes.delete(n)},
      style:{setProperty(){}},querySelectorAll:()=>[],
      addEventListener:(name,fn)=>events.set(name,[...(events.get(name)||[]),fn]),
      fire(name,event={}){(events.get(name)||[]).forEach(fn=>fn(event));this['on'+name]?.(event)},
      removeAttribute(name){delete this[name]},
      paused:true,currentTime:0,playCalls:0,loadCalls:0,error:null,duration:16,preload:'none',readyState:4,
      buffered:{length:0,start(){return 0},end(){return 0}},
      play(){this.playCalls++;if(this.playError)return Promise.reject(this.playError);this.paused=false;return this.playPromise||Promise.resolve()},
      pause(){this.paused=true},load(){this.loadCalls++;this.error=null;this.currentTime=0}
    };
  }
  const get=selector=>{if(!elements.has(selector))elements.set(selector,element());return elements.get(selector)};
  const video=get('#pcb-video'),idle=get('#pcb-idle'),root=element();
  video.playError=playError;
  video.playPromise=playPromise;
  video.readyState=readyState;
  get('#gallery-data').textContent='[]';
  get('.intro').offsetHeight=2400;get('.outro').offsetTop=8000;
  const doc={hidden,documentElement:root,querySelector:get,querySelectorAll:()=>[],fonts:{ready:Promise.resolve()},
    addEventListener:(name,fn)=>documentEvents.set(name,fn)};
  const location={hash,pathname:'/',search:''};
  const history={state:null,scrollRestoration:'auto',replaceState(state,title,url){location.hash='';this.url=url},pushState(){}};
  const context=vm.createContext({
    fetch:imageFetch,AbortController,URL:{createObjectURL:()=>`blob:qa-${++timerId}`,revokeObjectURL(){}},
    document:doc,location,history,innerHeight:1000,scrollY:5000,
    matchMedia:()=>({matches:reduced,addEventListener(){}}),
    scrollTo:({top})=>{context.scrollY=top},requestAnimationFrame(){},
    addEventListener:(name,fn)=>windowEvents.set(name,[...(windowEvents.get(name)||[]),fn]),
    ResizeObserver:class{observe(){}},IntersectionObserver:class{observe(){}},
    setTimeout(fn){const id=++timerId;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id)
  });
  vm.runInContext(source,context);
  return {get,video,idle,root,doc,history,location,context,timers,
    tick(){const [id,fn]=timers.entries().next().value||[];assert.ok(fn,'Expected a pending timer');timers.delete(id);fn()},
    visibility(value){doc.hidden=value;documentEvents.get('visibilitychange')()},
    fireDocument(name,event={}){documentEvents.get(name)?.(event)},
    fireWindow(name,event={}){for(const fn of windowEvents.get(name)||[])fn(event)}
  };
}
function assertAssemblyOnly(f){
  assert.equal(f.idle.playCalls,0,'Idle must not start before assembly ends');
  assert.equal(f.get('.hero-controls').hidden,true);
  assert.equal(f.root.classList.contains('intro-locked'),true);
  assert.equal(f.get('.intro-stage').classList.contains('assembly-ready'),false);
}

for(const hash of ['', '#about', '#projects', '#contact']){
  test(`fresh visit ${hash||'/'} starts assembly at the top`,async()=>{
    const f=fixture({hash});await flush();
    assertAssemblyOnly(f);assert.equal(f.video.playCalls,1);
    assert.equal(f.video.currentTime,0);assert.equal(f.video.playbackRate,1.5);
    assert.equal(f.context.scrollY,0);assert.equal(f.location.hash,'');
    assert.equal(f.history.scrollRestoration,'manual');
  });
}
test('a background load waits for visibility without a timeout',async()=>{
  const f=fixture({hidden:true});await flush();
  assertAssemblyOnly(f);assert.equal(f.video.playCalls,0);assert.equal(f.timers.size,0);
  f.visibility(false);await flush();assert.equal(f.video.playCalls,1);
  f.visibility(true);assert.equal(f.video.paused,true);assert.equal(f.timers.size,0);
  assertAssemblyOnly(f);
});
test('mobile preload needs play before any media data is available',async()=>{
  let playbackStarted;
  const f=fixture({readyState:0,playPromise:new Promise(resolve=>playbackStarted=resolve)});
  await flush();assertAssemblyOnly(f);
  assert.equal(f.video.playCalls,1,'play must initiate loading without waiting for a readiness event');
  assert.equal(f.get('#start-animation').hidden,true);
  assert.equal(f.video.autoplay,true);assert.equal(f.video.muted,true);assert.equal(f.video.playsInline,true);
  // Safari can remain at metadata until the outstanding play request starts loading.
  f.video.readyState=1;f.video.fire('loadedmetadata');await flush();
  assert.equal(f.video.playCalls,1);assert.equal(f.video.loadCalls,0);
  f.video.readyState=3;f.video.fire('canplay');playbackStarted();await flush();
  assert.equal(f.video.paused,false);assert.equal(f.video.playCalls,1);assertAssemblyOnly(f);
  // No canplaythrough or fully buffered range is needed to finish the intro.
  f.video.fire('ended');await flush();assert.equal(f.idle.playCalls,1);
  assert.equal(f.get('.hero-controls').hidden,false);
});
test('partially buffered video starts without canplaythrough',async()=>{
  const f=fixture({readyState:3});await flush();
  f.video.buffered={length:1,start:()=>0,end:()=>2};f.video.fire('progress');await flush();
  assert.equal(f.video.playCalls,1);assert.equal(f.get('#start-animation').hidden,true);
});
test('a trusted tap can release a pending mobile play request before readiness',async()=>{
  let rejectOld;
  const f=fixture({readyState:0,playPromise:new Promise((resolve,reject)=>rejectOld=reject)});
  await flush();f.video.playPromise=null;
  f.fireDocument('touchend',{isTrusted:true});await flush();
  assert.equal(f.video.playCalls,2);assert.equal(f.video.loadCalls,0);
  rejectOld({name:'AbortError'});await flush();
  assert.equal(f.video.paused,false);assert.equal(f.get('#start-animation').hidden,true);
});
test('background readiness waits until the tab becomes visible',async()=>{
  const f=fixture({hidden:true,readyState:0});await flush();
  f.video.readyState=4;f.video.fire('canplaythrough');await flush();
  assert.equal(f.video.playCalls,0);assert.equal(f.timers.size,0);assert.equal(f.video.autoplay,false);
  f.visibility(false);await flush();assert.equal(f.video.playCalls,1);assertAssemblyOnly(f);
});
test('a temporary autoplay refusal retries without a button or reloading data',async()=>{
  const f=fixture({playError:{name:'NotAllowedError'}});await flush();assertAssemblyOnly(f);
  assert.equal(f.get('#start-animation').hidden,true);
  f.video.playError=null;f.tick();await flush();
  assert.equal(f.video.playCalls,2);assert.equal(f.video.loadCalls,0);
  assert.equal(f.video.paused,false);assert.equal(f.get('#start-animation').hidden,true);
});
test('readiness events do not duplicate a pending play request',async()=>{
  const f=fixture({playPromise:new Promise(()=>{})});await flush();
  f.video.fire('canplay');f.video.fire('canplaythrough');f.fireWindow('focus');await flush();
  assert.equal(f.video.playCalls,1);assert.equal(f.get('#start-animation').hidden,true);
});
test('a background tab cancels an autoplay retry and resumes automatically on return',async()=>{
  const f=fixture({playError:{name:'NotAllowedError'}});await flush();
  assert.equal(f.timers.size,1);f.visibility(true);assert.equal(f.timers.size,0);
  assert.equal(f.video.autoplay,false);f.video.playError=null;f.visibility(false);await flush();
  assert.equal(f.video.playCalls,2);assert.equal(f.video.paused,false);
  assert.equal(f.get('#start-animation').hidden,true);assert.equal(f.video.loadCalls,0);
});
test('persistent autoplay restrictions start the image animation without a gesture',async()=>{
  const f=fixture({playError:{name:'NotAllowedError'}});await flush();
  for(let i=0;i<3;i++){assert.equal(f.get('#start-animation').hidden,true);f.tick();await flush()}
  assert.equal(f.video.playCalls,4);assert.equal(f.video.loadCalls,0);
  assert.equal(f.get('#start-animation').hidden,true);assert.equal(f.timers.size,0);
  assert.match(f.get('#pcb-image-animation').src,/^blob:/);
  assert.equal(f.video.paused,true);assert.equal(f.video.autoplay,false);assertAssemblyOnly(f);
  f.get('#pcb-image-animation').fire('load');assert.equal(f.get('#pcb-image-animation').hidden,false);
  assertAssemblyOnly(f);f.tick();await flush();
  assert.equal(f.get('.hero-controls').hidden,false);assert.equal(f.idle.playCalls,0);
  assert.match(f.get('#pcb-idle-image').src,/^blob:/);
});
test('image animation restarts on returning to the tab without finishing in the background',async()=>{
  const f=fixture({playError:{name:'NotAllowedError'}});await flush();
  for(let i=0;i<3;i++){f.tick();await flush()}
  const image=f.get('#pcb-image-animation'),prior=image.src;
  image.fire('load');f.visibility(true);assert.equal(f.timers.size,0);assert.equal(image.hidden,true);
  f.visibility(false);await flush();assert.notEqual(image.src,prior);assertAssemblyOnly(f);
  assert.equal(f.get('#start-animation').hidden,true);assert.equal(f.video.playCalls,4);
  f.fireWindow('focus');await flush();assert.equal(f.video.playCalls,4);
});
test('a slow fallback download cannot finish assembly before its first frame loads',async()=>{
  let downloaded;
  const f=fixture({playError:{name:'NotAllowedError'},imageFetch:()=>new Promise(resolve=>downloaded=resolve)});
  await flush();for(let i=0;i<3;i++){f.tick();await flush()}
  assertAssemblyOnly(f);assert.equal(f.get('#pcb-image-animation').src,undefined);
  downloaded({ok:true,blob:()=>Promise.resolve({})});await flush();
  assertAssemblyOnly(f);assert.equal(f.timers.size,0,'The animation clock starts on image load, not download start');
  f.get('#pcb-image-animation').fire('load');assert.equal(f.timers.size,1);
  f.tick();await flush();assert.equal(f.get('.hero-controls').hidden,false);
});
test('a fallback download completing in the background waits for a visible tab',async()=>{
  let downloaded;
  const f=fixture({playError:{name:'NotAllowedError'},imageFetch:()=>new Promise(resolve=>downloaded=resolve)});
  await flush();for(let i=0;i<3;i++){f.tick();await flush()}
  f.visibility(true);downloaded({ok:true,blob:()=>Promise.resolve({})});await flush();
  assert.equal(f.get('#pcb-image-animation').src,undefined);assertAssemblyOnly(f);
  f.visibility(false);await flush();assert.match(f.get('#pcb-image-animation').src,/^blob:/);
  assertAssemblyOnly(f);
});
test('replaying the image fallback restarts from the beginning using cached bytes',async()=>{
  let downloads=0;
  const f=fixture({playError:{name:'NotAllowedError'},imageFetch:()=>{downloads++;return Promise.resolve({ok:true,blob:()=>Promise.resolve({})})}});
  await flush();for(let i=0;i<3;i++){f.tick();await flush()}
  const first=f.get('#pcb-image-animation').src;f.get('#pcb-image-animation').fire('load');
  f.tick();await flush();const priorDownloads=downloads;
  f.get('#play-animation').fire('click');await flush();
  assert.notEqual(f.get('#pcb-image-animation').src,first);assert.equal(downloads,priorDownloads);
  assert.equal(f.get('#pcb-idle-image').hidden,true);assert.equal(f.get('.hero-controls').hidden,true);
  assert.equal(f.root.classList.contains('intro-locked'),true);
});
test('a failed fallback download offers a working network retry',async()=>{
  let fails=true;
  const f=fixture({playError:{name:'NotAllowedError'},imageFetch:()=>fails?Promise.reject(new Error('offline')):Promise.resolve({ok:true,blob:()=>Promise.resolve({})})});
  await flush();for(let i=0;i<3;i++){f.tick();await flush()}
  assert.equal(f.get('#start-animation').hidden,false);assert.match(f.get('#start-animation').textContent,/Retry/);
  fails=false;f.get('#start-animation').fire('click');await flush();
  assert.match(f.get('#pcb-image-animation').src,/^blob:/);assert.equal(f.get('#start-animation').hidden,true);
});
test('an ordinary trusted tap can unlock a browser that requires activation',async()=>{
  const f=fixture({playError:{name:'NotAllowedError'}});await flush();
  f.video.playError=null;
  f.fireDocument('touchend',{isTrusted:false});await flush();assert.equal(f.video.playCalls,1);
  f.fireDocument('touchend',{isTrusted:true});await flush();
  assert.equal(f.video.playCalls,2);assert.equal(f.video.paused,false);
  assert.equal(f.get('#start-animation').hidden,true);assert.equal(f.video.loadCalls,0);
});
test('native playback after a refusal cancels the scheduled retry',async()=>{
  const f=fixture({playError:{name:'NotAllowedError'}});await flush();
  const retry=[...f.timers.keys()][0];f.video.paused=false;f.video.fire('playing');
  assert.equal(f.timers.has(retry),false);assert.equal(f.get('#start-animation').hidden,true);
  assert.equal(f.video.playCalls,1);assertAssemblyOnly(f);
});
test('a stalled video reloads twice before automatically using the image animation',async()=>{
  const f=fixture();await flush();
  for(let i=0;i<2;i++){
    f.tick();await flush();assertAssemblyOnly(f);assert.equal(f.get('#start-animation').hidden,true);
    f.tick();await flush();assert.equal(f.video.loadCalls,i+1);
  }
  f.tick();await flush();
  assertAssemblyOnly(f);assert.equal(f.get('#start-animation').hidden,true);
  assert.equal(f.video.error,null);
  assert.match(f.get('#pcb-image-animation').src,/^blob:/);
  assert.equal(f.video.loadCalls,2);
});
test('a temporary media error recovers automatically at the interrupted frame',async()=>{
  const f=fixture();await flush();f.video.currentTime=6;f.video.error={code:2};f.video.fire('error');
  assertAssemblyOnly(f);assert.equal(f.get('#start-animation').hidden,true);
  f.tick();await flush();f.video.fire('loadedmetadata');
  assert.equal(f.video.error,null);assert.equal(f.video.paused,false);assertAssemblyOnly(f);
  assert.equal(f.video.currentTime,6);assert.equal(f.video.playbackRate,1.5);
});
test('slow download progress keeps waiting instead of showing retry',async()=>{
  const f=fixture({playPromise:new Promise(()=>{})});await flush();
  for(let end=1;end<=10;end++){
    const timer=[...f.timers.keys()][0];
    f.video.buffered={length:1,start:()=>0,end:()=>end};f.video.fire('progress');
    assert.equal(f.timers.has(timer),false,'Advancing downloads renew the stall timeout');
    assert.equal(f.timers.size,1);assert.equal(f.get('#start-animation').hidden,true);
    assert.equal(f.video.loadCalls,0);assertAssemblyOnly(f);
  }
  const timer=[...f.timers.keys()][0];f.video.fire('progress');
  assert.equal(f.timers.has(timer),true,'Repeated progress without new data does not conceal a stall');
});
test('idle download waits until the assembly is fully buffered',async()=>{
  const f=fixture();await flush();assert.equal(f.idle.loadCalls,0);
  f.video.buffered={length:1,start:()=>0,end:()=>8};f.video.fire('progress');assert.equal(f.idle.loadCalls,0);
  f.video.buffered={length:1,start:()=>0,end:()=>16};f.video.fire('progress');assert.equal(f.idle.loadCalls,1);
  f.video.fire('progress');assert.equal(f.idle.loadCalls,1);assertAssemblyOnly(f);
});
test('an old play rejection after a quick tab switch cannot stop the new attempt',async()=>{
  let rejectOld;
  const f=fixture({playPromise:new Promise((resolve,reject)=>rejectOld=reject)});await flush();
  f.visibility(true);f.video.playPromise=null;f.visibility(false);await flush();
  rejectOld({name:'AbortError'});await flush();
  assert.equal(f.video.paused,false);assert.equal(f.get('#start-animation').hidden,true);
  assert.equal(f.video.loadCalls,0);assertAssemblyOnly(f);
});
test('persistent media failures have bounded retries then play the image assembly',async()=>{
  const f=fixture({playError:{name:'NotSupportedError'}});await flush();
  for(let i=0;i<2;i++){assert.equal(f.get('#start-animation').hidden,true);f.tick();await flush()}
  assert.equal(f.video.playCalls,3);assert.equal(f.video.loadCalls,2);
  assert.equal(f.get('#start-animation').hidden,true);assert.equal(f.timers.size,0);assertAssemblyOnly(f);
  assert.match(f.get('#pcb-image-animation').src,/^blob:/);
});
test('going into the background cancels a scheduled recovery',async()=>{
  const f=fixture();await flush();f.video.error={code:2};f.video.fire('error');
  f.visibility(true);assert.equal(f.timers.size,0);
  f.visibility(false);await flush();assert.equal(f.video.loadCalls,1);assertAssemblyOnly(f);
});
test('returning online retries a failed download but preserves gesture requirements',async()=>{
  const f=fixture();await flush();f.video.error={code:2};f.video.fire('error');
  f.fireWindow('online');await flush();assert.equal(f.video.loadCalls,1);assert.equal(f.video.paused,false);
  const blocked=fixture({playError:{name:'NotAllowedError'}});await flush();
  for(let i=0;i<3;i++){blocked.tick();await flush()}
  blocked.fireWindow('online');await flush();assert.equal(blocked.video.playCalls,4);
  assert.equal(blocked.get('#start-animation').hidden,true);
});
test('completion enters idle; a restored page restarts assembly',async()=>{
  const f=fixture();await flush();f.video.currentTime=16;f.video.fire('ended');await flush();
  assert.equal(f.idle.playCalls,1);assert.equal(f.get('.hero-controls').hidden,false);
  assert.equal(f.root.classList.contains('intro-locked'),false);
  f.fireWindow('pageshow',{persisted:true});await flush();
  assert.equal(f.video.currentTime,0);assert.equal(f.video.paused,false);assert.equal(f.idle.paused,true);
  assert.equal(f.get('.hero-controls').hidden,true);
  assert.equal(f.get('.intro-stage').classList.contains('idle-playing'),false);
});
test('a refresh after completion creates a new assembly state',async()=>{
  const prior=fixture();await flush();prior.video.fire('ended');await flush();
  const refreshed=fixture({hash:'#contact'});await flush();assertAssemblyOnly(refreshed);
  assert.equal(refreshed.video.currentTime,0);assert.equal(refreshed.video.paused,false);
});
test('reduced-motion visitors retain the static fallback',async()=>{
  const f=fixture({reduced:true});await flush();
  assert.equal(f.video.playCalls,0);assert.equal(f.idle.playCalls,0);
  assert.equal(f.root.classList.contains('intro-locked'),false);
  assert.equal(f.get('.intro-stage').classList.contains('use-still'),true);
});
