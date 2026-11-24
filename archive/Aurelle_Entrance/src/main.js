import {mountEntrance} from './entrance.js';
const root=document.querySelector('#aurelle');
if(root){
 let cleanup,abandoned=false;
 const showFallback=()=>{abandoned=true;cleanup?.();root.classList.add('webgl-failed');const s=root.querySelector('.status');if(s)s.textContent=root.lang==='en'?'Explore Aurelle with the product preview.':'Jelajahi Aurelle melalui pratinjau produk.';};
 const entrance=mountEntrance(root,{onFallback:showFallback});
 // Give the lightweight entrance a painted frame before initializing WebGL.
 requestAnimationFrame(()=>requestAnimationFrame(async()=>{
  try{const {initExperience}=await import('./experience.js');if(abandoned)return;
   cleanup=initExperience(root,{storeUrl:root.dataset.storeUrl||'./store.html',onReady:()=>entrance.ready('render'),onError:()=>entrance.fallback('render-error')});
   if(abandoned){showFallback();return;}entrance.ready('ui');
  }catch{entrance.fallback('module-error');}
 }));
 window.addEventListener('pagehide',e=>{if(!e.persisted){entrance.dispose();cleanup?.();}});
}
