// Keep native audio URLs; bound metadata loading and recover stalled playback.
(()=>{
const audios=[...document.querySelectorAll('audio')],queue=[];
let active=0,loaded=0,failed=0;
const status=document.createElement('span'),nav=document.querySelector('nav');
const batch=document.createElement('button');batch.textContent='加载当前筛选音频';nav.append(batch,status);
const original=new WeakMap(),states=new WeakMap();
const rawRoot='https://raw.githubusercontent.com/Moonitor-NJU/qwen-caption-review/main/track2-multiepoch/';
function visible(a){return !a.closest('section')?.hidden&&(!a.closest('details')||a.closest('details').open)}
function show(){status.textContent=` 已载入 ${loaded} 条`+(active||queue.length?'，加载中…':'')+(failed?'；加载失败可点播放器下方重试':'')}
function fallback(a){
 const s=states.get(a);if(!s||s.alternate||location.hostname==='127.0.0.1'||location.protocol==='file:')return false;
 s.alternate=true;a.src=rawRoot+original.get(a).replace(/^\.\//,'');a.preload='metadata';a.load();return true;
}
function enqueue(a,priority=false){
 const s=states.get(a);if(!s||a.readyState>=1||s.loading||s.queued)return;
 s.queued=true;priority?queue.unshift(a):queue.push(a);pump();
}
function pump(){
 while(active<2&&queue.length){
  const a=queue.shift(),s=states.get(a);s.queued=false;
  if(!visible(a)||a.readyState>=1)continue;
  active++;s.loading=true;show();let timer;
  const done=(ok)=>{if(!s.loading)return;s.loading=false;clearTimeout(timer);a.removeEventListener('loadedmetadata',okHandler);a.removeEventListener('error',badHandler);active--;if(ok){loaded++;s.note.textContent='';}else{failed++;s.note.textContent='加载超时或网络错误，请重试或打开备用音频。';}show();pump();};
  const okHandler=()=>done(true),badHandler=()=>done(false);
  a.addEventListener('loadedmetadata',okHandler);a.addEventListener('error',badHandler);
  timer=setTimeout(()=>done(false),12000);
  a.preload='metadata';if(a.networkState===0||a.error)a.load();
 }
 show();
}
audios.forEach(a=>{
 original.set(a,a.getAttribute('src'));a.preload='none';
 const tools=document.createElement('div');tools.style.cssText='font-size:13px;margin:4px 0 10px;line-height:1.6';
 const retry=document.createElement('button');retry.textContent='重新加载';retry.type='button';
 const link=document.createElement('a');link.textContent='单独打开音频';link.href=original.get(a);link.target='_blank';link.rel='noopener';
 const alternate=document.createElement('a');alternate.textContent='备用音频链接';alternate.href=rawRoot+original.get(a);alternate.target='_blank';alternate.rel='noopener';alternate.style.marginLeft='10px';
 const note=document.createElement('span');note.style.marginLeft='8px';
 tools.append(retry,link);if(location.protocol!=='file:')tools.append(alternate);tools.append(note);a.after(tools);
 const s={queued:false,loading:false,alternate:false,note,playTimer:null};states.set(a,s);
 retry.onclick=()=>{note.textContent='重新加载中…';const resume=!a.paused;fallback(a)||a.load();enqueue(a,true);if(resume)a.play().catch(()=>{});};
 a.addEventListener('play',()=>{
  audios.forEach(b=>{if(a!==b)b.pause()});note.textContent=a.readyState<2?'正在加载音频…':'';
  clearTimeout(s.playTimer);s.playTimer=setTimeout(()=>{
   if(!a.paused&&a.currentTime===0&&a.readyState<2){if(fallback(a)){note.textContent='主链接加载较慢，已切换备用链接…';a.play().catch(()=>{note.textContent='已切换备用链接，请再次点击播放。'});}else note.textContent='音频仍未载入，请点重新加载或备用音频链接。';}
  },10000);
 });
 a.addEventListener('playing',()=>{clearTimeout(s.playTimer);note.textContent='';});
 a.addEventListener('error',()=>{note.textContent='音频加载失败，请点重新加载或备用音频链接。';});
 a.addEventListener('ended',()=>{clearTimeout(s.playTimer);});
});
function warmVisible(){
 const near=[...document.querySelectorAll('section:not([hidden])')].filter(s=>{const r=s.getBoundingClientRect();return r.bottom>=0&&r.top<innerHeight+300});
 near.forEach(s=>s.querySelectorAll('.grid audio').forEach(a=>enqueue(a)));
}
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting&&!e.target.hidden)e.target.querySelectorAll('.grid audio').forEach(a=>enqueue(a));}),{rootMargin:'300px'});
document.querySelectorAll('section').forEach(s=>observer.observe(s));
document.querySelectorAll('#subset,#kind').forEach(el=>el.addEventListener('change',()=>{
 for(let i=queue.length-1;i>=0;i--)if(!visible(queue[i])){states.get(queue[i]).queued=false;queue.splice(i,1)}
 requestAnimationFrame(warmVisible);
}));
document.querySelectorAll('details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)d.querySelectorAll('audio').forEach(a=>enqueue(a,true));}));
batch.onclick=()=>document.querySelectorAll('section:not([hidden]) .grid audio').forEach(a=>enqueue(a));
warmVisible();show();
})();
