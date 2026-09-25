/* Prefer reviewed card summaries stored with the item; otherwise extract short
   source statements. Full quotes stay in the drawer, without generated claims. */
const sentences = new Intl.Segmenter('en', { granularity: 'sentence' });

export function cardPoints(item) {
  if (Array.isArray(item.cardPoints) && item.cardPoints.length)
    return item.cardPoints.filter(point => typeof point === 'string' && point.trim()).slice(0, 3);
  const summary = (item.summary || '').trim();
  const story = (item.tags || []).includes('user-story');
  const text = (story ? item.detail || summary : summary).split(/\n\s*\n— /)[0].trim();
  const numbered = [...text.matchAll(/(?:^|\s)(\d{1,2})[.)]\s+/g)];
  const hasSteps = numbered.length > 1 && numbered.every((m, i) => Number(m[1]) === i + 1);
  const blocks = hasSteps
    ? numbered.map((m, i) => text.slice(m.index + m[0].length, numbered[i + 1]?.index).trim())
    : text.split(/\n+|\s+[*•]\s+/).map(line => line.replace(/^\s*[-*•]\s+/, '').trim());
  const candidates = blocks.flatMap(block => {
    const parts = [];
    for (const { segment } of sentences.segment(block.split(/\s+…\s+/)[0])) {
      const previous = parts.at(-1) || '';
      // Sentence segmentation treats abbreviations such as “vs.” as a boundary.
      // Keep open parentheses and abbreviated comparisons with their continuation.
      if (parts.length && (/(?:\bvs|\be\.g|\bi\.e)\.$/i.test(previous)
          || (previous.match(/\(/g) || []).length > (previous.match(/\)/g) || []).length))
        parts[parts.length - 1] += ' ' + segment.trim();
      else parts.push(segment.trim());
    }
    return parts;
  })
    .filter(line => line && !/^— |^\.{3}$|^…$/.test(line));
  // Long reference enumerations can use their introductory clause (e.g. provider lists).
  const brief = candidates.map(line => line.length > 220 && line.includes(':')
    ? line.slice(0, line.indexOf(':')).trim() : line)
    .filter(line => line.length >= 12 && line.length <= 220 && !/(?:…|\.{3})$/.test(line));
  const points = [];
  let length = 0;
  for (const line of brief) {
    if (points.includes(line)) continue;
    if (points.length && length + line.length > 330) break;
    points.push(line);
    length += line.length;
    if (points.length === 3) break;
  }
  // Sparse sources should remain honest; preserve their original summary if needed.
  return points.length ? points : [summary || item.title];
}

export function cardCategory(item, sectionIcon) {
  const tags = item.tags || [];
  if (tags.some(t => ['dev-workflow', 'integrations', 'cli', 'toolkit', 'privacy-self-hosted'].includes(t)))
    return { tone: 'teal', icon: sectionIcon === 'stories' ? 'commands' : sectionIcon };
  if (tags.some(t => ['creative', 'content-creation', 'research', 'marketing'].includes(t)))
    return { tone: 'violet', icon: sectionIcon === 'stories' ? 'tricks' : sectionIcon };
  return { tone: 'amber', icon: sectionIcon };
}
