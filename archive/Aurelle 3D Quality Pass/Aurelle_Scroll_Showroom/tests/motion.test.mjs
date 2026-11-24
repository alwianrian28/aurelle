import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleMotion,SHOTS,CHAPTERS} from '../src/motion.js';
import {createRing,STONE,PAVE,halfWidth,outerOffset,channelDepth} from '../src/ring-model.js';
import {brilliantGeometry,facetPlanes,CUT} from '../src/diamond.js';

// --- 12-shot continuity and determinism -----------------------------------
assert.equal(CHAPTERS.length,12);assert.equal(SHOTS.length,12);
for(let i=0;i<=2000;i++){
 const p=i/2000,m=sampleMotion(p),mobile=sampleMotion(p,true);
 assert.ok([...mobile.offset,...mobile.target,...mobile.rotation].every(Number.isFinite));
 assert.ok([...m.offset,...m.target,...m.rotation,m.lift,m.cloud].every(Number.isFinite));
 assert.ok(m.cloud>=0&&m.cloud<=1);assert.ok(m.lift>=0);assert.ok(m.chapter>=0&&m.chapter<CHAPTERS.length);
}
for(const key of SHOTS.slice(1,-1))for(const mobile of [false,true]){
 const a=sampleMotion(key.p-1e-6,mobile),b=sampleMotion(key.p+1e-6,mobile);
 for(const field of ['offset','target','rotation'])assert.ok(a[field].every((v,i)=>Math.abs(v-b[field][i])<.001),'No camera or object jump');
 assert.ok(Math.abs(a.lift-b.lift)<.001);
}
for(const p of [.1,.43,.61,.96]){const forward=sampleMotion(p);sampleMotion(p+.02);assert.deepEqual(sampleMotion(p),forward,'Reverse scroll must restore exact pose');}
assert.deepEqual(sampleMotion(-3),sampleMotion(0));assert.deepEqual(sampleMotion(4),sampleMotion(1));
assert.equal(sampleMotion(1).lift,0);assert.equal(sampleMotion(1).cloud,0);
assert.ok(sampleMotion(.8,true).offset[2]>sampleMotion(.8).offset[2]);
console.log('PASS: 12-shot continuity, reversibility and clamping.');

// --- Centre stone: convex, every plane is a real facet, plausible proportions ---
const geometry=brilliantGeometry(STONE.rx,STONE.rz),planes=facetPlanes(geometry),pos=geometry.attributes.position;
assert.ok(planes.length>50&&planes.length<192,'Facet uniform budget');
const verts=[];for(let i=0;i<pos.count;i++)verts.push(new THREE.Vector3().fromBufferAttribute(pos,i));
for(const plane of planes){
 const n=new THREE.Vector3(plane.x,plane.y,plane.z);assert.ok(Math.abs(n.length()-1)<1e-6);
 let on=0;for(const p of verts){const s=n.dot(p)-plane.w;assert.ok(s<=1e-5,'All vertices inside every facet plane');if(Math.abs(s)<1e-5)on++;}
 assert.ok(on>=3,'Every facet plane is an actual polished face');
}
const box=geometry.boundingBox,L=box.max.x-box.min.x,W=box.max.z-box.min.z,D=box.max.y-box.min.y;
assert.ok(L/W>1.3&&L/W<1.5,`Oval length/width ${(L/W).toFixed(2)}`);
assert.ok(D/W>.56&&D/W<.64,`Total depth ${(100*D/W).toFixed(1)}% of width`);
assert.ok(box.max.y>0&&box.min.y<0,'Girdle at stone origin');
for(let i=0;i<128;i++){const d=new THREE.Vector3(Math.sin(i*2.399),Math.cos(i*1.7),Math.cos(i*2.399)).normalize();const hits=planes.filter(p=>p.x*d.x+p.y*d.y+p.z*d.z>0).map(p=>p.w/(p.x*d.x+p.y*d.y+p.z*d.z));assert.ok(Math.min(...hits)>0&&Number.isFinite(Math.min(...hits)));}
console.log(`PASS: oval brilliant, ${planes.length} facets, L/W ${(L/W).toFixed(2)}, depth ${(100*D/W).toFixed(1)}%, table ${(CUT.table*100)|0}%.`);

// --- Ring construction --------------------------------------------------------
const ring=createRing();let meshes=0;
ring.traverse(o=>{if(o.isMesh){const a=o.geometry.attributes;assert.ok(a.position.array.every(Number.isFinite));if(a.normal)assert.ok(a.normal.array.every(Number.isFinite),'Finite normals: '+o.name);meshes++;}});
assert.ok(meshes<50,'Instancing prevents excessive draw calls');
const NP=PAVE.perSide*4,pave=ring.getObjectByName(`Pave_${NP}_stones`),beads=ring.getObjectByName('Pave_gold_beads'),band=ring.getObjectByName('Tapered_comfort_fit_band');
assert.equal(pave.count,NP);assert.equal(beads.count,(PAVE.perSide+1)*8);
assert.equal(band.geometry.index.count/3,band.geometry.attributes.position.count*2,'Band is a welded closed surface (no seam duplicates)');
const m1=new THREE.Matrix4(),m2=new THREE.Matrix4(),p1=new THREE.Vector3(),p2=new THREE.Vector3();
for(let side=0;side<2;side++)for(let i=0;i<PAVE.perSide-1;i++)for(let row=0;row<2;row++){
 pave.getMatrixAt(side*PAVE.perSide*2+i*2+row,m1);pave.getMatrixAt(side*PAVE.perSide*2+(i+1)*2+row,m2);
 const d=p1.setFromMatrixPosition(m1).distanceTo(p2.setFromMatrixPosition(m2));
 assert.ok(d>2*PAVE.radius+.008,'Adjacent pavé stones keep a bead gap');
}
for(let i=0;i<pave.count;i++){
 pave.getMatrixAt(i,m1);p1.setFromMatrixPosition(m1);const a=Math.atan2(p1.y,p1.x);
 assert.ok(Math.abs(p1.z)+PAVE.radius<PAVE.channel,'Stone sits inside the channel walls');
 assert.ok(Math.abs(p1.z)+PAVE.radius<halfWidth(a)*.8,'Stone sits on the flat of the shoulder');
 assert.ok(channelDepth(a)>PAVE.depth*.95,'Channel fully cut under every stone');
 const floor=1+outerOffset(a,p1.z),r=Math.hypot(p1.x,p1.y);assert.ok(Math.abs(r-floor-.0005)<1e-4,'Girdle seated on the channel floor');
}
let gripped=0;for(let i=0;i<beads.count;i++){beads.getMatrixAt(i,m1);p1.setFromMatrixPosition(m1);for(let j=0;j<pave.count;j++){pave.getMatrixAt(j,m2);const d=p1.distanceTo(p2.setFromMatrixPosition(m2));assert.ok(d>PAVE.radius*.7,'Bead does not swallow a stone');if(d<PAVE.radius+PAVE.bead)gripped++;}}
assert.ok(gripped>=pave.count*4,'Every stone is held by at least four beads');
// Claws: each must touch the girdle (slight overlap = grip) and stay outside the pavilion.
const stone=new THREE.Mesh(geometry);stone.position.y=STONE.y;stone.updateMatrixWorld();
const facets=planes.map(p=>({n:new THREE.Vector3(p.x,p.y,p.z),w:p.w}));
const signed=q=>{const l=q.clone().sub(stone.position);return Math.max(...facets.map(f=>f.n.dot(l)-f.w));};
for(let i=1;i<=4;i++){
 const claw=ring.getObjectByName('Claw_'+i).geometry.attributes.position;let min=Infinity;
 for(let k=0;k<claw.count;k++)min=Math.min(min,signed(new THREE.Vector3().fromBufferAttribute(claw,k)));
 assert.ok(min<0&&min>-.012,`Claw ${i} grips the girdle (penetration ${(min*8.6).toFixed(3)} mm)`);
}
// Front and back crossover strands must pass each other without intersecting.
const axis=n=>{const p=ring.getObjectByName(n).geometry.attributes.position,c=[];for(let k=0;k<p.count;k+=28){const s=new THREE.Vector3();for(let q=0;q<28;q++)s.add(new THREE.Vector3().fromBufferAttribute(p,k+q));c.push(s.multiplyScalar(1/28));}return c;};
for(const [A,B] of [['Claw_1','Claw_2'],['Claw_3','Claw_4']]){const a=axis(A),b=axis(B);let min=Infinity;for(const p of a)for(const q of b)min=Math.min(min,p.distanceTo(q));assert.ok(min>.115,`${A}/${B} cross with clearance (${min.toFixed(3)})`);}
const railPos=ring.getObjectByName('Under_girdle_rail').geometry.attributes.position;let railMin=Infinity;
for(let k=0;k<railPos.count;k++)railMin=Math.min(railMin,signed(new THREE.Vector3().fromBufferAttribute(railPos,k)));
assert.ok(railMin>.004,`Under-girdle rail clears the pavilion (${railMin.toFixed(4)})`);
// No pavé stone or bead may touch a crossover strand.
for(let c=1;c<=4;c++){const cp=ring.getObjectByName('Claw_'+c).geometry.attributes.position;
 for(const [mesh,clear] of [[pave,PAVE.radius],[beads,PAVE.bead]])for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m1);p1.setFromMatrixPosition(m1);let min=Infinity;for(let k=0;k<cp.count;k+=3)min=Math.min(min,p1.distanceTo(p2.fromBufferAttribute(cp,k)));assert.ok(min>clear+.004,`${mesh.name} ${i} clears Claw_${c} (${min.toFixed(4)})`);}}
console.log(`PASS: ${NP} seated pavé stones clear of the crossover, ${beads.count} beads, 4 crossover claws, welded band, ${meshes} model draw calls.`);
