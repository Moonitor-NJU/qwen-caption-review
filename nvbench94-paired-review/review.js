const experiment='nvbench94_qwen_legacy_step73337_20261122_review';
const viewKey=experiment+'_view',fields=['reference','nvv','quality','position','text'];
let reviews={},view={},plan=null,cases=[],results=new Map(),status={},labels=[],initialized=false,lastSignature='';
const dirtyKeys=new Set();
try{reviews=JSON.parse(localStorage.getItem(experiment)||'{}')}catch(e){}
try{view=JSON.parse(localStorage.getItem(viewKey)||'{}')}catch(e){}
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function get(name){const r=await fetch(name+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(name+':'+r.status);return r.json()}
function reviewState(c){
 const count=fields.filter(f=>Boolean(reviews[c.id+'|'+f])).length;
 const completed=Boolean(reviews[c.id+'|nvv']&&reviews[c.id+'|baseline_nvv']);
 return {count,completed,kind:completed?'done':count||reviews[c.id+'|notes']?'partial':'untouched'};
}
function badge(c){const s=reviewState(c);return s.completed?'✓ 已完成NVV听评':s.kind==='partial'?'待评NVV · 已有备注或其他评分':'未评';}
function remember(c){view={...view,tag:c.target,id:c.id};saveView();}
function saveView(){try{localStorage.setItem(viewKey,JSON.stringify(view))}catch(e){$('#saved').textContent='位置保存失败，请导出听评备份';}}
function setReview(key,value){reviews[key]=value;dirtyKeys.add(key);}
function persist(){try{const latest=JSON.parse(localStorage.getItem(experiment)||'{}');for(const k of dirtyKeys)latest[k]=reviews[k];reviews=latest;localStorage.setItem(experiment,JSON.stringify(reviews));dirtyKeys.clear();$('#saved').textContent='✓ 已保存 · '+new Date().toLocaleTimeString();}catch(e){$('#saved').textContent='保存失败，请立即导出听评备份';}updateProgress();}
function currentRows(){return cases.filter(x=>x.target===$('#tag').value&&x.subjective).sort((a,b)=>a.review_rank-b.review_rank);}
function choice(c,field,title,options){const key=c.id+'|'+field;return '<label>'+title+' <select data-key="'+key+'"><option value="">未评</option>'+options.map(x=>'<option value="'+esc(x)+'"'+(reviews[key]===x?' selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label>';}
function updateCard(c){const card=document.getElementById('case-'+c.id);if(!card)return;const s=reviewState(c);card.dataset.reviewState=s.kind;card.querySelector('.review-badge').textContent=badge(c);card.querySelector('.missing-fields').textContent=s.completed?'NVV已评分，自动计入完成进度。其他指标无需填写。':'为两版模型分别选择 NVV 结论，本条即完成。';}
const trainingChoices=['未标记','需要加强','暂不加强'];
const trainingKey=tag=>'category:'+tag+'|training_priority';
function trainingSelect(tag){
 const value=reviews[trainingKey(tag)]||'';
 return '<select data-training-tag="'+esc(tag)+'" aria-label="'+esc(tag)+' 的训练优先级">'+
 trainingChoices.map((label,i)=>{const option=i?label:'';return '<option value="'+esc(option)+'"'+(option===value?' selected':'')+'>'+label+'</option>';}).join('')+'</select>';
}
function updateProgress(){
 if(!plan)return;
 const all=cases.filter(c=>c.subjective),done=all.filter(c=>reviewState(c).completed).length,partial=all.filter(c=>reviewState(c).kind==='partial').length;
 const finishedCats=plan.categories.filter(x=>all.filter(c=>c.target===x.tag&&reviewState(c).completed).length===x.subjective).length;
 $('#review-progress').innerHTML='<strong>你的听评：已完成 '+done+' / '+all.length+' 条</strong> · 部分已评 '+partial+' 条 · 已完成类别 '+finishedCats+' / '+labels.length+'<progress max="'+all.length+'" value="'+done+'"></progress>';
 const selected=$('#tag').value;
 for(const option of $('#tag').options){const tag=option.value,mine=all.filter(c=>c.target===tag),n=mine.filter(c=>reviewState(c).completed).length,p=mine.filter(c=>reviewState(c).kind==='partial').length;option.textContent=(n===mine.length?'✓ ':'')+tag+' · 完成'+n+'/'+mine.length+(p?' · 部分'+p:'');}
 $('#tag').value=selected;
 const mine=currentRows(),d=mine.filter(c=>reviewState(c).completed).length,p=mine.filter(c=>reviewState(c).kind==='partial').length;
 $('#category-review').textContent='本类听评：已完成 '+d+'/'+mine.length+' · 部分已评 '+p+' · 未评 '+(mine.length-d-p)+'。';
 $('#overview').innerHTML=plan.categories.map(x=>{const mine=all.filter(c=>c.target===x.tag),rated=mine.filter(c=>reviews[c.id+'|nvv']),done=mine.filter(c=>reviewState(c).completed).length,hits=rated.filter(c=>reviews[c.id+'|nvv']==='目标事件自然明显').length;return '<tr><td><button class="tag-link" data-go-tag="'+esc(x.tag)+'">'+(done===x.subjective?'✓ ':'')+esc(x.tag)+'</button></td><td>'+x.selected+'</td><td>'+(status.category_generated?.[x.tag]||0)+'</td><td>'+done+' / '+rated.length+' / '+x.subjective+'</td><td>'+hits+(rated.length?' / '+rated.length:'')+'</td><td>'+x.shortfall+'</td><td>'+trainingSelect(x.tag)+'</td></tr>';}).join('');
 $('#current-training-priority').innerHTML='<strong>本类需要加强训练吗？</strong> '+trainingSelect(selected);
 document.querySelectorAll('[data-training-tag]').forEach(select=>select.onchange=()=>{
  const tag=select.dataset.trainingTag;
  setReview(trainingKey(tag),select.value);
  persist();
  [...document.querySelectorAll('[data-training-tag]')].find(el=>el.dataset.trainingTag===tag)?.focus({preventScroll:true});
 });
 document.querySelectorAll('[data-go-tag]').forEach(b=>b.onclick=()=>switchTag(b.dataset.goTag));
 $('#resume').disabled=!view.id&&!view.tag;$('#resume').textContent=view.tag?'继续上次位置：'+view.tag:'继续上次位置';
}
function render({keepScroll=false}={}){
 if(!plan)return;
 const y=window.scrollY,tag=$('#tag').value,cat=plan.categories.find(x=>x.tag===tag);let items=currentRows();
 $('#category').textContent='本类计划生成'+cat.selected+'条，主观试听'+cat.subjective+'条；已生成'+(status.category_generated?.[tag]||0)+'条。'+(cat.shortfall?'不足100条，缺'+cat.shortfall+'条。':'');
 if($('#ready').checked)items=items.filter(x=>results.get(x.id)?.status==='ok');
 if($('#pending').checked)items=items.filter(x=>!reviewState(x).completed);
 $('#cards').innerHTML=items.map(c=>{const x=results.get(c.id),ok=x?.status==='ok',suffix=c.audio.split('.').pop();return '<section id="case-'+c.id+'" data-case-id="'+c.id+'" data-review-state="'+reviewState(c).kind+'"><div class="card-heading"><h2>'+esc(c.target)+' · 试听'+c.review_rank+'/10</h2><span class="review-badge">'+badge(c)+'</span></div><p>来源：'+esc(c.uid)+' · '+(c.tags.length===1?'单标签':'包含：'+esc(c.tags.join('、')))+'</p><h3>实际带标签台词</h3><div class="text">'+esc(c.tagged_text)+'</div><h3>模型实际使用的instruction</h3><div class="caption">'+esc(c.instruction)+'</div><div class="grid"><div class="box"><h3>参考原音</h3>'+(ok?'<audio controls preload="none" data-audio-kind="reference" src="reference/'+c.id+'.'+suffix+'"></audio>':'<p>生成后同步原音。</p>')+'<small data-played="reference">'+(reviews[c.id+'|listened_reference']?'✓ 曾完整播放':'尚未记录完整播放')+'</small><p>原音未输入模型；先确认原音是否真的含目标事件。</p></div><div class="box"><h3>本轮模型 · step73337</h3>'+(ok?'<audio controls preload="none" data-audio-kind="generated" src="'+esc(x.file)+'"></audio><p>'+x.duration_s.toFixed(2)+'秒 · '+(x.model_eos?'模型正常EOS':'未正常EOS')+(x.hit_limit?' · 达到长度上限':'')+'</p>':'<p class="warn">'+(x?.status==='error'?'生成失败：'+esc(x.error):'等待生成／同步')+'</p>')+'<small data-played="generated">'+(reviews[c.id+'|listened_generated']?'✓ 曾完整播放':'尚未记录完整播放')+'</small></div><div class="box"><h3>续训前 · 四轮 Track2</h3>'+(x?.baseline?.status==='ok'?'<audio controls preload="none" data-audio-kind="baseline" src="'+esc(x.baseline.file)+'"></audio>':'<p>四轮模型音频待就绪</p>')+'<small data-played="baseline">'+(reviews[c.id+'|listened_baseline']?'✓ 曾完整播放':'尚未记录完整播放')+'</small></div></div>'+choice(c,'baseline_nvv','四轮模型 NVV',['目标事件自然明显','事件微弱或不确定','没有目标事件','出现其他类型事件','无法判断'])+choice(c,'nvv','本轮模型 NVV（沿用原听评记录）',['目标事件自然明显','事件微弱或不确定','没有目标事件','出现其他类型事件','无法判断'])+'<details class="optional-metrics"><summary>其他指标（可选，无需填写）</summary><div>'+choice(c,'reference','原音目标事件',['明确存在','不确定','原标签疑似错误'])+choice(c,'quality','整体音质',['正常','轻微不自然','明显失真／噪音／重复'])+choice(c,'position','事件位置',['符合要求','位置不符','无法判断'])+choice(c,'text','台词完整性',['基本完整','有漏字／错字','重复或长尾','无法判断'])+'</div></details>'+'<textarea data-key="'+c.id+'|notes" placeholder="听到了什么、哪里不自然、实际出现的其他事件">'+esc(reviews[c.id+'|notes']||'')+'</textarea><div class="finish-row"><button data-next-from="'+c.id+'">下一条未完成</button><span class="missing-fields"></span></div><details><summary>输入正文与可追溯记录</summary><p>'+esc(c.text)+'</p><small>ID：'+c.id+'；源清单行号：'+c.source_line+'；原音SHA256：'+c.sha256+'</small></details></section>';}).join('');
 if(!items.length)$('#cards').innerHTML='<section><p>'+($('#pending').checked&&currentRows().every(c=>reviewState(c).completed)?'✓ 本类10条已全部完成！点击“下一条未完成”继续其他类别。':'当前筛选下没有可显示的样本；未完成音频会继续同步。')+'</p></section>';
 for(const card of document.querySelectorAll('[data-case-id]')){
  const c=cases.find(x=>x.id===card.dataset.caseId);updateCard(c);
  card.addEventListener('pointerdown',()=>remember(c));card.addEventListener('focusin',()=>remember(c));
  for(const el of card.querySelectorAll('[data-key]')){if(el.tagName==='SELECT')el.value=reviews[el.dataset.key]||'';el.oninput=()=>{setReview(el.dataset.key,el.value);remember(c);persist();updateCard(c);};}
  card.querySelector('[data-next-from]').onclick=()=>nextPending(c.id);
  for(const audio of card.querySelectorAll('audio')){audio.onplay=()=>{remember(c);document.querySelectorAll('audio').forEach(a=>{if(a!==audio)a.pause();});};audio.onended=()=>{setReview(c.id+'|listened_'+audio.dataset.audioKind,'yes');card.querySelector('[data-played="'+audio.dataset.audioKind+'"]').textContent='✓ 已完整播放';persist();};}
 }
 updateProgress();if(keepScroll)window.scrollTo(0,y);
}
function switchTag(tag,id){$('#tag').value=tag;history.replaceState(null,'','#'+encodeURIComponent(tag));render();if(id){const el=document.getElementById('case-'+id);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});}else $('#cards').scrollIntoView({behavior:'smooth',block:'start'});}
function nextPending(fromId){
 const current=currentRows(),at=current.findIndex(x=>x.id===fromId);let target=current.slice(at+1).find(x=>!reviewState(x).completed&&results.get(x.id)?.status==='ok');
 if(!target){const all=cases.filter(x=>x.subjective&&results.get(x.id)?.status==='ok').sort((a,b)=>labels.indexOf(a.target)-labels.indexOf(b.target)||a.review_rank-b.review_rank);const start=all.findIndex(x=>x.id===fromId);target=[...all.slice(start+1),...all.slice(0,start+1)].find(x=>!reviewState(x).completed);}
 if(!target){$('#saved').textContent='所有已生成样本均已完成，后续音频仍会继续同步。';return;}remember(target);switchTag(target.target,target.id);
}
async function refresh(){
 try{
  if(!plan){[plan,cases]=await Promise.all([get('selection_plan.json'),get('cases.json')]);labels=plan.categories.map(x=>x.tag);$('#tag').innerHTML=labels.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');const hash=decodeURIComponent(location.hash.slice(1));if(labels.includes(hash))$('#tag').value=hash;else if(labels.includes(view.tag))$('#tag').value=view.tag;}
  const [s,r]=await Promise.all([get('local_status.json').catch(()=>get('progress.json')),get('review_results.json')]);status=s;const localReady=await get('ready_audio_ids.json').catch(()=>null);const localSet=localReady?new Set(localReady):null;results=new Map(r.map(x=>[x.id,localSet&&!localSet.has(x.id)?{...x,status:'sync_pending'}:x]));
  $('#progress').textContent=(s.paused?'【批量已暂停排查】':'')+'Qwen已标注 '+(s.annotation_accepted||0)+' / '+s.selected+'；Vox生成成功 '+s.ok+' / '+s.selected+'；失败 '+s.failed+'；主观试听样本已生成 '+s.subjective_ok+' / '+s.subjective_planned+'。'+(s.estimated_remaining_hours!=null?'按当前速度剩余约'+s.estimated_remaining_hours.toFixed(1)+'小时（含全部生成）。':'')+(s.last_sync?' 最近同步：'+new Date(s.last_sync*1000).toLocaleString():'');
  const signature=r.map(x=>x.id+':'+x.status).sort().join(',');
  if(!initialized){initialized=true;render();lastSignature=signature;}
  else if(signature!==lastSignature&&!document.querySelector('textarea:focus,select:focus')&&![...document.querySelectorAll('audio')].some(a=>!a.paused)){render({keepScroll:true});lastSignature=signature;}
  else updateProgress();
 }catch(e){$('#progress').textContent='数据准备／同步中：'+e.message;}
}
$('#tag').onchange=()=>{view={...view,tag:$('#tag').value,id:null};saveView();switchTag($('#tag').value);};
for(const id of ['ready','pending'])$('#'+id).onchange=()=>{view={...view,ready:$('#ready').checked,pending:$('#pending').checked};saveView();render();};
if(typeof view.ready==='boolean')$('#ready').checked=view.ready;if(typeof view.pending==='boolean')$('#pending').checked=view.pending;
for(const [id,d] of [['prev',-1],['next',1]])$('#'+id).onclick=()=>{const i=labels.indexOf($('#tag').value);$('#tag').value=labels[(i+d+labels.length)%labels.length];$('#tag').onchange();};
$('#resume').onclick=()=>{const target=cases.find(x=>x.id===view.id);if(target){if(reviewState(target).completed)$('#pending').checked=false;switchTag(target.target,target.id);}else if(view.tag)switchTag(view.tag);};
$('#next-review').onclick=()=>nextPending(view.id);
$('#export').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({experiment,schema_version:2,checkpoint:'step73337',caption_protocol:'legacy_training_qwen_f329e380',dataset_sha256:plan?.dataset_sha256,reviews,view},null,2)],{type:'application/json'}));a.download=experiment+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
$('#import').onclick=()=>$('#file').click();$('#file').onchange=async e=>{try{const x=JSON.parse(await e.target.files[0].text());if(x.experiment!==experiment)throw Error('不是本页听评文件');const valid=new Set(cases.map(c=>c.id));for(const [k,v]of Object.entries(x.reviews||{}))if(typeof v==='string'&&(valid.has(k.split('|')[0])||(labels.some(tag=>k===trainingKey(tag))&&(v===''||trainingChoices.slice(1).includes(v)))))setReview(k,v);if(x.view&&labels.includes(x.view.tag)){view=x.view;saveView();}persist();render({keepScroll:true});}catch(x){alert(x.message);}};
window.addEventListener('storage',e=>{if(e.key!==experiment)return;try{const incoming=JSON.parse(e.newValue||'{}');for(const k of dirtyKeys)incoming[k]=reviews[k];reviews=incoming;if(initialized){if(!document.querySelector('textarea:focus,select:focus')&&![...document.querySelectorAll('audio')].some(a=>!a.paused))render({keepScroll:true});else{currentRows().forEach(updateCard);updateProgress();}}}catch(err){}});
refresh();setInterval(refresh,30000);
