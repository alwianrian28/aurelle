import {initExperience} from './experience.js';
import {showroomMarkup} from './markup.js';
const root=document.querySelector('#aurelle');
if(root){
 // Ambroise François Std is served by Adobe Fonts: pass the project kit id as data-typekit="abc1234".
 if(root.dataset.typekit&&!document.querySelector('link[data-aurelle-typekit]')){const l=document.createElement('link');l.rel='stylesheet';l.href=`https://use.typekit.net/${root.dataset.typekit}.css`;l.dataset.aurelleTypekit='';document.head.append(l);}
 if(!root.querySelector('.showroom'))root.innerHTML=showroomMarkup;
 // Self-contained builds expose inlined assets as window.__resources (blob URLs); dev/production use paths.
 const res=globalThis.__resources||{};
 root.querySelectorAll('[data-asset]').forEach(i=>{if(res.monogram)i.src=res.monogram;else if(root.dataset.assetBase)i.src=root.dataset.assetBase+i.dataset.asset;});
 const poster=root.querySelector('.poster');
 if(poster){if(res.poster)poster.src=res.poster;else if(root.dataset.poster)poster.src=root.dataset.poster;poster.addEventListener('error',()=>poster.remove(),{once:true});}
 initExperience(root,{storeUrl:root.dataset.storeUrl||'./store.html'});
}
