import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleMotion,SHOTS,CHAPTERS} from '../src/motion.js';
import {createRing} from '../src/ring-model.js';
import {brilliantGeometry,facetPlanes} from '../src/diamond.js';
assert.equal(CHAPTERS.length,12);assert.equal(SHOTS.length,12);
for(let i=0;i<=2000;i++){
 const p=i/2000,m=sampleMotion(p);
 const mobile=sampleMotion(p,true);assert.ok([...mobile.offset,...mobile.target,...mobile.rotation].every(Number.isFinite));
 assert.ok([...m.offset,...m.target,...m.rotation,m.lift,m.cloud].every(Number.isFinite));
 assert.ok(m.cloud>=0&&m.cloud<=1);assert.ok(m.lift>=0);
 assert.ok(m.chapter>=0&&m.chapter<CHAPTERS.length);
}
for(const key of SHOTS.slice(1,-1)){
 for(const mobile of [false,true]){
 const a=sampleMotion(key.p-1e-6,mobile),b=sampleMotion(key.p+1e-6,mobile);
 for(const field of ['offset','target','rotation'])assert.ok(a[field].every((v,i)=>Math.abs(v-b[field][i])<.001),'No camera or object jump');
 assert.ok(Math.abs(a.lift-b.lift)<.001);
 }
}
for(const p of [.1,.43,.61,.96]){const forward=sampleMotion(p);sampleMotion(p+.02);assert.deepEqual(sampleMotion(p),forward,'Reverse scroll must restore exact pose');}
assert.deepEqual(sampleMotion(-3),sampleMotion(0));assert.deepEqual(sampleMotion(4),sampleMotion(1));
assert.equal(sampleMotion(1).lift,0);assert.equal(sampleMotion(1).cloud,0);
assert.ok(sampleMotion(.8,true).offset[2]>sampleMotion(.8).offset[2]);
const geometry=brilliantGeometry(),planes=facetPlanes(geometry),a=geometry.attributes.position;
assert.ok(planes.length>50&&planes.length<192,'Facet uniform budget');
for(const plane of planes){const n=new THREE.Vector3(plane.x,plane.y,plane.z);assert.ok(Math.abs(n.length()-1)<1e-6);for(let i=0;i<a.count;i++){const p=new THREE.Vector3().fromBufferAttribute(a,i);assert.ok(n.dot(p)<=plane.w+1e-5,'All vertices must be inside every convex plane');}}
for(let i=0;i<128;i++){const d=new THREE.Vector3(Math.sin(i*2.399),Math.cos(i*1.7),Math.cos(i*2.399)).normalize();const hits=planes.filter(p=>p.x*d.x+p.y*d.y+p.z*d.z>0).map(p=>p.w/(p.x*d.x+p.y*d.y+p.z*d.z));assert.ok(Math.min(...hits)>0&&Number.isFinite(Math.min(...hits)));}
const ring=createRing();let meshes=0;ring.traverse(o=>{if(o.isMesh){assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));meshes++;}});assert.equal(ring.getObjectByName('Pave_68_stones').count,68);assert.equal(ring.getObjectByName('Pave_gold_beads').count,136);assert.ok(meshes<50,'Instancing prevents excessive draw calls');
console.log(`PASS: 12-shot continuity and reversibility; convex ${planes.length}-facet gem; 68 instanced stones; ${meshes} model draw calls.`);

const pave=ring.getObjectByName('Pave_68_stones'),m1=new THREE.Matrix4(),m2=new THREE.Matrix4();
for(let side=0;side<2;side++)for(let i=0;i<16;i++)for(let row=0;row<2;row++){
 pave.getMatrixAt(side*34+i*2+row,m1);pave.getMatrixAt(side*34+(i+1)*2+row,m2);
 const d=new THREE.Vector3().setFromMatrixPosition(m1).distanceTo(new THREE.Vector3().setFromMatrixPosition(m2));
 assert.ok(d>.062,'Adjacent pave stones must not intersect');
}
console.log('PASS: non-overlapping pavé seats.');
