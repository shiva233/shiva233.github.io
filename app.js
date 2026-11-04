document.documentElement.classList.add('js');
const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const stage = document.querySelector('.intro-stage');
const video = document.querySelector('#pcb-video');
video.defaultPlaybackRate = 2.25;
video.playbackRate = 2.25;
const idle = document.querySelector('#pcb-idle');
const replay = document.querySelector('#play-animation');
const start = document.querySelector('#start-animation');
const controls = document.querySelector('.hero-controls');
let complete=false;
let watchdog, recoveryTimer, autoplayTimer, playbackGeneration=0, playAttempt=0, recoveryCount=0;
let playPending=false, autoplayRetries=0;
let resumeAt=0, lastPlaybackTime=0, lastBufferedEnd=0, gestureRequired=false;
let imagePlayback=false,idleUsesImage=false;
const assemblyImage=new PcbImagePlayer(document.querySelector('#pcb-image-animation'),'assets/pcb-reveal-fallback.webp?v=2',{
  duration:7124,onEnd:()=>finishAssembly(true),onError:()=>offerAssemblyStart(true)
});
const idleImage=new PcbImagePlayer(document.querySelector('#pcb-idle-image'),'assets/pcb-idle-fallback.webp');
function playImageAssembly(){
  if(complete||document.hidden||reducedMotion.matches)return;
  imagePlayback=true;stopAssemblyPlayback();
  start.hidden=true;stage.classList.remove('autoplay-blocked');
  assemblyImage.play();
}
function useStill(){stage.classList.add('use-still');stage.classList.remove('idle-playing')}
async function playIdle(){
  if(reducedMotion.matches||!complete||document.hidden)return;
  if(imagePlayback||idleUsesImage){idleUsesImage=true;useStill();idleImage.play();return}
  const generation=playbackGeneration;
  try{
    await idle.play();
    const reveal=()=>{if(complete&&!document.hidden&&!reducedMotion.matches&&generation===playbackGeneration){stage.classList.add('idle-playing');stage.classList.remove('use-still')}};
    if(idle.requestVideoFrameCallback)idle.requestVideoFrameCallback(reveal);else reveal();
  }catch{
    if(!complete||generation!==playbackGeneration)return;
    useStill();idleUsesImage=true;
    if(!document.hidden)idleImage.play();
  }
}
function finishAssembly(fallback=false){
  if(complete)return;
  complete=true;stopAssemblyPlayback();assemblyImage.pause();
  root.classList.remove('intro-locked');
  stage.classList.remove('autoplay-blocked');stage.classList.add('assembly-ready');
  start.hidden=true;controls.hidden=false;
  if(fallback||reducedMotion.matches)useStill();
  replay.hidden=reducedMotion.matches;
  if(!reducedMotion.matches)playIdle();
}
function offerAssemblyStart(retry=false){
  stopAssemblyPlayback();assemblyImage.pause();
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
  if(imagePlayback||complete||document.hidden||recoveryTimer!==undefined||!start.hidden)return;
  stopAssemblyPlayback();
  if(recoveryCount>=2){playImageAssembly();return}
  recoveryCount++;
  recoveryTimer=setTimeout(()=>{recoveryTimer=undefined;playAssembly(true)},500*recoveryCount);
}
function retryAutoplay(){
  clearTimeout(watchdog);
  // A new tab can reject play() before its visibility/layout has settled.
  // Retry the video briefly before switching to the image animation.
  const delays=[250,750,1500];
  if(autoplayRetries>=delays.length){playImageAssembly();return}
  autoplayTimer=setTimeout(()=>{autoplayTimer=undefined;playAssembly()},delays[autoplayRetries++]);
}
function playWhenReady(){
  if(!imagePlayback&&!complete&&!document.hidden&&!gestureRequired&&autoplayTimer===undefined&&recoveryTimer===undefined)playAssembly();
}
async function playAssembly(reload=false,fromGesture=false){
  if(reducedMotion.matches){finishAssembly(true);return}
  if(imagePlayback){playImageAssembly();return}
  // Never spend the opening (or its loading timeout) in a background tab.
  if(document.hidden||complete)return;
  if(playPending&&!reload&&!fromGesture)return;
  if(!video.paused&&!reload&&!fromGesture)return;
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
  video.defaultPlaybackRate=2.25;video.playbackRate=2.25;
  start.hidden=true;stage.classList.remove('autoplay-blocked');
  watchPlayback();
  // Request playback even at HAVE_NOTHING. Mobile Safari may only preload
  // metadata until play() is called, so waiting for canplaythrough deadlocks.
  // The promise stays pending while the browser loads enough data to start.
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
  assemblyImage.pause();idleImage.pause();
  resumeAt=0;lastPlaybackTime=0;lastBufferedEnd=0;
  playbackGeneration++;complete=false;idle.pause();idle.currentTime=0;
  controls.hidden=true;start.hidden=true;
  stage.classList.remove('assembly-ready','idle-playing','use-still','autoplay-blocked');
  scrollTo({top:0,behavior:'instant'});
  root.classList.add('intro-locked');
  video.currentTime=0;playAssembly();
}
video.addEventListener('ended',()=>finishAssembly());
video.addEventListener('error',recoverAssembly);
video.addEventListener('loadedmetadata',()=>{
  if(resumeAt>0){video.currentTime=resumeAt;lastPlaybackTime=resumeAt;resumeAt=0}
});
for(const event of ['loadeddata','canplay','canplaythrough'])video.addEventListener(event,playWhenReady);
video.addEventListener('playing',()=>{
  if(imagePlayback||complete||document.hidden){stopAssemblyPlayback();return}
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
  if(imagePlayback)return;
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
replay.addEventListener('click',replayAssembly);
start.addEventListener('click',()=>{recoveryCount=0;autoplayRetries=0;playAssembly(!gestureRequired,true)});
function resumeVisibleAssembly(){
  if(imagePlayback){playImageAssembly();return}
  if(complete||document.hidden||playPending||!video.paused)return;
  autoplayRetries=0;playAssembly();
}
// If the browser requires activation, an ordinary tap/key can unlock playback;
// visitors do not have to find the fallback button specifically.
function resumeWithGesture(event){
  if(event.isTrusted&&event.target!==start&&!complete&&!document.hidden&&(gestureRequired||autoplayTimer!==undefined||playPending||video.paused)){
    autoplayRetries=0;playAssembly(false,true);
  }
}
document.addEventListener('touchend',resumeWithGesture,{passive:true});
document.addEventListener('click',resumeWithGesture);
document.addEventListener('keydown',resumeWithGesture);
document.querySelector('.skip-link').addEventListener('click',()=>{finishAssembly(true);controls.focus()});
addEventListener('load',()=>{if(!complete)scrollTo({top:0,behavior:'instant'});playWhenReady()});
addEventListener('pageshow',event=>{
  if(event.persisted&&!reducedMotion.matches)startNewVisit();
  else if(!complete){scrollTo({top:0,behavior:'instant'});resumeVisibleAssembly()}
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){stopAssemblyPlayback();idle.pause();assemblyImage.pause();idleImage.pause()}
  else if(!complete)resumeVisibleAssembly();
  else playIdle();
});
addEventListener('focus',resumeVisibleAssembly);
addEventListener('online',()=>{
  if(!complete&&!document.hidden&&!gestureRequired){
    recoveryCount=0;playAssembly(true);
  }
});
reducedMotion.addEventListener('change',()=>{
  if(reducedMotion.matches){video.pause();idle.pause();assemblyImage.pause();idleImage.pause();if(!complete)finishAssembly(true);useStill()}
  replay.hidden=reducedMotion.matches;
  if(!reducedMotion.matches&&complete)playIdle();
});
function startNewVisit(){
  // A refresh must not restore a finished card or jump past assembly via an anchor.
  history.scrollRestoration='manual';
  if(location.hash)history.replaceState(history.state,'',location.pathname+location.search);
  replayAssembly();
}
if(reducedMotion.matches){finishAssembly(true)}else{startNewVisit()}
