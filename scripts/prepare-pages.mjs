import {cpSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
cpSync(fileURLToPath(new URL('dist/',root)),fileURLToPath(new URL('docs/',root)),{recursive:true});
writeFileSync(new URL('docs/.nojekyll',root),'');
console.log('GitHub Pages files prepared in docs/.');
