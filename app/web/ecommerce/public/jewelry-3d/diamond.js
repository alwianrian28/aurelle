import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Cut geometry
// The stone is built as an intersection of half-spaces (one per polished
// facet) in a radius-normalised round-brilliant space, then stretched to an
// oval. The same planes drive the mesh and the optical shader, so the facets
// the camera sees are exactly the facets the rays bounce between.
// ---------------------------------------------------------------------------
const DEG=Math.PI/180;
// Reference proportions (GIA "excellent" range for a brilliant pattern).
export const CUT=Object.freeze({table:.57,crownAngle:34.5,pavilionAngle:40.8,starLength:.5,lowerHalfLength:.77,girdle:.03,culet:0})  // pointed culet: a flat culet reads as a black dot in face-up macro;
// Refractive index of diamond at ~650 / 550 / 450 nm (Sellmeier fit; B–G dispersion ≈ 0.044, as measured).
export const DIAMOND_IOR=Object.freeze({red:2.4076,green:2.4237,blue:2.4513});

const v=(x,y,z)=>new THREE.Vector3(x,y,z);
const polar=(r,phi,y)=>v(r*Math.cos(phi),y,r*Math.sin(phi));
function plane(n,p){n=n.clone().normalize();return {n,d:n.dot(p)};}
function plane3(a,b,c){const n=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).normalize();let d=n.dot(a);if(d<0){n.negate();d=-d;}return {n,d};}

export function brilliantPlanes(girdleFacets=32){
 const a=CUT.crownAngle*DEG,p=CUT.pavilionAngle*DEG,g=CUT.girdle,ta=Math.tan(a),tp=Math.tan(p),c8=Math.cos(Math.PI/8);
 const hT=g+(1-CUT.table)*ta;                    // table height: bezel kites meet the table at its vertices
 const tm=CUT.table*c8;                           // table edge midpoint radius
 const rs=tm+CUT.starLength*(1-tm),ys=g+ta*(1-rs*c8); // star tip
 const b=Math.atan((hT-ys)/(rs-tm));              // star facet angle (~21°)
 const rl=1-CUT.lowerHalfLength,yl=-g-tp*(1-rl*c8);   // lower-half apex on the pavilion ridge
 const P=[plane(v(0,1,0),v(0,hT,0))];
 for(let k=0;k<8;k++){
  const f=k*Math.PI/4,s=f+Math.PI/8,f2=f+Math.PI/4,S=polar(rs,s,ys),L=polar(rl,s,yl);
  P.push(plane(v(Math.sin(a)*Math.cos(f),Math.cos(a),Math.sin(a)*Math.sin(f)),polar(1,f,g)));      // bezel
  P.push(plane(v(Math.sin(b)*Math.cos(s),Math.cos(b),Math.sin(b)*Math.sin(s)),polar(tm,s,hT)));    // star
  P.push(plane3(S,polar(1,f,g),polar(1,s,g)),plane3(S,polar(1,s,g),polar(1,f2,g)));               // upper halves
  P.push(plane(v(Math.sin(p)*Math.cos(f),-Math.cos(p),Math.sin(p)*Math.sin(f)),polar(1,f,-g)));    // pavilion main
  P.push(plane3(L,polar(1,f,-g),polar(1,s,-g)),plane3(L,polar(1,s,-g),polar(1,f2,-g)));           // lower halves
 }
 for(let i=0;i<girdleFacets;i++){const f=(i+.5)/girdleFacets*Math.PI*2;P.push(plane(v(Math.cos(f),0,Math.sin(f)),polar(1,f,0)));}
 if(CUT.culet>0)P.push(plane(v(0,-1,0),v(0,-(g+tp*(1-CUT.culet)),0)));
 return P;
}

function polytope(planes){
 const n=planes.length,N=planes.map(q=>[q.n.x,q.n.y,q.n.z]),D=planes.map(q=>q.d),verts=[];
 const cr=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
  const ij=cr(N[i],N[j]);
  for(let k=j+1;k<n;k++){
   const det=N[k][0]*ij[0]+N[k][1]*ij[1]+N[k][2]*ij[2];if(Math.abs(det)<1e-9)continue;
   const jk=cr(N[j],N[k]),ki=cr(N[k],N[i]);
   const x=(D[i]*jk[0]+D[j]*ki[0]+D[k]*ij[0])/det,y=(D[i]*jk[1]+D[j]*ki[1]+D[k]*ij[1])/det,z=(D[i]*jk[2]+D[j]*ki[2]+D[k]*ij[2])/det;
   let inside=true;for(let q=0;q<n;q++){if(N[q][0]*x+N[q][1]*y+N[q][2]*z>D[q]+1e-7){inside=false;break;}}
   if(inside&&!verts.some(w=>Math.abs(w.x-x)+Math.abs(w.y-y)+Math.abs(w.z-z)<1e-6))verts.push(v(x,y,z));
  }
 }
 const faces=[];
 for(const q of planes){
  const on=verts.filter(w=>Math.abs(q.n.dot(w)-q.d)<1e-6);if(on.length<3)continue;   // redundant plane
  const c=on.reduce((s,w)=>s.add(w),v(0,0,0)).multiplyScalar(1/on.length);
  const u=Math.abs(q.n.y)<.9?v(0,1,0).cross(q.n).normalize():v(1,0,0).cross(q.n).normalize(),w=new THREE.Vector3().crossVectors(q.n,u);
  on.sort((A,B)=>Math.atan2(w.dot(A.clone().sub(c)),u.dot(A.clone().sub(c)))-Math.atan2(w.dot(B.clone().sub(c)),u.dot(B.clone().sub(c))));
  faces.push({plane:q,loop:on});
 }
 return faces;
}

const roundCache=new Map();
function roundBrilliant(girdleFacets){if(!roundCache.has(girdleFacets))roundCache.set(girdleFacets,polytope(brilliantPlanes(girdleFacets)));return roundCache.get(girdleFacets);}

/** Oval/round brilliant. rx,rz: girdle radii. Depth scales with the width (rz). */
export function brilliantGeometry(rx=.505,rz=.365,{detailed=true}={}){
 const faces=roundBrilliant(detailed?32:16),S=v(rx,rz,rz),inv=v(1/rx,1/rz,1/rz),pos=[],nor=[],facets=[];
 for(const f of faces){
  const nn=f.plane.n.clone().multiply(inv),len=nn.length();nn.divideScalar(len);
  facets.push(new THREE.Vector4(nn.x,nn.y,nn.z,f.plane.d/len));
  const L=f.loop.map(p=>p.clone().multiply(S));
  for(let i=1;i<L.length-1;i++)for(const p of [L[0],L[i],L[i+1]]){pos.push(p.x,p.y,p.z);nor.push(nn.x,nn.y,nn.z);}
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
 geometry.computeBoundingSphere();geometry.computeBoundingBox();
 geometry.userData.facets=facets;geometry.userData.radius=Math.max(rx,rz);
 return geometry;
}

export function facetPlanes(geometry){
 if(geometry.userData.facets)return geometry.userData.facets;
 const a=geometry.attributes.position,planes=[];
 for(let i=0;i<a.count;i+=3){
  const p=new THREE.Vector3().fromBufferAttribute(a,i),q=new THREE.Vector3().fromBufferAttribute(a,i+1),r=new THREE.Vector3().fromBufferAttribute(a,i+2);
  const normal=q.sub(p).cross(r.sub(p)).normalize(),d=normal.dot(p);
  if(!planes.some(w=>Math.abs(w.x-normal.x)+Math.abs(w.y-normal.y)+Math.abs(w.z-normal.z)+Math.abs(w.w-d)<.0001))planes.push(new THREE.Vector4(normal.x,normal.y,normal.z,d));
 }
 return planes;
}

// ---------------------------------------------------------------------------
// Optics
// Per-pixel trace inside the convex stone: entrance Fresnel reflection,
// refraction at n=2.4175, internal bounces with exact dielectric Fresnel and
// total internal reflection, per-channel exit refraction (C/D/F indices) for
// restrained fire. Environment-only: neighbouring geometry is approximated by
// a gold "seat" term for light leaving through the pavilion of a set stone.
// Output is linear; tone mapping and sRGB conversion are applied once, by the
// renderer's standard chunks.
// ---------------------------------------------------------------------------
// Linear equivalent of the ring metal #E4E5E8 (rhodium white gold); used for the metal seat term inside set stones.
export const GOLD_LINEAR=Object.freeze([.776,.784,.807]);

export function diamondMaterial(geometry,environment,{bounces=7,dispersion=true,seat=0}={}){
 const planes=facetPlanes(geometry),radius=geometry.userData.radius||geometry.boundingSphere?.radius||1;
 const average=environment?.userData?.average||new THREE.Vector3(.5,.5,.5);
 const vertexShader=`
 uniform vec3 localCamera;
 varying vec3 vLocalPosition;varying vec3 vLocalNormal;varying vec3 vGemCamera;
 varying vec3 vBasisX;varying vec3 vBasisY;varying vec3 vBasisZ;
 void main(){
  vLocalPosition=position;vLocalNormal=normal;vGemCamera=localCamera;
  vBasisX=vec3(1,0,0);vBasisY=vec3(0,1,0);vBasisZ=vec3(0,0,1);
  vec4 p=vec4(position,1.0);
  #ifdef USE_INSTANCING
   vGemCamera=(inverse(instanceMatrix)*vec4(localCamera,1.0)).xyz;
   mat3 basis=mat3(instanceMatrix);
   vBasisX=normalize(basis[0]);vBasisY=normalize(basis[1]);vBasisZ=normalize(basis[2]);
   p=instanceMatrix*p;
  #endif
  gl_Position=projectionMatrix*modelViewMatrix*p;
 }`;
 const fragmentShader=`
 precision highp float;
 #define FACETS ${planes.length}
 #define BOUNCES ${bounces}
 ${dispersion?'#define DISPERSION':''}
 uniform vec4 planes[FACETS];uniform sampler2D studioMap;uniform mat3 worldRotation;
 uniform float envLod;uniform float epsilon;uniform float seatAmount;uniform vec3 seatColor;uniform vec3 envAverage;
 varying vec3 vLocalPosition;varying vec3 vLocalNormal;varying vec3 vGemCamera;
 varying vec3 vBasisX;varying vec3 vBasisY;varying vec3 vBasisZ;
 const float PI=3.141592653589793;
 vec3 toWorld(vec3 d){return normalize(worldRotation*(mat3(vBasisX,vBasisY,vBasisZ)*d));}
 vec3 studio(vec3 w,float lod){
  vec2 uv=vec2(atan(w.z,w.x)*(.5/PI)+.5,asin(clamp(w.y,-1.,1.))/PI+.5);
  return textureLod(studioMap,uv,lod).rgb;
 }
 vec3 exitLight(vec3 local){
  vec3 w=toWorld(local),c=studio(w,envLod);
  float s=seatAmount*smoothstep(-.2,-.75,local.y);
  if(s>0.){vec3 up=toWorld(vec3(0,1,0));c=mix(c,studio(reflect(w,up),envLod+1.)*seatColor,s);}
  return c;
 }
 float fresnel(float c,float n1,float n2){
  c=clamp(c,0.,1.);float r=n1/n2,s2=r*r*(1.-c*c);if(s2>=1.)return 1.;
  float ct=sqrt(1.-s2),rs=(n1*c-n2*ct)/(n1*c+n2*ct),rp=(n1*ct-n2*c)/(n1*ct+n2*c);
  return .5*(rs*rs+rp*rp);
 }
 vec3 traceGem(vec3 o,vec3 ray,vec3 nIn){
  const float IOR=${DIAMOND_IOR.green.toFixed(4)};
  float F=fresnel(dot(-ray,nIn),1.,IOR);
  vec3 result=studio(toWorld(reflect(ray,nIn)),envLod)*F,T=vec3(1.-F);
  vec3 d=refract(ray,nIn,1./IOR);o+=d*epsilon;
  for(int b=0;b<BOUNCES;b++){
   float tMin=1e9;vec3 n=vec3(0,1,0);
   for(int j=0;j<FACETS;j++){vec4 q=planes[j];float den=dot(q.xyz,d);if(den>1e-6){float t=(q.w-dot(q.xyz,o))/den;if(t<tMin){tMin=t;n=q.xyz;}}}
   o+=d*max(tMin,0.);
   float R=fresnel(dot(d,n),IOR,1.);
   if(R<1.){
    vec3 tg=refract(d,-n,IOR);
    #ifdef DISPERSION
     vec3 tr=refract(d,-n,${DIAMOND_IOR.red.toFixed(4)}),tb=refract(d,-n,${DIAMOND_IOR.blue.toFixed(4)});
     if(dot(tr,tr)<.5)tr=tg;if(dot(tb,tb)<.5)tb=tg;
     vec3 c=vec3(exitLight(tr).r,exitLight(tg).g,exitLight(tb).b);
    #else
     vec3 c=exitLight(tg);
    #endif
    result+=c*T*(1.-R);T*=R;
   }
   d=reflect(d,n);o+=d*epsilon-n*epsilon;
   if(max(T.r,max(T.g,T.b))<.003)break;
  }
  // Energy still inside after the bounce budget would leave in an effectively
  // random direction: credit it with the studio's mean radiance (no glow term).
  return result+T*envAverage;
 }
 void main(){
  vec3 ray=normalize(vLocalPosition-vGemCamera);
  gl_FragColor=vec4(traceGem(vLocalPosition,ray,normalize(vLocalNormal)),1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`;
 const seatColor=new THREE.Color().setRGB(GOLD_LINEAR[0]*.8,GOLD_LINEAR[1]*.8,GOLD_LINEAR[2]*.8,THREE.LinearSRGBColorSpace);
 const material=new THREE.ShaderMaterial({name:'Aurelle_cut_diamond',vertexShader,fragmentShader,uniforms:{
  planes:{value:planes},studioMap:{value:environment},localCamera:{value:new THREE.Vector3()},worldRotation:{value:new THREE.Matrix3()},
  envLod:{value:0},epsilon:{value:radius*2e-4},seatAmount:{value:seat},seatColor:{value:seatColor},envAverage:{value:average}}});
 material.userData.facetCount=planes.length;material.userData.bounces=bounces;
 return material;
}

/** Feeds camera position, rotation and a size-based environment blur to the stone shader. */
export function bindDiamond(mesh,{radius=mesh.geometry.userData.radius||.5,lodRef=380}={}){
 const inverse=new THREE.Matrix4(),cameraWorld=new THREE.Vector3(),center=new THREE.Vector3(),size=new THREE.Vector2();
 mesh.onBeforeRender=(renderer,scene,camera,geometry,material)=>{
  const u=material.uniforms;if(!u?.localCamera)return;
  inverse.copy(mesh.matrixWorld).invert();camera.getWorldPosition(cameraWorld);
  u.localCamera.value.copy(cameraWorld).applyMatrix4(inverse);
  u.worldRotation.value.setFromMatrix4(mesh.matrixWorld);
  center.setFromMatrixPosition(mesh.matrixWorld);renderer.getDrawingBufferSize(size);
  const px=radius/Math.max(.001,cameraWorld.distanceTo(center))*(size.y*.5)/Math.tan(camera.fov*Math.PI/360);
  // Small on screen -> sample a pre-filtered studio level: stable, no shimmer.
  u.envLod.value=Math.min(4,Math.max(0,Math.log2(lodRef/Math.max(1,px))*.8));
 };
 return mesh;
}

// ---------------------------------------------------------------------------
// Studio environment (procedural, linear HDR, equirectangular)
// Angles: phi = atan2(z,x) in degrees (camera sits near phi 90), el = elevation.
// ---------------------------------------------------------------------------
export const STUDIO={
 lights:[
  {name:'top-front softbox',phi:90,el:48,w:110,h:22,power:3.6,tint:[1,.99,.98],soft:8},
  {name:'key softbox',phi:135,el:28,w:56,h:40,power:10,tint:[1,.975,.94],soft:5},
  {name:'right strip',phi:30,el:16,w:9,h:66,power:9,tint:[1,1,.99],soft:2},
  {name:'rim strip',phi:-145,el:20,w:7,h:60,power:7,tint:[.96,.985,1],soft:2},
  {name:'back strip',phi:-38,el:8,w:6,h:44,power:5,tint:[1,.99,.97],soft:2},
  {name:'front bounce card',phi:90,el:-16,w:74,h:12,power:2.6,tint:[1,.98,.94],soft:6},
  {name:'pin light A',phi:104,el:50,w:2.6,h:2.6,power:40,tint:[1,1,1],soft:1.2},
  {name:'pin light B',phi:40,el:58,w:2.2,h:2.2,power:28,tint:[1,1,1],soft:1}
 ],
 flags:[
  {name:'camera flag',phi:90,el:6,w:24,h:24,soft:4},
  {name:'key edge flag',phi:106,el:22,w:8,h:56,soft:2},
  {name:'low right flag',phi:10,el:-4,w:40,h:20,soft:5},
  {name:'right flag',phi:56,el:14,w:13,h:62,soft:2.5},
  {name:'key separator',phi:160,el:30,w:6,h:40,soft:1.5},
  {name:'back flag',phi:180,el:8,w:18,h:52,soft:3},
  {name:'left-back flag',phi:-100,el:14,w:30,h:72,soft:4}
 ],
 overhead:{from:60,to:70,power:2.6}
};

// surround: brightness of the studio walls. Diamonds use the dark studio (contrast in the facets);
// metal gets the same lights and flags with brighter walls, as a real product set uses white cards.
// stone: diamond-photography variant: dimmer walls, deeper black flags and a ring of small
// hard pin lights, so facets break into crisp black/white contrast and scintillation.
export const STONE_PINS=Array.from({length:18},(_,i)=>({phi:-180+i*20+((i*37)%11),el:18+((i*53)%46),w:1.6+(i%3)*.6,h:1.6+(i%3)*.6,power:26+(i%4)*8,tint:[1,1,1],soft:.6}));
// metal: silver on graphite. Mid-grey walls are what read as "pale grey" in polished metal, so the walls
// drop and the band is wrapped by tall strip lights either side of the camera, an overhead strip and a
// low front card: the curve shows white highlights against deep reflections, with no flat grey zone.
export const METAL_STRIPS=[
 // Paired thin strips either side of the camera: polished metal shows several crisp lines with dark gaps.
 {name:'camera-left strip A',phi:58,el:10,w:4,h:84,power:9,tint:[.97,.985,1],soft:1.2},
 {name:'camera-left strip B',phi:72,el:16,w:2.5,h:70,power:7,tint:[1,1,1],soft:1},
 {name:'camera-right strip A',phi:122,el:10,w:4,h:84,power:9,tint:[.97,.985,1],soft:1.2},
 {name:'camera-right strip B',phi:108,el:16,w:2.5,h:70,power:7,tint:[1,1,1],soft:1},
 {name:'overhead strip A',phi:90,el:62,w:160,h:4,power:7,tint:[1,1,1],soft:1.5},
 {name:'overhead strip B',phi:90,el:78,w:200,h:3,power:5,tint:[1,1,1],soft:1.5},
 {name:'low front card',phi:90,el:-22,w:90,h:5,power:5,tint:[.97,.985,1],soft:2},
 {name:'floor bounce strip',phi:-90,el:-30,w:120,h:5,power:3.5,tint:[.97,.985,1],soft:2},
 {name:'back-left rim',phi:-60,el:10,w:4,h:70,power:7,tint:[.96,.98,1],soft:1.2},
 {name:'back-right rim',phi:-120,el:10,w:4,h:70,power:7,tint:[.96,.98,1],soft:1.2},
 // Banded light ceiling (replaces the uniform dome): up-facing surfaces show stepped highlights.
 {name:'ceiling band 1',phi:0,el:40,w:360,h:3.5,power:3.2,tint:[1,1,1],soft:1.5},
 {name:'ceiling band 2',phi:0,el:52,w:360,h:5,power:4.2,tint:[1,1,1],soft:2},
 {name:'ceiling band 3',phi:0,el:68,w:360,h:4,power:3.6,tint:[1,1,1],soft:2},
 {name:'ceiling band 4',phi:0,el:84,w:360,h:5,power:2.6,tint:[1,1,1],soft:2},
 // Soft graded cards left and right of the set: lift the shank sides out of black without flattening them.
 {name:'left graded card',phi:20,el:-6,w:34,h:40,power:2,tint:[.97,.985,1],soft:10},
 {name:'right graded card',phi:160,el:-6,w:34,h:40,power:2,tint:[.97,.985,1],soft:10},
 // Large diffused wall behind the camera: the band faces it in every full-ring shot. Its diffuser falloff
 // (bright core, dim rim) gives the shank a silver gradient instead of black or flat grey.
 {name:'behind-camera diffusion',phi:90,el:2,w:150,h:60,power:2.4,tint:[.97,.985,1],soft:18},
 {name:'below-camera diffusion',phi:90,el:-38,w:150,h:26,power:1.6,tint:[.97,.985,1],soft:14}];
export function makeStudioMap({width=2048,surround=1,stone=false,metal=false}={}){
 const lights=stone?[...STUDIO.lights,...STONE_PINS]:metal?[...STUDIO.lights,...METAL_STRIPS]:STUDIO.lights,flagDepth=stone?.9:metal?.985:.96;
 const height=width/2,data=new Float32Array(width*height*4);
 const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
 const wrap=d=>((d+180)%360+360)%360-180;
 const mask=(phi,el,b)=>{const dx=Math.abs(wrap(phi-b.phi)),dy=Math.abs(el-b.el),hw=b.w/2,hh=b.h/2;if(dx>hw+b.soft||dy>hh+b.soft)return 0;return (1-sm(hw-b.soft,hw+b.soft,dx))*(1-sm(hh-b.soft,hh+b.soft,dy));};
 const avg=[0,0,0];let wsum=0;
 for(let y=0;y<height;y++){
  const el=((y+.5)/height-.5)*180,cw=Math.cos(el*DEG);
  const L0=surround*(el<0?.22+.26*sm(-35,0,el):.42+.40*sm(15,80,el)),warm=el<0?[1,.96,.9]:[1,.975,.94];
  // The overhead dome is one uniform bright cap: in polished metal every up-facing surface mirrors it as
  // flat light grey. The metal studio keeps only a faint dome and relies on the overhead strips instead.
  const over=(metal?.12:1)*STUDIO.overhead.power*sm(STUDIO.overhead.from,STUDIO.overhead.to,el);
  for(let x=0;x<width;x++){
   const phi=((x+.5)/width-.5)*360;let L=L0;
   // Metal: walls are never one even tone. A slow luminance gradient (darker toward the camera side,
   // soft bright/dark panels around the set) means any patch of polished metal reflects a gradient
   // instead of a flat light-grey field.
   if(metal){const w=.5+.5*Math.sin(phi*DEG*3+el*DEG*2.2),v=.5+.5*Math.cos(phi*DEG*5-el*DEG*1.3);L*=.18+.82*w*w*(.55+.45*v)*(.6+.4*Math.abs(Math.sin(phi*DEG*.5)));}
   for(const f of STUDIO.flags){const m=mask(phi,el,f);if(m)L*=1-flagDepth*m;}
   const c=[L*warm[0]+over,L*warm[1]+over,L*warm[2]+over*.98];
   for(const l of lights){const m=mask(phi,el,l);if(!m)continue;const dx=wrap(phi-l.phi)/(l.w/2),dy=(el-l.el)/(l.h/2),big=metal&&l.w*l.h>400;
    // Large softboxes get a real diffuser falloff (bright core, dim edges, brighter top) in the metal studio, so broad faces show a gradient, not a flat tone.
    const shape=big?Math.max(0,1-.85*Math.min(1,dx*dx+dy*dy))*(.55+.45*Math.max(0,Math.min(1,dy*.5+.5)))*.75:1-.28*Math.min(1,dx*dx+dy*dy);for(let i=0;i<3;i++)c[i]+=l.power*l.tint[i]*m*shape;}
   const k=(y*width+x)*4;data[k]=c[0];data[k+1]=c[1];data[k+2]=c[2];data[k+3]=1;
   avg[0]+=c[0]*cw;avg[1]+=c[1]*cw;avg[2]+=c[2]*cw;wsum+=cw;
  }
 }
 // Box-filtered mip chain, sampled explicitly by the stone shader (textureLod).
 const levels=[{data,width,height}];
 while(levels.length<7){
  const p=levels[levels.length-1],w=p.width>>1,h=p.height>>1,d=new Float32Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let c=0;c<4;c++){const s=(i,j)=>p.data[((2*y+j)*p.width+2*x+i)*4+c];d[(y*w+x)*4+c]=(s(0,0)+s(1,0)+s(0,1)+s(1,1))*.25;}
  levels.push({data:d,width:w,height:h});
 }
 const half=levels.map(l=>{const o=new Uint16Array(l.data.length);for(let i=0;i<o.length;i++)o[i]=THREE.DataUtils.toHalfFloat(l.data[i]);return {data:o,width:l.width,height:l.height};});
 const map=new THREE.DataTexture(half[0].data,width,height,THREE.RGBAFormat,THREE.HalfFloatType);
 map.mipmaps=half;map.generateMipmaps=false;map.colorSpace=THREE.LinearSRGBColorSpace;
 map.mapping=THREE.EquirectangularReflectionMapping;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;map.wrapS=THREE.RepeatWrapping;map.needsUpdate=true;
 map.userData.average=new THREE.Vector3(avg[0]/wsum,avg[1]/wsum,avg[2]/wsum);
 return map;
}
