(() => {
  const form = document.querySelector('#github-sync');
  const status = form.querySelector('output');
  const repoInput = form.elements.repository;
  const tokenInput = form.elements.token;
  let connection, timer, busy = false;
  const pending = new Map();
  const queueKey = experiment + '_pending_sync';
  const encode = value => btoa(Array.from(new TextEncoder().encode(value), b => String.fromCharCode(b)).join(''));
  const decode = value => new TextDecoder().decode(Uint8Array.from(atob(value), ch => ch.charCodeAt(0)));
  const report = message => { status.textContent = message; };

  function queue(changes) {
    // Preserve offline edits, including explicit clears, across browser reloads.
    for (const [key, value] of Object.entries(changes)) pending.set(key, value);
    try { localStorage.setItem(queueKey, JSON.stringify(Object.fromEntries(pending))); } catch {}
    clearTimeout(timer);
    if (connection) timer = setTimeout(sync, 1800);
  }

  async function sync() {
    if (!connection || busy) return;
    busy = true;
    try {
      const metadata = await connection.request('');
      if (!metadata.private || metadata.archived) throw Error('评分仓库必须是可写的私有仓库');
      let merged;
      for (let attempt = 0; attempt < 4; attempt++) {
        const real = await connection.request(connection.path, {}, true);
        const saved = real ? JSON.parse(decode(real.content)) : {experiment, dataset: plan.dataset_sha256, reviews: {}};
        if (saved.experiment !== experiment || saved.dataset !== plan.dataset_sha256) throw Error('远端评分属于不同测试集');
        const local = JSON.parse(localStorage.getItem(experiment) || '{}');
        const changes = new Map(pending);
        merged = {...local, ...saved.reviews, ...Object.fromEntries(changes)};
        const changed = Object.keys(merged).some(key => !Object.hasOwn(saved.reviews, key) || merged[key] !== saved.reviews[key]);
        if (changed) {
          const body = {message: 'Sync NVV benchmark reviews', content: encode(JSON.stringify({...saved, reviews: merged}))};
          if (real) body.sha = real.sha;
          try { await connection.request(connection.path, {method:'PUT', body:JSON.stringify(body)}); }
          catch (error) { if ([409,422].includes(error.code) && attempt < 3) continue; throw error; }
        }
        for (const [key,value] of changes) if (pending.get(key) === value) pending.delete(key);
        localStorage.setItem(queueKey, JSON.stringify(Object.fromEntries(pending)));
        reviews = {...merged, ...Object.fromEntries(pending), ...Object.fromEntries([...dirtyKeys].map(k => [k,reviews[k]]))};
        localStorage.setItem(experiment, JSON.stringify(reviews));
        if (initialized) {
          const editing = document.querySelector('textarea:focus,select:focus') || [...document.querySelectorAll('audio')].some(a => !a.paused);
          if (editing) { currentRows().forEach(updateCard); updateProgress(); }
          else if (changed || Object.keys(saved.reviews).some(k => saved.reviews[k] !== local[k])) render({keepScroll:true});
        }
        report('已同步 · ' + new Date().toLocaleTimeString());
        break;
      }
    } catch (error) { report('同步失败，评分仍保存在本机。' + error.message); }
    finally { busy = false; if (connection && pending.size) { clearTimeout(timer); timer = setTimeout(sync, 30000); } }
  }

  try { for (const [key,value] of Object.entries(JSON.parse(localStorage.getItem(queueKey) || '{}'))) pending.set(key,value); } catch {}
  window.addEventListener('review-saved', event => queue(event.detail));
  form.onsubmit = async event => {
    event.preventDefault();
    if (!plan) { report('请等试听清单加载后再连接'); return; }
    const repo = repoInput.value.trim(), token = tokenInput.value.trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !token.startsWith('github_pat_')) { report('请输入 owner/repo 和仅授予该仓库读写权限的细粒度令牌'); return; }
    tokenInput.value = '';
    const request = async (path, options={}, missing=false) => {
      const response = await fetch('https://api.github.com/repos/' + repo + path, {
        ...options, cache:'no-store', redirect:'error', credentials:'omit',
        headers:{Authorization:'Bearer '+token, Accept:'application/vnd.github+json', 'Content-Type':'application/json'}
      });
      if (missing && response.status === 404) return null;
      if (!response.ok) throw Object.assign(Error('GitHub HTTP '+response.status), {code:response.status});
      return response.json();
    };
    connection = {request, path:'/contents/reviews/'+experiment+'.json'};
    report('正在连接 GitHub…');
    await sync();
  };
  form.querySelector('[data-sync-now]').onclick = () => connection ? sync() : report('请先连接私有评分仓库');
  setInterval(sync, 60000);
})();
