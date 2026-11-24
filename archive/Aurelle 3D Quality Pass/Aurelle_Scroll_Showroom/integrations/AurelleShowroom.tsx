import {useEffect, useRef} from 'react';
import {initExperience} from '../src/experience.js';
import {showroomMarkup} from '../src/markup.js';
import '../dist/style.css';

type Props = {storeUrl: string; posterUrl?: string; assetBase?: string; typekitId?: string};
/** Full-screen brand entrance. Place it on the root route, with your store on /store. */
export default function AurelleShowroom({storeUrl, posterUrl='/ring-poster.png', assetBase='/', typekitId}: Props){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!typekitId||document.querySelector('link[data-aurelle-typekit]'))return;
  const l=document.createElement('link');l.rel='stylesheet';l.href=`https://use.typekit.net/${typekitId}.css`;l.dataset.aurelleTypekit='';document.head.append(l);
 },[typekitId]);
 useEffect(()=>{
  const root=ref.current;if(!root)return;
  root.querySelectorAll<HTMLImageElement>('[data-asset]').forEach(i=>{i.src=assetBase+i.dataset.asset;});
  const poster=root.querySelector<HTMLImageElement>('.poster');if(poster)poster.src=posterUrl;
  return initExperience(root,{storeUrl});
 },[storeUrl,posterUrl,assetBase]);
 return <div ref={ref} id="aurelle" dangerouslySetInnerHTML={{__html:showroomMarkup}}/>;
}
