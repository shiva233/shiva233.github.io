import {createServer} from 'node:http';
import {createReadStream,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('./',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml','.mp4':'video/mp4','.pdf':'application/pdf','.ttf':'font/ttf'};
const host=process.env.HOST??'127.0.0.1',port=Number(process.env.PORT??8780);
createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'}).end();return}
 let name;try{name=decodeURIComponent(new URL(req.url,'http://local').pathname)}catch{res.writeHead(400).end();return}
 const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
 const relative=path.relative(root,file).split(path.sep).join('/');
 const publicFile=['index.html','app.js','styles.css','Shiva_Prakash_Resume_+_Portfolio.pdf'].includes(relative)||relative.startsWith('assets/');
 if(!file.startsWith(root)||!publicFile||!types[path.extname(file)]){res.writeHead(404).end();return}
 let size;try{const stat=statSync(file);if(!stat.isFile())throw Error();size=stat.size}catch{res.writeHead(404).end();return}
 let start=0,end=size-1;
 if(req.headers.range){
  const m=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if(!m||(!m[1]&&!m[2]))start=size;
  else if(m[1]){start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),end):end}
  else start=Math.max(0,size-Number(m[2]));
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`}).end();return}
 }
 res.writeHead(req.headers.range?206:200,{'Content-Type':types[path.extname(file)],'Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff',...(req.headers.range?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});
 if(req.method==='HEAD'){res.end();return}
 const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
}).listen(port,host,()=>console.log(`Portfolio: http://${host}:${port}/`));
