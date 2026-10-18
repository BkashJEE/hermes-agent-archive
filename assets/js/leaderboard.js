/* The prompt leaderboard's two orders, kept pure so they can be tested.

   "All time" is Jev's usefulness judgment, highest first — an editorial ranking, and the
   board says so in its own words. It is never a vote count: the archive has none, and a
   number nobody measured would be the one thing this site must not show. Unclassified
   prompts sit after every classified one, alphabetical, so a prompt that arrived an hour
   ago is visible without pretending to a rank it has not been given.

   "This week" is the same order over the prompts whose arrival date — the first commit
   holding the id, from data/added.json — falls inside the last seven days. */

const DAY = 86400000;

/** Usefulness first, ties alphabetical; unclassified last, alphabetical. */
export function rankPrompts(items) {
  const score = it => (it.ranking && typeof it.ranking.usefulness === 'number') ? it.ranking.usefulness : null;
  return [...items].sort((a, b) => {
    const sa = score(a), sb = score(b);
    if (sa === null && sb === null) return a.title.localeCompare(b.title);
    if (sa === null) return 1;
    if (sb === null) return -1;
    return sb - sa || a.title.localeCompare(b.title);
  });
}

/** The ranked prompts that arrived within `days` days of `today` (a Date or ISO string). */
export function thisWeek(items, added, today = new Date(), days = 7) {
  if (!added) return [];
  const end = new Date(today);
  const start = new Date(end.getTime() - (days - 1) * DAY).toISOString().slice(0, 10);
  const last = end.toISOString().slice(0, 10);
  return rankPrompts(items.filter(it => {
    const day = added[it.id];
    return typeof day === 'string' && day >= start && day <= last;
  }));
}

/** The text a reader copies: the prompt itself when the entry carries one, else its summary. */
export const promptText = it => (it.snippet && it.snippet.trim()) || it.summary || '';
