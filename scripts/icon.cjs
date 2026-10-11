const {chromium}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
  const page=await browser.newPage({viewport:{width:256,height:256},deviceScaleFactor:1});
  const svg=await fs.readFile(path.join(__dirname,'../web/mark.svg'),'utf8');
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:256px;height:256px;display:block}</style>${svg}`);
  const png=await page.screenshot({omitBackground:true});await fs.writeFile(path.join(__dirname,'../web/icon.png'),png);
  const frames=[];
  // Small Windows icons use ordinary 32-bit DIB frames; keep a PNG at 256px.
  // This lets Explorer choose a native size without relying on PNG-only ICOs.
  for(const size of [16,20,24,32,40,48,64,128]){
    const rgba=Buffer.from(await page.evaluate(async({svg,size})=>{
      const image=new Image();image.src='data:image/svg+xml;base64,'+btoa(svg);await image.decode();
      const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
      const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,size,size);
      return btoa(String.fromCharCode(...ctx.getImageData(0,0,size,size).data));
    },{svg,size}),'base64');
    const maskStride=Math.ceil(size/32)*4;
    const dib=Buffer.alloc(40+size*size*4+maskStride*size);
    dib.writeUInt32LE(40,0);dib.writeInt32LE(size,4);dib.writeInt32LE(size*2,8);
    dib.writeUInt16LE(1,12);dib.writeUInt16LE(32,14);dib.writeUInt32LE(size*size*4,20);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const src=(y*size+x)*4,dst=40+((size-1-y)*size+x)*4;
      dib[dst]=rgba[src+2];dib[dst+1]=rgba[src+1];dib[dst+2]=rgba[src];dib[dst+3]=rgba[src+3];
      if(rgba[src+3]===0)dib[40+size*size*4+(size-1-y)*maskStride+(x>>3)]|=128>>(x%8);
    }
    frames.push({size,data:dib});
  }
  frames.push({size:256,data:png});
  const header=Buffer.alloc(6+frames.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(frames.length,4);
  let offset=header.length;
  frames.forEach(({size,data},i)=>{const p=6+i*16;header[p]=header[p+1]=size===256?0:size;header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(data.length,p+8);header.writeUInt32LE(offset,p+12);offset+=data.length;});
  await fs.writeFile(path.join(__dirname,'../desktop/icon.ico'),Buffer.concat([header,...frames.map(f=>f.data)]));
}finally{await browser.close();}})();
