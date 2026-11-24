import {initExperience} from './experience.js';
const root=document.querySelector('#aurelle');
if(root)initExperience(root,{storeUrl:root.dataset.storeUrl||'./store.html'});
