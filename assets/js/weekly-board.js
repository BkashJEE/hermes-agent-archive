/* The weekly board: once a week the whole archive is scored and the top of it is written
   down, so the leaderboard can say "this week" and mean a measurement with a date on it,
   and so next week can say what moved.

   The score is Jev's usefulness judgment with public popularity breaking ties — the same
   editorial order every shelf uses — never a vote count. Movement is the difference
   between two written-down ranks, which is a measured thing. Pure functions here; the
   script that writes data/leaderboard.json and the app that reads it both use them. */

/** ISO week key for a date, e.g. 2026-W42 (weeks start Monday, UTC). */
export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;                       // Monday 1 … Sunday 7
  d.setUTCDate(d.getUTCDate() + 4 - day);               // the Thursday decides the year
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - jan1) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Usefulness first (rounded bands, then exact), popularity breaks ties, then title. */
export function scoreOrder(a, b) {
  const ar = a.ranking, br = b.ranking;
  if (!ar || !br) return Number(Boolean(br)) - Number(Boolean(ar)) || a.title.localeCompare(b.title);
  const POP = ['viral', 'high', 'moderate', 'low', 'unknown'];
  return (Math.round(br.usefulness) - Math.round(ar.usefulness))
    || (POP.indexOf(ar.popularity ?? 'unknown') - POP.indexOf(br.popularity ?? 'unknown'))
    || (br.usefulness - ar.usefulness)
    || a.title.localeCompare(b.title);
}

const entry = (it, i) => ({ rank: i + 1, id: it.id, shelf: it.shelf, usefulness: it.ranking.usefulness, popularity: it.ranking.popularity ?? 'unknown' });

/** The week's snapshot: the top `size` classified entries across every shelf, and the
    top `perShelf` of each shelf on its own — a shelf of stories should have a weekly
    board even when the documentation shelves hold every overall top-fifty place. */
export function snapshot(items, { week, scoredAt, size = 50, perShelf = 10 } = {}) {
  const ranked = items.filter(it => it.ranking && typeof it.ranking.usefulness === 'number').sort(scoreOrder);
  const shelves = {};
  for (const it of ranked) (shelves[it.shelf] ||= []).push(it);
  return {
    week, scoredAt, size, perShelf, of: ranked.length,
    entries: ranked.slice(0, size).map(entry),
    shelves: Object.fromEntries(Object.entries(shelves).map(([shelf, list]) => [shelf, { of: list.length, entries: list.slice(0, perShelf).map(entry) }]))
  };
}

/** Movement of each entry in `current` against `previous` (two lists of {id, rank}):
    a signed number of places, or 'new'. */
export function movement(current, previous) {
  const before = new Map((previous?.entries || []).map(e => [e.id, e.rank]));
  return Object.fromEntries((current?.entries || []).map(e => [e.id, before.has(e.id) ? before.get(e.id) - e.rank : 'new']));
}
