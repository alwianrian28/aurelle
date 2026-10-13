import * as THREE from 'three';
import {createRing} from './ring-model.js';
import {brilliantGeometry,makeStudioMap} from './diamond.js';
import {sampleMotion} from './motion.js';

export function mountShowroom(host,{onError=()=>{},onReady=()=>{}}={}){
 let renderer;try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});}catch(e){onError(e);return null;}
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,innerWidth<760?1.15:1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.setClearColor('#f8f5ef',0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','Cincin Aurelle dengan detail facet dan pavé yang dikendalikan scroll');host.appendChild(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.035,100);
 const map=makeStudioMap(),pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromEquirectangular(map);pmrem.dispose();scene.environment=env.texture;
 const ring=createRing({environment:map,bounces:innerWidth<760?4:7});scene.add(ring);
 const {centerStone,metal,stones,basicStone}=ring.userData.parts;const detailedMaterial=centerStone.material,detailedPave=stones.material;
 const fallbackMaterial=new THREE.MeshPhysicalMaterial({color:'#ffffff',metalness:0,roughness:.018,transmission:.96,ior:2.417,thickness:.59,dispersion:.025,envMapIntensity:1.2});
 const light=new THREE.DirectionalLight('#fff4de',1);light.position.set(-6,10,10);light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:.5,far:32});light.shadow.bias=-.00004;light.shadow.normalBias=.012;scene.add(light);
 const edge=new THREE.DirectionalLight('#e6eeff',.5);edge.position.set(4,2,-4);scene.add(edge);
 const point=new THREE.PointLight('#fffaf2',1.5,12,2);point.position.set(-2,3,1);scene.add(point);
 const cloud=new THREE.Group();scene.add(cloud);const fragments=[];
 const cloudGeometry=brilliantGeometry(.30,.20,{detailed:false}),cloudMaterial=new THREE.MeshPhysicalMaterial({color:'#ffffff',metalness:0,roughness:.025,transmission:.9,ior:2.417,thickness:.35,envMapIntensity:1.4});
 for(let i=0;i<18;i++){
  const gem=new THREE.Mesh(cloudGeometry,cloudMaterial);const angle=i*2.399963,rad=1.1+(i%5)*.27;
  const base=new THREE.Vector3(Math.cos(angle)*rad,1.85+Math.sin(angle)*1.1,(i%5-2)*.46);
  const size=.16+(i%4)*.10;gem.scale.setScalar(size);cloud.add(gem);fragments.push({gem,base,size,angle});
 }
 // A soft contact shadow grounds the ring only as the complete form is revealed.
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),gradient=ctx.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,'rgba(80,57,26,.28)');gradient.addColorStop(.5,'rgba(80,57,26,.09)');gradient.addColorStop(1,'rgba(80,57,26,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
 const shadowTex=new THREE.CanvasTexture(c),shadow=new THREE.Mesh(new THREE.PlaneGeometry(3.8,2.6),new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-1.34;scene.add(shadow);
 let progress=0,disposed=false,visible=true,pending=false,frame=0,shaderFailed=false,fallbackApplied=false,simple=false,prepared=false,readinessScheduled=false,readyFrame=0;
 const target=new THREE.Vector3();
 metal.traverse(o=>{if(o.isMesh){o.castShadow=!o.isInstancedMesh;o.receiveShadow=true;}});
 renderer.debug.onShaderError=()=>{shaderFailed=true;};
 function draw(){pending=false;if(disposed||!prepared||!visible||document.hidden)return;
  const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;const mobile=w<760,m=sampleMotion(progress,mobile);
  ring.rotation.set(...m.rotation);centerStone.position.y=1.43+m.lift;metal.visible=m.modelProgress>.105;
  ring.updateMatrixWorld(true);target.set(...m.target).applyMatrix4(ring.matrixWorld);
  camera.position.copy(target).add(new THREE.Vector3(...m.offset));camera.lookAt(target);
  camera.setViewOffset(w,h,-w*m.align,mobile?h*.19:0,w,h);
  for(const f of fragments){f.gem.visible=m.cloud>.01;f.gem.position.copy(f.base);f.gem.position.x+=Math.sin(progress*3+f.angle)*.5;f.gem.position.z+=progress*.8;f.gem.rotation.set(f.angle+progress*2,f.angle*.6-progress,progress+f.angle);f.gem.scale.setScalar(f.size*m.cloud);}
  shadow.material.opacity=Math.max(0,(m.modelProgress-.65)/.35);
  try{renderer.render(scene,camera);}catch(e){onError(e);return;}
  if(shaderFailed&&!fallbackApplied){fallbackApplied=true;centerStone.material=fallbackMaterial;stones.material=basicStone;requestDraw();return;}
  if(!readinessScheduled){readinessScheduled=true;readyFrame=requestAnimationFrame(()=>{readyFrame=requestAnimationFrame(()=>{if(!disposed)onReady();});});}
 }
 function requestDraw(){if(!pending&&!disposed){pending=true;frame=requestAnimationFrame(draw);}}
 function resize(){if(disposed)return;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();requestDraw();}
 function lost(e){e.preventDefault();onError(new Error('WebGL context lost'));}
 function visibility(){if(!document.hidden)requestDraw();}
 renderer.domElement.addEventListener('webglcontextlost',lost);document.addEventListener('visibilitychange',visibility);
 const ro=new ResizeObserver(resize);ro.observe(host);const io=new IntersectionObserver(e=>{visible=e[0].isIntersecting;if(visible)requestDraw();});io.observe(host);resize();
 // Compile the full ring while covered, including materials not visible at p=0.
 renderer.compileAsync(scene,camera).then(()=>{if(!disposed){prepared=true;requestDraw();}}).catch(e=>{if(!disposed)onError(e);});
 return {setProgress(v){const next=Math.min(1,Math.max(0,v));if(next===progress)return;progress=next;requestDraw();},setQuality(low){simple=low;renderer.shadowMap.enabled=!low;centerStone.material=low||shaderFailed?fallbackMaterial:detailedMaterial;stones.material=low||shaderFailed?basicStone:detailedPave;renderer.setPixelRatio(Math.min(devicePixelRatio||1,low?1:innerWidth<760?1.15:1.5));resize();},dispose(){disposed=true;light.shadow.map?.dispose();cancelAnimationFrame(frame);cancelAnimationFrame(readyFrame);ro.disconnect();io.disconnect();document.removeEventListener('visibilitychange',visibility);renderer.domElement.removeEventListener('webglcontextlost',lost);const geos=new Set(),mats=new Set([detailedMaterial,fallbackMaterial,detailedPave,basicStone]);scene.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)mats.add(o.material);});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());shadowTex.dispose();env.dispose();map.dispose();renderer.dispose();renderer.domElement.remove();}};
}
