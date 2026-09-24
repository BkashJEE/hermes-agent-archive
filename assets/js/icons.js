/* Section family: 24px grid, 1.75px strokes, rounded ends and angular details.
   Distinct silhouettes stay readable at menu size. Names live in data/index.json;
   navigation, cards, hero and empty states all use this single set. */
const paths = {
  dashboard: '<rect x="3" y="3" width="7" height="10" rx="1.5"/><rect x="14" y="3" width="7" height="6" rx="1.5"/><rect x="3" y="17" width="7" height="4" rx="1.5"/><rect x="14" y="13" width="7" height="8" rx="1.5"/>',
  stories: '<path d="M12 6 3 3v15l9 3 9-3V3l-9 3v15 M6 8l3 1 M6 12l3 1 M15 9l3-1 M15 13l3-1"/>',
  skills: '<path d="m12 2 8 4.5v11L12 22l-8-4.5v-11Z M13 6l-5 7h4l-1 5 5-7h-4Z"/>',
  prompts: '<path d="M6 18H3V4h18v14H11l-5 4Z M7 8l3 3-3 3 M13 14h4"/>',
  settings: '<path d="M3 6h4 M11 6h10 M3 12h10 M17 12h4 M3 18h4 M11 18h10"/><rect x="7" y="3" width="4" height="6" rx="1"/><rect x="13" y="9" width="4" height="6" rx="1"/><rect x="7" y="15" width="4" height="6" rx="1"/>',
  commands: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3 M13 15h4"/>',
  tricks: '<path d="m3 18 11-11 3 3L6 21Z M11 10l3 3 M18 2v4 M16 4h4 M20 14v4 M18 16h4 M6 3v4 M4 5h4"/>',
  toolkit: '<path d="M8 3v5 M16 3v5 M5 8h14v3a7 7 0 0 1-14 0Z M12 18v3"/>',
  builds: '<path d="m12 2 5 3-5 3-5-3Z M7 5v6l5 3 5-3V5 M12 8v6 M7 11l-5 3 5 3 5-3 5 3 5-3-5-3 M2 14v5l5 3 5-3 5 3 5-3v-5 M7 17v5 M12 14v5 M17 17v5"/>'
};

export function sectionIcon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.stories}</svg>`;
}
