/**
 * "updated 2 days ago" instead of "UPDATED 9/29/2026".
 *
 * An absolute date in the top bar is a countdown to looking abandoned: the site showed a
 * week-old date for a week, because a scheduled job was switched off. Relative wording
 * reads as freshness while it is fresh, and past a fortnight the badge is better gone
 * than advertising the gap.
 */
export const STALE_AFTER_DAYS = 14;

export function daysSince(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}

export function ageLabel(iso, now = Date.now()) {
  const d = daysSince(iso, now);
  if (d === null) return null;
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  if (d < STALE_AFTER_DAYS) return `${Math.floor(d / 7)} week${d >= 14 ? 's' : ''} ago`;
  return null;                                    // stale: show nothing rather than a gap
}
