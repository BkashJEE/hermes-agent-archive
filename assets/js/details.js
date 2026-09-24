/* Turn explicit lists in imported quotes into semantic bullets, without
   paraphrasing the source or treating ordinary numbers as list markers. */
const escape = text => text.replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inline = text => escape(text.trim()).replace(/\n/g, '<br>');
const bullets = items => `<ul>${items.map(text => `<li>${inline(text)}</li>`).join('')}</ul>`;

export function formatDetails(paragraphs) {
  return paragraphs.filter(p => p.trim()).map(paragraph => {
    const markers = [...paragraph.matchAll(/(?:^|\s)(\d{1,2})[.)]\s+/g)];
    if (markers.length >= 2 && markers.every((m, i) => Number(m[1]) === i + 1)) {
      const intro = paragraph.slice(0, markers[0].index).trim();
      const items = markers.map((m, i) => paragraph.slice(m.index + m[0].length, markers[i + 1]?.index));
      return (intro ? `<p>${inline(intro)}</p>` : '') + bullets(items);
    }
    // Preserve prose around lists whose bullets were retained on separate lines.
    const lines = paragraph.split('\n');
    const blocks = [];
    let list = [], prose = [];
    const flushProse = () => { if (prose.length) blocks.push(`<p>${inline(prose.join('\n'))}</p>`); prose = []; };
    const flushList = () => { if (list.length) blocks.push(bullets(list)); list = []; };
    for (const line of lines) {
      const bullet = line.match(/^\s*[-*•]\s+(.+)$/);
      if (bullet) { flushProse(); list.push(bullet[1]); }
      else { flushList(); prose.push(line); }
    }
    flushList(); flushProse();
    return blocks.join('');
  }).join('');
}
