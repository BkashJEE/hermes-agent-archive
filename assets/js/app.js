/* Use-Case Archive — data loading, filtering, rendering. No framework, no build step. */

import { sectionIcon } from './icons.js?v=badge-3';
import { mergeLive } from './archive.js?v=stars-4';
import { formatDetails } from './details.js';
import { creditFor } from './credits.js';
import { attachRankings, compareRankings, usefulnessLabel, popularityLabel } from './ranking.js';

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
  sort: 'recommended',
  q: '',
  tag: null,
  author: null,
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

async function getJSON(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

/* ------------------------------------------------------------ data load */

async function load() {
  state.cfg = await getJSON('data/index.json');

  const sections = await Promise.all(
    state.cfg.sections.map(s => s.file ? getJSON(`data/${s.file}`).catch(() => ({ items: [] })) : { items: [] })
  );
  state.cfg.sections.forEach((s, i) => { state.data[s.id] = sections[i].items || []; });

  state.live = await getJSON('data/live.json').catch(() => null);
  mergeLive(state.data, state.live);
  const rankings = await getJSON('data/rankings.json').catch(() => null);
  await attachRankings(Object.values(state.data).flat(), rankings);
}

/* -------------------------------------------------------------- filters */

function matches(item) {
  if (state.author && creditFor(item).name !== state.author) return false;
  if (state.source !== 'all' && item.source !== state.source) return false;
  if (state.tag && !(item.tags || []).includes(state.tag)) return false;
  if (state.q) {
    const hay = [item.title, item.summary, item.detail, item.snippet, item.author, ...(item.tags || [])]
      .join(' ').toLowerCase();
    if (!state.q.toLowerCase().split(/\s+/).every(t => hay.includes(t))) return false;
  }
  return true;
}

function sortItems(items) {
  return [...items].sort((a, b) => state.sort === 'az'
    ? a.title.localeCompare(b.title) : compareRankings(a, b, state.sort));
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
  const credit = creditFor(item);
  return `<li><button class="card" data-id="${esc(item.id)}">
    <div class="card-top"><span class="card-index"><span class="card-tab">${sectionIcon(iconName)}</span><span class="rank">${state.sort === 'az' ? 'A–Z' : item.ranking ? `#${rank}` : 'UNCLASSIFIED'}</span></span>
      ${item.sourced ? '<span class="pill pill-sourced" title="Found by the sourcing pipeline, not written by hand">SOURCED</span>' : ''}${pill(item.source)}</div>
    <h3>${esc(item.title)}</h3>
    <p class="card-byline"><span>${esc(credit.label)}</span> <strong>${esc(credit.name)}</strong></p>
    <p class="sum">${esc(item.summary)}</p>
    ${metricBlock(item)}
    <div class="card-foot"><span>Open ${item.url ? '&#8599;' : '&rarr;'}</span><span class="when">${item.ranking ? 'Jev classified' : 'Awaiting Jev'}</span></div>
  </button></li>`;
}

function renderNav() {
  $('#nav').innerHTML = state.cfg.sections.map(s => `
    <a href="#${s.id}" class="${s.id === state.section ? 'on' : ''}" data-section="${s.id}" ${s.id === state.section ? 'aria-current="page"' : ''}>
      <span class="nav-ico">${sectionIcon(s.icon)}</span>${esc(s.label)}<span class="nav-n">${s.file ? visible(s.id).length : ''}</span>
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
  if (state.author)             bits.push(['author', `AUTHOR: ${state.author}`]);
  if (state.tag)                bits.push(['tag',    `TAG: ${state.tag}`]);
  if (state.source !== 'all')   bits.push(['source', `SOURCE: ${SOURCE_LABEL[state.source] || state.source}`]);

  const box = $('#activeFilters');
  box.hidden = !bits.length;
  box.innerHTML = bits.map(([k, label]) => `<button class="chip" data-drop="${k}">${esc(label)} &#10005;</button>`).join('');
}

function render() {
  const focused = document.activeElement;
  const focusKey = focused?.dataset.tag ? ['tag', focused.dataset.tag]
    : focused?.dataset.section ? ['section', focused.dataset.section] : null;
  const sec = state.cfg.sections.find(s => s.id === state.section) || state.cfg.sections[0];
  const isDash = sec.kind === 'dashboard';
  $('#dashboard').hidden = !isDash;
  $('#listbar').hidden = isDash;
  $('#grid').hidden = isDash;
  if (isDash) {
    $('#heroIcon').innerHTML = sectionIcon(sec.icon);
    $('#heroTitle').textContent = sec.title;
    $('#heroBlurb').textContent = sec.blurb;
    $('#empty').hidden = true;
    document.title = `${sec.label} · Hermes Agent Archive`;
    renderDashboard(); renderNav(); renderTags(); renderFilters();
    return;
  }
  const items = sortItems(visible(sec.id));

  $('#heroIcon').innerHTML    = sectionIcon(sec.icon);
  $('#heroTitle').textContent = sec.title;
  $('#heroBlurb').textContent = sec.blurb;
  $('#listTitle').innerHTML   = `${esc(sec.label.toUpperCase())} &middot; <span>${items.length}</span>`;
  const classified = items.filter(item => item.ranking).length;
  $('#listSub').textContent = !items.length ? 'No entries to rank in this view.'
    : state.sort === 'az' ? 'Alphabetical.'
    : !classified ? 'Awaiting Jev classification. Unclassified entries are alphabetical; dates never affect the order.'
    : state.sort === 'popular' && !items.some(item => item.ranking && item.ranking.popularity !== 'unknown')
      ? 'Popularity is unknown on this shelf: no fetched engagement evidence. Ordered by Jev usefulness instead.'
    : `${classified} of ${items.length} classified by Jev. ${state.sort === 'popular'
      ? 'Public popularity first; unknown popularity last.'
      : 'Usefulness first; public popularity breaks ties.'} Dates never affect the order.`;

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
       <a class="ghost-btn empty-link" href="#use-cases" data-browse>Browse ${(state.data['use-cases'] || []).length} user stories &rarr;</a>`
    : `<strong>Nothing matches those filters.</strong>
       <span>This shelf has entries. Choose All Sources or clear your filters to see them.</span>
       <button class="ghost-btn" data-clear>Clear filters</button>`;
  document.title = `${sec.label} · Hermes Agent Archive`;

  renderNav();
  renderTags();
  renderFilters();
  if (focusKey) $$('[data-' + focusKey[0] + ']').find(el => el.dataset[focusKey[0]] === focusKey[1])?.focus({ preventScroll: true });
}

/* ------------------------------------------------------- motion helpers */

const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/* Display counted values directly; animation must never invent intermediate figures. */
function countUp(el, value) { el.textContent = num(value); }

/* Grow a bar to its real width. Same rule as the figures: the final width is set
   straight away and the animation plays over the top, so a throttled tab shows a
   correct chart rather than an empty one. */
function growTo(el, target, delay = 0) {
  el.style.width = target;
  if (REDUCED || document.hidden || typeof el.animate !== 'function') return;
  el.animate([{ width: '0%' }, { width: target }], {
    duration: 620, delay, easing: 'cubic-bezier(.22,.7,.3,1)', fill: 'backwards'
  });
}

function growBars(root) {
  [...root.querySelectorAll('.bar-fill')].forEach((fill, i) =>
    growTo(fill, fill.dataset.w, Math.min(i * 22, 600)));
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
    const credit = creditFor(it);
    if (credit.label !== 'Author') byAuthor.set(credit.name, (byAuthor.get(credit.name) || 0) + 1);
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
    byAuthor: [...byAuthor].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
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
      ? ` data-${action}="${esc(label)}" aria-label="${esc(label)}, ${n} entries — filter the archive"`
      : '';
    return `<${action ? 'button type="button"' : 'div'} class="bar-row${action ? ' bar-click' : ''}"${attr}
        data-tip="${esc(label)} · ${num(n)} ${n === 1 ? 'entry' : 'entries'} · ${share}% of ${num(sum)}">
      <span class="bar-label" title="${esc(label)}">${esc(label)}</span>
      <span class="bar-track"><span class="bar-fill" data-w="${pct.toFixed(1)}%"></span></span>
      <span class="bar-n">${num(n)}</span>
    </${action ? 'button' : 'div'}>`;
  }).join('')}</div>`;
}

function renderDashboard() {
  const st = dashboardStats();
  const live = state.live || {};
  const stale = (live.github || []).filter(g => g.stale).length;
  const warnings = (live.warnings || []).length;

  /* A tile may carry a share track — the progress-stat idea: a big numeral with a
     thin rail underneath showing what fraction of the whole it represents. */
  const tile = (k, v, note, share) =>
    `<div class="tile">
       <span class="tile-k">${esc(k)}</span>
       <span class="tile-v" data-count="${typeof v === 'number' ? v : ''}">${typeof v === 'number' ? num(v) : v}</span>
       ${share != null ? `<span class="tile-rail"><span class="tile-rail-fill" data-w="${(share * 100).toFixed(1)}%"></span></span>` : ''}
       ${note ? `<span class="tile-note">${esc(note)}</span>` : ''}
     </div>`;

  const metricTiles = st.byMetric.length
    ? st.byMetric.map(([kind, r]) =>
        tile(kind, r.total, `across ${num(r.items)} ${r.items === 1 ? 'entry' : 'entries'}`)).join('')
    : '<p class="dash-none">No fetched metrics loaded.</p>';

  $('#dashboard').innerHTML = `
    <div class="dash-tiles">
      ${tile('items in the archive', st.total)}
      ${tile('carry a real metric', st.withMetric, `${Math.round(st.withMetric / (st.total || 1) * 100)}% of the archive`, st.withMetric / (st.total || 1))}
      ${tile('authors / owners', st.authors)}
      ${tile('distinct sources', st.sources)}
    </div>

    <section class="dash-block">
      <h3>COUNTED TOTALS</h3>
      <p class="dash-sub">Each kind on its own. Stars, points and upvotes measure
      different things, so they are never added together.</p>
      <div class="dash-tiles dash-tiles-sm">${metricTiles}</div>
    </section>

    <div class="dash-cols">
      <section class="dash-block"><h3>BY SHELF</h3>${barChart(st.byShelf, { total: st.total })}</section>
      <section class="dash-block"><h3>BY SOURCE</h3>
        ${barChart(st.bySource.map(([s, n]) => [SOURCE_LABEL[s] || s, n]), { total: st.total })}</section>
    </div>

    <section class="dash-block">
      <h3>BY AUTHOR / OWNER <span class="dash-hint">click to filter the archive</span></h3>
      <div id="authorBars" data-expanded="0">${barChart(st.byAuthor.slice(0, 10), { action: 'author' })}</div>
      ${st.byAuthor.length > 10
        ? `<button class="ghost-btn dash-more" id="authorMore">Show all ${st.byAuthor.length} &#8595;</button>` : ''}
    </section>

    <p class="dash-fresh">
      ${live.generatedAt ? `Metrics fetched ${esc(new Date(live.generatedAt).toLocaleString())}.` : 'No metrics fetched yet.'}
      ${live.routedBy ? ` Sourced items shelved by ${live.routedBy === 'jev' ? 'Jev' : 'keyword rules'}.` : ''}
      ${stale ? ` ${stale} repo${stale === 1 ? '' : 's'} carried over from an earlier fetch.` : ''}
      ${warnings ? ` ${warnings} source${warnings === 1 ? ' was' : 's were'} unavailable at the last fetch.` : ''}
    </p>`;

  wireTips();
  revealDashboard(st);
}

function revealDashboard(st) {
  const root = $('#dashboard');

  for (const el of root.querySelectorAll('.tile-v[data-count]')) {
    const v = Number(el.dataset.count);
    if (Number.isFinite(v) && el.dataset.count !== '') countUp(el, v);
  }
  for (const rail of root.querySelectorAll('.tile-rail-fill')) growTo(rail, rail.dataset.w, 150);
  growBars(root);

  const more = $('#authorMore');
  if (more) more.onclick = () => {
    const box = $('#authorBars');
    box.innerHTML = barChart(st.byAuthor, { action: 'author' });
    growBars(box);
    more.remove();
  };
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


/* ---------------------------------------------------------- command palette */

/* 700 items is past the point where scrolling is a navigation strategy.
   Cmd/Ctrl-K opens one field that reaches every shelf, author, tag and entry. */
const palette = { open: false, rows: [], active: 0, trigger: null };

function paletteRows(q) {
  const hits = [];
  const needle = q.trim().toLowerCase();
  const ok = s => !needle || String(s).toLowerCase().includes(needle);

  for (const sec of state.cfg.sections)
    if (ok(sec.label)) hits.push({ kind: 'Shelf', label: sec.label, meta: sec.file ? `${(state.data[sec.id] || []).length} entries` : 'computed', act: () => { state.section = sec.id; location.hash = sec.id; render(); } });

  const authors = new Map(), tags = new Map();
  for (const sec of state.cfg.sections.filter(s => s.file))
    for (const it of state.data[sec.id] || []) {
      const credit = creditFor(it);
      if (credit.label !== 'Author') authors.set(credit.name, (authors.get(credit.name) || 0) + 1);
      for (const t of it.tags || []) tags.set(t, (tags.get(t) || 0) + 1);
    }

  for (const [name, n] of [...authors].sort((a, b) => b[1] - a[1]))
    if (ok(name) && hits.length < 60) hits.push({ kind: 'Author', label: name, meta: `${n} ${n === 1 ? 'entry' : 'entries'}`, act: () => { filterAuthor(name); } });

  for (const [name, n] of [...tags].sort((a, b) => b[1] - a[1]))
    if (ok(name) && hits.length < 80) hits.push({ kind: 'Tag', label: name, meta: `${n}`, act: () => { clearFilters(); state.tag = name; state.section = state.cfg.sections.find(s => (state.data[s.id] || []).some(it => it.tags?.includes(name)))?.id || 'use-cases'; location.hash = state.section; render(); } });

  if (needle)
    for (const sec of state.cfg.sections.filter(s => s.file))
      for (const it of state.data[sec.id] || []) {
        if (hits.length >= 120) break;
        if (ok(it.title)) hits.push({ kind: sec.label, label: it.title, meta: SOURCE_LABEL[it.source] || '', act: () => { clearFilters(); state.section = sec.id; location.hash = sec.id; render(); openDrawer(it.id, document.querySelector(`[data-id="${CSS.escape(it.id)}"]`)); } });
      }

  return hits.slice(0, 60);
}

function paletteRender(q) {
  palette.rows = paletteRows(q);
  palette.active = 0;
  const list = $('#palList');
  list.innerHTML = palette.rows.length
    ? palette.rows.map((r, i) => `<li id="pal-option-${i}" class="pal-row${i ? '' : ' on'}" role="option" aria-selected="${!i}" data-i="${i}">
        <span class="pal-kind">${esc(r.kind)}</span>
        <span class="pal-label">${esc(r.label)}</span>
        <span class="pal-meta">${esc(r.meta || '')}</span></li>`).join('')
    : '<li class="pal-none">Nothing matches.</li>';
  $('#palInput').setAttribute('aria-activedescendant', palette.rows.length ? 'pal-option-0' : '');
  list.firstElementChild?.scrollIntoView?.({ block: 'nearest' });
}

function paletteMove(d) {
  if (!palette.rows.length) return;
  palette.active = (palette.active + d + palette.rows.length) % palette.rows.length;
  const rows = $$('#palList .pal-row');
  rows.forEach((el, i) => { el.classList.toggle('on', i === palette.active); el.setAttribute('aria-selected', i === palette.active); });
  $('#palInput').setAttribute('aria-activedescendant', `pal-option-${palette.active}`);
  rows[palette.active]?.scrollIntoView({ block: 'nearest' });
}

function paletteRun() {
  const row = palette.rows[palette.active];
  if (!row) return;
  paletteClose();
  row.act();
}

function paletteOpen() {
  if (palette.open) return;
  palette.trigger = document.activeElement;
  setSidebar(false);
  palette.open = true;
  $('.topbar').inert = true; $('.shell').inert = true;
  document.body.classList.add('modal-open');
  $('#palette').hidden = false;
  const input = $('#palInput');
  input.value = '';
  paletteRender('');
  input.focus();
}

function paletteClose() {
  if (!palette.open) return;
  palette.open = false;
  $('.topbar').inert = false; $('.shell').inert = false;
  document.body.classList.remove('modal-open');
  $('#palette').hidden = true;
  if (palette.trigger?.isConnected) palette.trigger.focus();
}

function wirePalette() {
  if ($('#palette')) return;
  const el = document.createElement('div');
  el.id = 'palette';
  el.className = 'pal';
  el.hidden = true;
  el.innerHTML = `<div class="pal-scrim" data-pal-close></div>
    <div class="pal-box" role="dialog" aria-modal="true" aria-label="Jump to">
      <input id="palInput" class="pal-input" type="text" placeholder="Jump to a shelf, author, tag or entry…"
             autocomplete="off" spellcheck="false" aria-label="Jump to a shelf, author, tag or entry" role="combobox" aria-expanded="true" aria-controls="palList">
      <ul id="palList" class="pal-list" role="listbox" aria-label="Results"></ul>
      <div class="pal-foot"><kbd>&#8593;</kbd><kbd>&#8595;</kbd> move <kbd>&#8629;</kbd> open <kbd>esc</kbd> close</div>
    </div>`;
  document.body.appendChild(el);

  $('#palInput').addEventListener('input', e => paletteRender(e.target.value));
  el.addEventListener('click', e => {
    if (e.target.closest('[data-pal-close]')) return paletteClose();
    const row = e.target.closest('.pal-row');
    if (row) { palette.active = +row.dataset.i; paletteRun(); }
  });
  el.addEventListener('keydown', e => {
    if (e.key === 'Tab') { e.preventDefault(); $('#palInput').focus(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); paletteMove(1); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); paletteMove(-1); }
    if (e.key === 'Enter')     { e.preventDefault(); paletteRun(); }
  });
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
  const body = formatDetails(paragraphs);
  const date = it.date ? new Date(`${it.date.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US',
    { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '';
  const author = creditFor(it);
  const credit = attribution || [`${author.label} ${author.name}`, SOURCE_LABEL[it.source], date].filter(Boolean).join(' · ');

  $('#drawerBody').innerHTML = `
    <div class="d-kicker">${pill(it.source)}${it.lang ? `<span class="pill pill-curated">${esc(it.lang)}</span>` : ''}</div>
    <p class="d-attribution">${it.ranking
      ? `Jev assessment: ${esc(usefulnessLabel(it.ranking.usefulness))} · ${esc(popularityLabel(it.ranking.popularity))}`
      : 'Awaiting Jev classification; no date-based ranking.'}</p>
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
  state.q = ''; state.tag = null; state.author = null; state.source = 'all';
  $('#search').value = '';
  $('#sourceSel').value = 'all';
  render();
}

function filterAuthor(name) {
  clearFilters(); state.author = name;
  state.section = state.cfg.sections.find(s => (state.data[s.id] || []).some(it => creditFor(it).name === name))?.id || 'use-cases';
  location.hash = state.section; render(); $('#listTitle').focus();
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
  $('#archiveMark').innerHTML = sectionIcon('archive');
  wirePalette();
  $('#jumpBtn').addEventListener('click', paletteOpen);
  const applyTheme = theme => {
    document.documentElement.dataset.theme = theme === 'broadsheet' ? theme : 'dark';
    $('#themeBtn').setAttribute('aria-pressed', theme === 'broadsheet');
  };
  try { applyTheme(localStorage.getItem('ha-theme')); } catch { applyTheme('dark'); }
  $('#themeBtn').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'broadsheet' ? 'dark' : 'broadsheet';
    applyTheme(next);
    try { localStorage.setItem('ha-theme', next); } catch {}
  });
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
    (state.section === 'dashboard' ? $('#heroTitle') : $('#listTitle')).focus({ preventScroll: true });
  });

  document.addEventListener('click', e => {
    const authorBtn = e.target.closest('[data-author]');
    if (authorBtn) { filterAuthor(authorBtn.dataset.author); return; }
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
      if (k === 'author') state.author = null;
      if (k === 'source') { state.source = 'all'; $('#sourceSel').value = 'all'; }
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
    if (palette.open) { if (e.key === 'Escape') { e.preventDefault(); paletteClose(); } return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); paletteOpen(); return; }
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
