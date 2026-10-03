/* Presentation metadata. The current corpus is Hermes-only; agent identity is
   an entry dimension, never a layout class or a colour assignment. */
export const SOURCE_LABEL = {
  x: 'X / Twitter', reddit: 'Reddit', hn: 'Hacker News', discord: 'Discord',
  fb: 'Facebook', github: 'GitHub', youtube: 'YouTube', blog: 'Blog',
  podcast: 'Podcast', linkedin: 'LinkedIn', producthunt: 'Product Hunt',
  docs: 'Official docs', community: 'Community'
};
export const agentFor = item => typeof item.agent === 'string' && item.agent.trim()
  ? item.agent.trim() : 'Hermes';
export const shelfLabel = section => section?.id === 'dashboard' ? 'Explore'
  : section?.id === 'my-work' ? 'Curator’s work' : section?.label || 'Entry';
export const snippetLabel = item => item.snippet?.trim()
  ? ((item.tags || []).includes('prompt') ? 'Copyable prompt' : 'Copyable snippet') : null;
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
