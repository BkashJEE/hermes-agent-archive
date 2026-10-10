/* Credit recorded authors; a GitHub account identifies the repository owner,
   not necessarily the person who wrote every contribution. */
/** The author field as one string. Two catalogue skills listed co-authors as an array, and
    `item.author?.trim` threw — only on the Dashboard, the one view that walks every shelf,
    so production landed on an empty page while every shelf looked fine. */
export const authorName = author =>
  (Array.isArray(author) ? author.filter(Boolean).join(', ') : String(author ?? '')).trim();

export function creditFor(item) {
  const author = authorName(item.author);
  if (author && !/^r\//i.test(author)) return { label: 'By', name: author };
  if (item.source === 'docs' && item.url) {
    try {
      if (new URL(item.url).hostname === 'hermes-agent.nousresearch.com')
        return { label: 'Documentation by', name: 'Nous Research' };
    } catch { /* Invalid links cannot establish a publisher. */ }
  }
  if (item.source === 'github' && item.url) {
    try {
      const url = new URL(item.url);
      const parts = url.pathname.split('/').filter(Boolean);
      if (url.hostname === 'github.com' && parts.length >= 2)
        return { label: 'Repository owner', name: parts[0] };
    } catch { /* An invalid link cannot establish ownership. */ }
  }
  return { label: 'Author', name: 'not recorded' };
}
