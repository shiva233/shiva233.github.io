import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve()};
function fixture({hash='',hidden=false,reduced=false,playError=null,playPromise=null}={}){
  const timers=new Map(),windowEvents=new Map(),documentEvents=new Map(),elements=new Map();
  let timerId=0;
  function element(){
    const classes=new Set(),events=new Map();
    return {
      hidden:true,inert:false,textContent:'',offsetTop:0,offsetHeight:1000,scrollHeight:10000,
      classList:{add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n)),contains:n=>classes.has(n),toggle:(n,on)=>on?classes.add(n):classes.delete(n)},
      style:{setProperty(){}},querySelectorAll:()=>[],
      addEventListener:(name,fn)=>events.set(name,[...(events.get(name)||[]),fn]),
      fire:(name,event={})=>(events.get(name)||[]).forEach(fn=>fn(event)),
      paused:true,currentTime:0,playCalls:0,loadCalls:0,error:null,duration:16,preload:'none',
      buffered:{length:0,end(){return 0}},
      play(){this.playCalls++;if(this.playError)return Promise.reject(this.playError);this.paused=false;return this.playPromise||Promise.resolve()},
      pause(){this.paused=true},load(){this.loadCalls++;this.error=null;this.currentTime=0}
    };
  }
  const get=selector=>{if(!elements.has(selector))elements.set(selector,element());return elements.get(selector)};
  const video=get('#pcb-video'),idle=get('#pcb-idle'),root=element();
  video.playError=playError;
  video.playPromise=playPromise;
  get('#gallery-data').textContent='[]';
  get('.intro').offsetHeight=2400;get('.outro').offsetTop=8000;
  const doc={hidden,documentElement:root,querySelector:get,querySelectorAll:()=>[],fonts:{ready:Promise.resolve()},
    addEventListener:(name,fn)=>documentEvents.set(name,fn)};
  const location={hash,pathname:'/',search:''};
  const history={state:null,scrollRestoration:'auto',replaceState(state,title,url){location.hash='';this.url=url},pushState(){}};
  const context=vm.createContext({
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
for(const name of ['NotAllowedError']){
  test(`${name} offers playback instead of skipping to idle`,async()=>{
    const f=fixture({playError:{name}});await flush();assertAssemblyOnly(f);
    assert.equal(f.get('#start-animation').hidden,false);
    f.video.playError=null;f.get('#start-animation').fire('click');await flush();
    assert.equal(f.video.paused,false);assertAssemblyOnly(f);
  });
}
test('a stalled load reloads twice before offering manual retry',async()=>{
  const f=fixture();await flush();
  for(let i=0;i<2;i++){
    f.tick();await flush();assertAssemblyOnly(f);assert.equal(f.get('#start-animation').hidden,true);
    f.tick();await flush();assert.equal(f.video.loadCalls,i+1);
  }
  f.tick();await flush();
  assertAssemblyOnly(f);assert.equal(f.get('#start-animation').hidden,false);
  assert.equal(f.video.error,null);
  f.get('#start-animation').fire('click');await flush();
  assert.equal(f.video.loadCalls,3,'Manual retry reloads even without a MediaError');
  assert.equal(f.get('#start-animation').hidden,true);
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
    f.video.buffered={length:1,end:()=>end};f.video.fire('progress');
    assert.equal(f.timers.has(timer),false,'Advancing downloads renew the stall timeout');
    assert.equal(f.timers.size,1);assert.equal(f.get('#start-animation').hidden,true);
    assert.equal(f.video.loadCalls,0);assertAssemblyOnly(f);
  }
  const timer=[...f.timers.keys()][0];f.video.fire('progress');
  assert.equal(f.timers.has(timer),true,'Repeated progress without new data does not conceal a stall');
});
test('idle download waits until the assembly is fully buffered',async()=>{
  const f=fixture();await flush();assert.equal(f.idle.loadCalls,0);
  f.video.buffered={length:1,end:()=>8};f.video.fire('progress');assert.equal(f.idle.loadCalls,0);
  f.video.buffered={length:1,end:()=>16};f.video.fire('progress');assert.equal(f.idle.loadCalls,1);
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
test('persistent media failures have bounded retries without skipping assembly',async()=>{
  const f=fixture({playError:{name:'NotSupportedError'}});await flush();
  for(let i=0;i<2;i++){assert.equal(f.get('#start-animation').hidden,true);f.tick();await flush()}
  assert.equal(f.video.playCalls,3);assert.equal(f.video.loadCalls,2);
  assert.equal(f.get('#start-animation').hidden,false);assert.equal(f.timers.size,0);assertAssemblyOnly(f);
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
  blocked.fireWindow('online');await flush();assert.equal(blocked.video.playCalls,1);
  assert.equal(blocked.get('#start-animation').hidden,false);
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
