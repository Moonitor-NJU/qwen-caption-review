// Prefetch nearby comparison clips with at most two background transfers.
(()=>{
if(location.protocol==='file:')return;
const memo=new Map(),queue=[];let active=0,finished=0,failed=0;
const status=document.createElement('span');status.style.marginLeft='10px';
const button=document.createElement('button');button.textContent='缓存当前筛选音频';
const nav=document.querySelector('nav');nav.append(button,status);
function progress(){status.textContent='已预载 '+finished+' 条'+(queue.length||active?'，加载中…':'')+(failed?'，'+failed+'条稍后可点播放重试':'')}
function apply(a,entry){
 if(!entry.blob||!a.paused||a.currentTime>0)return;
 a.src=entry.blob;a.preload='auto';a.load();a.dataset.cached='1';
}
async function pump(){
 while(active<2&&queue.length){
  const entry=queue.shift();active++;entry.state='loading';progress();
  fetch(entry.url,{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error(r.status);return r.blob()})
  .then(b=>{entry.blob=URL.createObjectURL(b);entry.state='ready';finished++;entry.targets.forEach(a=>apply(a,entry))})
  .catch(()=>{entry.state='failed';failed++})
  .finally(()=>{active--;progress();pump()});
 }
}
function warm(a){
 const url=a.dataset.originalSrc||(a.dataset.originalSrc=a.getAttribute('src'));
 if(!url||url.startsWith('blob:'))return;
 const key=new URL(url,location.href).href;
 let entry=memo.get(key);
 if(!entry){entry={url:key,state:'queued',targets:new Set()};memo.set(key,entry);queue.push(entry)}
 entry.targets.add(a);if(entry.state==='ready')apply(a,entry);pump();
}
const observer=new IntersectionObserver(entries=>{
 entries.forEach(e=>{if(e.isIntersecting&&!e.target.hidden)e.target.querySelectorAll('.grid audio').forEach(warm)});
},{rootMargin:'300px'});
document.querySelectorAll('section').forEach(s=>observer.observe(s));
button.onclick=()=>{document.querySelectorAll('section:not([hidden]) .grid audio').forEach(warm);progress()};
document.querySelectorAll('details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)d.querySelectorAll('audio').forEach(warm)}));
document.querySelectorAll('audio').forEach(a=>{
 a.addEventListener('ended',()=>{const section=a.closest('section');if(section&&section.nextElementSibling)section.nextElementSibling.querySelectorAll('.grid audio').forEach(warm)});
});
progress();
})();
