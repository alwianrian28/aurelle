import {createLoadingGate} from './loading-gate.js';

/** Lightweight entrance; can run before importing GSAP or Three.js. */
export function mountEntrance(root,{onFallback=()=>{},onOpen=()=>{}}={}){
 const overlay=root.querySelector('.entrance'),content=root.querySelector('.experience-content');
 if(!overlay||!content)return {ready(){},fallback(){},dispose(){}};
 clearTimeout(window.__aurelleEntranceWatchdog);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const lang='en';
 root.lang=lang;
 const previous={htmlOverflow:document.documentElement.style.overflow,bodyOverflow:document.body.style.overflow,bodyPadding:document.body.style.paddingRight,inert:content.inert,busy:content.getAttribute('aria-busy'),focus:document.activeElement};
 const gap=innerWidth-document.documentElement.clientWidth;
 if(gap>0)document.body.style.paddingRight=`${parseFloat(getComputedStyle(document.body).paddingRight)+gap}px`;
 document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';
 content.inert=true;content.setAttribute('aria-busy','true');overlay.hidden=false;overlay.focus({preventScroll:true});
 let disposed=false,opened=false,exitTimer;const events=[];
 function listen(el,type,fn){el.addEventListener(type,fn);events.push(()=>el.removeEventListener(type,fn));}
 function unlock(){document.documentElement.style.overflow=previous.htmlOverflow;document.body.style.overflow=previous.bodyOverflow;document.body.style.paddingRight=previous.bodyPadding;content.inert=previous.inert;if(previous.busy===null)content.removeAttribute('aria-busy');else content.setAttribute('aria-busy',previous.busy);}
 function open(){if(disposed||opened)return;opened=true;clearTimeout(exitTimer);overlay.hidden=true;overlay.classList.remove('entrance--leaving');unlock();root.dataset.loading='complete';
  if(overlay.contains(document.activeElement)){if(previous.focus?.isConnected&&previous.focus!==document.body)previous.focus.focus({preventScroll:true});else content.focus({preventScroll:true});}
  window.dispatchEvent(new Event('resize'));onOpen();
 }
 const gate=createLoadingGate({onResolve:result=>{if(disposed)return;root.dataset.loading=result.state;if(result.state==='fallback')onFallback(result.reason);
  if(reduced){open();return;}overlay.classList.add('entrance--leaving');exitTimer=setTimeout(open,900);
 }});
 listen(overlay.querySelector('.entrance-panel--bottom'),'transitionend',e=>{if(e.propertyName==='transform'&&gate.state!=='loading')open();});
 listen(overlay,'keydown',e=>{if(e.key==='Tab')e.preventDefault();});
 Promise.resolve(document.fonts?.ready).catch(()=>{}).then(()=>{if(!disposed)gate.ready('fonts');});
 return {ready:task=>gate.ready(task),fallback:reason=>gate.fallback(reason),dispose(){disposed=true;gate.dispose();clearTimeout(exitTimer);events.forEach(f=>f());unlock();overlay.hidden=true;overlay.classList.remove('entrance--leaving');}};
}
