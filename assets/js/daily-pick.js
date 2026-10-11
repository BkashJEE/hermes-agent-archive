/**
 * Today's pick: one entry a day, in rotation, from the archive's most useful.
 *
 * Sources do not publish something new every day, and this archive never invents an
 * entry to fill a quiet one. What can change every day honestly is which existing entry
 * is put in front of a reader. The pick is labelled as a rotation, not as news.
 *
 * Deterministic and dependency-free, so the browser and `npm run post -- --pick` agree
 * on the same day without a server: the pool is every displayed entry Jev rated at or
 * above THRESHOLD, put in a fixed pseudo-random order by a hash of its id (so it is not
 * clustered by shelf), and day N of the year-long count takes position N mod pool size.
 * No entry repeats until the whole pool has been shown. Adding entries moves positions,
 * so the pick is a property of the archive as published that day.
 */
export const THRESHOLD = 2.5;
const EPOCH = Date.UTC(2026, 0, 1);

/** FNV-1a, 32-bit: a stable shuffle key with no dependency. */
export function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

export const dayNumber = (date = new Date()) =>
  Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - EPOCH) / 86_400_000);

/** `items` carry `id` and `usefulness`; returns the ordered pool of eligible ids. */
export function pool(items) {
  return items
    .filter(i => typeof i.usefulness === 'number' && i.usefulness >= THRESHOLD)
    .map(i => i.id)
    .sort((a, b) => hash(a) - hash(b) || a.localeCompare(b));
}

export function pickFor(items, date = new Date()) {
  const ids = pool(items);
  if (!ids.length) return null;
  const n = dayNumber(date);
  return ids[((n % ids.length) + ids.length) % ids.length];
}
