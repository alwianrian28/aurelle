import * as THREE from 'three';
import {createRing} from './ring-model.js';
import {brilliantGeometry,diamondMaterial,bindDiamond,makeStudioMap} from './diamond.js';
import {sampleMotion} from './motion.js';

// Shots in motion.js were authored for a 34° lens. A longer macro lens keeps
// the same framing at a greater distance, removing wide-angle distortion.
const AUTHORED_FOV=34;
const LENS={desktop:24,mobile:27};
const lensFactor=fov=>Math.tan(AUTHORED_FOV*Math.PI/360)/Math.tan(fov*Math.PI/360);
const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};

export function mountShowroom(host,{onError=()=>{}}={}){
 let renderer;try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:!!globalThis.AURELLE_CAPTURE});}catch(e){onError(e);return null;}
 const small=innerWidth<760;
 const ratio=low=>Math.min(devicePixelRatio||1,low?1:small?1.5:2);
 renderer.setPixelRatio(ratio(false));
 // Linear shading -> Khronos PBR Neutral tone map -> sRGB, applied once for every material.
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1.0;renderer.setClearColor(0xffffff,0);
 renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','Cincin Aurelle dengan detail facet dan pavé yang dikendalikan scroll');host.appendChild(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(LENS.desktop,1,.05,100);

 // Metal is lit by the bright product studio (PMREM). Stones trace a diamond-photography version of the
// same set: same softboxes and flags, dimmer walls, deeper flags, extra hard pin lights.
 const metalStudio=makeStudioMap({width:2048,surround:.7,metal:true});
 const pmrem=new THREE.PMREMGenerator(renderer),envRT=pmrem.fromEquirectangular(metalStudio);pmrem.dispose();metalStudio.dispose();scene.environment=envRT.texture;
 const studio=makeStudioMap({width:small?1024:2048,surround:.55,stone:true});

 const ring=createRing({environment:studio,bounces:small?6:10,paveBounces:small?2:3});scene.add(ring);
 const {centerStone,stones,basicStone}=ring.userData.parts,stoneY=ring.userData.stoneY;
 const fragGeo=brilliantGeometry(1,1,{detailed:false});
 const variants={
  high:{center:centerStone.material,pave:stones.material,frag:diamondMaterial(fragGeo,studio,{bounces:small?2:3})},
  low:{center:diamondMaterial(centerStone.geometry,studio,{bounces:3,dispersion:false,seat:1}),pave:diamondMaterial(stones.geometry,studio,{bounces:1,dispersion:false,seat:1}),frag:diamondMaterial(fragGeo,studio,{bounces:1,dispersion:false})},
  fallback:{center:new THREE.MeshPhysicalMaterial({name:'Primary_diamond_fallback',color:'#ffffff',metalness:0,roughness:.015,transmission:.96,ior:2.417,thickness:.45,dispersion:.025}),pave:basicStone,frag:basicStone}
 };

 // Loose stones for "Floating light": the same cut and optics as the centre stone.
 const FRAGMENTS=10,fragments=new THREE.InstancedMesh(fragGeo,variants.high.frag,FRAGMENTS);fragments.name='Floating_loose_diamonds';fragments.frustumCulled=false;
 bindDiamond(fragments,{radius:.09,lodRef:260});scene.add(fragments);
 const fragData=[];for(let i=0;i<FRAGMENTS;i++){const angle=i*2.399963,rad=.7+(i%3)*.2;fragData.push({angle,size:.045+(i%4)*.02,base:new THREE.Vector3(.4+Math.cos(angle)*rad,1.95+Math.sin(angle)*.55,(i%5-2)*.4)});}
 const dummy=new THREE.Object3D();

 let progress=0,disposed=false,visible=true,pending=false,frame=0,shaderFailed=false,fallbackApplied=false,quality='high';
 const target=new THREE.Vector3(),offset=new THREE.Vector3();
 renderer.debug.onShaderError=(gl,program,vs,fs)=>{shaderFailed=true;console.warn('Aurelle: stone shader failed, using fallback material.',gl.getShaderInfoLog(fs)||gl.getShaderInfoLog(vs));};
 function apply(){const set=shaderFailed?variants.fallback:variants[quality];centerStone.material=set.center;stones.material=set.pave;fragments.material=set.frag;}

 function draw(){pending=false;if(disposed||(!globalThis.AURELLE_CAPTURE&&(!visible||document.hidden)))return;
  const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
  const mobile=w<760,m=sampleMotion(progress,mobile),fov=mobile?LENS.mobile:LENS.desktop;
  if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}
  ring.rotation.set(...m.rotation);centerStone.position.y=stoneY+m.lift;
  // Light leaving the pavilion meets the gold setting only once the stone is seated.
  const seated=1-sm(0,.22,m.lift);for(const s of [variants.high,variants.low])s.center.uniforms.seatAmount.value=seated*.55;
  ring.updateMatrixWorld(true);target.set(...m.target).applyMatrix4(ring.matrixWorld);
  offset.set(...m.offset).multiplyScalar(lensFactor(fov));
  camera.position.copy(target).add(offset);camera.lookAt(target);
  camera.setViewOffset(w,h,-w*m.align,mobile?h*.19:0,w,h);
  fragments.visible=m.cloud>.01;
  if(fragments.visible){
   fragData.forEach((f,i)=>{
    dummy.position.copy(f.base);dummy.position.x+=Math.sin(progress*3+f.angle)*.25;dummy.position.z+=progress*.6;
    dummy.rotation.set(f.angle+progress*1.2,f.angle*.6-progress*.8,progress*.6+f.angle);dummy.scale.setScalar(f.size*m.cloud);
    dummy.updateMatrix();fragments.setMatrixAt(i,dummy.matrix);
   });
   fragments.instanceMatrix.needsUpdate=true;
  }
  renderer.render(scene,camera);
  if(shaderFailed&&!fallbackApplied){fallbackApplied=true;apply();requestDraw();}
 }
 function requestDraw(){if(!pending&&!disposed){pending=true;frame=requestAnimationFrame(draw);}}
 function resize(){if(disposed)return;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();requestDraw();}
 function lost(e){e.preventDefault();onError(new Error('WebGL context lost'));}
 function visibility(){if(!document.hidden)requestDraw();}
 renderer.domElement.addEventListener('webglcontextlost',lost);document.addEventListener('visibilitychange',visibility);
 const ro=new ResizeObserver(resize);ro.observe(host);const io=new IntersectionObserver(e=>{visible=e[0].isIntersecting;if(visible)requestDraw();});io.observe(host);resize();
 return {
  setProgress(v){const next=Math.min(1,Math.max(0,v));if(next===progress)return;progress=next;requestDraw();},
  setQuality(low){quality=low?'low':'high';apply();renderer.setPixelRatio(ratio(low));resize();},
  renderNow(){pending=false;cancelAnimationFrame(frame);draw();return renderer.domElement;},
  dispose(){disposed=true;cancelAnimationFrame(frame);ro.disconnect();io.disconnect();document.removeEventListener('visibilitychange',visibility);renderer.domElement.removeEventListener('webglcontextlost',lost);
   const geos=new Set(),mats=new Set();for(const s of Object.values(variants))for(const m of Object.values(s))mats.add(m);
   scene.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)mats.add(o.material);});
   geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());fragments.dispose();envRT.dispose();studio.dispose();renderer.dispose();renderer.domElement.remove();}
 };
}
