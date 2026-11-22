/* Self-contained preview controls; no notes or images are sent to another service. */
(()=>{
 const button=document.getElementById('save-pdf'),status=document.getElementById('image-status'),retry=document.getElementById('retry-images');
 if(!button||!status||!retry)return;
 let failed=[];
 const load=image=>new Promise(resolve=>{
  let timer;
  const done=ok=>{clearTimeout(timer);image.removeEventListener('load',loaded);image.removeEventListener('error',errored);resolve(ok);};
  const loaded=()=>done(image.naturalWidth>0),errored=()=>done(false);
  if(image.complete){done(image.naturalWidth>0);return;}
  image.addEventListener('load',loaded,{once:true});image.addEventListener('error',errored,{once:true});timer=setTimeout(()=>done(false),15000);
 });
 async function prepare(){
  button.disabled=true;retry.hidden=true;status.className='';status.textContent='Preparing images…';
  const images=Array.from(document.querySelectorAll('main img'));
  const results=await Promise.all(images.map(load));
  failed=images.filter((image,index)=>!results[index]);
  for(const image of images){
   const fallback=image.nextElementSibling;
   if(fallback?.classList.contains('missing-image'))fallback.remove();
   image.hidden=failed.includes(image);
   if(image.hidden){const note=document.createElement('span');note.className='missing-image';note.textContent='Image unavailable'+(image.alt?': '+image.alt:'');image.after(note);}
  }
  if(document.fonts?.ready)await document.fonts.ready;
  status.textContent=failed.length?failed.length+' image'+(failed.length===1?' could':'s could')+' not be loaded. Retry or print with the marked placeholders.':'Ready to save. The print dialog shows the final page breaks.';
  status.className=failed.length?'image-status':'';retry.hidden=!failed.length;button.disabled=false;
 }
 retry.addEventListener('click',()=>{for(const image of failed){const src=image.src;image.removeAttribute('src');image.src=src;}void prepare();});
 button.addEventListener('click',()=>window.print());
 void prepare();
})();
