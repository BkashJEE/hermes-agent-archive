// A public star count is necessary, but does not prove Hermes compatibility.
// Add a repository only after reviewing its own documented Hermes integration.
export const MIN_GITHUB_STARS = 50000;
export const HERMES_REPOSITORIES = {
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
  qualifiesStars(stars, floor) && !!hermesSupport(repo, reviews);
