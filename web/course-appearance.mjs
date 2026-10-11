export const courseIcons = [
  {id:'book',label:'阅读',path:'<path d="M12 6c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v15"/>'},
  {id:'chip',label:'电子',path:'<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/>'},
  {id:'wave',label:'信号',path:'<path d="M2 12c3-14 7-14 10 0s7 14 10 0M2 12h20"/>'},
  {id:'math',label:'数学',path:'<path d="M17 3H7l7 9-7 9h10M3 3v18"/>'},
  {id:'atom',label:'物理',path:'<ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/><circle cx="12" cy="12" r="1"/>'},
  {id:'flask',label:'实验',path:'<path d="M9 3h6m-5 0v6L4 19c-.6 1 .2 2 1 2h14c.8 0 1.6-1 1-2L14 9V3M7 15h10"/>'},
  {id:'code',label:'编程',path:'<path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"/>'},
  {id:'language',label:'语言',path:'<path d="M3 5h12M9 2v3m4 0c-1 7-4 10-10 12m2-9c1 4 4 6 7 8m2 5 4-12 4 12m-6-4h4"/>'},
  {id:'globe',label:'地理',path:'<circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><path d="M2 12h20M4 6h16M4 18h16"/>'},
  {id:'art',label:'艺术',path:'<path d="M12 2a10 10 0 1 0 0 20c2 0 3-1 3-3 0-1-2-2-1-3s3 0 4 0c3 0 4-2 4-4A10 10 0 0 0 12 2Z"/><circle cx="7" cy="9" r="1"/><circle cx="12" cy="6" r="1"/><circle cx="17" cy="9" r="1"/><circle cx="6" cy="14" r="1"/>'},
];
export const importanceLabels=['常规','重要','非常重要'];
export const urgencyLabels=['不紧急','较紧急','很紧急'];
export const MAX_COVER_LENGTH=80000;
export function validCover(value) {
  return value===undefined || value==='' || typeof value==='string' && value.length<=MAX_COVER_LENGTH
    && /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(value)
    && (value.length-'data:image/jpeg;base64,'.length)%4===0;
}
export function validAppearance(c) {
  return (c.icon===undefined||courseIcons.some(i=>i.id===c.icon)) && validCover(c.cover)
    && ['importance','urgency'].every(k=>c[k]===undefined||Number.isInteger(c[k])&&c[k]>=0&&c[k]<=2);
}
export function defaultCourseIcon(name='') {
  if(/电子|电路|模电|数电/.test(name))return 'chip';
  if(/信号|系统|通信/.test(name))return 'wave';
  if(/数学|概率|复变|代数|微积分/.test(name))return 'math';
  if(/物理/.test(name))return 'atom';
  if(/实验|化学|生物/.test(name))return 'flask';
  if(/编程|计算机|程序|软件/.test(name))return 'code';
  if(/英语|语言|语文/.test(name))return 'language';
  return 'book';
}
export function courseIcon(c) {
  const chosen=courseIcons.find(i=>i.id===(c.icon||defaultCourseIcon(c.course)))||courseIcons[0];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${chosen.path}</svg>`;
}
// Read a user-chosen local bitmap and store a small, portable JPEG in the backup.
export async function prepareCourseCover(file) {
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('请选择 JPG、PNG 或 WebP 图片');
  if(file.size>12*1024*1024)throw Error('原图超过 12 MB，请选择较小的图片');
  const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('图片读取失败'));reader.readAsDataURL(file);});
  const img=new Image();img.src=data;
  try{await img.decode();}catch{throw Error('图片无法读取，请换一张图片');}
  if(!img.naturalWidth||!img.naturalHeight)throw Error('图片尺寸有误');
  const ratio=16/5,sourceRatio=img.naturalWidth/img.naturalHeight;
  const sw=sourceRatio>ratio?img.naturalHeight*ratio:img.naturalWidth,sh=sourceRatio>ratio?img.naturalHeight:img.naturalWidth/ratio;
  const sx=(img.naturalWidth-sw)/2,sy=(img.naturalHeight-sh)/2,canvas=document.createElement('canvas');
  for(const width of [960,800,640]){canvas.width=width;canvas.height=Math.round(width/ratio);const ctx=canvas.getContext('2d');ctx.fillStyle='#f5f5f7';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
    for(const quality of [.82,.65,.48]){const cover=canvas.toDataURL('image/jpeg',quality);if(validCover(cover))return cover;}
  }
  throw Error('图片压缩后仍过大，请选择纹理较简单的图片');
}
