const {chromium}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
  const page=await browser.newPage({viewport:{width:256,height:256},deviceScaleFactor:1});
  const svg=await fs.readFile(path.join(__dirname,'../web/mark.svg'),'utf8');
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:256px;height:256px;display:block}</style>${svg}`);
  const png=await page.screenshot({omitBackground:true});await fs.writeFile(path.join(__dirname,'../web/icon.png'),png);
  const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);
  await fs.writeFile(path.join(__dirname,'../desktop/icon.ico'),Buffer.concat([header,png]));
}finally{await browser.close();}})();
