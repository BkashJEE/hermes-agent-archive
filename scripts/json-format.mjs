/**
 * Rewrite a data file without changing how it is written.
 *
 * The data files do not share one escaping convention: commands.json stores non-ASCII as
 * \uXXXX escapes, use-cases.json stores the characters themselves. A plain
 * JSON.stringify would flip the first kind wholesale, and a one-line fix would arrive as
 * a hundred-line diff with the real change buried in it. Reviewers should see only what
 * actually changed, so each file keeps whichever convention it already had.
 */

const ASCII_ONLY = /^[\x00-\x7F]*$/;

/** True when this file spells non-ASCII as escapes rather than as characters. */
export function usesEscapes(original) {
  return /\\u[0-9a-fA-F]{4}/.test(original) && ASCII_ONLY.test(original);
}

const escapeNonAscii = s =>
  s.replace(/[^\x00-\x7F]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

/** Serialise `value` the way `original` was written: same indent, escaping and final newline. */
export function serialise(original, value) {
  const out = JSON.stringify(value, null, 2);
  return (usesEscapes(original) ? escapeNonAscii(out) : out) + (original.endsWith('\n') ? '\n' : '');
}
