import * as esbuild from 'esbuild';
await esbuild.build({entryPoints:{app:'src/main.js'},bundle:true,splitting:true,format:'esm',minify:true,legalComments:'eof',target:['es2020'],outdir:'dist',chunkNames:'chunks/[name]-[hash]'});
console.log('Aurelle showroom built.');
