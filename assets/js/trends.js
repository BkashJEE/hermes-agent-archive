/* Trending is measured star growth, never publication age or an inferred score. */
const HOUR = 3_600_000;
const MAX_AGE = 14 * 24 * HOUR;
const validCount = value => Number.isFinite(value) && value >= 0;

export function recordGithubObservations(fresh, previous, observedAt) {
  const oldByRepo = new Map((previous.github || []).map(g => [g.repo.toLowerCase(), g]));
  return fresh.map(g => {
    if (g.stale) return g;
    const old = oldByRepo.get(g.repo.toLowerCase());
    const oldAt = old?.observedAt || (!old?.stale ? previous.generatedAt : undefined);
    const candidate = { value: old?.stars, at: oldAt };
    const elapsed = Date.parse(observedAt) - Date.parse(oldAt);
    const baseline = elapsed >= HOUR ? candidate : old?.previousStars;
    const result = { ...g, observedAt };
    delete result.previousStars;
    if (validCount(baseline?.value) && Date.parse(baseline.at) < Date.parse(observedAt))
      result.previousStars = baseline;
    return result;
  });
}

export function githubTrend(g, now = Date.now()) {
  if (!g || g.stale || !validCount(g.stars) || !validCount(g.previousStars?.value)) return null;
  const end = Date.parse(g.observedAt), start = Date.parse(g.previousStars.at);
  const elapsed = end - start, age = now - end, gain = g.stars - g.previousStars.value;
  if (!Number.isFinite(elapsed) || !Number.isFinite(age) || elapsed < HOUR || elapsed > MAX_AGE
      || age < 0 || age > MAX_AGE || gain <= 0) return null;
  return { gain, perDay: gain * 24 * HOUR / elapsed, from: g.previousStars.at, to: g.observedAt };
}
