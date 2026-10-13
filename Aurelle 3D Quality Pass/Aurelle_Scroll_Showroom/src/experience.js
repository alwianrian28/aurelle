import gsap from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {mountShowroom} from './scene.js';
import {CHAPTERS} from './motion.js';
const lastChapter=CHAPTERS.length-1;
gsap.registerPlugin(ScrollTrigger);
const ui={id:{enterNav:'<span>Masuk ke</span><span>Store</span>',enter:'Masuk ke Store',scroll:'SCROLL UNTUK MENJELAJAH',replay:'Ulangi perjalanan',motion:'Kurangi gerakan',enable:'Aktifkan gerakan',quality:'Detail tinggi',light:'Mode ringan',index:'Jelajahi adegan',close:'Tutup',fallback:'Pratinjau 3D tidak tersedia pada perangkat ini.',endTitle:'Dibuat untuk<br>momen yang <em>tak terlupa.</em>',endBody:'Cincin tunangan, cincin pernikahan, dan perhiasan fine jewelry, dikerjakan dengan detail yang sama.'},en:{enterNav:'<span>Enter</span><span>the Store</span>',enter:'Enter the Store',scroll:'SCROLL TO DISCOVER',replay:'Replay the journey',motion:'Reduce motion',enable:'Enable motion',quality:'High detail',light:'Light mode',index:'Explore the scenes',close:'Close',fallback:'The 3D preview is unavailable on this device.',endTitle:'Made for the moments<br>you <em>keep.</em>',endBody:'Engagement rings, wedding bands and fine jewelry, made with the same attention to detail.'}};

export function initExperience(root,{storeUrl='./store.html'}={}){
 let language='id',simple=matchMedia('(prefers-reduced-motion: reduce)').matches,low=false,timeline,trigger,scene,active=-1,menuOpen=false;
 const stage=root.querySelector('.showroom'),canvas=root.querySelector('.scene'),status=root.querySelector('.status'),media=matchMedia('(prefers-reduced-motion: reduce)');
 const title=root.querySelector('[data-title]'),body=root.querySelector('[data-body]'),eyebrow=root.querySelector('[data-eyebrow]'),copyWrap=root.querySelector('.scene-copy');
 const counter=root.querySelector('[data-counter]'),label=root.querySelector('[data-label]'),indicator=root.querySelector('.progress-fill'),motionButton=root.querySelector('[data-motion]'),qualityButton=root.querySelector('[data-quality]');
 const menuButton=root.querySelector('[data-index]'),drawer=root.querySelector('.scene-index'),closeButton=root.querySelector('[data-close]');
 const listeners=[];function listen(el,type,f){if(!el)return;el.addEventListener(type,f);listeners.push(()=>el.removeEventListener(type,f));}
 try{language=localStorage.getItem('aurelle-language')==='en'?'en':'id';}catch{}
 root.querySelectorAll('[data-store]').forEach(a=>a.href=storeUrl);
 const nav=root.querySelector('.scene-list');nav.innerHTML=CHAPTERS.map((c,i)=>`<button type="button" data-jump="${i}"><span>${String(i+1).padStart(2,'0')}</span><span data-scene-name="${i}"></span><span aria-hidden="true">↗</span></button>`).join('');
 const dots=root.querySelector('.chapter-dots');if(dots)dots.innerHTML=CHAPTERS.map((c,i)=>`<button type="button" data-jump="${i}" class="chapter-dot"><span class="sr-only" data-scene-name="${i}"></span></button>`).join('');
 function paintChapter(index){active=index;const c=CHAPTERS[index];title.innerHTML=language==='id'?c.titleId:c.titleEn;body.textContent=language==='id'?c.bodyId:c.bodyEn;eyebrow.textContent=language==='id'?c.captionId:c.captionEn;if(label)label.textContent=language==='id'?c.idLabel:c.en;counter.textContent=String(index+1).padStart(2,'0');root.querySelectorAll('[data-jump]').forEach(b=>{b.setAttribute('aria-current',Number(b.dataset.jump)===index?'step':'false');});}
 function languageChange(lang){language=lang;root.setAttribute('lang',lang);try{localStorage.setItem('aurelle-language',lang);}catch{}root.querySelectorAll('[data-ui]').forEach(el=>el.innerHTML=ui[lang][el.dataset.ui]??'');root.querySelectorAll('[data-language]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.language===lang)));root.querySelectorAll('[data-scene-name]').forEach(el=>{const c=CHAPTERS[Number(el.dataset.sceneName)];el.textContent=lang==='id'?c.idLabel:c.en;});motionButton.textContent=simple?ui[lang].enable:ui[lang].motion;qualityButton.textContent=low?ui[lang].light:ui[lang].quality;paintChapter(Math.max(0,active));}
 root.querySelectorAll('[data-language]').forEach(el=>listen(el,'click',()=>languageChange(el.dataset.language)));
 function openMenu(open){menuOpen=open;drawer.hidden=!open;menuButton.setAttribute('aria-expanded',String(open));if(open){closeButton.focus();}else menuButton.focus();}
 listen(menuButton,'click',()=>openMenu(!menuOpen));listen(closeButton,'click',()=>openMenu(false));
 listen(drawer,'keydown',e=>{if(e.key==='Escape')openMenu(false);if(e.key==='Tab'){const focusable=Array.from(drawer.querySelectorAll('button'));const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 const state={p:0};
 function update(){const p=state.p;scene?.setProgress(p);if(indicator)indicator.style.transform=`scaleX(${p})`;
 const raw=p*lastChapter,index=Math.min(lastChapter,Math.round(raw));if(index!==active)paintChapter(index);
 const distance=Math.abs(raw-index);// The last segment ends inside the diamond (full-screen POV): copy yields to the stone.
 const handoff=gsap.utils.clamp(0,1,(p-(lastChapter-.55)/lastChapter)/(.4/lastChapter));
 const opacity=simple?1:(1-gsap.utils.clamp(0,.92,(distance-.22)/.27))*(1-handoff);copyWrap.style.opacity=String(opacity);copyWrap.style.setProperty('--copy-y',`${(1-opacity)*12}px`);
 root.dataset.scene=String(index);root.style.setProperty('--progress',String(p));root.style.setProperty('--pov',String(simple?0:handoff));
 }
 function setup(){timeline?.kill();trigger?.kill();timeline=null;trigger=null;root.classList.toggle('simple-motion',simple);
 if(simple){state.p=(lastChapter-2)/lastChapter;update();} // calm full-ring view; the final pose is a full-screen macro
 else{state.p=0;timeline=gsap.timeline({scrollTrigger:{trigger:stage,pin:true,start:'top top',end:()=>`+=${Math.round(innerHeight*lastChapter*(innerWidth<760?20/17:24/17))}`,scrub:true,anticipatePin:1,invalidateOnRefresh:true}});timeline.to(state,{p:1,duration:1,ease:'none',onUpdate:update});trigger=timeline.scrollTrigger;update();ScrollTrigger.refresh();}
 motionButton.textContent=simple?ui[language].enable:ui[language].motion;motionButton.setAttribute('aria-pressed',String(simple));
 }
 function fail(){root.classList.add('webgl-failed');status.textContent=ui[language].fallback;simple=true;if(scene)setup();}
 try{scene=mountShowroom(canvas,{onError:fail});}catch{fail();}
 if(scene)root.classList.add('three-ready');else{simple=true;fail();}
 listen(motionButton,'click',()=>{if(!scene)return;simple=!simple;setup();});listen(media,'change',e=>{simple=e.matches;setup();});
 listen(qualityButton,'click',()=>{low=!low;scene?.setQuality(low);qualityButton.textContent=low?ui[language].light:ui[language].quality;qualityButton.setAttribute('aria-pressed',String(low));});
 root.querySelectorAll('[data-jump]').forEach(b=>listen(b,'click',()=>{if(menuOpen)openMenu(false);if(simple){state.p=Number(b.dataset.jump)/lastChapter;update();return;}if(!trigger)return;window.scrollTo({top:trigger.start+(trigger.end-trigger.start)*Number(b.dataset.jump)/lastChapter,behavior:media.matches?'instant':'smooth'});}));
 root.querySelectorAll('[data-replay]').forEach(b=>listen(b,'click',()=>window.scrollTo({top:0,behavior:media.matches?'instant':'smooth'})));
 languageChange(language);setup();
 root.aurellePreview={show(p){state.p=Math.min(1,Math.max(0,p));update();scene?.renderNow?.();}};
 return ()=>{listeners.forEach(f=>f());timeline?.kill();trigger?.kill();scene?.dispose();root.classList.remove('three-ready','simple-motion','webgl-failed');};
}
