/* Merge fetched public metrics onto curated entries, then shelve everything the
   sourcing pipeline found. Every value here came from a public API — nothing is
   hand-written, and nothing is estimated. */
import { githubTrend } from './trends.js';

export const MIN_GITHUB_STARS = 5000;
const qualifies = stars => Number.isFinite(stars) && stars >= MIN_GITHUB_STARS;

export function githubRepo(item) {
  // An entry carrying its own credit is a post, not a repository listing, even
  // when it links to one. The star threshold does not apply to it.
  if (item.credit) return undefined;
  if (item.repo) return item.repo.toLowerCase();
  try {
    const url = new URL(item.url);
    const parts = url.pathname.split('/').filter(Boolean);
    if (url.hostname === 'github.com' && parts.length === 2)
      return parts.slice(0, 2).join('/').replace(/\.git$/i, '').toLowerCase();
  } catch { /* No repository identity can be inferred from an invalid URL. */ }
}

export function mergeLive(data, live) {
  /* A fetched snapshot is the only thing that may supply engagement, with one
     exception: an entry that names where its figure came from. The rule is that
     every number states its source, not that every number comes from an API —
     an author's own analytics export is real, it simply is not public, so the
     card says so rather than the archive pretending the figure does not exist. */
  for (const items of Object.values(data)) for (const item of items) {
    if (item.credit) { delete item.trend; continue; }
    delete item.metric; delete item.metric2; delete item.trend;
  }
  if (!live) {
    for (const [id, items] of Object.entries(data))
      data[id] = items.filter(item => !githubRepo(item));
    return;
  }
  // GitHub: attach real stars/forks to any seeded repo, on any shelf.
  // Repository write-ups stay on disk; only verified 5k+ repos enter the view.
  const byRepo = new Map((live.github || []).map(g => [g.repo.toLowerCase(), g]));
  for (const [sectionId, items] of Object.entries(data)) {
    data[sectionId] = items.filter(item => {
      // The visibility rule applies to every shelf, including URL-only entries.
      // Stored content is retained so a later public count can qualify it again.
      const repo = githubRepo(item), observation = byRepo.get(repo);
      if (repo && !qualifies(observation?.stars)) return false;
      item.trend = githubTrend(observation);
      // A credited entry never took part in the qualification above, so there is
      // no fetched observation to attach — leave it exactly as written.
      if (!repo || item.credit) return true;
      const g = byRepo.get(repo);
      // Qualification above guarantees a fetched observation for this seed.
      if (item.repo) item.title = g.repo;                       // follow renames/transfers
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
    const observation = byRepo.get(repo);
    const stars = observation?.stars ?? (raw.metric?.kind === 'stars' ? raw.metric.value : undefined);
    if ((repo || raw.metric?.kind === 'stars') && !qualifies(stars)) return;
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
      metric: observation ? { kind: 'stars', value: observation.stars } : raw.metric,
      metric2: observation ? { kind: 'forks', value: observation.forks } : raw.metric2,
      trend: githubTrend(observation),
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

// A computed shelf: references existing entries without duplicating archive totals.
export function trendingItems(data) {
  const repos = new Map();
  for (const item of Object.values(data).flat()) {
    const repo = githubRepo(item);
    if (repo && item.trend && item.metric?.kind === 'stars' && qualifies(item.metric.value) && !repos.has(repo))
      repos.set(repo, item);
  }
  return [...repos.values()].sort((a, b) => b.trend.perDay - a.trend.perDay || a.title.localeCompare(b.title));
}
