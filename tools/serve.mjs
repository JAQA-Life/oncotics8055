import http from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../public_html');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.bin':'application/octet-stream','.onnx':'application/octet-stream','.zip':'application/zip'};
const server=http.createServer(async(req,res)=>{
  try{
    const uri=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(uri.split('/').some(x=>x.startsWith('.')||x==='..'))throw Error('Denied');
    let file=path.resolve(root,'.'+uri);
    if(!file.startsWith(root+path.sep)&&file!==root)throw Error('Denied');
    if((await stat(file)).isDirectory())file=path.join(file,'index.html');
    const body=await readFile(file);
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Cross-Origin-Opener-Policy','same-origin');
    if(uri.startsWith('/imaging/')||uri.startsWith('/assets/ohif/'))res.setHeader('Cross-Origin-Embedder-Policy','credentialless');
    if(uri.startsWith('/scenario-lab/'))res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://clinicaltrials.gov https://www.ebi.ac.uk https://rest.uniprot.org https://pubchem.ncbi.nlm.nih.gov https://api.fda.gov; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'");
    res.end(body);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log('Oncotics preview on http://127.0.0.1:'+server.address().port));
