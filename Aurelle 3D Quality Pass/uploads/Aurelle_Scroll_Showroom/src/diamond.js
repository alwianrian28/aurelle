import * as THREE from 'three';
import {ConvexGeometry} from 'three/addons/geometries/ConvexGeometry.js';

export function brilliantGeometry(rx=.48,rz=.37,{detailed=true}={}){
 const vertices=[];
 // A flat octagonal table, star/crown facets, thin faceted girdle and pavilion.
 // The extra girdle divisions smooth the oval silhouette without smooth normals.
 const n=detailed?32:16;
 const rings=[{n:8,r:.47,y:.235,offset:0},{n:16,r:.77,y:.153,offset:0},{n,r:1,y:.036,offset:0},{n,r:1,y:.019,offset:0},{n:16,r:.60,y:-.17,offset:Math.PI/16},{n:8,r:.025,y:-.351,offset:0}];
 for(const a of rings)for(let i=0;i<a.n;i++){const t=i/a.n*Math.PI*2+a.offset;vertices.push(new THREE.Vector3(Math.cos(t)*rx*a.r,a.y,Math.sin(t)*rz*a.r));}
 const geometry=new ConvexGeometry(vertices);geometry.computeBoundingSphere();return geometry;
}

export function facetPlanes(geometry){
 const a=geometry.attributes.position,planes=[];
 for(let i=0;i<a.count;i+=3){
  const p=new THREE.Vector3().fromBufferAttribute(a,i),q=new THREE.Vector3().fromBufferAttribute(a,i+1),r=new THREE.Vector3().fromBufferAttribute(a,i+2);
  const normal=q.sub(p).cross(r.sub(p)).normalize(),d=normal.dot(p);
  if(!planes.some(v=>Math.abs(v.x-normal.x)+Math.abs(v.y-normal.y)+Math.abs(v.z-normal.z)+Math.abs(v.w-d)<.0001))planes.push(new THREE.Vector4(normal.x,normal.y,normal.z,d));
 }
 return planes;
}

// Real convex facet intersections, dielectric Fresnel, total internal reflection,
// restrained wavelength separation and Beer-Lambert attenuation. No animated noise.
export function diamondMaterial(geometry,environment,{bounces=7}={}){
 const planes=facetPlanes(geometry);
 const vertexShader=`
 varying vec3 vLocalPosition;varying vec3 vLocalNormal;varying vec3 vGemCamera;
 varying vec3 vBasisX;varying vec3 vBasisY;varying vec3 vBasisZ;
 uniform vec3 localCamera;
 void main(){
  vLocalPosition=position;vLocalNormal=normal;vGemCamera=localCamera;
  vBasisX=vec3(1,0,0);vBasisY=vec3(0,1,0);vBasisZ=vec3(0,0,1);
  vec3 transformed=position;
  #ifdef USE_INSTANCING
   mat3 basis=mat3(instanceMatrix);
   vec3 delta=localCamera-instanceMatrix[3].xyz;
   vGemCamera=vec3(dot(delta,basis[0]),dot(delta,basis[1]),dot(delta,basis[2]));
   vBasisX=basis[0];vBasisY=basis[1];vBasisZ=basis[2];
   transformed=(instanceMatrix*vec4(position,1.)).xyz;
  #endif
  gl_Position=projectionMatrix*modelViewMatrix*vec4(transformed,1.0);
 }`;
 const fragmentShader=`
 precision highp float;
 uniform vec4 planes[${planes.length}];uniform sampler2D studioMap;
 uniform mat3 worldRotation;
 varying vec3 vLocalPosition;varying vec3 vLocalNormal;varying vec3 vGemCamera;
 varying vec3 vBasisX;varying vec3 vBasisY;varying vec3 vBasisZ;
 #define PI 3.141592653589793
 vec3 environmentLight(vec3 localDirection){
  mat3 basis=mat3(vBasisX,vBasisY,vBasisZ);
  vec3 d=normalize(worldRotation*basis*localDirection);
  vec2 uv=vec2(atan(d.z,d.x)/(2.0*PI)+.5,asin(clamp(d.y,-1.0,1.0))/PI+.5);
  return texture2D(studioMap,uv).rgb;
 }
 float fresnel(float c,float n1,float n2){
  c=clamp(c,0.0,1.0);float ratio=n1/n2;float sinT2=ratio*ratio*(1.0-c*c);
  if(sinT2>=1.0)return 1.0;
  float ct=sqrt(1.0-sinT2);
  float rs=(n1*c-n2*ct)/max(.00001,n1*c+n2*ct);
  float rp=(n1*ct-n2*c)/max(.00001,n1*ct+n2*c);
  return .5*(rs*rs+rp*rp);
 }
 vec3 traceGem(vec3 origin,vec3 ray,vec3 faceNormal){
  float ior=2.417;float f=fresnel(dot(-ray,faceNormal),1.0,ior);
  vec3 result=environmentLight(reflect(ray,faceNormal))*f;
  vec3 throughput=vec3(1.0-f);
  vec3 d=refract(ray,faceNormal,1.0/ior),o=origin+d*.00008;
  for(int bounce=0;bounce<${bounces};bounce++){
   float distanceToFacet=1000.0;vec3 n=vec3(0.0,1.0,0.0);
   for(int j=0;j<${planes.length};j++){
    vec4 plane=planes[j];float den=dot(plane.xyz,d);
    if(den>.00001){float t=(plane.w-dot(plane.xyz,o))/den;if(t>.00001&&t<distanceToFacet){distanceToFacet=t;n=plane.xyz;}}
   }
   if(distanceToFacet>100.0){result+=environmentLight(d)*throughput;throughput=vec3(0);break;}
   throughput*=exp(-vec3(.008,.005,.003)*distanceToFacet);
   vec3 hit=o+d*distanceToFacet,refracted=refract(d,-n,ior);
   if(dot(refracted,refracted)>.001){
    float reflection=fresnel(dot(d,n),ior,1.0);
    vec3 r=refract(d,-n,2.405),b=refract(d,-n,2.435);
    if(dot(r,r)<.001)r=refracted;if(dot(b,b)<.001)b=refracted;
    vec3 chroma=vec3(environmentLight(r).r,environmentLight(refracted).g,environmentLight(b).b);
    result+=chroma*throughput*(1.0-reflection);throughput*=reflection;
   }
   d=normalize(reflect(d,n));o=hit+d*.00008;
   if(max(throughput.r,max(throughput.g,throughput.b))<.002)break;
  }
  // Residual unresolved energy samples the studio instead of an artificial glow.
  result+=environmentLight(d)*throughput*.42;
  return result;
 }
 void main(){
  vec3 ray=normalize(vLocalPosition-vGemCamera),normal=normalize(vLocalNormal);
  gl_FragColor=vec4(traceGem(vLocalPosition,ray,normal),1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`;
 const material=new THREE.ShaderMaterial({name:'Aurelle_cut_diamond',vertexShader,fragmentShader,uniforms:{planes:{value:planes},studioMap:{value:environment},localCamera:{value:new THREE.Vector3()},worldRotation:{value:new THREE.Matrix3()}}});
 material.userData.facetCount=planes.length;return material;
}

export function bindDiamond(mesh){
 const inverse=new THREE.Matrix4(),rotation=new THREE.Matrix4(),cameraWorld=new THREE.Vector3();
 mesh.onBeforeRender=(renderer,scene,camera,geometry,material)=>{
  if(!material.uniforms?.localCamera)return;
  inverse.copy(mesh.matrixWorld).invert();camera.getWorldPosition(cameraWorld);
  material.uniforms.localCamera.value.copy(cameraWorld).applyMatrix4(inverse);
  rotation.extractRotation(mesh.matrixWorld);material.uniforms.worldRotation.value.setFromMatrix4(rotation);material.uniformsNeedUpdate=true;
 };return mesh;
}

export function makeStudioMap(){
 const width=1024,height=512,data=new Float32Array(width*height*4);
 const panels=[
  {u:.12,v:.64,w:.14,h:.33,power:4.5,tint:[1,.97,.91],soft:.14},
  {u:.47,v:.60,w:.025,h:.44,power:7.5,tint:[1,.99,.97],soft:.10},
  {u:.76,v:.77,w:.18,h:.09,power:5.0,tint:[.91,.96,1],soft:.22},
  {u:.91,v:.47,w:.065,h:.29,power:3.0,tint:[1,.96,.88],soft:.15},
  {u:.64,v:.51,w:.011,h:.014,power:12,tint:[1,1,1],soft:.55}
 ];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=x/width,v=y/height;
  let base=.10+.20*Math.pow(Math.sin(v*Math.PI),2);
  // Dark studio flags define polished metal edges and the diamond's contrast.
  for(const flag of [.28,.59,.86]){let d=Math.min(Math.abs(u-flag),1-Math.abs(u-flag));if(d<.035&&v>.27&&v<.77)base*=.12+.88*Math.min(1,d/.035);}
  const color=[base*1.04,base,base*.96];
  for(const p of panels){const dx=Math.min(Math.abs(u-p.u),1-Math.abs(u-p.u)),dy=Math.abs(v-p.v);const edge=Math.max(dx/(p.w*.5),dy/(p.h*.5));const t=Math.min(1,Math.max(0,(edge-(1-p.soft))/p.soft));const weight=1-t*t*(3-2*t);for(let i=0;i<3;i++)color[i]+=p.power*p.tint[i]*weight;}
  const idx=(y*width+x)*4;data[idx]=color[0];data[idx+1]=color[1];data[idx+2]=color[2];data[idx+3]=1;
 }
 const half=new Uint16Array(data.length);for(let i=0;i<data.length;i++)half[i]=THREE.DataUtils.toHalfFloat(data[i]);
 const map=new THREE.DataTexture(half,width,height,THREE.RGBAFormat,THREE.HalfFloatType);map.mapping=THREE.EquirectangularReflectionMapping;map.minFilter=THREE.LinearFilter;map.magFilter=THREE.LinearFilter;map.wrapS=THREE.RepeatWrapping;map.needsUpdate=true;return map;
}
