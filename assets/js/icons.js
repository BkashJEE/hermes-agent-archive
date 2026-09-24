/* Section family: 24px grid, 1.5px strokes, rounded ends and a 19° shelf rake.
   Names are referenced by data/index.json; navigation, hero and empty states share it. */
const paths = {
  dashboard: '<path d="m4 7 16-5v16L4 23Z M8 16v-4 M12 15V8 M16 14v-5"/>',
  toolkit: '<path d="m4 10 16-5v13L4 23Z M8 8V5l8-2v3 M4 14l16-5 M10 12v4"/>',
  stories: '<path d="m4 7 16-5v13L4 20Z M8 9l8-2.5 M8 13l5-1.5"/>',
  skills: '<path d="m12 3 8 6-8 6-8-6Z M4 14l8 6 8-6"/>',
  prompts: '<path d="m4 7 16-5v13l-9 3-7 4Z M8 9l8-2.5 M8 13l5-1.5"/>',
  settings: '<path d="m3 8 18-6 M3 14l18-6 M3 20l18-6 M8 4v5 M16 8v5 M10 15v5"/>',
  commands: '<path d="m5 6 5 4-5 7 M13 17l7-2"/>',
  tricks: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z M18 3v3 M16.5 4.5h3"/>',
  builds: '<path d="m4 8 8-5 8 5v10l-8 3-8-5Z M4 8l8 5 8-5 M12 13v8"/>'
};

export function sectionIcon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.stories}</svg>`;
}
