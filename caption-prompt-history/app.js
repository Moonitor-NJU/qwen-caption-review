'use strict';
let catalog;
const versionsById=new Map();
const $=id=>document.getElementById(id);
function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function disclosure(title,text){const d=node('details');d.append(node('summary','',title));d.append(node('pre','',text));return d;}
function actualPrompt(v,s){return v.prompt.replaceAll('{{TAGGED_TEXT}}',s.taggedText).replaceAll('{{ALLOWED_LABELS}}',s.whitelist||'');}
function pauseOthers(current){for(const audio of document.querySelectorAll('audio'))if(audio!==current)audio.pause();}
document.addEventListener('play',event=>{if(event.target.tagName==='AUDIO')pauseOthers(event.target);},true);
function compare(){
 const id=$('compare-select').value;
 const completed=catalog.versions.filter(v=>v.samples.length);
 const first=completed.map(v=>v.samples.find(s=>s.id===id)).find(Boolean);
 if(!first){$('load-status').textContent='这条原音暂时没有可比较的结果。';return;}
 const audio=$('compare-audio');audio.pause();audio.src=first.audioUrl;audio.load();
 $('compare-input').textContent=first.taggedText;
 const container=$('compare-captions');container.replaceChildren();
 const last=completed.at(-1).id;
 for(const v of completed){
  const sample=v.samples.find(s=>s.id===id);
  const card=node('article','compare-card'+(v.id===last?' latest':''));
  const heading=node('h3');const link=node('a','',v.title);link.href='#'+v.id;heading.append(link);card.append(heading);
  card.append(node('p',sample?'':'missing',sample?sample.caption:'本版未生成这条原音，不能作同样本比较。'));
  container.append(card);
 }
}
function sampleCard(v,s,index){
 const card=node('article','sample-card');card.id=v.id+'--'+s.id;
 const title=node('h3','',String(index+1).padStart(2,'0')+' · '+s.label);title.append(node('span','tag',s.target));card.append(title);
 const audio=document.createElement('audio');audio.controls=true;audio.preload='none';audio.setAttribute('playsinline','');audio.src=s.audioUrl;card.append(audio);
 card.append(node('p','caption-box',s.caption));
 card.append(disclosure('原带标签文本',s.taggedText));
 if(s.whitelist)card.append(disclosure('本条实际输入的白名单',s.whitelist));
 if(s.note)card.append(node('p','review-note','文字核对：'+s.note+' 此说明不是声学准确率评分。'));
 card.append(disclosure('实际完整 Prompt（已替换本条输入）',actualPrompt(v,s)));
 card.append(disclosure('模型原始输出',s.rawOutput));
 return card;
}
function ensureSamples(panel){
 if(panel.dataset.built==='true')return;
 const v=versionsById.get(panel.dataset.version);if(!v)return;
 const container=panel.querySelector('.sample-content');
 const toolbar=node('div','sample-toolbar');
 const search=node('input');search.type='search';search.placeholder='按类别、Caption 或核对备注筛选';search.setAttribute('aria-label','筛选'+v.title+'的样本');
 toolbar.append(search);
 const groups=[...new Set(v.samples.map(s=>s.group))];let group;
 if(groups.length>1){
  group=node('select');group.setAttribute('aria-label','选择主对照或扩展样本');
  const all=node('option','','全部样本（'+v.samples.length+'）');all.value='all';group.append(all);
  for(const g of groups){const count=v.samples.filter(s=>s.group===g).length;const option=node('option','',(g==='base'?'主对照样本':'补充样本')+'（'+count+'）');option.value=g;group.append(option);}
  toolbar.append(group);
 }else toolbar.classList.add('single');
 const count=node('p','sample-count');
 const list=node('div','sample-list');
 const cards=v.samples.map((s,i)=>({s,card:sampleCard(v,s,i)}));
 cards.forEach(x=>list.append(x.card));
 function filter(){
  const q=search.value.trim().toLowerCase();let shown=0;
  for(const item of cards){
   const selected=!group||group.value==='all'||item.s.group===group.value;
   const matches=(item.s.label+' '+item.s.target+' '+item.s.caption+' '+item.s.note).toLowerCase().includes(q);
   item.card.hidden=!(selected&&matches);if(!item.card.hidden)shown++;else item.card.querySelector('audio').pause();
  }
  count.textContent='显示 '+shown+' / '+v.samples.length+' 条；原音按需加载，Caption 为本版实际输出。';
 }
 search.addEventListener('input',filter);if(group)group.addEventListener('change',filter);
 container.append(toolbar,count,list);panel.dataset.built='true';filter();
}
function markNav(){
 const hash=decodeURIComponent(location.hash.slice(1)).split('--')[0];
 for(const a of document.querySelectorAll('.sidebar nav a'))a.classList.toggle('active',a.getAttribute('href')==='#'+hash);
}
async function start(){
 try{
  const response=await fetch('versions.json',{cache:'no-cache'});if(!response.ok)throw Error('数据请求失败（'+response.status+'）');
  catalog=await response.json();catalog.versions.forEach(v=>versionsById.set(v.id,v));
  $('compare-select').addEventListener('change',compare);compare();$('load-status').textContent='已载入。点击播放可听原音；点击版本标题可跳到对应 Prompt。';
  for(const panel of document.querySelectorAll('.samples-panel')){
   panel.addEventListener('toggle',()=>{if(panel.open)ensureSamples(panel);});
   if(panel.open)ensureSamples(panel);
  }
  for(const button of document.querySelectorAll('.copy-prompt')){
   button.addEventListener('click',async()=>{
    const status=button.parentElement.querySelector('.copy-status');
    try{await navigator.clipboard.writeText(versionsById.get(button.dataset.version).prompt);status.textContent='已复制。';}
    catch{status.textContent='请在下方选中完整提示词手动复制。';}
   });
  }
  const hash=decodeURIComponent(location.hash.slice(1));
  if(hash.includes('--')){
   const id=hash.split('--')[0];const panel=document.querySelector('.samples-panel[data-version="'+id+'"]');
   if(panel){ensureSamples(panel);panel.open=true;requestAnimationFrame(()=>document.getElementById(hash)?.scrollIntoView());}
  }
  markNav();
 }catch(error){
  $('load-status').textContent='迭代数据暂未载入，请刷新。也可以先使用各版本下方的原独立页链接。';$('load-status').classList.add('error');
  console.error(error);
 }
}
window.addEventListener('hashchange',markNav);
start();