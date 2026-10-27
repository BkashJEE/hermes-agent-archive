#!/usr/bin/env node
/**
 * Give every entry a URL a search engine can actually index.
 *
 *   npm run pages          # write entry/, shelf/ and sitemap.xml
 *   npm run pages -- --dry # report what would be written, write nothing
 *
 * The archive is one page with hash routes. A crawler discards everything after the '#',
 * so 929 entries collapsed into a single URL and a search for any of them found nothing.
 * robots.txt could not even name a sitemap, because there was nothing to list.
 *
 * This writes a small static page per entry and per shelf, generated from the same data
 * the app renders. They are plain documents: no JavaScript, no fetch, readable with
 * styles off. Each one links back into the app at its card, so a visitor who arrives from
 * a search lands on the entry and can keep browsing.
 *
 * GENERATED. Never hand-edit; rerun the script. A test fails if the output drifts from
 * the data, so a shelf cannot gain an entry that no page describes.
 *
 * No metric appears on these pages on purpose. A star count baked into a static file is a
 * number that was true once and is asserted forever, which is exactly the thing this
 * archive does not do. The live figure stays on the card, where it is fetched.
 */

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { githubRepo } from '../assets/js/archive.js';
import { qualifiesRepository } from '../assets/js/github-policy.js';
import { creditFor } from '../assets/js/credits.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://hermes-agent-archive.vercel.app';
const OWNER_X = 'https://x.com/BkashJosi';
const OWNER_GH = 'https://github.com/BkashJEE';

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** A one-line description for <meta>, which must not run to 900 characters. */
const trim = (s, n = 155) => {
  const flat = String(s ?? '').replace(/\s+/g, ' ').trim();
  return flat.length <= n ? flat : flat.slice(0, flat.lastIndexOf(' ', n - 1)).replace(/[,;:.]$/, '') + '…';
};

/* An id comes from a slug or an upstream key and ends up in a path. Anything outside this
   set would write outside the output directory, so it is rejected rather than cleaned —
   a silently renamed page is a broken link nobody notices. */
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/* Each shelf has its own social card (scripts/make-og.mjs), so a pasted entry link shows
   that shelf's count rather than the whole archive's. Pages without a shelf use the archive card. */
const social = sectionId => sectionId ? `${SITE}/assets/social/${sectionId}.png` : `${SITE}/assets/social-preview.png`;

/** "October 11, 2026", or the honest label when the source carries no date. */
export const dateLabel = d => d
  ? new Date(`${String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
  : 'Date unknown';

/* JSON-LD is JSON inside a script element: a "</script" in any string would end the
   element early, so the one sequence that matters is escaped and nothing else is. */
const ldJson = data => JSON.stringify(data).replace(/<\//g, '<\\/');
const WEBSITE = { '@type': 'WebSite', name: 'Hermes Agent Archive', url: `${SITE}/` };

/** A tier is live when it has a real link; the tip surface across the site follows. */
export const liveTiers = links => (Array.isArray(links) ? links : []).filter(l => l && typeof l.url === 'string' && /^https?:\/\//.test(l.url));
/* Set once per build from data/support.json. Until a tier is live, no page shows a ☕
   button or a "buy a coffee" line: a call to tip with nowhere to tip would be a lie. */
let TIPS_LIVE = false;
export const setTipsLive = v => { TIPS_LIVE = Boolean(v); };

const page = ({ title, titleTag = null, description, canonical, body, breadcrumb, image = social(), jsonld = null }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="dark light">
<script>/* Colour scheme before first paint: a stored choice wins, otherwise the system's. Same snippet on every page, so the archive looks the same from one page to the next. */(function(){try{var s=localStorage.getItem('hermes-scheme');if(s==='light'||s==='dark')document.documentElement.dataset.scheme=s;var t=localStorage.getItem('ha-theme');if(t==='broadsheet')document.documentElement.dataset.theme=t;}catch(e){}})();</script>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titleTag || `${title} · Hermes Agent Archive`)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<link rel="icon" type="image/svg+xml" href="/assets/mark.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/style.css">
<link rel="stylesheet" href="/assets/css/doc.css">
${jsonld ? `<script type="application/ld+json">${ldJson(jsonld)}</script>` : ''}
</head>
<body>
<div class="doc">
<header><a href="/">Hermes Agent Archive</a>${breadcrumb}${TIPS_LIVE ? '<a class="support-btn" href="/support" aria-label="Support the archive">☕ Support</a>' : ''}</header>
${body}
<footer>
<p>Part of the <a href="/">Hermes Agent Archive</a> — sourced Hermes Agent workflows,
prompts and projects, each one linked to where it came from.</p>
<p>Curated by <a href="${OWNER_X}" rel="me">@BkashJosi</a> · <a href="${OWNER_GH}" rel="me">GitHub</a> · <a href="/support">Support the archive</a></p>
</footer>
</div>
</body>
</html>
`;

/** Blank lines become paragraphs, exactly as the drawer renders them. */
const paragraphs = text => String(text || '').split(/\n{2,}/)
  .map(p => p.trim()).filter(Boolean)
  .map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n');

export function entryPage(item, section, sourceLabel, lookup = new Map()) {
  /* Entries this story names, each a link to its own page. Only ones that resolve: a
     reference to an entry withheld under the floor would be a dead link. */
  const uses = (item.uses || []).map(id => lookup.get(id)).filter(Boolean);
  const link = item.url || (item.repo ? `https://github.com/${item.repo}` : null);
  const credit = item.author ? `By ${esc(item.author)}`
               : item.credit ? esc(item.credit)
               : sourceLabel ? `From ${esc(sourceLabel)}` : '';

  /* Many summaries are the opening of the detail, cut short with an ellipsis. Printing
     both puts a truncated sentence directly above the same sentence in full, which reads
     like a mistake. The summary still carries the meta description either way. */
  const flat = t => String(t || '').replace(/\s+/g, ' ').trim().replace(/[.…]+$/, '');
  const echoesDetail = item.detail && flat(item.detail).startsWith(flat(item.summary).slice(0, 60))
    && flat(item.summary).length > 40;

  const body = `
<article>
<h1>${esc(item.title)}</h1>
${echoesDetail ? '' : `<p class="lede">${esc(item.summary)}</p>`}
<p class="meta">${[credit, sourceLabel && item.author ? esc(sourceLabel) : '', esc(dateLabel(item.date))].filter(Boolean).join(' · ')}</p>
${item.detail ? paragraphs(item.detail) : ''}
${item.snippet ? `<pre><code>${esc(item.snippet)}</code></pre>` : ''}
${uses.length ? `<p class="meta">Mentioned in this story</p><ul class="entries uses">${uses.map(u => `<li><a href="/entry/${esc(u.id)}">${esc(u.title)}</a><p>${esc(u.shelf)}</p></li>`).join('')}</ul>` : ''}
${item.tags?.length ? `<ul class="tags">${item.tags.map(t => `<li>#${esc(t)}</li>`).join('')}</ul>` : ''}
${TIPS_LIVE ? '<p class="meta coffee">Saved you time? <a href="/support">Buy the curator a coffee ☕</a></p>' : ''}
<div class="actions">
${link ? `<a href="${esc(link)}" rel="noopener">Read the original</a>` : ''}
<a href="/#${esc(section.id)}?item=${encodeURIComponent(item.id)}">Open in the archive</a>
</div>
</article>`;

  /* Structured data says only what the entry says: a date only when the source carries
     one, an author only when one is credited, the original link as the citation. */
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: item.title, description: trim(item.summary), url: `${SITE}/entry/${item.id}`,
    inLanguage: 'en', isPartOf: WEBSITE, image: social(section.id),
    ...(item.date ? { datePublished: String(item.date).slice(0, 10) } : {}),
    ...(item.author ? { author: { '@type': 'Person', name: item.author } } : {}),
    ...(link ? { citation: link } : {}),
    ...(item.tags?.length ? { keywords: item.tags.join(', ') } : {})
  };
  /* An optional `titleTag` is the whole <title>, for an entry whose heading is too long to
     rank as one; without it the title is the heading plus the site name, as everywhere else. */
  return page({
    title: item.title,
    titleTag: typeof item.titleTag === 'string' && item.titleTag.trim() ? item.titleTag.trim() : null,
    description: trim(item.summary),
    canonical: `${SITE}/entry/${item.id}`,
    breadcrumb: ` / <a href="/shelf/${esc(section.id)}">${esc(section.label)}</a>`,
    image: social(section.id),
    jsonld,
    body
  });
}

export function shelfPage(section, items) {
  const body = `
<h1>${esc(section.title || section.label)}</h1>
<p class="lede">${esc(section.blurb || '')}</p>
<p class="meta">${items.length} ${items.length === 1 ? 'entry' : 'entries'}</p>
<ul class="entries">
${items.map(i => `<li><a href="/entry/${esc(i.id)}">${esc(i.title)}</a><p>${esc(trim(i.summary, 180))}</p></li>`).join('\n')}
</ul>
<div class="actions"><a href="/#${esc(section.id)}">Browse this shelf in the archive</a></div>`;

  const jsonld = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: section.title || section.label, url: `${SITE}/shelf/${section.id}`, isPartOf: WEBSITE,
    mainEntity: { '@type': 'ItemList', numberOfItems: items.length,
      itemListElement: items.slice(0, 100).map((i, n) => ({ '@type': 'ListItem', position: n + 1, name: i.title, url: `${SITE}/entry/${i.id}` })) }
  };
  return page({
    title: section.label,
    description: trim(section.blurb || `${items.length} entries in the Hermes Agent Archive.`),
    canonical: `${SITE}/shelf/${section.id}`,
    breadcrumb: '',
    image: social(section.id),
    jsonld,
    body
  });
}

/**
 * The shelf's own visibility rule, applied here too.
 *
 * A GitHub entry whose fetched star count does not clear the floor, or whose Hermes
 * support nobody has documented, is stored but never rendered on a shelf. The first
 * version of this generator paged every stored entry regardless, so thirteen repositories
 * the archive refuses to show were crawlable anyway — a side door in the one rule this
 * site is strictest about. A credited entry (an author's own figure) is exempt, as on the
 * shelf.
 */
export async function visible(item, byRepo) {
  const repo = githubRepo(item);
  if (!repo || item.credit) return true;
  return qualifiesRepository(repo, byRepo.get(repo)?.stars);
}

/**
 * The two ways a follower learns what changed without opening the site.
 *
 * /whats-new is the "What arrived recently" panel as a static page: every arrival grouped
 * by the day it landed, newest first, each linking to its entry page. A crawler can read
 * it and a reader can send it. /feed.xml is the same list as RSS 2.0, so a feed reader or
 * an automation can subscribe. Both use the arrival date — the first commit holding the
 * id — which is measured, unlike the `date` field, which is when the source was published.
 */
export function whatsNewPage(days, sections) {
  const label = id => sections.find(s => s.id === id)?.label || id;
  const when = day => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const total = days.reduce((n, [, items]) => n + items.length, 0);
  const body = `
<h1>What arrived recently</h1>
<p class="lede">${total} entries across the last ${days.length} days the archive grew. Dates are when each entry arrived here, not when its source was published.</p>
<p class="meta"><a href="/feed.xml">Subscribe by RSS</a> · <a href="/">Browse the archive</a></p>
${days.map(([day, items]) => {
  const byShelf = items.reduce((m, i) => ((m[i.shelf] ||= []).push(i), m), {});
  return `<section>
<h2>${esc(when(day))} <span class="meta">+${items.length}</span></h2>
${Object.entries(byShelf).map(([shelf, list]) => `<p class="meta">${esc(label(shelf).toUpperCase())} · ${list.length}</p>
<ul class="entries">${list.slice(0, 10).map(i => `<li><a href="/entry/${esc(i.id)}">${esc(i.title)}</a><p>${esc(trim(i.summary, 160))}</p></li>`).join('\n')}${list.length > 10 ? `
<li><a href="/shelf/${esc(shelf)}">+ ${list.length - 10} more on ${esc(label(shelf))} →</a></li>` : ''}</ul>`).join('\n')}
</section>`; }).join('\n')}`;
  return page({ title: 'What arrived recently', description: trim(`${total} entries added to the Hermes Agent Archive over the last ${days.length} days it grew, newest first.`), canonical: `${SITE}/whats-new`, breadcrumb: ' / What arrived recently', body,
    jsonld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'What arrived recently', url: `${SITE}/whats-new`, isPartOf: WEBSITE } });
}

/**
 * /support — a tip page that reads like one. Free to browse, always; what a tip pays for,
 * what it never buys, and the ways to help that cost nothing. Every figure on it is
 * counted from the loaded archive at build time. A payment link renders only when the
 * curator has configured a real one in data/support.json — a dead button would say the
 * opposite of what the page says.
 */
export function supportPage(links = [], sponsor = null, stats = null) {
  links = liveTiers(links);   // a tier without a real link is not a button
  const tier = l => `<a class="tier" href="${esc(l.url)}" rel="noopener">
    <span class="tier-amount">${esc(l.label)}</span>
    ${l.note ? `<span class="tier-note">${esc(l.note)}</span>` : ''}
    <span class="tier-cta">Tip →</span></a>`;
  const n = v => Number(v || 0).toLocaleString('en-US');
  const body = `
<section class="support-hero">
  <span class="support-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="5" rx="1"/><path d="M5 8v12h14V8 M9 12h6 M10 16h4"/></svg></span>
  <p class="support-kicker">TIP JAR</p>
  <h1>Keep the archive running.</h1>
  <p class="lede">Free to browse, always. One person reads every source, checks every credit and keeps the daily harvest honest. If it saved you an evening, a tip keeps the lights on.</p>
  ${stats ? `<ul class="support-stats" aria-label="What the archive holds today">
    <li><b>${n(stats.entries)}</b><span>entries, each linked to its source</span></li>
    <li><b>${n(stats.people)}</b><span>people credited by name</span></li>
    <li><b>${n(stats.shelves)}</b><span>shelves, refreshed daily</span></li>
  </ul>` : ''}
</section>
${links.length ? `<section class="support-tiers" aria-labelledby="tipTitle">
  <h2 id="tipTitle">Leave a tip</h2>
  <div class="tiers">${links.map(tier).join('')}</div>
  <p class="meta">Payments open on the curator's own page. Nothing is collected here.</p>
</section>` : ''}
<section class="support-pays" aria-labelledby="paysTitle">
  <h2 id="paysTitle">What a tip pays for</h2>
  <ul class="support-list">
    <li><b>The editorial API calls</b> that triage and rank every arrival, so the shelves stay ordered by usefulness rather than by date.</li>
    <li><b>The evenings</b> spent reading sources, resolving quotes to the exact message and checking that every credit names the right person.</li>
    <li><b>Keeping it free</b> — no paywall, no account, no tracking script, and the whole thing open source.</li>
  </ul>
</section>
<section class="support-never" aria-labelledby="neverTitle">
  <h2 id="neverTitle">What a tip never buys</h2>
  <p>A place on a shelf. A position in the ranking. A number on a card. ${sponsor ? 'The one sponsor slot is always labelled <em>Sponsored</em> and sits outside every shelf.' : 'There is no sponsored placement.'}</p>
</section>
<section class="support-free" aria-labelledby="freeTitle">
  <h2 id="freeTitle">Help without spending anything</h2>
  <div class="ways">
    <a class="way" href="/"><b>Share one entry</b><span>Every entry has its own page. Sending one useful page to a Hermes user grows this more than anything else.</span></a>
    <a class="way" href="${OWNER_GH}/hermes-agent-archive" rel="noopener"><b>Star the repository</b><span>A star is how new readers find it, and how the curator knows it is read.</span></a>
    <a class="way" href="${OWNER_GH}/hermes-agent-archive/issues/new?template=submit-entry.yml" rel="noopener"><b>Add to it</b><span>Suggest an entry or correct a credit. Both are reviewed before publishing, and both are credited.</span></a>
  </div>
</section>
${sponsor ? `<section class="support-sponsor" aria-labelledby="sponsorTitle">
  <h2 id="sponsorTitle">Sponsor slot</h2>
  <p>One labelled slot, always marked <em>Sponsored</em>, never on a shelf and never in the ranking. <a href="${esc(sponsor)}">Ask about it</a>.</p>
</section>` : ''}`;
  return page({ title: 'Support the archive', description: 'Tip jar for the Hermes Agent Archive: free to browse, kept by one person. What a tip pays for, what it never buys, and the ways to help that cost nothing.', canonical: `${SITE}/support`, breadcrumb: ' / Support', body,
    jsonld: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Support the archive', url: `${SITE}/support`, isPartOf: WEBSITE } });
}

export function feedXml(days, sections, limit = 60) {
  const label = id => sections.find(s => s.id === id)?.label || id;
  const items = days.flatMap(([day, list]) => list.map(i => ({ ...i, day }))).slice(0, limit);
  const rfc = day => new Date(`${day}T12:00:00Z`).toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Hermes Agent Archive — what arrived</title>
<link>${SITE}/whats-new</link>
<atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
<description>Sourced Hermes Agent workflows, prompts, skills and projects, as they are added. Dates are arrival dates.</description>
<language>en</language>
${items.map(i => `<item>
<title>${esc(i.title)}</title>
<link>${SITE}/entry/${esc(i.id)}</link>
<guid isPermaLink="true">${SITE}/entry/${esc(i.id)}</guid>
<pubDate>${rfc(i.day)}</pubDate>
<category>${esc(label(i.shelf))}</category>
<description>${esc(trim(i.summary, 300))}</description>
</item>`).join('\n')}
</channel>
</rss>
`;
}

async function main() {
  const dry = process.argv.includes('--dry');
  const index = JSON.parse(await readFile(join(ROOT, 'data', 'index.json'), 'utf8'));
  const sourceLabels = new Map(index.sources.map(s => [s.id, s.label || s.name]));
  const live = JSON.parse(await readFile(join(ROOT, 'data', 'live.json'), 'utf8').catch(() => '{"github":[]}'));
  const byRepo = new Map((live.github || []).map(g => [g.repo.toLowerCase(), g]));

  const shelves = [];
  const skipped = [];
  const withheld = [];
  for (const section of index.sections) {
    if (!section.file) continue;                 // a computed shelf has nothing on disk
    const { items } = JSON.parse(await readFile(join(ROOT, 'data', section.file), 'utf8'));
    const usable = [];
    for (const i of items) {
      if (!SAFE_ID.test(i.id)) { skipped.push(i.id); continue; }
      if (!await visible(i, byRepo)) { withheld.push(i.id); continue; }
      usable.push(i);
    }
    shelves.push({ section, items: usable });
  }

  const total = shelves.reduce((n, s) => n + s.items.length, 0);
  console.log(`${total} entries across ${shelves.length} shelves`);
  if (skipped.length) console.log(`  ${skipped.length} id(s) unsafe for a path and skipped: ${skipped.slice(0, 5).join(', ')}`);
  if (withheld.length) console.log(`  ${withheld.length} GitHub entr${withheld.length === 1 ? 'y' : 'ies'} below the floor or undocumented: stored, not paged`);

  if (dry) { console.log('\n--dry: nothing written.'); return; }

  /* Rebuild from empty so a renamed or removed entry cannot leave an orphan page behind,
     still reachable and still claiming to be current. */
  for (const dir of ['entry', 'shelf']) await rm(join(ROOT, dir), { recursive: true, force: true });
  await mkdir(join(ROOT, 'entry'), { recursive: true });
  await mkdir(join(ROOT, 'shelf'), { recursive: true });

  /* Arrival dates, if they have been generated. Only entries this build pages. */
  const added = JSON.parse(await readFile(join(ROOT, 'data', 'added.json'), 'utf8').catch(() => '{"added":{}}')).added || {};
  const dayMap = new Map();
  for (const { section, items } of shelves)
    for (const item of items) {
      const day = added[item.id]; if (!day) continue;
      if (!dayMap.has(day)) dayMap.set(day, []);
      dayMap.get(day).push({ ...item, shelf: section.id });
    }
  const days = [...dayMap.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  /* Every paged entry by id, so a story's `uses` can link by title and shelf. */
  const lookup = new Map();
  for (const { section, items } of shelves) for (const i of items) lookup.set(i.id, { id: i.id, title: i.title, shelf: section.label });
  const urls = [`${SITE}/`];
  const support = JSON.parse(await readFile(join(ROOT, 'data', 'support.json'), 'utf8').catch(() => '{"links":[]}'));
  setTipsLive(liveTiers(support.links).length);
  /* The page's figures are the same counts the cards and the dashboard carry. */
  const paged = shelves.flatMap(s => s.items);
  const stats = { entries: paged.length, shelves: shelves.length,
    people: new Set(paged.map(creditFor).filter(c => c.label !== 'Author').map(c => c.name)).size };
  await writeFile(join(ROOT, 'support.html'), supportPage(Array.isArray(support.links) ? support.links : [], typeof support.sponsor === 'string' ? support.sponsor : null, stats));
  urls.push(`${SITE}/support`);
  if (days.length) {
    await writeFile(join(ROOT, 'whats-new.html'), whatsNewPage(days.slice(0, 30), index.sections));
    await writeFile(join(ROOT, 'feed.xml'), feedXml(days, index.sections));
    urls.push(`${SITE}/whats-new`);
  }
  for (const { section, items } of shelves) {
    await writeFile(join(ROOT, 'shelf', `${section.id}.html`), shelfPage(section, items));
    urls.push(`${SITE}/shelf/${section.id}`);
    for (const item of items) {
      await writeFile(join(ROOT, 'entry', `${item.id}.html`), entryPage(item, section, sourceLabels.get(item.source), lookup));
      urls.push(`${SITE}/entry/${item.id}`);
    }
  }

  /* No <lastmod>. The `date` field is when the thing described was published, not when
     this page changed, and claiming otherwise would be a date nobody measured. */
  await writeFile(join(ROOT, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(u => `  <url><loc>${esc(u)}</loc></url>`).join('\n')
    + '\n</urlset>\n');

  console.log(`wrote ${total} entry pages, ${shelves.length} shelf pages, sitemap.xml (${urls.length} urls)${days.length ? `, whats-new.html and feed.xml (${days.length} arrival days)` : ', no arrival dates — run npm run added'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
