export const CHAPTERS = [
 {id:'first-light',en:'First light',idLabel:'Kilau pertama',titleEn:'A world,<br>within a <em>glimmer.</em>',titleId:'Sebuah dunia,<br>dalam satu <em>kilau.</em>',bodyEn:'Scroll into the art of Aurelle.',bodyId:'Jelajahi detail Aurelle melalui scroll.',captionEn:'THE AURELLE EXPERIENCE',captionId:'PERJALANAN AURELLE'},
 {id:'the-cut',en:'The cut',idLabel:'Potongan batu',titleEn:'Light finds<br>its <em>form.</em>',titleId:'Cahaya menemukan<br><em>bentuknya.</em>',bodyEn:'An intimate view of the oval-cut stone.',bodyId:'Melihat lebih dekat potongan batu oval.',captionEn:'01 / THE DIAMOND',captionId:'01 / BERLIAN'},
 {id:'floating-light',en:'Floating light',idLabel:'Cahaya melayang',titleEn:'A quiet<br><em>constellation.</em>',titleId:'Gugusan cahaya<br>yang <em>tenang.</em>',bodyEn:'Facets unfold as the perspective changes.',bodyId:'Sisi-sisi batu terungkap saat sudut berubah.',captionEn:'02 / REFLECTIONS',captionId:'02 / PANTULAN'},
 {id:'the-crown',en:'The crown',idLabel:'Dudukan batu',titleEn:'Architecture<br>in <em>gold.</em>',titleId:'Arsitektur<br>dalam <em>emas.</em>',bodyEn:'An open gallery. Four delicate claws.',bodyId:'Dudukan terbuka dengan empat cabang yang halus.',captionEn:'03 / THE SETTING',captionId:'03 / DUDUKAN'},
 {id:'suspended',en:'Suspended',idLabel:'Sebelum menyatu',titleEn:'Before<br>the <em>embrace.</em>',titleId:'Sesaat sebelum<br><em>menyatu.</em>',bodyEn:'The stone meets its golden setting.',bodyId:'Batu mendekati dudukan emasnya.',captionEn:'04 / THE CONNECTION',captionId:'04 / PERTEMUAN'},
 {id:'the-fit',en:'The embrace',idLabel:'Saat menyatu',titleEn:'Everything,<br>in its <em>place.</em>',titleId:'Setiap detail,<br>di <em>tempatnya.</em>',bodyEn:'One silhouette takes shape.',bodyId:'Satu bentuk mulai tercipta.',captionEn:'05 / THE ASSEMBLY',captionId:'05 / PENYATUAN'},
 {id:'pave',en:'Pavé detail',idLabel:'Detail pavé',titleEn:'A thousand<br>little <em>moments.</em>',titleId:'Detail kecil,<br>kesan yang <em>besar.</em>',bodyEn:'Follow the diamonds along the shoulders.',bodyId:'Ikuti susunan berlian kecil di sisi cincin.',captionEn:'06 / THE SHOULDERS',captionId:'06 / SISI CINCIN'},
 {id:'beneath',en:'Beneath the stone',idLabel:'Di bawah batu',titleEn:'Beauty,<br>from <em>within.</em>',titleId:'Keindahan,<br>dari <em>dalam.</em>',bodyEn:'Discover the structure beneath the diamond.',bodyId:'Lihat struktur di balik dudukan berlian.',captionEn:'07 / THE GALLERY',captionId:'07 / STRUKTUR'},
 {id:'silhouette',en:'The silhouette',idLabel:'Siluet',titleEn:'An unmistakable<br><em>silhouette.</em>',titleId:'Siluet yang<br><em>berkarakter.</em>',bodyEn:'From the smallest detail to the complete form.',bodyId:'Dari detail terkecil menuju bentuk yang utuh.',captionEn:'08 / THE REVEAL',captionId:'08 / BENTUK UTUH'},
 {id:'perspective',en:'Another perspective',idLabel:'Sudut berbeda',titleEn:'Another angle.<br>The same <em>feeling.</em>',titleId:'Sudut berbeda.<br>Kesan yang <em>sama.</em>',bodyEn:'A new view of a familiar shape.',bodyId:'Melihat bentuk yang sama dari sisi berbeda.',captionEn:'09 / THE PROFILE',captionId:'09 / PROFIL'},
 {id:'whole',en:'The whole',idLabel:'Keseluruhan',titleEn:'Made for<br><em>your story.</em>',titleId:'Untuk<br><em>ceritamu.</em>',bodyEn:'The Aurelle ring, seen in its entirety.',bodyId:'Cincin Aurelle dalam bentuk keseluruhannya.',captionEn:'10 / AURELLE',captionId:'10 / AURELLE'},
 {id:'invitation',en:'From form to feeling',idLabel:'Dari bentuk ke rasa',titleEn:'From form<br>to <em>feeling.</em>',titleId:'Dari bentuk<br>menjadi <em>rasa.</em>',bodyEn:'Discover the world of Aurelle.',bodyId:'Temukan dunia Aurelle dan masuk ke store.',captionEn:'11 / THE TRANSITION',captionId:'11 / PERALIHAN'},

];
// Targets are ring-local. Camera offsets are world-space, relative to each target.
// All poses and particle/assembly motion are deterministic functions of scroll.
export const SHOTS = [
 {p:0,offset:[.45,1.15,2.55],target:[0,2.40,0],rotation:[.06,.12,-.10],lift:.98,cloud:1.0,align:.12},
 {p:1/11,offset:[-.6,1.25,1.9],target:[0,2.12,0],rotation:[.12,-.2,-.14],lift:.72,cloud:.85,align:.16},
 {p:2/11,offset:[1.2,.85,3.8],target:[0,1.82,0],rotation:[.15,.35,-.2],lift:.55,cloud:1,align:.13},
 {p:3/11,offset:[1.50,.40,2.05],target:[0,1.28,0],rotation:[.1,.62,-.13],lift:.63,cloud:.3,align:.12},
 {p:4/11,offset:[.85,.75,2.95],target:[0,1.52,0],rotation:[.28,.68,-.18],lift:.42,cloud:.16,align:.12},
 {p:5/11,offset:[-.70,.68,2.5],target:[0,1.37,0],rotation:[.32,.12,-.22],lift:0,cloud:0,align:.16},
 {p:6/11,offset:[1.35,.45,1.8],target:[.62,.7,.02],rotation:[.12,-.22,-.22],lift:0,cloud:0,align:.12},
 {p:7/11,offset:[.5,-.1,2.2],target:[0,1.1,0],rotation:[-.22,1.10,-.18],lift:0,cloud:0,align:.16},
 {p:8/11,offset:[.20,1.50,6.6],target:[0,.24,0],rotation:[.42,.35,-.30],lift:0,cloud:0,align:.17},
 {p:9/11,offset:[0,1.40,6.5],target:[0,.25,0],rotation:[.30,2.65,-.15],lift:0,cloud:0,align:.16},
 {p:10/11,offset:[0,1.65,6.4],target:[0,.24,0],rotation:[.46,5.95,-.23],lift:0,cloud:0,align:.16},
 {p:11/11,offset:[0,1.8,6.8],target:[0,.24,0],rotation:[.48,6.65,-.25],lift:0,cloud:0,align:.16},

];
export const clamp=v=>Math.min(1,Math.max(0,Number.isFinite(v)?v:0));
export const ease=v=>{const t=clamp(v);return t*t*(3-2*t);};
export function sampleMotion(value,mobile=false){
 const p=clamp(value),raw=p*(SHOTS.length-1),i=Math.min(SHOTS.length-2,Math.floor(raw)),a=SHOTS[i],b=SHOTS[i+1];const t=ease((p-a.p)/(b.p-a.p));
 const mix=k=>Array.isArray(a[k])?a[k].map((v,j)=>v+(b[k][j]-v)*t):a[k]+(b[k]-a[k])*t;
 const modelProgress=p;const offset=mix('offset');if(mobile){offset[2]*=1.27+.23*ease((modelProgress-.59)/.12);offset[1]+=.15;}
 return {progress:p,modelProgress,offset,target:mix('target'),rotation:mix('rotation'),lift:mix('lift'),cloud:mix('cloud'),align:mobile?0:mix('align'),chapter:Math.min(CHAPTERS.length-1,Math.round(raw))};
}
