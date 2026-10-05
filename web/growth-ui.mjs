import {growthAnalysis,quantityBuckets} from './growth.mjs';
import {courseLabel} from './learning.mjs';
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:3}).format(n);
const tick=n=>Math.abs(n)>=10000?new Intl.NumberFormat('zh-CN',{notation:'compact',maximumFractionDigits:1}).format(n):new Intl.NumberFormat('zh-CN',{maximumFractionDigits:6}).format(n);
const date=d=>d.slice(5).replace('-','/');
const minutes=s=>num(s/60)+' 分钟';
const percent=p=>num(p*100)+'%';
const empty=text=>'<div class="analysis-empty"><span>记录会慢慢长出来</span><p>'+text+'</p></div>';
const table=(headers,rows)=>'<details class="analysis-data"><summary>查看数据</summary><div class="analysis-table-scroll"><table><thead><tr>'+headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></details>';
function scale(max){if(max<=0)return 1;const step=10**Math.floor(Math.log10(max));return Math.ceil(max/step)*step;}
function trendSVG(days){
 const width=Math.max(250,Math.floor($('#analysis-trend').clientWidth)),height=200,left=45,right=12,top=15,bottom=31,base=height-bottom,plot=base-top,max=scale(Math.max(...days.map(d=>d.seconds/60))),x=i=>left+i*(width-left-right)/(days.length-1),y=v=>base-v/max*plot;
 const points=days.map((d,i)=>x(i)+','+y(d.seconds/60)).join(' ');
 const grid=[0,.5,1].map(p=>'<line class="analysis-gridline" x1="'+left+'" x2="'+(width-right)+'" y1="'+y(p*max)+'" y2="'+y(p*max)+'"/><text x="'+(left-8)+'" y="'+(y(p*max)+4)+'" text-anchor="end">'+tick(p*max)+'</text>').join('');
 const ticks=[0,Math.floor((days.length-1)/2),days.length-1].map(i=>'<text x="'+x(i)+'" y="'+(height-6)+'" text-anchor="'+(i===0?'start':i===days.length-1?'end':'middle')+'">'+date(days[i].day)+'</text>').join('');
 return '<svg class="analysis-plot" id="analysis-trend-svg" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="每日专注分钟趋势，详细数值可使用下方日期滑块或查看数据"><g>'+grid+'</g><polygon class="analysis-area" points="'+left+','+base+' '+points+' '+x(days.length-1)+','+base+'"/><polyline class="analysis-line" points="'+points+'"/>'+ticks+'<line id="trend-cursor" class="analysis-cursor" x1="'+x(days.length-1)+'" x2="'+x(days.length-1)+'" y1="'+top+'" y2="'+base+'"/><circle id="trend-point" class="analysis-point" cx="'+x(days.length-1)+'" cy="'+y(days.at(-1).seconds/60)+'" r="4"/></svg>';
}
function quantitySVG(buckets){
 const width=Math.max(250,Math.floor($('#analysis-quantity').clientWidth)),height=200,left=45,right=12,top=15,bottom=31,base=height-bottom,plot=base-top,max=scale(Math.max(0,...buckets.flatMap(b=>[b.target,b.actual]))),slot=(width-left-right)/buckets.length,bw=Math.min(15,slot*.3),y=v=>base-v/max*plot;
 const grid=[0,.5,1].map(p=>'<line class="analysis-gridline" x1="'+left+'" x2="'+(width-right)+'" y1="'+y(p*max)+'" y2="'+y(p*max)+'"/><text x="'+(left-8)+'" y="'+(y(p*max)+4)+'" text-anchor="end">'+tick(p*max)+'</text>').join('');
 const bars=buckets.map((b,i)=>{const x=left+slot*(i+.5);return '<rect class="analysis-target" x="'+(x-bw-1)+'" y="'+y(b.target)+'" width="'+bw+'" height="'+(base-y(b.target))+'" rx="2"/><rect class="analysis-actual" x="'+(x+1)+'" y="'+y(b.actual)+'" width="'+bw+'" height="'+(base-y(b.actual))+'" rx="2"/>';}).join('');
 const indices=[...new Set([0,Math.floor((buckets.length-1)/2),buckets.length-1])];
 const ticks=indices.map(i=>'<text x="'+(left+slot*(i+.5))+'" y="'+(height-6)+'" text-anchor="middle">'+date(buckets[i].from)+'</text>').join('');
 return '<svg class="analysis-plot" id="analysis-quantity-svg" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="学习量目标与实际完成量，详细数值可使用下方滑块或查看数据">'+grid+bars+ticks+'</svg>';
}
export function setupGrowthCharts({getState,getCourse,onCourse}){
 let model,unit,buckets=[];
 function pickTrend(index){const d=model.days[index];if(!d)return;$('#analysis-day-picker').value=index;$('#analysis-day-picker').setAttribute('aria-valuetext',d.day+'，'+minutes(d.seconds)+'，'+d.count+' 次');$('#analysis-day-detail').textContent=d.day+' · '+minutes(d.seconds)+' · '+d.count+' 次';const max=scale(Math.max(...model.days.map(d=>d.seconds/60))),x=45+index*($('#analysis-trend-svg').viewBox.baseVal.width-57)/(model.days.length-1),y=169-d.seconds/60/max*154;$('#trend-cursor')?.setAttribute('x1',x);$('#trend-cursor')?.setAttribute('x2',x);$('#trend-point')?.setAttribute('cx',x);$('#trend-point')?.setAttribute('cy',y);}
 function pickQuantity(index){const b=buckets[index];if(!b)return;$('#analysis-quantity-picker').value=index;const text=(b.from===b.to?b.from:b.from+' — '+b.to)+' · 目标 '+num(b.target)+' / 实际 '+num(b.actual)+' '+unit.unit+' · '+b.count+' 次有填写';$('#analysis-quantity-detail').textContent=text;$('#analysis-quantity-picker').setAttribute('aria-valuetext',text);}
 function wirePlot(id,count,pick,grouped=false){const svg=$(id);if(!svg)return;const pointer=e=>{const r=svg.getBoundingClientRect(),width=svg.viewBox.baseVal.width,x=(e.clientX-r.left)*width/r.width;const index=grouped?Math.floor((x-45)/(width-57)*count):Math.round((x-45)/(width-57)*(count-1));pick(Math.max(0,Math.min(count-1,index)));};svg.onpointermove=e=>{if(e.pointerType==='mouse')pointer(e);};svg.onclick=pointer;}
 function renderQuantity(){
   const saved=$('#analysis-unit').value;$('#analysis-unit').innerHTML=model.units.map(u=>'<option value="'+esc(u.unit)+'">'+esc(u.unit)+'</option>').join('');if(model.units.some(u=>u.unit===saved))$('#analysis-unit').value=saved;
   unit=model.units.find(u=>u.unit===$('#analysis-unit').value);$('#analysis-unit').disabled=!unit;buckets=quantityBuckets(unit,model.period);
   if(!unit||!unit.recorded){$('#analysis-quantity').innerHTML=empty(unit?'有 '+unit.missing+' 次设置目标，尚未填写实际完成量。':'设置学习量目标，并在结束时填写实际完成量。');$('#analysis-quantity-note').textContent='不同单位分别统计；未填写实际完成量的记录不算作 0。';return;}
   $('#analysis-quantity').innerHTML='<div class="analysis-metric"><strong>'+num(unit.actual)+' <small>'+esc(unit.unit)+'</small></strong><span>对应目标 '+num(unit.target)+' · '+unit.recorded+' 次有填写</span></div><div class="analysis-legend"><span><i class="target-key"></i>目标</span><span><i class="actual-key"></i>实际完成</span><span>单位：'+esc(unit.unit)+'</span></div>'+quantitySVG(buckets)+'<output id="analysis-quantity-detail" class="analysis-detail"></output><input id="analysis-quantity-picker" class="analysis-picker" type="range" min="0" max="'+(buckets.length-1)+'" value="'+(buckets.length-1)+'" aria-label="查看各时段学习量">'+table(['日期区间','目标（'+unit.unit+'）','实际（'+unit.unit+'）','有填写次数'],buckets.map(b=>[b.from===b.to?b.from:b.from+' — '+b.to,num(b.target),num(b.actual),b.count]));
   $('#analysis-quantity-note').textContent=(model.period<=7?'按日汇总':'每 7 天汇总，最后一组截至今天')+'；仅对比填写实际完成量的 '+unit.recorded+' 次记录'+(unit.missing?'，另有 '+unit.missing+' 次未填写':'')+'。';
   pickQuantity(buckets.length-1);$('#analysis-quantity-picker').oninput=e=>pickQuantity(Number(e.target.value));wirePlot('#analysis-quantity-svg',buckets.length,pickQuantity,true);
 }
 function render(){
  model=growthAnalysis(getState(),{period:$('#analysis-period').value,course:getCourse()});$('#analysis-scope').textContent=(model.course===null?'全部课程':courseLabel(model.course))+' · '+new Date(model.start).toLocaleDateString('zh-CN')+' — '+new Date(model.now).toLocaleDateString('zh-CN')+'（今天截至当前）';
  $('#analysis-trend').innerHTML=model.sessions?'<div class="analysis-metric"><strong>'+num(model.seconds/60)+' <small>分钟</small></strong><span>'+model.sessions+' 次 · 日均 '+num(model.average/60)+' 分钟 · '+model.activeDays+' 个满 1 分钟的专注日</span></div><div class="analysis-legend">单位：分钟 / 天</div>'+trendSVG(model.days)+'<output id="analysis-day-detail" class="analysis-detail"></output><input id="analysis-day-picker" class="analysis-picker" type="range" min="0" max="'+(model.period-1)+'" value="'+(model.period-1)+'" aria-label="查看每日专注数据">'+table(['日期','专注（分钟）','次数'],model.days.map(d=>[d.day,num(d.seconds/60),d.count])):empty('完成第一段专注后，这里会显示每日投入。');
  if(model.sessions){pickTrend(model.period-1);$('#analysis-day-picker').oninput=e=>pickTrend(Number(e.target.value));wirePlot('#analysis-trend-svg',model.period,pickTrend);}
  $('#analysis-courses').innerHTML=model.courses.length?model.courses.map(c=>'<button class="analysis-bar-row" data-analysis-course="'+esc(JSON.stringify(c.course))+'" aria-label="筛选 '+esc(c.label)+'，'+minutes(c.seconds)+'，占 '+percent(c.share)+'"><span class="analysis-bar-heading"><strong>'+esc(c.label)+'</strong><span>'+minutes(c.seconds)+' · '+percent(c.share)+'</span></span><span class="analysis-bar-track"><span data-width="'+c.share*100+'"></span></span><small>'+c.count+' 次专注 · 点选查看该课程</small></button>').join(''):empty('为专注选择课程，就能看见时间的分布。');
  $('#analysis-course-reset').hidden=model.course===null;
  $('#analysis-causes').innerHTML=model.causes.length?'<div class="analysis-metric"><strong>'+model.thoughtCount+' <small>次主动记录</small></strong><span>按记录次数占比展示</span></div>'+model.causes.map(c=>'<div class="analysis-bar-row"><div class="analysis-bar-heading"><strong>'+esc(c.label)+'</strong><span>'+c.count+' 次 · '+percent(c.share)+'</span></div><div class="analysis-bar-track"><span data-width="'+c.share*100+'"></span></div></div>').join(''):empty('专注时暂存念头并选择原因，这里就能看到分布。');
  document.querySelectorAll('#growth-analysis [data-width]').forEach(el=>el.style.width=el.dataset.width+'%');renderQuantity();
 }
 $('#analysis-period').onchange=render;$('#analysis-unit').onchange=renderQuantity;
 $('#analysis-courses').onclick=e=>{const el=e.target.closest('[data-analysis-course]');if(el)onCourse(JSON.parse(el.dataset.analysisCourse));};$('#analysis-course-reset').onclick=()=>onCourse(null);
 let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(!$('#page-growth').hidden)render();},100);});
 return {render};
}
