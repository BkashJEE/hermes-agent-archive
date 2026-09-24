/* Use-Case Archive — data loading, filtering, rendering. No framework, no build step. */

import { sectionIcon } from './icons.js';

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
  tagQuery: '',
  density: 'comfortable'
};

// Storage is optional: denied access must never prevent browsing.
try {
  if (localStorage.getItem('hermes-density') === 'compact') state.density = 'compact';
} catch { /* Private windows may deny storage. */ }

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

/* Merge fetched public metrics onto curated entries, then shelve everything the
   sourcing pipeline found. Every value here came from a public API — nothing is
   hand-written, and nothing is estimated. */
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
  // Colour marks the source family; unique monograms and names identify sources.
  const marks = { x: 'X', reddit: 'rd', hn: 'Y', discord: 'dc', fb: 'f', github: 'gh',
    youtube: '▶', blog: 'b', podcast: '♫', linkedin: 'in', producthunt: 'P', docs: '//', community: 'co' };
  return `<span class="pill pill-${key}"><span class="source-mark" aria-hidden="true">${marks[source] || '—'}</span>${esc(SOURCE_LABEL[source] || 'CURATED')}</span>`;
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

function card(item, rank, iconName) {
  return `<li><button class="card" data-id="${esc(item.id)}">
    <div class="card-top"><span class="card-index"><span class="card-tab">${sectionIcon(iconName)}</span><span class="rank">#${rank}</span></span>
      ${item.sourced ? '<span class="pill pill-sourced" title="Found by the sourcing pipeline, not written by hand">SOURCED</span>' : ''}${pill(item.source)}</div>
    <h3>${esc(item.title)}</h3>
    <p class="sum">${esc(item.summary)}</p>
    ${metricBlock(item)}
    <div class="card-foot"><span>Open ${item.url ? '&#8599;' : '&rarr;'}</span><span class="when">${esc(ago(item.date))}</span></div>
  </button></li>`;
}

function renderNav() {
  $('#nav').innerHTML = state.cfg.sections.map(s => `
    <a href="#${s.id}" class="${s.id === state.section ? 'on' : ''}" data-section="${s.id}" ${s.id === state.section ? 'aria-current="page"' : ''}>
      <span class="nav-ico">${sectionIcon(s.icon)}</span>${esc(s.label)}<span class="nav-n">${visible(s.id).length}</span>
    </a>`).join('');
}

function renderTags() {
  const counts = new Map();
  for (const s of state.cfg.sections)
    for (const it of state.data[s.id] || [])
      for (const t of it.tags || []) counts.set(t, (counts.get(t) || 0) + 1);

  const top = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).filter(([tag]) => tag.toLowerCase().includes(state.tagQuery.toLowerCase()));
  $('#tagList').innerHTML = top.map(([t, n]) => `
    <li><button data-tag="${esc(t)}" aria-pressed="${state.tag === t}" class="${state.tag === t ? 'on' : ''}">
      <i class="t-dot"></i>${esc(t)}<span class="t-n">${n}</span>
    </button></li>`).join('');
  $('#tagEmpty').hidden = top.length > 0;
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
  const focused = document.activeElement;
  const focusKey = focused?.dataset.tag ? ['tag', focused.dataset.tag]
    : focused?.dataset.section ? ['section', focused.dataset.section] : null;
  const sec = state.cfg.sections.find(s => s.id === state.section) || state.cfg.sections[0];
  const items = sortItems(visible(sec.id));

  $('#heroIcon').innerHTML    = sectionIcon(sec.icon);
  $('#heroTitle').textContent = sec.title;
  $('#heroBlurb').textContent = sec.blurb;
  $('#listTitle').innerHTML   = `${esc(sec.label.toUpperCase())} &middot; <span>${items.length}</span>`;
  $('#listSub').textContent   = state.sort === 'talked'
    ? 'Ranked by public reach where a real number exists, then by recency.'
    : state.sort === 'recent' ? 'Newest first.' : 'Alphabetical.';

  $('#grid').innerHTML = items.map((it, i) => card(it, i + 1, sec.icon)).join('');
  $('#grid').dataset.density = state.density;
  $$('button[data-density]').forEach(button => button.setAttribute('aria-pressed', button.dataset.density === state.density));
  const emptyShelf = !(state.data[sec.id] || []).length;
  $('#empty').hidden = items.length > 0;
  $('#empty').innerHTML = emptyShelf
    ? `<div class="empty-icon">${sectionIcon(sec.icon)}</div>
       <span class="empty-kicker">ROOM FOR THE NEXT GOOD FIND</span>
       <strong>This shelf isn't stocked yet.</strong>
       <span>We're collecting ${esc(sec.label.toLowerCase())} worth keeping. Every entry needs a real source before it earns a place here.</span>
       <a class="ghost-btn empty-link" href="#use-cases" data-browse>Explore the user stories &rarr;</a>`
    : `<strong>Nothing matches those filters.</strong>
       <span>This shelf has entries. Widen the time range, choose All Sources, or clear your filters to see them.</span>
       <button class="ghost-btn" data-clear>Clear filters</button>`;
  document.title = `${sec.label} · Hermes Agent Archive`;

  renderNav();
  renderTags();
  renderFilters();
  if (focusKey) $$('[data-' + focusKey[0] + ']').find(el => el.dataset[focusKey[0]] === focusKey[1])?.focus({ preventScroll: true });
}

/* --------------------------------------------------------------- drawer */

function findItem(id) {
  for (const s of state.cfg.sections) {
    const hit = (state.data[s.id] || []).find(i => i.id === id);
    if (hit) return hit;
  }
  return null;
}

let drawerTrigger = null;

function openDrawer(id, trigger) {
  const it = findItem(id);
  if (!it) return;

  drawerTrigger = trigger || document.activeElement;
  const story = (it.tags || []).includes('user-story');
  const paragraphs = (it.detail || it.summary || '').split('\n\n');
  // Imported stories already end with attribution. Move that exact line into the
  // caption, preserving its wording rather than quoting the author twice.
  const attribution = story && paragraphs.at(-1)?.startsWith(`— ${it.author},`)
    ? paragraphs.pop().replace(/^— /, '') : null;
  const body = paragraphs.map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  const date = it.date ? new Date(`${it.date.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US',
    { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '';
  const credit = attribution || [it.author, SOURCE_LABEL[it.source], date].filter(Boolean).join(' · ');

  $('#drawerBody').innerHTML = `
    <div class="d-kicker">${pill(it.source)}${it.lang ? `<span class="pill pill-curated">${esc(it.lang)}</span>` : ''}</div>
    <h3 id="drawerTitle">${esc(it.title)}</h3>
    ${story ? `<figure class="d-story"><blockquote class="d-body" cite="${esc(it.url)}">${body}</blockquote>
      <figcaption class="d-attribution"><span class="attribution-rule" aria-hidden="true"></span>${esc(credit)}</figcaption></figure>`
      : `<p class="d-attribution">${esc(credit)}</p><div class="d-body">${body}</div>`}
    ${it.snippet ? `<div class="d-snip">
        <button class="copy-btn" id="copyBtn">COPY</button>
        <pre><code>${esc(it.snippet)}</code></pre></div>` : ''}
    ${(it.tags || []).length ? `<div class="d-tags">${it.tags.map(t => `<button class="d-tag" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}
    ${it.url ? `<a class="d-link" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">READ THE ORIGINAL &#8599;</a>` : ''}
    <div class="d-meta">${it.metric ? metricBlock(it) : '<span class="trow-note">no public metric</span>'}</div>`;

  $('#drawer').hidden = false;
  $('#scrim').hidden = false;
  $('.topbar').inert = true;
  $('.shell').inert = true;
  document.body.classList.add('modal-open');
  $('#drawer').scrollTop = 0;
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
  if ($('#drawer').hidden) return;
  $('#drawer').hidden = true;
  $('#scrim').hidden = true;
  $('.topbar').inert = false;
  $('.shell').inert = false;
  document.body.classList.remove('modal-open');
  if (drawerTrigger?.isConnected) drawerTrigger.focus({ preventScroll: true });
  else $('#listTitle').focus();
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

const mobile = matchMedia('(max-width:960px)');
function setSidebar(open) {
  open = mobile.matches && open;
  $('#sidebar').classList.toggle('open', open);
  $('#sidebar').inert = mobile.matches && !open;
  $('#sidebarScrim').hidden = !open;
  $('#main').inert = open;
  $('#menuBtn').setAttribute('aria-expanded', open);
  document.body.classList.toggle('sidebar-open', open);
}

function wire() {
  setSidebar(false);
  mobile.addEventListener('change', () => setSidebar(false));
  new ResizeObserver(([entry]) => {
    document.documentElement.style.setProperty('--top-h', `${entry.target.offsetHeight}px`);
  }).observe($('.topbar'));
  $('#tagSearch').addEventListener('input', e => { state.tagQuery = e.target.value.trim(); renderTags(); });
  $$('button[data-density]').forEach(button => button.addEventListener('click', () => {
    state.density = button.dataset.density;
    try { localStorage.setItem('hermes-density', state.density); } catch { /* Browsing still works. */ }
    render();
  }));
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
  $('#menuBtn').addEventListener('click', () => setSidebar(!$('#sidebar').classList.contains('open')));
  $('#sidebarScrim').addEventListener('click', () => { setSidebar(false); $('#menuBtn').focus(); });

  $('#nav').addEventListener('click', e => {
    const a = e.target.closest('[data-section]');
    if (!a) return;
    state.section = a.dataset.section;
    setSidebar(false);
    render();
    $('#listTitle').focus({ preventScroll: true });
  });

  document.addEventListener('click', e => {
    const tagBtn = e.target.closest('[data-tag]');
    if (tagBtn) {
      state.tag = state.tag === tagBtn.dataset.tag ? null : tagBtn.dataset.tag;
      const fromDrawer = !$('#drawer').hidden;
      closeDrawer(); setSidebar(false); render();
      if (fromDrawer || mobile.matches) $('#listTitle').focus({ preventScroll: true });
      return;
    }
    const drop = e.target.closest('[data-drop]');
    if (drop) {
      const k = drop.dataset.drop;
      if (k === 'q')      { state.q = ''; $('#search').value = ''; }
      if (k === 'tag')    state.tag = null;
      if (k === 'source') { state.source = 'all'; $('#sourceSel').value = 'all'; }
      if (k === 'range')  { state.range  = 'all'; $('#rangeSel').value  = 'all'; }
      render(); $('#clearBtn').focus(); return;
    }
    if (e.target.closest('[data-browse]')) {
      e.preventDefault();
      state.section = 'use-cases'; location.hash = 'use-cases';
      clearFilters(); setSidebar(false); $('#listTitle').focus(); return;
    }
    if (e.target.closest('[data-clear]')) { clearFilters(); $('#clearBtn').focus(); return; }

    const c = e.target.closest('.card');
    if (c) openDrawer(c.dataset.id, c);
  });

  $('#drawerClose').addEventListener('click', closeDrawer);
  $('#scrim').addEventListener('click', closeDrawer);

  document.addEventListener('keydown', e => {
    if (!$('#drawer').hidden) {
      if (e.key === 'Escape') { e.preventDefault(); closeDrawer(); }
      if (e.key === 'Tab') {
        const controls = $$('button, a[href], input, select, [tabindex="0"]', $('#drawer'));
        const first = controls[0], last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      return; // Global search shortcuts must never escape the dialog.
    }
    if (e.key === 'Escape' && $('#sidebar').classList.contains('open')) {
      setSidebar(false); $('#menuBtn').focus();
    }
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey &&
        !e.target.closest('input, textarea, select, [contenteditable="true"]')) {
      e.preventDefault(); $('#search').focus();
    }
  });

  window.addEventListener('hashchange', () => { routeFromHash(); render(); });
}

/* ------------------------------------------------------------------ boot */

load()
  .then(() => { routeFromHash(); wire(); render(); })
  .catch(err => {
    $('#grid').innerHTML =
      `<li class="empty"><strong>COULD NOT LOAD DATA</strong>
       <span>${esc(err.message)} — this page reads local JSON over fetch(), so it needs a web server.
       Run <code>npm start</code> (or <code>python3 -m http.server</code>) instead of opening the file directly.</span></li>`;
    $('#empty').hidden = true;
  });
