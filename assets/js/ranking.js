/* Shared by the offline Jev job and browser. Assessments are never public metrics. */
export const RANKING_VERSION = 1;
export const MODEL = 'jev-latest';
export const USEFULNESS = ['Thin evidence', 'Limited usefulness', 'Useful in a niche', 'Useful and repeatable', 'Highly useful and actionable'];
export const POPULARITY = { unknown: 'Popularity unknown', limited: 'Limited public traction', established: 'Established public traction', strong: 'Strong public traction', widespread: 'Widespread public traction' };
const POPULARITY_ORDER = ['unknown', 'limited', 'established', 'strong', 'widespread'];
export const usefulnessLabel = score => USEFULNESS[Math.round(score)];
export const popularityLabel = label => POPULARITY[label];
export function rankingInput(item) {
  // Attribution dates are excluded; no recency or source-post age enters the rubric.
  const detail = (item.detail || '').split('\n\n').filter(p => !p.startsWith(`— ${item.author},`)).join('\n\n');
  return { id: item.id, title: item.title, summary: item.summary || '', detail,
    snippet: item.snippet || '', tags: item.tags || [], source: item.source,
    evidence: [item.metric, item.metric2].filter(m => m && Number.isFinite(m.value) && m.value >= 0) };
}
export async function inputKey(item) {
  const bytes = new TextEncoder().encode(JSON.stringify(rankingInput(item)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function validAssessment(r) {
  return r && typeof r.input === 'string' && /^[a-f0-9]{64}$/.test(r.input) && Number.isFinite(r.usefulness) && r.usefulness >= 0 && r.usefulness <= 4
    && Object.hasOwn(POPULARITY, r.popularity)
    && Number.isFinite(r.confidence) && r.confidence >= 0 && r.confidence <= 1;
}
export async function attachRankings(items, file) {
  for (const item of items) {
    delete item.ranking;
    const r = file?.results?.[item.id];
    if (file?.version === RANKING_VERSION && file?.model === MODEL && validAssessment(r) && r.input === await inputKey(item)) item.ranking = r;
  }
}
export function compareRankings(a, b, mode = 'recommended') {
  const ar = a.ranking, br = b.ranking;
  if (!ar || !br) return Number(Boolean(br)) - Number(Boolean(ar)) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  const useful = Math.round(br.usefulness) - Math.round(ar.usefulness);
  const popular = POPULARITY_ORDER.indexOf(br.popularity) - POPULARITY_ORDER.indexOf(ar.popularity);
  return (mode === 'popular' ? popular || useful : useful || popular)
    || br.usefulness - ar.usefulness || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
}
