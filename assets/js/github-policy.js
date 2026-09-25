// Shared by the browser, public fetcher and router. The snapshot records overrides.
export const MIN_GITHUB_STARS = 1000;
export function githubStarFloor(value = MIN_GITHUB_STARS) {
  if (value === null || !['string','number'].includes(typeof value)) throw new Error('MIN_STARS must be a non-negative integer');
  if (typeof value === 'string' && !value.trim()) return MIN_GITHUB_STARS;
  const floor = Number(value);
  if (!Number.isSafeInteger(floor) || floor < 0) throw new Error('MIN_STARS must be a non-negative integer');
  return floor;
}
export const qualifiesStars = (stars, floor = MIN_GITHUB_STARS) =>
  Number.isFinite(stars) && stars >= githubStarFloor(floor);
