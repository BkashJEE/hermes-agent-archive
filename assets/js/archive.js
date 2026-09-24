/* Merge fetched public metrics onto curated entries, then shelve everything the
   sourcing pipeline found. Every value here came from a public API — nothing is
   hand-written, and nothing is estimated. */
export function mergeLive(data, live) {
  if (!live) return;
  const builds = data.builds || [];

  // GitHub: attach real stars/forks to seeded repos; drop seeds that never resolved.
  const byRepo = new Map((live.github || []).map(g => [g.repo.toLowerCase(), g]));
  data.builds = builds.filter(item => {
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
    if (!data[sectionId]) return;
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

