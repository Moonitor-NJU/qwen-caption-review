const datasets=window.NVVVC_DATASETS||[window.NVVVC_DATA],$=s=>document.querySelector(s);
let D=datasets[0],reviews={},page=1,cats;
const activeKey="nvvvc-review:active-dataset";
const requested=new URLSearchParams(location.search).get("dataset");
try{const saved=requested||localStorage.getItem(activeKey);D=datasets.find(x=>x.dataset_id===saved)||D}catch(e){}
const element=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
function storageKey(){return "nvvvc-review:"+D.dataset_id}
function expectedSpeech(){return D.expected_speech||"yes"}
function effective(r){const v=reviews[r.id]||{};if(["reject","uncertain"].includes(v.verdict))return v.verdict;
return v.verdict==="pass"&&v.actual_category===r.category&&v.speech===expectedSpeech()&&["good","usable"].includes(v.quality)&&typeof v.other_events==="string"&&v.other_events.trim()?"pass":"pending"}
function loadDataset(id){
 document.querySelectorAll("audio").forEach(x=>x.pause());D=datasets.find(x=>x.dataset_id===id)||D;reviews={};page=1;
 try{reviews=JSON.parse(localStorage.getItem(storageKey())||"{}");localStorage.setItem(activeKey,D.dataset_id);$("#save").textContent="本批记录单独保存"}catch(e){$("#save").textContent="本地存储不可用，请导出备份"}
 cats=new Map(D.categories.map(c=>[c.en,c.cn]));
 $("#category").replaceChildren(new Option("全部类别",""));for(const c of D.categories)$("#category").add(new Option(c.cn+" · "+c.en,c.en));
 for(const id of ["role","status","search"])$("#"+id).value="";
 document.querySelectorAll("#datasets button").forEach(b=>{const active=b.dataset.id===D.dataset_id;b.setAttribute("aria-selected",String(active));b.tabIndex=active?0:-1});
 $("#scope").textContent=D.title+" · "+(expectedSpeech()==="no"?"纯NV原始录音":"完整语音＋NVV")+" · 待人工核验";
 render()
}
function save(id,value){reviews[id]={...(reviews[id]||{}),...value,updated_at:new Date().toISOString(),method:"user_review"};
try{localStorage.setItem(storageKey(),JSON.stringify(reviews));$("#save").textContent="已保存到本浏览器"}catch(e){$("#save").textContent="保存失败，请立即导出审核记录";$("#save").className="error"}stats()}
function stats(){const n={pass:0,reject:0,uncertain:0,pending:0};D.records.forEach(r=>n[effective(r)]++);
$("#summary").replaceChildren(element("span","本批 "+D.records.length+" 条"),element("span","主候选 "+D.records.filter(r=>r.role==="primary").length),element("span","备选 "+D.records.filter(r=>r.role==="reserve").length),element("span","待核验 "+n.pending),element("span","试听通过 "+n.pass),element("span","排除 "+n.reject),element("span","存疑 "+n.uncertain))}
function selectField(r,label,field,options,wrapper){const box=element("label",label),sel=document.createElement("select");sel.setAttribute("aria-label",label+" "+r.id);
for(const [value,text] of options)sel.add(new Option(text,value));sel.value=(reviews[r.id]||{})[field]||"";box.append(sel);
sel.addEventListener("change",()=>{save(r.id,{[field]:sel.value});state(r,wrapper)});return box}
function state(r,wrapper){const v=reviews[r.id]||{},s=effective(r),e=wrapper.querySelector(".state");e.className="state "+s;
e.textContent={pending:"待核验",pass:"试听通过（未冻结）",reject:"排除",uncertain:"存疑"}[s];
if(v.verdict==="pass"&&s!=="pass")e.textContent=expectedSpeech()==="no"?"待确认类别、无语音、音质与其他事件":"待确认类别、有语音、音质与其他事件"}
function card(r){
 const a=element("article",undefined,"sample");a.dataset.id=r.id;
 const head=element("div",undefined,"sample-head"),left=document.createElement("div");
 left.append(element("h2",r.cn+" · "+r.id),element("div",(r.role==="primary"?"主候选":"备选")+" · "+r.source+" · 本页第 "+r.line+" 行","meta"));
 head.append(left,element("span","","state"));a.append(head);
 const audio=document.createElement("audio");audio.controls=true;audio.preload="none";audio.src=r.audio;audio.setAttribute("aria-label",r.id);
 audio.addEventListener("play",()=>document.querySelectorAll("audio").forEach(x=>{if(x!==audio)x.pause()}));
 audio.addEventListener("error",()=>a.append(element("p","音频加载失败，请刷新重试或检查网络。","error")),{once:true});a.append(audio);
 const rms=r.rms_dbfs===null?"未知":r.rms_dbfs.toFixed(1)+" dBFS";
 a.append(element("div",r.duration.toFixed(3)+" 秒 · "+r.rate+" Hz · "+r.channels+" 声道 · RMS "+rms+" · 峰值 "+r.peak.toFixed(4),"meta"));
 if(r.speaker)a.append(element("div","来源说话人ID："+r.speaker+" · "+(r.split||"")+"（数据集标识）","meta"));
 if(r.flags.length)a.append(element("div","自动提示："+r.flags.join("；"),"flags"));
 if(r.text)a.append(element("p",r.text,"text"));
 if(r.hints.length)a.append(element("div","原标签提示区间（待核对）："+r.hints.map(x=>x[0].toFixed(2)+"–"+x[1].toFixed(2)+" 秒").join("；"),"hints"));
 const provenance={原标签:r.original_tags,去重:"原文件与解码PCM哈希均已检查",模型训练重叠:"未知，不作未见样本声明"};
 if(r.archive)Object.assign(provenance,{压缩包:r.archive,成员:r.member});if(r.split)provenance.官方划分=r.split;
 const details=document.createElement("details");details.append(element("summary","来源与检查信息"),element("pre",JSON.stringify(provenance,null,2)));a.append(details);
 const fields=element("div",undefined,"fields");fields.append(
 selectField(r,"实际事件","actual_category",[["","未确认"],...D.categories.map(c=>[c.en,c.cn]),["other","其他／不是NV事件"]],a),
 selectField(r,"可听语音","speech",[["","未确认"],["yes","有"],["no","没有"],["uncertain","不确定"]],a),
 selectField(r,"音质","quality",[["","未评"],["good","良好"],["usable","可用"],["bad","较差"]],a),
 selectField(r,"试听结论","verdict",[["","待核验"],["pass","确认符合"],["reject","排除"],["uncertain","存疑"]],a));
 for(const [field,title,cls] of [["other_events","其他事件（无则填无）","wide"],["exclude_reason","排除原因","wide"],["notes","试听备注","full"]]){
 const box=element("label",title,cls),input=document.createElement(field==="notes"?"textarea":"input");input.value=(reviews[r.id]||{})[field]||"";input.setAttribute("aria-label",title+" "+r.id);
 input.addEventListener("input",()=>{save(r.id,{[field]:input.value});state(r,a)});box.append(input);fields.append(box)}
 a.append(element("p",r.model_review?"模型意见（非人工结论）："+JSON.stringify(r.model_review):"模型评审：尚未运行；自动音量提示不代表已试听。","model-review"));
 a.append(fields);state(r,a);return a
}
function render(){
 document.querySelectorAll("audio").forEach(a=>a.pause());
 const q=$("#search").value.toLowerCase(),c=$("#category").value,role=$("#role").value,status=$("#status").value;
 const rows=D.records.filter(r=>(!c||r.category===c)&&(!role||r.role===role)&&(!status||effective(r)===status)&&(!q||[r.id,r.text,r.path,r.speaker||""].join(" ").toLowerCase().includes(q)));
 const pages=Math.max(1,Math.ceil(rows.length/20));page=Math.min(page,pages);$("#samples").replaceChildren(...rows.slice((page-1)*20,page*20).map(card));
 if(!rows.length)$("#samples").append(element("p","没有匹配的样本。","empty"));
 $("#count").textContent="筛选结果 "+rows.length+" 条";$("#page").textContent=page+" / "+pages;$("#prev").disabled=page===1;$("#next").disabled=page===pages;stats()
}
for(const d of datasets){const b=element("button",d.tab_title||d.title);b.type="button";b.setAttribute("role","tab");b.dataset.id=d.dataset_id;b.addEventListener("click",()=>loadDataset(d.dataset_id));$("#datasets").append(b)}
for(const id of ["category","role","status"])$("#"+id).addEventListener("change",()=>{page=1;render()});
$("#search").addEventListener("input",()=>{page=1;render()});$("#prev").addEventListener("click",()=>{page--;render();scrollTo(0,0)});$("#next").addEventListener("click",()=>{page++;render();scrollTo(0,0)});
$("#export").addEventListener("click",()=>{const blob=new Blob([JSON.stringify({dataset_id:D.dataset_id,expected_speech:expectedSpeech(),exported_at:new Date().toISOString(),reviews},null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
a.href=url;a.download="NVVVC_review_"+D.dataset_id+"_"+new Date().toISOString().slice(0,10)+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)});
$("#import").addEventListener("change",async e=>{try{
 const file=e.target.files[0];if(!file)return;const incoming=JSON.parse(await file.text());if(incoming.dataset_id!==D.dataset_id||!incoming.reviews||Array.isArray(incoming.reviews))throw Error("数据集版本不一致");
 const known=new Set(D.records.map(r=>r.id));let n=0,skipped=0;
 for(const [id,v] of Object.entries(incoming.reviews)){if(!known.has(id)||!v||typeof v!=="object"||Array.isArray(v))continue;
 const old=reviews[id];if(old?.updated_at&&(!v.updated_at||Date.parse(v.updated_at)<Date.parse(old.updated_at))){skipped++;continue}reviews[id]=v;n++}
 localStorage.setItem(storageKey(),JSON.stringify(reviews));$("#save").textContent="已导入 "+n+" 条；保留较新记录 "+skipped+" 条";render()
}catch(err){$("#save").textContent="导入失败："+err.message}finally{e.target.value=""}});
loadDataset(D.dataset_id);

