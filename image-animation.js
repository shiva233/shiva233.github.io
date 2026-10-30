// Video is the efficient default. These images are fetched only if playback is
// refused, and do not depend on a browser's media-autoplay permission.
const pcbImageBlobs = new Map();
function loadPcbImage(source){
  if(!pcbImageBlobs.has(source)){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),45000);
    const pending=fetch(source,{signal:controller.signal})
      .then(response=>{if(!response.ok)throw new Error('Animation download failed');return response.blob()})
      .catch(error=>{pcbImageBlobs.delete(source);throw error})
      .finally(()=>clearTimeout(timeout));
    pcbImageBlobs.set(source,pending);
  }
  return pcbImageBlobs.get(source);
}
class PcbImagePlayer {
  constructor(image,source,{duration=0,onStart=()=>{},onEnd=()=>{},onError=()=>{}}={}){
    Object.assign(this,{image,source,duration,onStart,onEnd,onError,active:false,generation:0});
  }
  async play(){
    if(this.active)return;
    this.active=true;
    const generation=++this.generation;
    try{
      // Download first: a slow connection must not spend the animation's runtime.
      const blob=await loadPcbImage(this.source);
      if(!this.active||generation!==this.generation)return;
      // A fresh object URL restarts single-pass WebP even on replay or tab restore.
      this.url=URL.createObjectURL(blob);
      this.image.onload=()=>{
        if(!this.active||generation!==this.generation)return;
        this.image.hidden=false;this.onStart();
        if(this.duration)this.timer=setTimeout(()=>{
          if(this.active&&generation===this.generation)this.onEnd();
        },this.duration);
      };
      this.image.onerror=()=>{
        if(generation!==this.generation)return;
        this.pause();this.onError();
      };
      this.image.src=this.url;
    }catch{
      if(generation!==this.generation)return;
      this.pause();this.onError();
    }
  }
  pause(){
    this.active=false;this.generation++;
    clearTimeout(this.timer);this.timer=undefined;
    this.image.onload=null;this.image.onerror=null;this.image.hidden=true;
    this.image.removeAttribute('src');
    if(this.url){URL.revokeObjectURL(this.url);this.url=undefined}
  }
}
