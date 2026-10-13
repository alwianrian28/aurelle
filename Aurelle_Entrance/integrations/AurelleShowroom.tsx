import {useEffect, useRef} from 'react';
import {initExperience} from '../src/experience.js';
import {showroomMarkup} from '../src/markup.js';
import {mountEntrance} from '../src/entrance.js';
import '../dist/style.css';

type Props = {storeUrl: string; posterUrl?: string};
/** Full-screen brand entrance. Place it on the root route, with your store on /store. */
export default function AurelleShowroom({storeUrl, posterUrl='/ring-poster.png'}: Props){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const root=ref.current;if(!root)return;
  const poster=root.querySelector<HTMLImageElement>('.poster');if(poster)poster.src=posterUrl;
  let cleanup: (()=>void)|undefined,abandoned=false;
  const fallback=()=>{abandoned=true;cleanup?.();root.classList.add('webgl-failed');};
  const entrance=mountEntrance(root,{onFallback:fallback,storeUrl});
  try{cleanup=initExperience(root,{storeUrl,onReady:()=>entrance.ready('render'),onError:()=>entrance.fallback('render-error')});if(abandoned)fallback();else entrance.ready('ui');}catch{entrance.fallback('render-error');}
  return ()=>{entrance.dispose();cleanup?.();};
 },[storeUrl,posterUrl]);
 return <div ref={ref} id="aurelle" dangerouslySetInnerHTML={{__html:showroomMarkup}}/>;
}
