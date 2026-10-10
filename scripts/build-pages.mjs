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

const page = ({ title, description, canonical, body, breadcrumb }) => `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Hermes Agent Archive</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${SITE}/assets/social-preview.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE}/assets/social-preview.png">
<link rel="icon" type="image/svg+xml" href="/assets/mark.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/style.css">
<link rel="stylesheet" href="/assets/css/doc.css">
</head>
<body>
<div class="doc">
<header><a href="/">Hermes Agent Archive</a>${breadcrumb}</header>
${body}
<footer>
<p>Part of the <a href="/">Hermes Agent Archive</a> — sourced Hermes Agent workflows,
prompts and projects, each one linked to where it came from.</p>
<p>Curated by <a href="${OWNER_X}" rel="me">@BkashJosi</a> · <a href="${OWNER_GH}" rel="me">GitHub</a></p>
</footer>
</div>
</body>
</html>
`;

/** Blank lines become paragraphs, exactly as the drawer renders them. */
const paragraphs = text => String(text || '').split(/\n{2,}/)
  .map(p => p.trim()).filter(Boolean)
  .map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n');

export function entryPage(item, section, sourceLabel) {
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
${credit ? `<p class="meta">${credit}${sourceLabel && item.author ? ` · ${esc(sourceLabel)}` : ''}</p>` : ''}
${item.detail ? paragraphs(item.detail) : ''}
${item.snippet ? `<pre><code>${esc(item.snippet)}</code></pre>` : ''}
${item.tags?.length ? `<ul class="tags">${item.tags.map(t => `<li>#${esc(t)}</li>`).join('')}</ul>` : ''}
<div class="actions">
${link ? `<a href="${esc(link)}" rel="noopener">Read the original</a>` : ''}
<a href="/#${esc(section.id)}?item=${encodeURIComponent(item.id)}">Open in the archive</a>
</div>
</article>`;

  return page({
    title: item.title,
    description: trim(item.summary),
    canonical: `${SITE}/entry/${item.id}`,
    breadcrumb: ` / <a href="/shelf/${esc(section.id)}">${esc(section.label)}</a>`,
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

  return page({
    title: section.label,
    description: trim(section.blurb || `${items.length} entries in the Hermes Agent Archive.`),
    canonical: `${SITE}/shelf/${section.id}`,
    breadcrumb: '',
    body
  });
}

async function main() {
  const dry = process.argv.includes('--dry');
  const index = JSON.parse(await readFile(join(ROOT, 'data', 'index.json'), 'utf8'));
  const sourceLabels = new Map(index.sources.map(s => [s.id, s.label || s.name]));

  const shelves = [];
  const skipped = [];
  for (const section of index.sections) {
    if (!section.file) continue;                 // a computed shelf has nothing on disk
    const { items } = JSON.parse(await readFile(join(ROOT, 'data', section.file), 'utf8'));
    const usable = items.filter(i => {
      if (SAFE_ID.test(i.id)) return true;
      skipped.push(i.id);
      return false;
    });
    shelves.push({ section, items: usable });
  }

  const total = shelves.reduce((n, s) => n + s.items.length, 0);
  console.log(`${total} entries across ${shelves.length} shelves`);
  if (skipped.length) console.log(`  ${skipped.length} id(s) unsafe for a path and skipped: ${skipped.slice(0, 5).join(', ')}`);

  if (dry) { console.log('\n--dry: nothing written.'); return; }

  /* Rebuild from empty so a renamed or removed entry cannot leave an orphan page behind,
     still reachable and still claiming to be current. */
  for (const dir of ['entry', 'shelf']) await rm(join(ROOT, dir), { recursive: true, force: true });
  await mkdir(join(ROOT, 'entry'), { recursive: true });
  await mkdir(join(ROOT, 'shelf'), { recursive: true });

  const urls = [`${SITE}/`];
  for (const { section, items } of shelves) {
    await writeFile(join(ROOT, 'shelf', `${section.id}.html`), shelfPage(section, items));
    urls.push(`${SITE}/shelf/${section.id}`);
    for (const item of items) {
      await writeFile(join(ROOT, 'entry', `${item.id}.html`), entryPage(item, section, sourceLabels.get(item.source)));
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

  console.log(`wrote ${total} entry pages, ${shelves.length} shelf pages, sitemap.xml (${urls.length} urls)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
