import * as THREE from 'three';
import {brilliantGeometry,diamondMaterial,bindDiamond} from './diamond.js';

export function createRing({environment=null,highQuality=true,bounces=7}={}){
 const root=new THREE.Group();root.name='Aurelle_Atelier_Ring';
 const metal=new THREE.Group();metal.name='Setting_and_band';root.add(metal);
 const gold=new THREE.MeshPhysicalMaterial({name:'Polished_champagne_gold',color:'#e8c48b',metalness:1,roughness:.105,clearcoat:0,envMapIntensity:1.05});
 // Subtle variation in polishing, with no time-driven glitter or noisy bump map.
 gold.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vGoldPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvGoldPosition=position;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vGoldPosition;').replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nfloat polish=sin(vGoldPosition.y*120.0+sin(vGoldPosition.x*49.0))*sin(vGoldPosition.z*190.0);\nroughnessFactor=clamp(roughnessFactor+polish*.007,.075,.18);');
 };
 gold.customProgramCacheKey=()=> 'aurelle-polish-v3';
 const seatGold=new THREE.MeshPhysicalMaterial({name:'Recessed_pave_seats',color:'#b99762',metalness:1,roughness:.23,envMapIntensity:.65});
 const basicStone=new THREE.MeshPhysicalMaterial({name:'Pave_diamond',color:'#ffffff',metalness:0,roughness:.018,transmission:.94,thickness:.065,ior:2.417,dispersion:.025,envMapIntensity:1.35});
 const bandVertices=[],bandUV=[],bandIndices=[];const major=384,minor=40;
 function widthAt(a){return .11+.055*Math.pow(Math.max(0,Math.sin(a)),2);}
 for(let i=0;i<=major;i++){
  const a=i/major*Math.PI*2,w=widthAt(a);
  for(let j=0;j<=minor;j++){
   const b=j/minor*Math.PI*2;const radial=1+.079*Math.cos(b);
   bandVertices.push(radial*Math.cos(a),radial*Math.sin(a),w*Math.sin(b));bandUV.push(i/major,j/minor);
  }
 }
 for(let i=0;i<major;i++)for(let j=0;j<minor;j++){const a=i*(minor+1)+j,b=a+minor+1;bandIndices.push(a,b,a+1,b,b+1,a+1);}
 const bandGeo=new THREE.BufferGeometry();bandGeo.setAttribute('position',new THREE.Float32BufferAttribute(bandVertices,3));bandGeo.setAttribute('uv',new THREE.Float32BufferAttribute(bandUV,2));bandGeo.setIndex(bandIndices);bandGeo.computeVertexNormals();
 const band=new THREE.Mesh(bandGeo,gold);band.name='Tapered_gold_band';metal.add(band);
 const tube=(pts,r=.02)=>new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),64,r,14,false),gold);
 // Fine rails follow both shoulders, creating a milgrain-like edge.
 for(const side of [-1,1])for(const z of [-1,1]){
  const pts=[];for(let i=0;i<=32;i++){const a=(side===1?.18:Math.PI-.18)+(side===1?1:-1)*i/32*1.11;pts.push(new THREE.Vector3(1.06*Math.cos(a),1.06*Math.sin(a),z*widthAt(a)*.76));}
  metal.add(tube(pts,.014));
 }
 // Oval crown with a lower open gallery and four visible structural arches.
 const crown=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;crown.push(new THREE.Vector3(.39*Math.cos(a),1.33,.285*Math.sin(a)));}metal.add(tube(crown,.025));
 const lower=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;lower.push(new THREE.Vector3(.27*Math.cos(a),1.15,.18*Math.sin(a)));}metal.add(tube(lower,.024));
 const tipGeo=new THREE.SphereGeometry(.028,20,14);
 for(let i=0;i<4;i++){
  const a=Math.PI/4+i*Math.PI/2,c=Math.cos(a),s=Math.sin(a);
  const path=[new THREE.Vector3(c*.14,1.02,s*.095),new THREE.Vector3(c*.37,1.25,s*.26),new THREE.Vector3(c*.49,1.49,s*.38),new THREE.Vector3(c*.455,1.54,s*.35)];
  const prong=tube(path,.026);prong.name='Claw_'+(i+1);metal.add(prong);const tip=new THREE.Mesh(tipGeo,gold);tip.position.copy(path[3]);metal.add(tip);
 }
 // Pavé diamonds are set into the shoulders, each with miniature gold beads.
 const smallGeo=brilliantGeometry(.031,.031,{detailed:false});smallGeo.scale(1,.13,1);
 const paveMaterial=environment&&highQuality?diamondMaterial(smallGeo,environment,{bounces:3}):basicStone;
 const beadGeo=new THREE.SphereGeometry(.009,12,8);
 const stones=new THREE.InstancedMesh(smallGeo,paveMaterial,68);stones.name='Pave_68_stones';if(paveMaterial.isShaderMaterial)bindDiamond(stones);
 const seatGeo=new THREE.TorusGeometry(.0305,.0045,8,20);seatGeo.rotateX(Math.PI/2);
 const seats=new THREE.InstancedMesh(seatGeo,seatGold,68);seats.name='Individual_pave_seats';
 const beads=new THREE.InstancedMesh(beadGeo,gold,136);beads.name='Pave_gold_beads';
 const dummy=new THREE.Object3D();let si=0,bi=0;
 for(const side of [-1,1])for(let i=0;i<17;i++){
  const a=(side===1?.15:Math.PI-.15)+(side===1?1:-1)*i/16*1.08;
  for(const row of [-1,1]){
   dummy.position.set(1.084*Math.cos(a),1.084*Math.sin(a),row*widthAt(a)*.40);dummy.rotation.set(0,0,a-Math.PI/2);dummy.updateMatrix();stones.setMatrixAt(si,dummy.matrix);dummy.position.x*=1.071/1.084;dummy.position.y*=1.071/1.084;dummy.updateMatrix();seats.setMatrixAt(si++,dummy.matrix);
   for(const along of [-1,1]){dummy.position.set(1.092*Math.cos(a+along*.027),1.092*Math.sin(a+along*.027),row*widthAt(a)*.65);dummy.rotation.set(0,0,0);dummy.updateMatrix();beads.setMatrixAt(bi++,dummy.matrix);}
  }
 }
 stones.instanceMatrix.needsUpdate=true;beads.instanceMatrix.needsUpdate=true;seats.instanceMatrix.needsUpdate=true;metal.add(stones,beads,seats);

 const geometry=brilliantGeometry(.49,.375);
 const material=environment&&highQuality?diamondMaterial(geometry,environment,{bounces}):new THREE.MeshPhysicalMaterial({name:'Primary_diamond_fallback',color:'#ffffff',roughness:.018,metalness:0,transmission:.96,thickness:.59,ior:2.417,dispersion:.025});
 const centerStone=new THREE.Mesh(geometry,material);centerStone.position.y=1.43;centerStone.name='Center_diamond';if(material.isShaderMaterial)bindDiamond(centerStone);root.add(centerStone);
 root.userData.parts={metal,centerStone,band,gold,basicStone,stones,seats};
 return root;
}
