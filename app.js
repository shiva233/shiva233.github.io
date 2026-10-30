document.documentElement.classList.add('js');
const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const intro = document.querySelector('.intro');
const stage = document.querySelector('.intro-stage');
const content = document.querySelector('.document');
const outro = document.querySelector('.outro');
const outroStage = document.querySelector('.outro-stage');
const video = document.querySelector('#pcb-video');
video.defaultPlaybackRate = 1.5;
video.playbackRate = 1.5;
const idle = document.querySelector('#pcb-idle');
const outroIdle = document.querySelector('#outro-idle');
const outroCard = document.querySelector('.outro-card');
const replay = document.querySelector('#play-animation');
const start = document.querySelector('#start-animation');
const controls = document.querySelector('.hero-controls');
const clamp = (x, lo=0, hi=1) => Math.max(lo, Math.min(hi, x));
const ease = x => {x=clamp(x); return x*x*(3-2*x)};
let complete=false, scheduled=false, introTop=0, introTravel=1, outroTop=0, outroTravel=1;
let watchdog, recoveryTimer, autoplayTimer, playbackGeneration=0, playAttempt=0, recoveryCount=0;
let playPending=false, autoplayRetries=0;
let resumeAt=0, lastPlaybackTime=0, lastBufferedEnd=0, gestureRequired=false;
let outroOnScreen=false;
function syncOutroPlayback(){
  if(!outroOnScreen||document.hidden||reducedMotion.matches){
    outroIdle.pause();
    if(reducedMotion.matches)outroCard.classList.remove('idle-playing');
    return;
  }
  if(outroIdle.paused)outroIdle.play().catch(()=>outroCard.classList.remove('idle-playing'));
}
function measure(){
  introTop=intro.offsetTop;introTravel=Math.max(1,intro.offsetHeight-stage.offsetHeight);
  outroTop=outro.offsetTop;outroTravel=Math.max(1,outro.offsetHeight-outroStage.offsetHeight);
}
function renderScroll(){
  scheduled=false;
  const y=scrollY, p=complete?clamp((y-introTop)/introTravel):0;
  const reading=complete&&(reducedMotion.matches||p>=.999);
  root.classList.toggle('content-visible',reading);
  content.inert=!reading;
  controls.inert=p>.08;
  root.style.setProperty('--read',clamp(y/Math.max(1,root.scrollHeight-innerHeight)));
  if(reducedMotion.matches){outroStage.querySelectorAll('a').forEach(a=>a.tabIndex=0);return}
  const z=ease((p-.04)/.75);
  stage.style.setProperty('--zoom',String(1+z*z*18));
  stage.style.setProperty('--cue-opacity',String(1-ease(p/.15)));
  stage.style.setProperty('--bloom',String(ease((p-.24)/.4)));
  stage.style.setProperty('--intro-fade',String(ease((p-.73)/.27)));
  if(y>=intro.offsetHeight||document.hidden){idle.pause()}
  else if(complete&&stage.classList.contains('idle-playing')&&idle.paused){idle.play().catch(()=>{})}
  const q=clamp((y-outroTop)/outroTravel), arrive=ease(q/.8);
  outroStage.style.setProperty('--outro-zoom',String(1+Math.pow(1-arrive,3)*17));
  outroStage.style.setProperty('--outro-card',String(ease(q/.18)));
  outroStage.style.setProperty('--outro-bloom',String(Math.sin(Math.PI*clamp(q/.68))*.72));
  outroStage.style.setProperty('--outro-copy',String(ease((q-.56)/.3)));
  outroStage.style.setProperty('--outro-y',`${(1-ease((q-.56)/.3))*12}px`);
  outroStage.querySelectorAll('a').forEach(a=>a.tabIndex=q>.72?0:-1);
}
function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(renderScroll)}}
function useStill(){stage.classList.add('use-still');stage.classList.remove('idle-playing')}
async function playIdle(){
  if(reducedMotion.matches||!complete)return;
  const generation=playbackGeneration;
  try{
    await idle.play();
    const reveal=()=>{if(complete&&generation===playbackGeneration){stage.classList.add('idle-playing');stage.classList.remove('use-still')}};
    if(idle.requestVideoFrameCallback)idle.requestVideoFrameCallback(reveal);else reveal();
  }catch{useStill()}
}
function finishAssembly(fallback=false){
  if(complete)return;
  complete=true;stopAssemblyPlayback();
  root.classList.remove('intro-locked');
  stage.classList.remove('autoplay-blocked');stage.classList.add('assembly-ready');
  start.hidden=true;controls.hidden=false;
  if(fallback||reducedMotion.matches)useStill();
  replay.hidden=reducedMotion.matches;
  if(!reducedMotion.matches)playIdle();
  measure();schedule();
}
function offerAssemblyStart(retry=false){
  stopAssemblyPlayback();
  if(complete)return;
  gestureRequired=!retry;
  start.hidden=false;
  start.textContent=retry?'Retry animation ▷':'Play animation ▷';
  stage.classList.add('autoplay-blocked');
}
function stopAssemblyPlayback(){
  // pause()/load() reject pending play promises, sometimes after the tab returns.
  // Invalidate those promises before pausing so they cannot replace a newer attempt.
  playAttempt++;playPending=false;video.autoplay=false;
  clearTimeout(watchdog);clearTimeout(recoveryTimer);recoveryTimer=undefined;
  clearTimeout(autoplayTimer);autoplayTimer=undefined;
  video.pause();
}
function watchPlayback(){
  clearTimeout(watchdog);
  if(!complete&&!document.hidden&&start.hidden)watchdog=setTimeout(recoverAssembly,30000);
}
function recoverAssembly(){
  if(complete||document.hidden||recoveryTimer!==undefined||!start.hidden)return;
  stopAssemblyPlayback();
  if(recoveryCount>=2){offerAssemblyStart(true);return}
  recoveryCount++;
  recoveryTimer=setTimeout(()=>{recoveryTimer=undefined;playAssembly(true)},500*recoveryCount);
}
function retryAutoplay(){
  clearTimeout(watchdog);
  // A new tab can reject play() before its visibility/layout has settled.
  // Retry the already buffered video before asking for a browser-required gesture.
  const delays=[250,750,1500];
  if(autoplayRetries>=delays.length){offerAssemblyStart();return}
  autoplayTimer=setTimeout(()=>{autoplayTimer=undefined;playAssembly()},delays[autoplayRetries++]);
}
function readyToPlay(){
  if(video.readyState>=4)return true;
  return Number.isFinite(video.duration)&&video.buffered.length===1&&
    video.buffered.start(0)<=.1&&video.buffered.end(video.buffered.length-1)>=video.duration-.1;
}
function playWhenReady(){
  if(!complete&&!document.hidden&&!gestureRequired&&autoplayTimer===undefined&&recoveryTimer===undefined&&readyToPlay())playAssembly();
}
async function playAssembly(reload=false,fromGesture=false){
  if(reducedMotion.matches){finishAssembly(true);return}
  // Never spend the opening (or its loading timeout) in a background tab.
  if(document.hidden||complete)return;
  if(playPending&&!reload)return;
  if(!video.paused&&!reload)return;
  const attempt=++playAttempt;
  gestureRequired=false;
  clearTimeout(recoveryTimer);recoveryTimer=undefined;
  clearTimeout(autoplayTimer);autoplayTimer=undefined;
  video.muted=true;video.defaultMuted=true;
  // Enable native muted autoplay only in a visible tab, including while buffering.
  video.playsInline=true;video.autoplay=true;
  if(reload||video.error){
    resumeAt=Math.max(resumeAt,video.currentTime||0);
    lastBufferedEnd=0;video.load();
  }
  video.defaultPlaybackRate=1.5;video.playbackRate=1.5;
  start.hidden=true;stage.classList.remove('autoplay-blocked');
  watchPlayback();
  // Loading a frame is not the same as being ready to play through the intro.
  // A real gesture may call play immediately so browsers keep that activation.
  if(!fromGesture&&!readyToPlay())return;
  playPending=true;
  try{
    await video.play();
    if(attempt!==playAttempt)return;
    playPending=false;autoplayRetries=0;
    if(document.hidden||complete){video.pause();clearTimeout(watchdog)}
  }
  catch(error){
    if(complete||document.hidden||attempt!==playAttempt)return;
    playPending=false;
    if(error.name==='NotAllowedError')retryAutoplay();
    else recoverAssembly();
  }
}
function replayAssembly(){
  stopAssemblyPlayback();recoveryCount=0;autoplayRetries=0;gestureRequired=false;
  resumeAt=0;lastPlaybackTime=0;lastBufferedEnd=0;
  playbackGeneration++;complete=false;idle.pause();idle.currentTime=0;
  controls.hidden=true;start.hidden=true;
  stage.classList.remove('assembly-ready','idle-playing','use-still','autoplay-blocked');
  scrollTo({top:0,behavior:'instant'});
  root.classList.add('intro-locked');root.classList.remove('content-visible');
  content.inert=true;video.currentTime=0;renderScroll();playAssembly();
}
video.addEventListener('ended',()=>finishAssembly());
video.addEventListener('error',recoverAssembly);
video.addEventListener('loadedmetadata',()=>{
  if(resumeAt>0){video.currentTime=resumeAt;lastPlaybackTime=resumeAt;resumeAt=0}
});
for(const event of ['loadeddata','canplay','canplaythrough'])video.addEventListener(event,playWhenReady);
video.addEventListener('playing',()=>{
  if(complete||document.hidden){stopAssemblyPlayback();return}
  autoplayRetries=0;gestureRequired=false;
  clearTimeout(autoplayTimer);autoplayTimer=undefined;
  start.hidden=true;stage.classList.remove('autoplay-blocked');watchPlayback();
});
video.addEventListener('timeupdate',()=>{
  if(!complete&&!video.paused&&!document.hidden&&video.currentTime>lastPlaybackTime){
    lastPlaybackTime=video.currentTime;watchPlayback();
  }
});
video.addEventListener('progress',()=>{
  // Slow but advancing downloads are healthy, even before Safari can play a frame.
  const end=video.buffered.length?video.buffered.end(video.buffered.length-1):0;
  if(end>lastBufferedEnd){lastBufferedEnd=end;watchPlayback()}
  // Fetch the idle loop only once it cannot compete with the opening download.
  if(!document.hidden&&Number.isFinite(video.duration)&&end>=video.duration-.1&&idle.preload==='none'){
    idle.preload='auto';idle.load();
  }
  playWhenReady();
});
idle.addEventListener('error',useStill);
outroIdle.addEventListener('playing',()=>{
  const reveal=()=>{if(outroOnScreen&&!document.hidden&&!reducedMotion.matches)outroCard.classList.add('idle-playing')};
  if(outroIdle.requestVideoFrameCallback)outroIdle.requestVideoFrameCallback(reveal);else reveal();
});
outroIdle.addEventListener('error',()=>outroCard.classList.remove('idle-playing'));
new IntersectionObserver(([entry])=>{
  outroOnScreen=entry.isIntersecting;
  syncOutroPlayback();
}).observe(outro);
replay.addEventListener('click',replayAssembly);
start.addEventListener('click',()=>{recoveryCount=0;autoplayRetries=0;playAssembly(!gestureRequired,true)});
function resumeVisibleAssembly(){
  if(complete||document.hidden||playPending||!video.paused)return;
  autoplayRetries=0;playAssembly();
}
// If the browser requires activation, an ordinary tap/key can unlock playback;
// visitors do not have to find the fallback button specifically.
function resumeWithGesture(event){
  if(event.isTrusted&&event.target!==start&&!complete&&!document.hidden&&(gestureRequired||autoplayTimer!==undefined)){
    autoplayRetries=0;playAssembly(false,true);
  }
}
document.addEventListener('touchend',resumeWithGesture,{passive:true});
document.addEventListener('click',resumeWithGesture);
document.addEventListener('keydown',resumeWithGesture);
document.querySelector('.skip-link').addEventListener('click',()=>finishAssembly(true));
addEventListener('scroll',schedule,{passive:true});
addEventListener('resize',()=>{measure();schedule()},{passive:true});
addEventListener('load',()=>{if(!complete)scrollTo({top:0,behavior:'instant'});playWhenReady();measure();schedule()});
addEventListener('pageshow',event=>{
  if(event.persisted&&!reducedMotion.matches)startNewVisit();
  else if(!complete){scrollTo({top:0,behavior:'instant'});resumeVisibleAssembly()}
  measure();schedule();
});
document.addEventListener('visibilitychange',()=>{
  syncOutroPlayback();
  if(document.hidden){stopAssemblyPlayback();idle.pause()}
  else if(!complete)resumeVisibleAssembly();
  else schedule();
});
addEventListener('focus',resumeVisibleAssembly);
addEventListener('online',()=>{
  if(!complete&&!document.hidden&&!gestureRequired){
    recoveryCount=0;playAssembly(true);
  }
});
new ResizeObserver(()=>{measure();schedule()}).observe(content);
document.fonts.ready.then(()=>{measure();schedule()});
reducedMotion.addEventListener('change',()=>{
  syncOutroPlayback();
  if(reducedMotion.matches){video.pause();idle.pause();if(!complete)finishAssembly(true);useStill()}
  replay.hidden=reducedMotion.matches;measure();schedule();
});
function startNewVisit(){
  // A refresh must not restore a finished card or jump past assembly via an anchor.
  history.scrollRestoration='manual';
  if(location.hash)history.replaceState(history.state,'',location.pathname+location.search);
  replayAssembly();
}
if(reducedMotion.matches){finishAssembly(true)}else{startNewVisit()}
document.querySelectorAll('a[href="#contact"]').forEach(link=>link.addEventListener('click',event=>{
  event.preventDefault();history.pushState(null,'','#contact');
  scrollTo({top:root.scrollHeight-innerHeight,behavior:reducedMotion.matches?'instant':'smooth'});
}));
document.querySelector('#year').textContent=new Date().getFullYear();
measure();renderScroll();
if(reducedMotion.matches&&location.hash==='#contact')addEventListener('load',()=>scrollTo({top:root.scrollHeight-innerHeight,behavior:'instant'}),{once:true});

const galleries=JSON.parse(document.querySelector('#gallery-data').textContent);
const dialog=document.querySelector('#image-dialog');
let activeGallery=null,activeIndex=0,lastTrigger=null;
function showDialogImage(){
  const image=activeGallery.images[activeIndex];
  const el=document.querySelector('#dialog-image');el.src=`assets/${image.src}`;el.alt=image.alt;
  document.querySelector('#dialog-title').textContent=`${activeGallery.name} / ${String(activeIndex+1).padStart(2,'0')} of ${String(activeGallery.images.length).padStart(2,'0')}`;
  document.querySelector('#dialog-caption').textContent=image.caption;
}
for(const gallery of galleries){
  const el=document.querySelector(`[data-gallery="${gallery.id}"]`);let index=0;
  function show(n){index=(n+gallery.images.length)%gallery.images.length;const im=gallery.images[index],main=el.querySelector('[data-main-image]');main.src=`assets/${im.src}`;main.alt=im.alt;main.className=im.fit;el.querySelector('[data-caption]').textContent=im.caption;el.querySelector('[data-counter]').textContent=`${String(index+1).padStart(2,'0')} / ${String(gallery.images.length).padStart(2,'0')}`;el.querySelectorAll('[data-image]').forEach((b,i)=>b.setAttribute('aria-pressed',String(index===i)))}
  el.querySelector('[data-prev]').addEventListener('click',()=>show(index-1));
  el.querySelector('[data-next]').addEventListener('click',()=>show(index+1));
  el.querySelectorAll('[data-image]').forEach(b=>b.addEventListener('click',()=>show(Number(b.dataset.image))));
  el.querySelector('.gallery-open').addEventListener('click',event=>{lastTrigger=event.currentTarget;activeGallery=gallery;activeIndex=index;showDialogImage();dialog.showModal()});
}
document.querySelector('#close-dialog').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>lastTrigger?.focus());
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()}});
function stepImage(d){activeIndex=(activeIndex+d+activeGallery.images.length)%activeGallery.images.length;showDialogImage()}
document.querySelector('#dialog-prev').addEventListener('click',()=>stepImage(-1));
document.querySelector('#dialog-next').addEventListener('click',()=>stepImage(1));
dialog.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();stepImage(-1)}if(event.key==='ArrowRight'){event.preventDefault();stepImage(1)}});
