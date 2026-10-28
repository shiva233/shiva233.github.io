import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve()};
function fixture({hash='',hidden=false,reduced=false,playError=null}={}){
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
      paused:true,currentTime:0,playCalls:0,error:null,
      play(){this.playCalls++;if(this.playError)return Promise.reject(this.playError);this.paused=false;return Promise.resolve()},
      pause(){this.paused=true},load(){this.error=null}
    };
  }
  const get=selector=>{if(!elements.has(selector))elements.set(selector,element());return elements.get(selector)};
  const video=get('#pcb-video'),idle=get('#pcb-idle'),root=element();
  video.playError=playError;
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
for(const name of ['NotAllowedError','NotSupportedError']){
  test(`${name} offers playback instead of skipping to idle`,async()=>{
    const f=fixture({playError:{name}});await flush();assertAssemblyOnly(f);
    assert.equal(f.get('#start-animation').hidden,false);
    f.video.playError=null;f.get('#start-animation').fire('click');await flush();
    assert.equal(f.video.paused,false);assertAssemblyOnly(f);
  });
}
test('a stalled load offers retry and does not mark assembly complete',async()=>{
  const f=fixture();await flush();
  for(const fn of [...f.timers.values()])fn();
  assertAssemblyOnly(f);assert.equal(f.get('#start-animation').hidden,false);
});
test('a media error can be retried without entering idle',async()=>{
  const f=fixture();await flush();f.video.error={code:4};f.video.fire('error');
  assertAssemblyOnly(f);f.get('#start-animation').fire('click');await flush();
  assert.equal(f.video.error,null);assert.equal(f.video.paused,false);assertAssemblyOnly(f);
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
