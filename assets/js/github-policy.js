// A public star count is necessary, but does not prove Hermes compatibility.
// Add a repository only after reviewing its own documented Hermes integration.
export const MIN_GITHUB_STARS = 50000;
// Owner-approved exceptions are exact repositories, never an author-wide exemption.
export const COMMUNITY_EXCEPTIONS = Object.freeze({
  'cliffwade/hermes-desktop-theme-pack': 'https://github.com/BkashJEE/hermes-agent-archive/issues/39',
  'cliffwade/hermes-command-center': 'https://github.com/BkashJEE/hermes-agent-archive/issues/40',
  'cliffwade/hermes-desktop-achievements': 'https://github.com/BkashJEE/hermes-agent-archive/issues/41'
});
export const communityException = repo => Object.hasOwn(COMMUNITY_EXCEPTIONS, repo?.toLowerCase())
  ? COMMUNITY_EXCEPTIONS[repo.toLowerCase()] : null;
export const HERMES_REPOSITORIES = {
  "cliffwade/hermes-desktop-theme-pack": {
    "url": "https://github.com/CliffWade/hermes-desktop-theme-pack#theme-switcher-desktop-app--web-dashboard",
    "note": "Documents Hermes YAML skins plus backend and Desktop Theme Switcher plugins. The full switcher requires both components; remote connections split them across backend and Desktop hosts.",
    "reviewedAt": "2026-09-28"
  },
  "cliffwade/hermes-command-center": {
    "url": "https://github.com/CliffWade/hermes-command-center#install",
    "note": "Documents a Hermes backend API and Desktop SDK page at /hermes-center. Both plugins and a backend restart are required.",
    "reviewedAt": "2026-09-28"
  },
  "cliffwade/hermes-desktop-achievements": {
    "url": "https://github.com/CliffWade/hermes-desktop-achievements#how-it-works",
    "note": "Documents use of the Hermes Desktop SDK and existing hermes-achievements backend. Requires the backend to be enabled; the author recommends Desktop v0.19 or newer.",
    "reviewedAt": "2026-09-28"
  },
  "nousresearch/hermes-agent": {
    "url": "https://github.com/NousResearch/hermes-agent/blob/main/README.md",
    "note": "Official Hermes Agent repository: skills, tools, plugins and example workflows.",
    "reviewedAt": "2026-09-25"
  },
  "farion1231/cc-switch": {
    "url": "https://github.com/farion1231/cc-switch/blob/main/README.md",
    "note": "Documents Hermes provider management and shared MCP and skills configuration.",
    "reviewedAt": "2026-09-25"
  },
  "colbymchenry/codegraph": {
    "url": "https://github.com/colbymchenry/codegraph/blob/main/README.md#quick-start",
    "note": "The installer detects Hermes and configures its CodeGraph MCP server.",
    "reviewedAt": "2026-09-25"
  },
  "obra/superpowers": {
    "url": "https://github.com/obra/superpowers/blob/main/README.md#hermes-agent",
    "note": "Documents native Hermes plugin installation and development skills.",
    "reviewedAt": "2026-09-25"
  },
  "dietrichgebert/ponytail": {
    "url": "https://github.com/DietrichGebert/ponytail/blob/main/README.md#hermes-agent",
    "note": "Documents a Hermes plugin with review, audit and technical-debt commands.",
    "reviewedAt": "2026-09-25"
  },
  "juliusbrussee/caveman": {
    "url": "https://github.com/JuliusBrussee/caveman/blob/main/README.md",
    "note": "Documents the caveman hermes launcher and custom-provider integration.",
    "reviewedAt": "2026-09-25"
  },
  "nexu-io/open-design": {
    "url": "https://github.com/nexu-io/open-design/blob/main/README.md",
    "note": "Documents od mcp install hermes for its design engine.",
    "reviewedAt": "2026-09-25"
  },
  "unslothai/unsloth": {
    "url": "https://github.com/unslothai/unsloth/blob/main/README.md",
    "note": "Documents unsloth start hermes for launching Hermes with local models.",
    "reviewedAt": "2026-09-25"
  },
  "pbakaus/impeccable": {
    "url": "https://github.com/pbakaus/impeccable/blob/main/README.md",
    "note": "Documents Hermes skill installation, trust requirements and command routing.",
    "reviewedAt": "2026-09-25"
  },
  "hkuds/cli-anything": {
    "url": "https://github.com/HKUDS/CLI-Anything/blob/main/README.md",
    "note": "Documents an experimental community Hermes skill for building CLI harnesses.",
    "reviewedAt": "2026-09-25"
  }
};

export function githubStarFloor(value = MIN_GITHUB_STARS) {
  if (value === null || !['string','number'].includes(typeof value)) throw new Error('MIN_STARS must be a non-negative integer');
  if (typeof value === 'string' && !value.trim()) return MIN_GITHUB_STARS;
  const floor = Number(value);
  if (!Number.isSafeInteger(floor) || floor < 0) throw new Error('MIN_STARS must be a non-negative integer');
  return floor;
}
export const qualifiesStars = (stars, floor = MIN_GITHUB_STARS) =>
  Number.isFinite(stars) && stars > githubStarFloor(floor);
export const hermesSupport = (repo, reviews = HERMES_REPOSITORIES) => reviews[repo?.toLowerCase()] || null;
export const qualifiesRepository = (repo, stars, reviews = HERMES_REPOSITORIES, floor = MIN_GITHUB_STARS) =>
  (qualifiesStars(stars, floor) || (!!communityException(repo) && Number.isSafeInteger(stars) && stars >= 0)) && !!hermesSupport(repo, reviews);
