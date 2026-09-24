/* Merge fetched public metrics onto curated entries, then shelve everything the
   sourcing pipeline found. Every value here came from a public API — nothing is
   hand-written, and nothing is estimated. */
const belowStarCutoff = stars => Number.isFinite(stars) && stars >= 0 && stars <= 50;

function githubRepo(item) {
  if (item.repo) return item.repo.toLowerCase();
  try {
    const url = new URL(item.url);
    const parts = url.pathname.split('/').filter(Boolean);
    if (url.hostname === 'github.com' && parts.length >= 2)
      return parts.slice(0, 2).join('/').replace(/\.git$/i, '').toLowerCase();
  } catch { /* No repository identity can be inferred from an invalid URL. */ }
}

export function mergeLive(data, live) {
  // Only the public API snapshot can supply engagement, including in the CLI job.
  for (const items of Object.values(data)) for (const item of items) {
    delete item.metric; delete item.metric2;
  }
  if (!live) return;
  // GitHub: attach real stars/forks to any seeded repo, on any shelf.
  // Seeds retain their write-ups when no metric is available.
  const byRepo = new Map((live.github || []).map(g => [g.repo.toLowerCase(), g]));
  for (const [sectionId, items] of Object.entries(data)) {
    data[sectionId] = items.filter(item => {
      // The visibility rule applies to every shelf, including URL-only entries.
      // Stored content is retained so a later public count can qualify it again.
      if (belowStarCutoff(byRepo.get(githubRepo(item))?.stars)) return false;
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

  const seenIds = new Set(Object.values(data).flat().map(it => it.id));
  const seenUrls = new Set(Object.values(data).flat().map(it => it.url).filter(Boolean));
  const shelve = (sectionId, raw) => {
    const repo = githubRepo(raw);
    const stars = byRepo.get(repo)?.stars ?? (raw.metric?.kind === 'stars' ? raw.metric.value : undefined);
    if ((repo || raw.source === 'github') && belowStarCutoff(stars)) return;
    if (seenIds.has(raw.id) || (raw.url && seenUrls.has(raw.url))) return;
    if (!data[sectionId]) return;
    seenIds.add(raw.id); if (raw.url) seenUrls.add(raw.url);
    data[sectionId].push({
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
