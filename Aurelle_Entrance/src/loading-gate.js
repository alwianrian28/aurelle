/** Resolve once: actual readiness signals, explicit fallback, or deadline. */
export function createLoadingGate({onResolve,timeoutMs=12000,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 const pending=new Set(['ui','fonts','render']);let state='loading';
 const timer=setTimer(()=>finish('fallback','timeout'),timeoutMs);
 function finish(next,reason){if(state!=='loading')return;state=next;clearTimer(timer);onResolve?.({state,reason});}
 return {
  ready(task){if(state!=='loading'||!pending.has(task))return;pending.delete(task);if(!pending.size)finish('ready','rendered');},
  fallback(reason='unavailable'){finish('fallback',reason);},
  dispose(){if(state==='loading'){state='disposed';clearTimer(timer);}},
  get state(){return state;}
 };
}
