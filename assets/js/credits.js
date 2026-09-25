/* Credit recorded authors; a GitHub account identifies the repository owner,
   not necessarily the person who wrote every contribution. */
export function creditFor(item) {
  if (item.author?.trim()) return { label: 'By', name: item.author.trim() };
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
  return { label: 'Author', name: 'not provided by source' };
}
