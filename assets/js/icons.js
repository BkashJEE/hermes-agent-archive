/* Section family: one 24px grid, 1.5px strokes, rounded ends.
   Each shelf gets a distinct metaphor — a repeated glyph tells a reader nothing.
   Names are referenced by data/index.json; nav, hero and empty states share this. */
const paths = {
  // panel grid — a view assembled from parts
  dashboard: '<path d="M4 4h6v7H4Z M14 4h6v4h-6Z M14 12h6v8h-6Z M4 15h6v5H4Z"/>',
  // speech bubble with lines — somebody telling you what they did
  stories:   '<path d="M4 5h16v11H10l-6 4Z M8 9h8 M8 12.5h5"/>',
  // chip with pins — a capability you install
  skills:    '<path d="M8.5 8.5h7v7h-7Z M12 4v4.5 M12 15.5V20 M4 12h4.5 M15.5 12H20"/>',
  // quotation marks — the wording itself
  prompts:   '<path d="M6 15c0-4.5 1.8-6.8 5-7.6 M6 13.5h3.6V19H6Z M14 15c0-4.5 1.8-6.8 5-7.6 M14 13.5h3.6V19H14Z"/>',
  // sliders — values you set
  settings:  '<path d="M3 7h6 M13 7h8 M3 13h11 M18 13h3 M3 19h5 M12 19h9"/><circle cx="11" cy="7" r="2"/><circle cx="16" cy="13" r="2"/><circle cx="10" cy="19" r="2"/>',
  // terminal window with a caret — something you run
  commands:  '<path d="M3.5 5h17v14h-17Z M7.5 10.5l2.5 2-2.5 2 M13 14.5h4"/>',
  // sparkle — the move you would not have found
  tricks:    '<path d="m12 3 2.4 6.1L21 11.5l-6.6 2.4L12 20l-2.4-6.1L3 11.5l6.6-2.4Z M18.5 3.5v2.6 M17.2 4.8h2.6"/>',
  // chain link — a thing that pairs with Hermes
  toolkit:   '<path d="M10.5 13.5a4.5 4.5 0 0 0 6.4 0l2.4-2.4a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2 M13.5 10.5a4.5 4.5 0 0 0-6.4 0l-2.4 2.4a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
  // cube — something built and shipped
  builds:    '<path d="m4 8 8-4.5 8 4.5v8l-8 4.5L4 16Z M4 8l8 4.5 8-4.5 M12 12.5V21"/>'
};

export function sectionIcon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.stories}</svg>`;
}
