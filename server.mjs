import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.json':'application/json'};
const server=http.createServer((req,res)=>{try{const url=new URL(req.url,'http://localhost');const decoded=decodeURIComponent(url.pathname);const file=path.resolve(root,'.'+(decoded==='/'?'/index.html':decoded));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}const stat=fs.statSync(file);if(!stat.isFile())throw Error();res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});fs.createReadStream(file).pipe(res);}catch{res.writeHead(404);res.end('Not found');}});
server.listen(4186,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4186'));
