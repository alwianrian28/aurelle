import * as THREE from 'three';
import {brilliantGeometry,diamondMaterial,bindDiamond,GOLD_LINEAR} from './diamond.js';

// One scale system for every part: 1 scene unit ≈ 8.6 mm.
// Inner Ø ≈ 16.1 mm (≈ US 5½–6), band 1.8 → 2.6 mm wide, 1.25 → 1.6 mm thick,
// centre oval ≈ 8.7 × 6.3 mm, pavé ≈ 0.46 mm. Visual reference only.
export const MM_PER_UNIT=8.6;
export const STONE=Object.freeze({rx:.505,rz:.365,y:1.45});
export const PAVE=Object.freeze({radius:.027,perSide:14,row:.039,start:.851,step:.0625,channel:.072,depth:.009,bead:.0095,beadSpread:.011});
export const PRONG_ANGLES=Object.freeze([40,140,220,320]);

const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
const topWeight=a=>{const s=Math.max(0,Math.sin(a));return s*s;};
export const halfWidth=a=>.105+.045*topWeight(a);
export const halfThickness=a=>.08+.022*topWeight(a);
const INNER=.8;  // comfort-fit inner dome, relative to the outer dome height
const dome=t=>Math.pow(Math.max(0,1-Math.pow(Math.min(1,Math.abs(t)),4)),.25);
function shoulder(a){a=((a%(2*Math.PI))+2*Math.PI)%(2*Math.PI);if(a>Math.PI)return -1;return a<=Math.PI/2?a:Math.PI-a;}
export function channelDepth(a){
 const s=shoulder(a);if(s<0)return 0;
 const a0=PAVE.start-PAVE.step*(PAVE.perSide-1)-.035,a1=PAVE.start+.035;
 return PAVE.depth*sm(a0-.03,a0+.005,s)*(1-sm(a1-.005,a1+.03,s));
}
/** Radial offset of the outer surface from the r=1 centre circle (includes the pavé channel). */
export function outerOffset(a,z){
 const w=halfWidth(a),inChannel=1-sm(PAVE.channel-.0025,PAVE.channel+.0025,Math.abs(z));
 return halfThickness(a)*dome(z/w)-channelDepth(a)*inChannel;
}

function bandGeometry(major=720,uniform=80,wall=10){
 const pos=[];let ring=0;
 for(let i=0;i<major;i++){
  const a=i/major*Math.PI*2,w=halfWidth(a),h=halfThickness(a),bs=[];
  for(let j=0;j<uniform;j++)bs.push(-Math.PI+j/uniform*Math.PI*2);
  // Extra samples across both channel walls keep the bright-cut edges crisp.
  for(let j=0;j<wall;j++){const z=PAVE.channel-.005+.01*j/(wall-1),b=Math.asin(Math.min(1,(z/w)*(z/w)));bs.push(b,-b);}
  bs.sort((x,y)=>x-y);ring=bs.length;
  for(const b of bs){
   const s=Math.sin(b),c=Math.cos(b),z=w*Math.sign(s)*Math.sqrt(Math.abs(s));
   const r=c>=0?outerOffset(a,z):-INNER*h*Math.pow(Math.abs(c),2/3);
   pos.push((1+r)*Math.cos(a),(1+r)*Math.sin(a),z);
  }
 }
 const idx=[];
 for(let i=0;i<major;i++)for(let j=0;j<ring;j++){
  const A=i*ring+j,B=((i+1)%major)*ring+j,C=i*ring+(j+1)%ring,D=((i+1)%major)*ring+(j+1)%ring;
  idx.push(A,B,C,B,D,C);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
}

/** Swept tube with a radius profile, analytic normals and an optional rounded tip. */
function sweepGeometry(points,radiusAt,{segments=64,radial=20,closed=false,tip=false}={}){
 const curve=new THREE.CatmullRomCurve3(points,closed,'centripetal'),frames=curve.computeFrenetFrames(segments,closed);
 const pos=[],nor=[],idx=[],rings=[];const P=new THREE.Vector3(),n=new THREE.Vector3();
 const ringCount=closed?segments:segments+1;
 for(let i=0;i<ringCount;i++){const t=i/segments;rings.push({p:curve.getPointAt(t),r:radiusAt(t),N:frames.normals[i],B:frames.binormals[i],T:frames.tangents[i],k:1,lift:0});}
 if(tip){const e=rings[rings.length-1];for(let m=1;m<=7;m++){const f=m/7*Math.PI/2;rings.push({...e,p:e.p.clone().addScaledVector(e.T,e.r*Math.sin(f)),k:Math.cos(f),lift:Math.sin(f)});}}
 for(const R of rings)for(let k=0;k<radial;k++){
  const th=k/radial*Math.PI*2;n.copy(R.N).multiplyScalar(Math.cos(th)).addScaledVector(R.B,Math.sin(th));
  P.copy(R.p).addScaledVector(n,R.r*R.k);pos.push(P.x,P.y,P.z);
  n.multiplyScalar(Math.sqrt(1-R.lift*R.lift)).addScaledVector(R.T,R.lift).normalize();nor.push(n.x,n.y,n.z);
 }
 const L=rings.length,last=closed?L:L-1;
 for(let i=0;i<last;i++)for(let k=0;k<radial;k++){const A=i*radial+k,C=i*radial+(k+1)%radial,B=((i+1)%L)*radial+k,D=((i+1)%L)*radial+(k+1)%radial;idx.push(A,C,B,C,D,B);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setIndex(idx);return g;
}

/** Polished champagne gold. Roughness micro-variation and head occlusion are evaluated in ring space. */
// Elegant silver finish: rhodium-plated white gold, #E4E5E8 (sRGB, converted to linear by three).
export function goldMaterial({name='Polished_rhodium_white_gold',roughness=.045,polish=true,tint=1}={}){
 const m=new THREE.MeshPhysicalMaterial({name,color:0xE4E5E8,metalness:1.0,roughness,clearcoat:0.0,envMapIntensity:1});
 if(tint!==1)m.color.multiplyScalar(tint);
 if(!polish)return m;
 m.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRingPos;').replace('#include <begin_vertex>',`#include <begin_vertex>
  vec4 aurelleP=vec4(transformed,1.0);
  #ifdef USE_INSTANCING
   aurelleP=instanceMatrix*aurelleP;
  #endif
  vRingPos=aurelleP.xyz;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vRingPos;').replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
  float aRad=length(vRingPos.xy);
  float aInner=1.0-smoothstep(.95,.985,aRad);
  // Fine polishing lines following the shank; faded out by screen footprint so they never alias.
  float aPhase=vRingPos.z*1150.0+sin(atan(vRingPos.y,vRingPos.x)*38.0)*2.0;
  float aFade=1.0-smoothstep(.35,1.1,fwidth(aPhase));
  float aLow=sin(vRingPos.x*9.0+vRingPos.y*5.0)*sin(vRingPos.z*31.0+vRingPos.y*7.0);
  roughnessFactor=clamp(roughnessFactor+aInner*.03+(sin(aPhase)*.5+.5)*aFade*.03+aLow*.012,.03,.3);`).replace('#include <aomap_fragment>',`
  float aQ=length(vec2(vRingPos.x/.42,vRingPos.z/.30));
  float aHead=(1.0-smoothstep(.45,.9,aQ))*smoothstep(.9,1.04,vRingPos.y)*(1.0-smoothstep(1.3,1.42,vRingPos.y));
  reflectedLight.indirectSpecular*=1.0-.45*aHead;
  #include <aomap_fragment>`);
 };
 m.customProgramCacheKey=()=>'aurelle-gold-v8.3';
 return m;
}

export function createRing({environment=null,highQuality=true,bounces=8,paveBounces=3,dispersion=true}={}){
 const root=new THREE.Group();root.name='Aurelle_Atelier_Ring';
 const metal=new THREE.Group();metal.name='Setting_and_band';root.add(metal);
 const gold=goldMaterial();
 const seatGold=goldMaterial({name:'Recessed_pave_seats',roughness:.1,polish:false,tint:.8});
 const basicStone=new THREE.MeshPhysicalMaterial({name:'Pave_diamond_fallback',color:'#ffffff',metalness:0,roughness:.02,transmission:.94,thickness:.04,ior:2.417,dispersion:.025,envMapIntensity:1.3});

 const band=new THREE.Mesh(bandGeometry(),gold);band.name='Tapered_comfort_fit_band';metal.add(band);

 // Crossover (bypass) head. Built like a cast setting rather than bent wire:
 // - each strand starts buried inside the shank and rises out of the band top as a raised ridge,
 // - front and back strands cross in a low X that rests on the band (no floating gap),
 // - claws are ≈1.1 mm at the base tapering to ≈0.6 mm, hooked over the crown just above the girdle,
 // - an under-girdle rail ties the four claws together, as a real basket would.
 const G=deg=>{const t=deg*Math.PI/180;return [STONE.rx*Math.cos(t),STONE.rz*Math.sin(t)];};
 const at=(k,y,deg)=>{const [x,z]=G(deg);return new THREE.Vector3(x*k,y,z*k);};
 const onBand=(a,r,z)=>new THREE.Vector3(r*Math.cos(a),r*Math.sin(a),z);
 const Y=STONE.y,ROOT=.66;   // root angle from the top; the pavé starts beyond it
 const STRANDS=[[-1,1,40],[1,1,140],[1,-1,220],[-1,-1,320]];   // [root side, face, claw angle]
 STRANDS.forEach(([sx,zs,deg],i)=>{
  const zc=sx<0?.35:.2;
  const pts=[
   onBand(Math.PI/2-sx*ROOT,1.0,zs*.05),
   onBand(Math.PI/2-sx*ROOT*.62,1.085,zs*.10),
   onBand(Math.PI/2-sx*ROOT*.22,1.15,zs*zc),
   new THREE.Vector3(-sx*.10,1.17,zs*zc),
   at(.92,Y-.13,deg),at(1.075,Y-.02,deg),at(1.07,Y+.025,deg),at(1.02,Y+.045,deg),at(.97,Y+.05,deg)];
  const g=sweepGeometry(pts,t=>.062-.028*sm(.3,.9,t),{segments:160,radial:28,tip:true});
  const claw=new THREE.Mesh(g,gold);claw.name='Claw_'+(i+1);metal.add(claw);
 });
 {const pts=[];for(let k=0;k<64;k++)pts.push(at(.9,Y-.1,k/64*360));
  const rail=new THREE.Mesh(sweepGeometry(pts,()=>.022,{segments:192,radial:18,closed:true}),gold);rail.name='Under_girdle_rail';metal.add(rail);}

 // Pavé: two rows per shoulder in a bright-cut channel, each stone held by four beads.
 const smallGeo=brilliantGeometry(PAVE.radius,PAVE.radius,{detailed:false});
 const paveMaterial=environment&&highQuality?diamondMaterial(smallGeo,environment,{bounces:paveBounces,dispersion,seat:1}):basicStone;
 const count=PAVE.perSide*2*2,beadCount=(PAVE.perSide+1)*4*2;
 const stones=new THREE.InstancedMesh(smallGeo,paveMaterial,count);stones.name=`Pave_${count}_stones`;
 if(paveMaterial.isShaderMaterial)bindDiamond(stones,{radius:PAVE.radius});
 const seatGeo=new THREE.LatheGeometry([new THREE.Vector2(PAVE.radius*1.22,-.0012),new THREE.Vector2(PAVE.radius*1.08,.0004),new THREE.Vector2(PAVE.radius*1.0,.0012)],28);
 seatGold.side=THREE.DoubleSide;
 const seats=new THREE.InstancedMesh(seatGeo,seatGold,count);seats.name='Individual_pave_seats';
 const beadGeo=new THREE.SphereGeometry(PAVE.bead,16,12);beadGeo.scale(1,.85,1);
 const beads=new THREE.InstancedMesh(beadGeo,gold,beadCount);beads.name='Pave_gold_beads';
 const M=new THREE.Matrix4(),X=new THREE.Vector3(),Yv=new THREE.Vector3(),Z=new THREE.Vector3(0,0,1);
 const frame=(a,z,lift)=>{const r=1+outerOffset(a,z)+lift;X.set(Math.sin(a),-Math.cos(a),0);Yv.set(Math.cos(a),Math.sin(a),0);M.makeBasis(X,Yv,Z).setPosition(r*Math.cos(a),r*Math.sin(a),z);return M;};
 const angle=(side,s)=>side===1?s:Math.PI-s;
 let si=0,bi=0;
 for(const side of [-1,1]){
  for(let i=0;i<PAVE.perSide;i++){
   const a=angle(side,PAVE.start-i*PAVE.step);
   for(const row of [-1,1]){stones.setMatrixAt(si,frame(a,row*PAVE.row,.0005));seats.setMatrixAt(si++,frame(a,row*PAVE.row,0));}
  }
  for(let i=0;i<=PAVE.perSide;i++){
   const a=angle(side,PAVE.start-(i-.5)*PAVE.step);
   for(const z of [-PAVE.row-PAVE.beadSpread,-PAVE.row+PAVE.beadSpread,PAVE.row-PAVE.beadSpread,PAVE.row+PAVE.beadSpread])beads.setMatrixAt(bi++,frame(a,z,.0028));
  }
 }
 stones.instanceMatrix.needsUpdate=seats.instanceMatrix.needsUpdate=beads.instanceMatrix.needsUpdate=true;
 for(const m of [stones,seats,beads])m.computeBoundingSphere();
 metal.add(seats,beads,stones);

 const geometry=brilliantGeometry(STONE.rx,STONE.rz);
 const material=environment&&highQuality?diamondMaterial(geometry,environment,{bounces,dispersion,seat:1}):new THREE.MeshPhysicalMaterial({name:'Primary_diamond_fallback',color:'#ffffff',roughness:.015,metalness:0,transmission:.96,thickness:.45,ior:2.417,dispersion:.025});
 const centerStone=new THREE.Mesh(geometry,material);centerStone.position.y=STONE.y;centerStone.name='Center_oval_diamond';
 if(material.isShaderMaterial)bindDiamond(centerStone);root.add(centerStone);
 root.userData.parts={metal,centerStone,band,gold,seatGold,basicStone,stones,seats,beads};
 root.userData.stoneY=STONE.y;
 return root;
}
