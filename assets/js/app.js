/* Use-Case Archive — data loading, filtering, rendering. No framework, no build step. */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const SOURCE_LABEL = {
  x: 'X / TWITTER', reddit: 'REDDIT', hn: 'HACKER NEWS', discord: 'DISCORD',
  fb: 'FACEBOOK', github: 'GITHUB', youtube: 'YOUTUBE', blog: 'BLOG',
  podcast: 'PODCAST', linkedin: 'LINKEDIN', producthunt: 'PRODUCT HUNT',
  docs: 'OFFICIAL DOCS', community: 'COMMUNITY'
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
  tag: null,
  author: null
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
    // A computed section has no file; asking for data/undefined would 404.
    state.cfg.sections.map(s => s.file ? getJSON(`data/${s.file}`).catch(() => ({ items: [] })) : { items: [] })
  );
  state.cfg.sections.forEach((s, i) => { state.data[s.id] = sections[i].items || []; });

  state.live = await getJSON('data/live.json').catch(() => null);
  applyLive();
}

/* Merge fetched public metrics onto curated entries, then shelve everything the
   sourcing pipeline found. Every value here came from a public API — nothing is
   hand-written, and nothing is estimated. */
function applyLive() {
  const live = state.live;
  if (!live) return;
  // GitHub: attach real stars/forks to any seeded repo, on any shelf.
  // A seed that never resolved is hidden rather than shown with a guess.
  const byRepo = new Map((live.github || []).map(g => [g.repo.toLowerCase(), g]));
  for (const [sectionId, items] of Object.entries(state.data)) {
    state.data[sectionId] = items.filter(item => {
      if (!item.repo) return true;
      const g = byRepo.get(item.repo.toLowerCase());
      // Nothing is removed because a lookup failed — the write-up is the value,
      // the star count is decoration. It simply shows no metric.
      if (!g) return true;
      item.title   = g.repo;                       // follow renames/transfers
      // A curated write-up outranks the repo's own one-liner.
      if (!item.detail) item.summary = g.description || item.summary;
      item.metric  = { kind: 'stars', value: g.stars };
      item.metric2 = { kind: 'forks', value: g.forks };
      item.lang    = g.language;
      item.url     = g.url;
      item.date    = g.pushedAt || item.date;
      return true;
    });
  }

  const shelve = (sectionId, raw) => {
    if (!state.data[sectionId]) return;
    state.data[sectionId].push({
      id: raw.id,
      title: raw.title,
      summary: raw.summary,
      source: raw.source,
      url: raw.url,
      author: raw.author,
      date: raw.date,
      lang: raw.lang,
      metric: raw.metric,
      metric2: raw.metric2,
      sourced: raw.routedBy || 'auto',
      tags: ['sourced', ...(raw.topics || []).slice(0, 2)]
    });
  };

  if (live.routed) {
    // Routed by scripts/route-signals.mjs — each signal on the shelf it belongs to.
    for (const [sectionId, items] of Object.entries(live.routed))
      for (const raw of items) shelve(sectionId, raw);
    return;
  }

  // Not routed yet: everything fetched still belongs somewhere, so it goes to builds.
  for (const g of (live.github || []).filter(g => g.discovered))
    shelve('builds', {
      id: `gh-${g.repo.replace(/[^\w]+/g, '-').toLowerCase()}`, title: g.repo,
      summary: g.description || 'No project description supplied.', source: 'github',
      url: g.url, date: g.pushedAt, lang: g.language, topics: g.topics,
      metric: { kind: 'stars', value: g.stars }, metric2: { kind: 'forks', value: g.forks }
    });
  for (const h of live.hn || [])
    shelve('builds', {
      id: `hn-${h.id}`, title: h.title, summary: h.summary, source: 'hn', url: h.url,
      author: h.author, date: h.date,
      metric: { kind: 'points', value: h.points }, metric2: { kind: 'comments', value: h.comments }
    });
  for (const r of live.reddit || [])
    shelve('builds', {
      id: `rd-${r.id}`, title: r.title, summary: r.summary, source: 'reddit', url: r.url,
      author: r.author, date: r.date,
      metric: { kind: 'upvotes', value: r.upvotes }, metric2: { kind: 'comments', value: r.comments }
    });
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
  if (state.author && item.author !== state.author) return false;
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
    <div class="card-top"><span class="rank">#${rank}</span>
      ${item.sourced ? '<span class="pill pill-sourced" title="Found by the sourcing pipeline, not written by hand">SOURCED</span>' : ''}${pill(item.source)}</div>
    <h3>${esc(item.title)}</h3>
    <p class="sum">${esc(item.summary)}</p>
    ${metricBlock(item)}
    <div class="card-foot"><span>Open ${item.url ? '&#8599;' : '&rarr;'}</span><span class="when">${esc(ago(item.date))}</span></div>
  </button>`;
}

function renderNav() {
  $('#nav').innerHTML = state.cfg.sections.map(s => `
    <a href="#${s.id}" class="${s.id === state.section ? 'on' : ''}" data-section="${s.id}">
      <span class="nav-ico">${s.icon}</span>${esc(s.label)}<span class="nav-n">${s.file ? visible(s.id).length : ''}</span>
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
  if (state.author)             bits.push(['author', `AUTHOR: ${state.author}`]);
  if (state.source !== 'all')   bits.push(['source', `SOURCE: ${SOURCE_LABEL[state.source] || state.source}`]);
  if (state.range !== 'all')    bits.push(['range',  (state.cfg.ranges.find(r => r.id === state.range) || {}).label?.toUpperCase()]);

  const box = $('#activeFilters');
  box.hidden = !bits.length;
  box.innerHTML = bits.map(([k, label]) => `<button class="chip" data-drop="${k}">${esc(label)} &#10005;</button>`).join('');
}

function render() {
  const sec = state.cfg.sections.find(s => s.id === state.section) || state.cfg.sections[0];

  $('#heroIcon').textContent  = sec.icon;
  $('#heroTitle').textContent = sec.title;
  $('#heroBlurb').textContent = sec.blurb;
  document.title = `${sec.label} · Hermes Agent Archive`;

  const isDash = sec.kind === 'dashboard';
  $('#dashboard').hidden = !isDash;
  $('#listbar').hidden   = isDash;
  $('#grid').hidden      = isDash;
  if (isDash) {
    $('#empty').hidden = true;
    renderDashboard();
    renderNav(); renderTags(); renderFilters();
    return;
  }

  const items = sortItems(visible(sec.id));
  $('#listTitle').innerHTML   = `${esc(sec.label.toUpperCase())} &middot; <span>${items.length}</span>`;
  $('#listSub').textContent   = state.sort === 'talked'
    ? 'Ranked by public reach where a real number exists, then by recency.'
    : state.sort === 'recent' ? 'Newest first.' : 'Alphabetical.';

  $('#grid').innerHTML = items.map((it, i) => card(it, i + 1)).join('');
  $('#empty').hidden = items.length > 0;

  renderNav();
  renderTags();
  renderFilters();
}


/* ------------------------------------------------------------- dashboard */

/* Every figure below is counted from what is loaded in this page right now, or is a
   sum of values fetched from a public API. Metric kinds are never added together:
   a star, an upvote and an impression measure different things, so one combined
   "engagement" number would be a number nobody ever measured. */
function dashboardStats() {
  const sections = state.cfg.sections.filter(s => s.file);
  const all = sections.flatMap(s => state.data[s.id] || []);

  const byShelf  = sections.map(s => [s.label, (state.data[s.id] || []).length]);
  const bySource = new Map();
  const byAuthor = new Map();
  const byMetric = new Map();       // kind -> { total, items }

  for (const it of all) {
    bySource.set(it.source, (bySource.get(it.source) || 0) + 1);
    if (it.author) byAuthor.set(it.author, (byAuthor.get(it.author) || 0) + 1);
    for (const m of [it.metric, it.metric2]) {
      if (!m || !Number.isFinite(m.value)) continue;
      const row = byMetric.get(m.kind) || { total: 0, items: 0 };
      row.total += m.value; row.items++;
      byMetric.set(m.kind, row);
    }
  }

  return {
    total: all.length,
    withMetric: all.filter(i => i.metric).length,
    authors: byAuthor.size,
    sources: bySource.size,
    byShelf:  byShelf.sort((a, b) => b[1] - a[1]),
    bySource: [...bySource].sort((a, b) => b[1] - a[1]),
    byAuthor: [...byAuthor].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 25),
    byMetric: [...byMetric].sort((a, b) => b[1].total - a[1].total)
  };
}

/* One shared tooltip for every chart — created once, moved on hover. */
function chartTip() {
  let el = document.getElementById('chartTip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'chartTip';
    el.className = 'chart-tip';
    el.hidden = true;
    document.body.appendChild(el);
  }
  return el;
}

/* Horizontal bars: one series, one hue, magnitude by category.
   Rounded data-end, recessive gridlines, value direct-labelled. */
function barChart(rows, { action, total } = {}) {
  if (!rows.length) return '<p class="dash-none">Nothing to count yet.</p>';
  const max = Math.max(...rows.map(r => r[1])) || 1;
  const sum = total ?? rows.reduce((n, r) => n + r[1], 0);

  return `<div class="bars">${rows.map(([label, n]) => {
    const pct = Math.max(1.2, (n / max) * 100);
    const share = sum ? ((n / sum) * 100).toFixed(n / sum < 0.1 ? 1 : 0) : '0';
    const attr = action
      ? ` data-${action}="${esc(label)}" role="button" tabindex="0" aria-label="${esc(label)}, ${n} entries — filter the archive"`
      : '';
    return `<div class="bar-row${action ? ' bar-click' : ''}"${attr}
        data-tip="${esc(label)} · ${num(n)} ${n === 1 ? 'entry' : 'entries'} · ${share}% of ${num(sum)}">
      <span class="bar-label" title="${esc(label)}">${esc(label)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${pct.toFixed(1)}%"></span></span>
      <span class="bar-n">${num(n)}</span>
    </div>`;
  }).join('')}</div>`;
}

/* Area chart of when the archived material was actually published.
   Reference docs are excluded: their date is the day they were imported, not
   the day anything happened, and charting that would invent a spike. */
function timelineSeries() {
  const months = new Map();
  for (const s of state.cfg.sections.filter(s => s.file))
    for (const it of state.data[s.id] || []) {
      if (!it.date || it.source === 'docs') continue;
      const m = String(it.date).slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(m)) continue;
      months.set(m, (months.get(m) || 0) + 1);
    }
  if (months.size < 2) return [];

  const keys = [...months.keys()].sort();
  const out = [];
  const [y0, m0] = keys[0].split('-').map(Number);
  const [y1, m1] = keys[keys.length - 1].split('-').map(Number);
  for (let y = y0, m = m0; y < y1 || (y === y1 && m <= m1); m === 12 ? (m = 1, y++) : m++) {
    const k = `${y}-${String(m).padStart(2, '0')}`;
    out.push([k, months.get(k) || 0]);
  }
  return out.slice(-24);
}

function areaChart(series) {
  if (series.length < 2) return '';
  const W = 720, H = 190, PAD = { t: 14, r: 12, b: 26, l: 34 };
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const max = Math.max(...series.map(s => s[1]));
  const nice = max <= 5 ? 5 : Math.ceil(max / 10) * 10;

  const x = i => PAD.l + (series.length === 1 ? iw / 2 : (i / (series.length - 1)) * iw);
  const y = v => PAD.t + ih - (v / nice) * ih;

  const line = series.map(([, v], i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(series.length - 1).toFixed(1)},${(PAD.t + ih).toFixed(1)} L${x(0).toFixed(1)},${(PAD.t + ih).toFixed(1)} Z`;

  const ticks = [0, nice / 2, nice].map(v =>
    `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="gridline"/>
     <text x="${PAD.l - 7}" y="${(y(v) + 3.5).toFixed(1)}" class="axis-y">${v}</text>`).join('');

  const step = Math.ceil(series.length / 6);
  const xLabels = series.map(([k], i) =>
    (i % step === 0 || i === series.length - 1)
      ? `<text x="${x(i).toFixed(1)}" y="${H - 8}" class="axis-x">${k.slice(2)}</text>` : '').join('');

  const dots = series.map(([k, v], i) =>
    `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="9" class="hit"
       data-tip="${k} · ${num(v)} ${v === 1 ? 'entry' : 'entries'}"/>`).join('');

  const peak = series.reduce((b, s, i) => s[1] > series[b][1] ? i : b, 0);

  return `<svg class="area-chart" viewBox="0 0 ${W} ${H}" role="img"
      aria-label="Entries published per month, ${series[0][0]} to ${series[series.length - 1][0]}">
    <defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--accent)" stop-opacity=".34"/>
      <stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>
    </linearGradient></defs>
    ${ticks}
    <path d="${area}" fill="url(#areaFill)"/>
    <path d="${line}" class="area-line"/>
    <circle cx="${x(peak).toFixed(1)}" cy="${y(series[peak][1]).toFixed(1)}" r="3.5" class="peak-dot"/>
    <text x="${x(peak).toFixed(1)}" y="${(y(series[peak][1]) - 9).toFixed(1)}" class="peak-label">${num(series[peak][1])}</text>
    ${xLabels}${dots}
  </svg>`;
}

function renderDashboard() {
  const st = dashboardStats();
  const live = state.live || {};
  const stale = (live.github || []).filter(g => g.stale).length;
  const warnings = (live.warnings || []).length;
  const series = timelineSeries();

  const tile = (k, v, note) =>
    `<div class="tile"><span class="tile-k">${esc(k)}</span><span class="tile-v">${v}</span>${note ? `<span class="tile-note">${esc(note)}</span>` : ''}</div>`;

  const metricTiles = st.byMetric.length
    ? st.byMetric.map(([kind, r]) =>
        tile(kind, num(r.total), `across ${num(r.items)} ${r.items === 1 ? 'entry' : 'entries'}`)).join('')
    : '<p class="dash-none">No fetched metrics loaded.</p>';

  $('#dashboard').innerHTML = `
    <div class="dash-tiles">
      ${tile('items in the archive', num(st.total))}
      ${tile('carry a real metric', num(st.withMetric), `${Math.round(st.withMetric / (st.total || 1) * 100)}% of the archive`)}
      ${tile('credited authors', num(st.authors))}
      ${tile('distinct sources', num(st.sources))}
    </div>

    <section class="dash-block">
      <h3>COUNTED TOTALS</h3>
      <p class="dash-sub">Each kind on its own. Stars, points, impressions and upvotes measure
      different things, so they are never added together.</p>
      <div class="dash-tiles dash-tiles-sm">${metricTiles}</div>
    </section>

    ${series.length ? `<section class="dash-block">
      <h3>PUBLISHED PER MONTH <span class="dash-hint">${series[0][0]} → ${series[series.length - 1][0]}</span></h3>
      <p class="dash-sub">When the archived material was published. Reference documentation is
      left out — its date is the day it was imported, not the day anything happened.</p>
      ${areaChart(series)}
    </section>` : ''}

    <div class="dash-cols">
      <section class="dash-block"><h3>BY SHELF</h3>${barChart(st.byShelf, { total: st.total })}</section>
      <section class="dash-block"><h3>BY SOURCE</h3>
        ${barChart(st.bySource.map(([s, n]) => [SOURCE_LABEL[s] || s, n]), { total: st.total })}</section>
    </div>

    <section class="dash-block">
      <h3>BY AUTHOR <span class="dash-hint">top ${st.byAuthor.length} &middot; click to filter the archive</span></h3>
      ${barChart(st.byAuthor, { action: 'author' })}
    </section>

    <p class="dash-fresh">
      ${live.generatedAt ? `Metrics fetched ${esc(new Date(live.generatedAt).toLocaleString())}.` : 'No metrics fetched yet.'}
      ${live.routedBy ? ` Sourced items shelved by ${live.routedBy === 'jev' ? 'Jev' : 'keyword rules'}.` : ''}
      ${stale ? ` ${stale} repo${stale === 1 ? '' : 's'} carried over from an earlier fetch.` : ''}
      ${warnings ? ` ${warnings} source${warnings === 1 ? ' was' : 's were'} unavailable at the last fetch.` : ''}
    </p>`;

  wireTips();
}

/* Hover layer: every mark carrying data-tip gets the shared tooltip. */
function wireTips() {
  const tip = chartTip();
  const dash = $('#dashboard');
  const show = e => {
    const el = e.target.closest('[data-tip]');
    if (!el) return;
    tip.textContent = el.dataset.tip;
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    tip.style.left = `${Math.min(window.innerWidth - tip.offsetWidth - 10, Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2))}px`;
    tip.style.top  = `${Math.max(8, r.top - tip.offsetHeight - 8)}px`;
  };
  dash.onmouseover = show;
  dash.onfocusin = show;
  dash.onmouseout = e => { if (!e.relatedTarget || !dash.contains(e.relatedTarget)) tip.hidden = true; };
  dash.onfocusout = () => { tip.hidden = true; };
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
  state.q = ''; state.tag = null; state.author = null; state.source = 'all'; state.range = 'all';
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
    ? `Live signals last fetched ${new Date(state.live.generatedAt).toLocaleString()}`
      + (state.live.routedAt ? `, shelved by ${state.live.routedBy === 'jev' ? 'Jev' : 'keyword rules'}.` : '.')
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
    const authorBtn = e.target.closest('[data-author]');
    if (authorBtn) {
      state.author = state.author === authorBtn.dataset.author ? null : authorBtn.dataset.author;
      state.section = state.cfg.sections.find(s => s.id === 'use-cases') ? 'use-cases' : state.section;
      render();
      return;
    }
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
      if (k === 'author') state.author = null;
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
    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement?.hasAttribute?.('data-author')) {
      e.preventDefault();
      document.activeElement.click();
    }
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
