/**
 * Tags that describe where an entry came from, not what it is about.
 *
 * The Tag Watchlist ranked `user-story 345 · cli 330 · reference 309 · docs 209` at the
 * top — importer labels, every one. A reader scanning for topics (memory, voice-mode,
 * dev-workflow) found provenance instead, and the same labels took two of the three chip
 * slots on a card. They still filter, still count, and still appear in the drawer; they
 * just stop pretending to be subjects.
 */
export const PROVENANCE_TAGS = new Set([
  'user-story', 'reference', 'docs', 'sourced', 'cli', 'built-in', 'optional', 'official-example'
]);

export const isTopicTag = tag => !PROVENANCE_TAGS.has(String(tag).toLowerCase());
