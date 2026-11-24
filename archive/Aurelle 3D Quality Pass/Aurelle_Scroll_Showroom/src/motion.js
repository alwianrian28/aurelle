export const CHAPTERS = [
 {id:'first-light',en:'First light',idLabel:'Kilau pertama',titleEn:'Light, kept<br>for a <em>lifetime.</em>',titleId:'Cahaya yang<br>dijaga <em>selamanya.</em>',bodyEn:'Every Aurelle piece begins with a single stone and the light it was made to hold.',bodyId:'Setiap karya Aurelle berawal dari satu batu, dan cahaya yang ditakdirkan untuk ia simpan.',captionEn:'AURELLE · LUXURY JEWELRY',captionId:'AURELLE · LUXURY JEWELRY'},
 {id:'the-cut',en:'The cut',idLabel:'Potongan batu',titleEn:'Cut to <em>catch</em><br>the light.',titleId:'Dipotong untuk<br><em>menangkap</em> cahaya.',bodyEn:'An oval brilliant with ninety facets, each angled to return light to the eye.',bodyId:'Berlian oval brilliant dengan sembilan puluh facet, masing-masing disudutkan untuk memantulkan cahaya kembali ke mata.',captionEn:'02 · THE DIAMOND',captionId:'02 · BERLIAN'},
 {id:'floating-light',en:'Floating light',idLabel:'Cahaya melayang',titleEn:'Chosen from<br><em>many.</em>',titleId:'Dipilih dari<br>sekian <em>banyak.</em>',bodyEn:'Only stones that pass on cut, clarity and colour are allowed into an Aurelle setting.',bodyId:'Hanya batu yang lolos dari segi potongan, kejernihan, dan warna yang masuk ke dudukan Aurelle.',captionEn:'03 · THE SELECTION',captionId:'03 · SELEKSI'},
 {id:'the-crown',en:'The crown',idLabel:'Dudukan batu',titleEn:'Built to<br><em>hold,</em> not hide.',titleId:'Dibuat untuk<br><em>menjaga,</em> bukan menutupi.',bodyEn:'Four slender claws in polished white gold. Just enough metal to keep the stone safe, and no more.',bodyId:'Empat claw ramping dari emas putih yang dipoles. Logam secukupnya untuk menjaga batu, tidak lebih.',captionEn:'04 · THE SETTING',captionId:'04 · DUDUKAN'},
 {id:'suspended',en:'Suspended',idLabel:'Sebelum menyatu',titleEn:'A moment of<br><em>precision.</em>',titleId:'Sebuah momen<br><em>presisi.</em>',bodyEn:'The stone is aligned by hand before it is set, so it sits true from every angle.',bodyId:'Batu diselaraskan dengan tangan sebelum dipasang, agar tegak lurus dari setiap sudut.',captionEn:'05 · ALIGNMENT',captionId:'05 · PENYELARASAN'},
 {id:'the-fit',en:'The embrace',idLabel:'Saat menyatu',titleEn:'Set once.<br><em>Forever.</em>',titleId:'Dipasang sekali.<br><em>Selamanya.</em>',bodyEn:'Each claw is closed over the girdle, holding the diamond in a firm, quiet grip.',bodyId:'Setiap claw ditutup di atas tepi batu, menggenggam berlian dengan erat dan tenang.',captionEn:'06 · THE SETTING',captionId:'06 · PEMASANGAN'},
 {id:'pave',en:'Pavé detail',idLabel:'Detail pavé',titleEn:'Brilliance,<br>in the <em>details.</em>',titleId:'Kilau ada<br>pada <em>detail.</em>',bodyEn:'Fifty-six diamonds line the shoulders, each seated in its own bead-set place.',bodyId:'Lima puluh enam berlian menghiasi bahu cincin, masing-masing duduk di tempatnya sendiri.',captionEn:'07 · THE PAVÉ',captionId:'07 · PAVÉ'},
 {id:'beneath',en:'Beneath the stone',idLabel:'Di bawah batu',titleEn:'Open to<br>the <em>light.</em>',titleId:'Terbuka<br>untuk <em>cahaya.</em>',bodyEn:'The crossing gallery leaves the stone open beneath, so light enters from every side.',bodyId:'Struktur silang di bawah batu dibiarkan terbuka, agar cahaya masuk dari segala arah.',captionEn:'08 · THE GALLERY',captionId:'08 · STRUKTUR'},
 {id:'silhouette',en:'The silhouette',idLabel:'Siluet',titleEn:'Quiet,<br>by <em>design.</em>',titleId:'Tenang,<br>secara <em>desain.</em>',bodyEn:'A slim, tapered band that lets the diamond speak first.',bodyId:'Band ramping yang meruncing, membiarkan berlian berbicara lebih dulu.',captionEn:'09 · THE SILHOUETTE',captionId:'09 · SILUET'},
 {id:'perspective',en:'Another perspective',idLabel:'Sudut berbeda',titleEn:'Beautiful from<br>every <em>angle.</em>',titleId:'Indah dari<br>setiap <em>sudut.</em>',bodyEn:'Turn your hand and the ring answers with new light, from the table to the inner band.',bodyId:'Gerakkan tangan, dan cincin menjawab dengan cahaya baru, dari permukaan batu hingga sisi dalam band.',captionEn:'10 · THE PROFILE',captionId:'10 · PROFIL'},
 {id:'whole',en:'Held by the claw',idLabel:'Digenggam claw',titleEn:'Every detail,<br><em>deliberate.</em>',titleId:'Setiap detail,<br><em>disengaja.</em>',bodyEn:'Up close, the work shows: a polished claw, a clean girdle, nothing left to chance.',bodyId:'Dari dekat, kerja tangan terlihat: claw yang dipoles, tepi batu yang bersih, tidak ada yang kebetulan.',captionEn:'11 · CRAFT',captionId:'11 · KERAJINAN'},
 {id:'invitation',en:'Into the light',idLabel:'Menuju cahaya',titleEn:'Step into<br>the <em>light.</em>',titleId:'Melangkah ke<br>dalam <em>cahaya.</em>',bodyEn:'The full collection is waiting inside.',bodyId:'Seluruh koleksi menanti di dalam.',captionEn:'12 · AURELLE',captionId:'12 · AURELLE'},
];
// Targets are ring-local. Camera offsets are world-space, relative to each target.
// All poses and particle/assembly motion are deterministic functions of scroll.
export const SHOTS = [
 {p:0,offset:[.45,1.15,2.55],target:[0,2.40,0],rotation:[.06,.12,-.10],lift:.98,cloud:.5,align:.12},
 {p:1/11,offset:[-.6,1.25,1.9],target:[0,2.12,0],rotation:[.12,-.2,-.14],lift:.72,cloud:.3,align:.16},
 {p:2/11,offset:[1.2,.85,3.8],target:[0,1.82,0],rotation:[.15,.35,-.2],lift:.55,cloud:1,align:.13},
 {p:3/11,offset:[1.50,.40,2.05],target:[0,1.28,0],rotation:[.1,.62,-.13],lift:.63,cloud:.3,align:.12},
 {p:4/11,offset:[.85,.75,2.95],target:[0,1.52,0],rotation:[.28,.68,-.18],lift:.42,cloud:.16,align:.12},
 {p:5/11,offset:[-.70,.68,2.5],target:[0,1.37,0],rotation:[.32,.12,-.22],lift:0,cloud:0,align:.16},
 {p:6/11,offset:[1.45,.95,1.35],target:[.70,.79,0],rotation:[.12,-.22,-.22],lift:0,cloud:0,align:.12},
 {p:7/11,offset:[.5,-.1,2.2],target:[0,1.1,0],rotation:[-.22,1.10,-.18],lift:0,cloud:0,align:.16},
 {p:8/11,offset:[.20,1.50,6.6],target:[0,.24,0],rotation:[.42,.35,-.30],lift:0,cloud:0,align:.07},
 {p:9/11,offset:[0,1.40,6.5],target:[0,.25,0],rotation:[.30,2.65,-.15],lift:0,cloud:0,align:.07},
 // 11-12 follow the reference reversed: claw macro at the girdle, then rise to the face-up diamond POV.
 {p:10/11,offset:[.24,.46,1.62],target:[.30,1.40,.17],rotation:[.10,5.62,0],lift:0,cloud:0,align:.18},
 {p:11/11,offset:[0,0,.52],target:[0,1.62,0],rotation:[0,7.854,1.5708],lift:0,cloud:0,align:0},

];
export const clamp=v=>Math.min(1,Math.max(0,Number.isFinite(v)?v:0));
export const ease=v=>{const t=clamp(v);return t*t*(3-2*t);};
export function sampleMotion(value,mobile=false){
 const p=clamp(value),raw=p*(SHOTS.length-1),i=Math.min(SHOTS.length-2,Math.floor(raw)),a=SHOTS[i],b=SHOTS[i+1];const t=ease((p-a.p)/(b.p-a.p));
 const mix=k=>Array.isArray(a[k])?a[k].map((v,j)=>v+(b[k][j]-v)*t):a[k]+(b[k]-a[k])*t;
 const modelProgress=p;const offset=mix('offset');if(mobile){offset[2]*=1.27+.23*ease((modelProgress-.59)/.12);offset[1]+=.15;}
 return {progress:p,modelProgress,offset,target:mix('target'),rotation:mix('rotation'),lift:mix('lift'),cloud:mix('cloud'),align:mobile?0:mix('align'),chapter:Math.min(CHAPTERS.length-1,Math.round(raw))};
}
