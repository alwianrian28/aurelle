import assert from 'node:assert/strict';
import {createLoadingGate} from '../src/loading-gate.js';
import {mountEntrance} from '../src/entrance.js';

function clock(){let now=0,id=0;const jobs=new Map();return {setTimer(fn,delay){jobs.set(++id,{fn,at:now+delay});return id;},clearTimer(id){jobs.delete(id);},advance(ms){const end=now+ms;while(true){const job=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!job)break;now=job[1].at;jobs.delete(job[0]);job[1].fn();}now=end;},get size(){return jobs.size;}};}
for(const order of [['render','fonts','ui'],['ui','render','fonts'],['fonts','ui','render']]){
 const c=clock(),calls=[],g=createLoadingGate({onResolve:r=>calls.push(r),...c});
 g.ready(order[0]);g.ready(order[0]);g.ready('unknown');g.ready(order[1]);assert.equal(calls.length,0,'Cannot reveal before every required task');
 g.ready(order[2]);assert.deepEqual(calls,[{state:'ready',reason:'rendered'}]);g.fallback();c.advance(20000);assert.equal(calls.length,1);assert.equal(c.size,0);
}
for(const reason of ['timeout','module-error','skipped']){
 const c=clock(),calls=[],g=createLoadingGate({onResolve:r=>calls.push(r),...c});g.ready('ui');if(reason==='timeout')c.advance(12000);else g.fallback(reason);
 g.ready('fonts');g.ready('render');assert.deepEqual(calls,[{state:'fallback',reason}]);assert.equal(c.size,0);
}
{const c=clock(),calls=[],g=createLoadingGate({onResolve:r=>calls.push(r),...c});g.dispose();g.ready('render');c.advance(20000);assert.equal(calls.length,0);assert.equal(c.size,0);}

// DOM contract checks; this is not a browser visual/performance test.
function fixture(reduced=false){
 const c=clock();
 class Node{constructor(){this.hidden=false;this.attrs=new Map();this.listeners=new Map();this.style={};this.children=[];this.inert=false;this.isConnected=true;const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)};}
  addEventListener(type,fn){this.listeners.set(type,fn);}removeEventListener(type){this.listeners.delete(type);}getAttribute(k){return this.attrs.get(k)??null;}setAttribute(k,v){this.attrs.set(k,v);}removeAttribute(k){this.attrs.delete(k);}focus(){document.activeElement=this;}contains(n){return n===this||this.children.includes(n);}}
 const overlay=new Node(),content=new Node(),status=new Node(),skip=new Node(),store=new Node(),panel=new Node(),root=new Node();skip.hidden=true;overlay.children=[skip,store,panel];
 overlay.querySelector=s=>({'[data-loading-label]':status,'[data-loading-skip]':skip,'[data-loading-store]':store,'.entrance-panel--bottom':panel}[s]);overlay.querySelectorAll=()=>[skip,store];
 root.querySelector=s=>({'.entrance':overlay,'.experience-content':content}[s]);root.dataset={};
 const body=new Node(),html=new Node();body.style={overflow:'auto',paddingRight:'2px'};html.style={overflow:'visible'};html.clientWidth=1000;
 Object.assign(globalThis,{document:{body,documentElement:html,activeElement:body,fonts:{ready:Promise.resolve()}},window:{dispatchEvent(){}},innerWidth:1015,matchMedia:()=>({matches:reduced}),getComputedStyle:()=>({paddingRight:'2px'}),localStorage:{getItem:()=>null},setTimeout:c.setTimer,clearTimeout:c.clearTimer});
 return {c,root,overlay,content,skip,store,panel,body,html};
}
const originals=Object.fromEntries(['document','window','innerWidth','matchMedia','getComputedStyle','localStorage','setTimeout','clearTimeout'].map(k=>[k,globalThis[k]]));
try{
 {const f=fixture(),p=mountEntrance(f.root,{storeUrl:'/shop'});assert.equal(f.store.href,'/shop');assert.equal(f.content.inert,true);assert.equal(f.body.style.overflow,'hidden');
  p.ready('ui');p.ready('render');await Promise.resolve();await Promise.resolve();assert.equal(f.overlay.hidden,false,'Curtain remains during exit');f.c.advance(900);
  assert.equal(f.overlay.hidden,true);assert.equal(f.content.inert,false);assert.equal(f.body.style.overflow,'auto');assert.equal(f.html.style.overflow,'visible');assert.equal(f.body.style.paddingRight,'2px');assert.equal(document.activeElement,f.content);p.dispose();assert.equal(f.c.size,0);
 }
 {const f=fixture(true),p=mountEntrance(f.root);p.ready('ui');p.ready('render');await Promise.resolve();await Promise.resolve();assert.equal(f.overlay.hidden,true,'Reduced motion skips curtain');p.dispose();}
 {const f=fixture(),reasons=[],p=mountEntrance(f.root,{onFallback:r=>reasons.push(r)});f.c.advance(6000);assert.equal(f.skip.hidden,false);f.skip.listeners.get('click')();f.c.advance(900);assert.deepEqual(reasons,['skipped']);assert.equal(f.content.inert,false);p.ready('render');p.dispose();assert.equal(f.c.size,0);}
 {const f=fixture(),p=mountEntrance(f.root);p.dispose();f.c.advance(20000);assert.equal(f.body.style.overflow,'auto');assert.equal(f.content.inert,false);assert.equal(f.c.size,0,'Unmount removes timers');}
}finally{Object.assign(globalThis,originals);}
console.log('PASS: real-readiness gate, one-shot timeout/error fallback, reduced motion, curtain unlock, custom store URL, focus and unmount cleanup.');
