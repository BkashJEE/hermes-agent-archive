/* Bring the phyllotaxis composition from make-hero.mjs into the live page.
   Each mark represents one loaded, eligible entry, never a separate metric. */
export function archiveField(items) {
  const groups = {docs:'docs', github:'github'};
  const entries = items.map(item => groups[item.source] || 'community');
  entries.sort();
  const golden = Math.PI * (3 - Math.sqrt(5));
  const scale = entries.length ? 142 / Math.sqrt(entries.length) : 0;
  return entries.map((family, i) => {
    const radius = scale * Math.sqrt(i + 0.5), angle = i * golden;
    const x = 220 + radius * Math.cos(angle), y = 164 + radius * Math.sin(angle);
    return `<circle class="field-${family}" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.15"/>`;
  }).join('');
}
