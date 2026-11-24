import * as esbuild from 'esbuild';
await esbuild.build({entryPoints:['src/main.js'],bundle:true,format:'esm',minify:true,legalComments:'eof',target:['es2020'],outfile:'dist/app.js'});
console.log('Aurelle showroom built.');
