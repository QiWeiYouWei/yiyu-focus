const http=require('node:http'), fs=require('node:fs'), path=require('node:path');
const root=path.resolve(__dirname,'../web');
http.createServer((req,res)=>{
  const route=decodeURIComponent(req.url.split('?')[0]);
  const file=path.resolve(root,'.'+(route==='/'?'/index.html':route));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found');}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'text/javascript','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data);});
}).listen(4173,'127.0.0.1',()=>console.log('Focus: http://127.0.0.1:4173'));
