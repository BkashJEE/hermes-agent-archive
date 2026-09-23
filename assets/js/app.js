/* Use-Case Archive — data loading, filtering, rendering. No framework, no build step. */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const SOURCE_LABEL = {
  x: 'X / TWITTER', reddit: 'REDDIT', hn: 'HACKER NEWS',
  fb: 'FACEBOOK', github: 'GITHUB', docs: 'OFFICIAL DOCS', community: 'COMMUNITY'
};

const state = {
  cfg: null,
  data: {},          // sectionId -> items[]
  live: null,
  section: 'use-cases',
  source: 'all',
  range: 'all',
  sort: 'talked',
  q: '',
  tag: null
};

/* ---------------------------------------------------------------- utils */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const num = n => n >= 1000 ? n.toLocaleString('en-US') : String(n);

function ago(iso) {
  if (!iso) return '';
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (!isFinite(d)) return '';
  if (d < 1)  return 'today';
  if (d < 2)  return 'yesterday';
  if (d < 30) return `${Math.round(d)}d ago`;
  if (d < 365) return `${Math.round(d / 30)}mo ago`;
  return `${Math.round(d / 365)}y ago`;
}

async function getJSON(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

/* ------------------------------------------------------------ data load */

async function load() {
  state.cfg = await getJSON('data/index.json');

  const sections = await Promise.all(
    state.cfg.sections.map(s => getJSON(`data/${s.file}`).catch(() => ({ items: [] })))
  );
  state.cfg.sections.forEach((s, i) => { state.data[s.id] = sections[i].items || []; });

  state.live = await getJSON('data/live.json').catch(() => null);
  applyLive();
}

/* Merge fetched public metrics onto curated entries, and append fetched posts.
   Everything here comes from a public API — nothing is hand-written. */
function applyLive() {
  const live = state.live;
  if (!live) return;
  const builds = state.data.builds || [];

  // GitHub: attach real stars/forks to seeded repos; drop seeds that never resolved.
  const byRepo = new Map((live.github || []).map(g => [g.repo.toLowerCase(), g]));
  state.data.builds = builds.filter(item => {
    if (!item.repo) return true;
    const g = byRepo.get(item.repo.toLowerCase());
    if (!g) { item.unresolved = true; return false; }
    item.title   = g.repo;                       // follow renames/transfers
    item.summary = g.description || item.summary;
    item.metric  = { kind: 'stars', value: g.stars };
    item.metric2 = { kind: 'forks', value: g.forks };
    item.lang    = g.language;
    item.url     = g.url;
    item.date    = g.pushedAt || item.date;
    return true;
  });

  const extra = [];

  // Repos found by search that nobody seeded — surfaced as their own cards.
  for (const g of (live.github || []).filter(g => g.discovered)) {
    extra.push({
      id: `gh-${g.repo.replace(/[^\w]+/g, '-').toLowerCase()}`,
      title: g.repo,
      summary: g.description || 'No project description supplied.',
      source: 'github', url: g.url, date: g.pushedAt, lang: g.language,
      metric: { kind: 'stars', value: g.stars }, metric2: { kind: 'forks', value: g.forks },
      tags: ['discovered', ...(g.topics || []).slice(0, 3)]
    });
  }

  for (const h of live.hn || []) {
    extra.push({
      id: `hn-${h.id}`, title: h.title, summary: h.summary || 'Discussed on Hacker News.',
      source: 'hn', url: h.url, date: h.date, author: h.author,
      metric: { kind: 'points', value: h.points }, metric2: { kind: 'comments', value: h.comments },
      tags: ['discussion']
    });
  }
  for (const r of live.reddit || []) {
    extra.push({
      id: `rd-${r.id}`, title: r.title, summary: r.summary || `Posted in r/${r.subreddit}.`,
      source: 'reddit', url: r.url, date: r.date, author: r.author,
      metric: { kind: 'upvotes', value: r.upvotes }, metric2: { kind: 'comments', value: r.comments },
      tags: ['discussion', r.subreddit.toLowerCase()]
    });
  }
  state.data.builds = [...state.data.builds, ...extra];
}

/* -------------------------------------------------------------- filters */

function inRange(item) {
  const days = (state.cfg.ranges.find(r => r.id === state.range) || {}).days || 0;
  if (!days) return true;
  if (!item.date) return false;
  return (Date.now() - new Date(item.date).getTime()) / 86400000 <= days;
}

function matches(item) {
  if (state.source !== 'all' && item.source !== state.source) return false;
  if (!inRange(item)) return false;
  if (state.tag && !(item.tags || []).includes(state.tag)) return false;
  if (state.q) {
    const hay = [item.title, item.summary, item.detail, item.snippet, item.author, ...(item.tags || [])]
      .join(' ').toLowerCase();
    if (!state.q.toLowerCase().split(/\s+/).every(t => hay.includes(t))) return false;
  }
  return true;
}

function sortItems(items) {
  const arr = [...items];
  if (state.sort === 'az')     return arr.sort((a, b) => a.title.localeCompare(b.title));
  if (state.sort === 'recent') return arr.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  // "most talked about": real public numbers first, then curated by recency
  return arr.sort((a, b) => {
    const av = a.metric?.value ?? -1, bv = b.metric?.value ?? -1;
    if (av !== bv) return bv - av;
    return (b.date || '').localeCompare(a.date || '');
  });
}

const visible = id => (state.data[id] || []).filter(matches);

/* ------------------------------------------------------------- renderers */

function pill(source) {
  const key = SOURCE_LABEL[source] ? source : 'curated';
  return `<span class="pill pill-${key}">${esc(SOURCE_LABEL[source] || 'CURATED')}</span>`;
}

function metricBlock(item) {
  if (item.metric) {
    const m2 = item.metric2
      ? `<div class="metric"><span class="m-k">${esc(item.metric2.kind.toUpperCase())}</span><span class="m-v">${num(item.metric2.value)}</span></div>`
      : '';
    return `<div class="metrics">
      <div class="metric"><span class="m-k">${esc(item.metric.kind.toUpperCase())}</span><span class="m-v">${num(item.metric.value)}</span></div>${m2}
    </div>`;
  }
  const tags = (item.tags || []).slice(0, 3);
  return `<div class="tagrow">${tags.map(t => `<span class="trow-tag">${esc(t)}</span>`).join('')}
    <span class="trow-note">no public metric</span></div>`;
}

function card(item, rank) {
  return `<button class="card" role="listitem" data-id="${esc(item.id)}">
    <div class="card-top"><span class="rank">#${rank}</span>${pill(item.source)}</div>
    <h3>${esc(item.title)}</h3>
    <p class="sum">${esc(item.summary)}</p>
    ${metricBlock(item)}
    <div class="card-foot"><span>Open ${item.url ? '&#8599;' : '&rarr;'}</span><span class="when">${esc(ago(item.date))}</span></div>
  </button>`;
}

function renderNav() {
  $('#nav').innerHTML = state.cfg.sections.map(s => `
    <a href="#${s.id}" class="${s.id === state.section ? 'on' : ''}" data-section="${s.id}">
      <span class="nav-ico">${s.icon}</span>${esc(s.label)}<span class="nav-n">${visible(s.id).length}</span>
    </a>`).join('');
}

function renderTags() {
  const counts = new Map();
  for (const s of state.cfg.sections)
    for (const it of state.data[s.id] || [])
      for (const t of it.tags || []) counts.set(t, (counts.get(t) || 0) + 1);

  const top = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10);
  $('#tagList').innerHTML = top.map(([t, n]) => `
    <li><button data-tag="${esc(t)}" class="${state.tag === t ? 'on' : ''}">
      <i class="t-dot"></i>${esc(t)}<span class="t-n">${n}</span>
    </button></li>`).join('');
}

function renderFilters() {
  const bits = [];
  if (state.q)                  bits.push(['q',      `SEARCH: ${state.q}`]);
  if (state.tag)                bits.push(['tag',    `TAG: ${state.tag}`]);
  if (state.source !== 'all')   bits.push(['source', `SOURCE: ${SOURCE_LABEL[state.source] || state.source}`]);
  if (state.range !== 'all')    bits.push(['range',  (state.cfg.ranges.find(r => r.id === state.range) || {}).label?.toUpperCase()]);

  const box = $('#activeFilters');
  box.hidden = !bits.length;
  box.innerHTML = bits.map(([k, label]) => `<button class="chip" data-drop="${k}">${esc(label)} &#10005;</button>`).join('');
}

function render() {
  const sec = state.cfg.sections.find(s => s.id === state.section) || state.cfg.sections[0];
  const items = sortItems(visible(sec.id));

  $('#heroIcon').textContent  = sec.icon;
  $('#heroTitle').textContent = sec.title;
  $('#heroBlurb').textContent = sec.blurb;
  $('#listTitle').innerHTML   = `${esc(sec.label.toUpperCase())} &middot; <span>${items.length}</span>`;
  $('#listSub').textContent   = state.sort === 'talked'
    ? 'Ranked by public reach where a real number exists, then by recency.'
    : state.sort === 'recent' ? 'Newest first.' : 'Alphabetical.';

  $('#grid').innerHTML = items.map((it, i) => card(it, i + 1)).join('');
  $('#empty').hidden = items.length > 0;
  document.title = `${sec.label} · Use-Case Archive`;

  renderNav();
  renderTags();
  renderFilters();
}

/* --------------------------------------------------------------- drawer */

function findItem(id) {
  for (const s of state.cfg.sections) {
    const hit = (state.data[s.id] || []).find(i => i.id === id);
    if (hit) return hit;
  }
  return null;
}

function openDrawer(id) {
  const it = findItem(id);
  if (!it) return;

  const body = (it.detail || it.summary).split('\n\n')
    .map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

  $('#drawerBody').innerHTML = `
    <div class="d-kicker">${pill(it.source)}${it.lang ? `<span class="pill pill-curated">${esc(it.lang)}</span>` : ''}
      <span class="rank">${esc(ago(it.date))}</span></div>
    <h3>${esc(it.title)}</h3>
    <p class="d-sum">${esc(it.summary)}</p>
    <div class="d-body">${body}</div>
    ${it.snippet ? `<div class="d-snip">
        <button class="copy-btn" id="copyBtn">COPY</button>
        <pre><code>${esc(it.snippet)}</code></pre></div>` : ''}
    ${(it.tags || []).length ? `<div class="d-tags">${it.tags.map(t => `<button class="d-tag" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}
    ${it.url ? `<a class="d-link" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">OPEN SOURCE &#8599;</a>` : ''}
    <p class="d-meta">${it.author ? `BY ${esc(it.author)} &middot; ` : ''}${esc(SOURCE_LABEL[it.source] || 'CURATED')}${it.metric ? ` &middot; ${num(it.metric.value)} ${esc(it.metric.kind)}` : ''}</p>`;

  $('#drawer').hidden = false;
  $('#scrim').hidden = false;
  $('#drawerClose').focus();

  const copy = $('#copyBtn');
  if (copy) copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(it.snippet);
      copy.textContent = 'COPIED';
      copy.classList.add('done');
      setTimeout(() => { copy.textContent = 'COPY'; copy.classList.remove('done'); }, 1400);
    } catch {
      copy.textContent = 'SELECT IT';
    }
  };
}

function closeDrawer() {
  $('#drawer').hidden = true;
  $('#scrim').hidden = true;
}

/* ---------------------------------------------------------------- wiring */

function fillSelect(el, options, selected) {
  el.innerHTML = options.map(o => `<option value="${o.id}"${o.id === selected ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
}

function clearFilters() {
  state.q = ''; state.tag = null; state.source = 'all'; state.range = 'all';
  $('#search').value = '';
  $('#sourceSel').value = 'all';
  $('#rangeSel').value = 'all';
  render();
}

function routeFromHash() {
  const id = location.hash.replace('#', '');
  if (state.cfg.sections.some(s => s.id === id)) state.section = id;
}

function wire() {
  fillSelect($('#sourceSel'), state.cfg.sources, state.source);
  fillSelect($('#rangeSel'),  state.cfg.ranges,  state.range);
  fillSelect($('#sortSel'),   state.cfg.sorts,   state.sort);

  $('#curator').textContent     = state.cfg.site.curator;
  $('#siteQuote').textContent   = `“${state.cfg.site.quote}”`;
  $('#siteQuoteBy').textContent = state.cfg.site.quoteAuthor;
  $('#updatedAt').textContent   = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  $('#footGen').textContent     = state.live?.generatedAt
    ? `Live signals last fetched ${new Date(state.live.generatedAt).toLocaleString()}.`
    : 'Live signals not fetched yet — run `npm run fetch` to pull real GitHub, Hacker News and Reddit numbers.';

  const warn = state.live?.warnings || [];
  if (warn.length) {
    const el = document.createElement('p');
    el.className = 'foot-gen foot-warn';
    el.textContent = `Unavailable at last fetch: ${warn.join(' · ')}`;
    $('#footGen').after(el);
  }

  let t;
  $('#search').addEventListener('input', e => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = e.target.value.trim(); render(); }, 130);
  });

  $('#sourceSel').addEventListener('change', e => { state.source = e.target.value; render(); });
  $('#rangeSel').addEventListener('change',  e => { state.range  = e.target.value; render(); });
  $('#sortSel').addEventListener('change',   e => { state.sort   = e.target.value; render(); });
  $('#clearBtn').addEventListener('click', clearFilters);
  $('#refreshBtn').addEventListener('click', async () => { await load(); render(); });
  $('#menuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

  $('#nav').addEventListener('click', e => {
    const a = e.target.closest('[data-section]');
    if (!a) return;
    state.section = a.dataset.section;
    $('#sidebar').classList.remove('open');
    render();
  });

  document.addEventListener('click', e => {
    const tagBtn = e.target.closest('[data-tag]');
    if (tagBtn) {
      state.tag = state.tag === tagBtn.dataset.tag ? null : tagBtn.dataset.tag;
      closeDrawer(); render(); return;
    }
    const drop = e.target.closest('[data-drop]');
    if (drop) {
      const k = drop.dataset.drop;
      if (k === 'q')      { state.q = ''; $('#search').value = ''; }
      if (k === 'tag')    state.tag = null;
      if (k === 'source') { state.source = 'all'; $('#sourceSel').value = 'all'; }
      if (k === 'range')  { state.range  = 'all'; $('#rangeSel').value  = 'all'; }
      render(); return;
    }
    if (e.target.closest('[data-clear]')) { clearFilters(); return; }

    const c = e.target.closest('.card');
    if (c) openDrawer(c.dataset.id);
  });

  $('#drawerClose').addEventListener('click', closeDrawer);
  $('#scrim').addEventListener('click', closeDrawer);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeDrawer(); $('#sidebar').classList.remove('open'); }
    if (e.key === '/' && document.activeElement !== $('#search')) { e.preventDefault(); $('#search').focus(); }
  });

  window.addEventListener('hashchange', () => { routeFromHash(); render(); });
}

/* ------------------------------------------------------------------ boot */

load()
  .then(() => { routeFromHash(); wire(); render(); })
  .catch(err => {
    $('#grid').innerHTML =
      `<div class="empty"><strong>COULD NOT LOAD DATA</strong>
       <span>${esc(err.message)} — this page reads local JSON over fetch(), so it needs a web server.
       Run <code>npm start</code> (or <code>python3 -m http.server</code>) instead of opening the file directly.</span></div>`;
    $('#empty').hidden = true;
  });
