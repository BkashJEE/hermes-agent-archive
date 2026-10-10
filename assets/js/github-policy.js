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
  "outsourc-e/hermes-workspace": {
    "url": "https://github.com/outsourc-e/hermes-workspace/blob/main/README.md",
    "note": "A browser workspace over an existing Hermes agent: chat, terminal, memory, skills and a request inspector. Attach to an agent you already run, or let its install script fetch hermes-agent through Nous's own installer, clone the repo, write .env and install dependencies; then run `hermes gateway run` alongside it. The README states v2 runs on vanilla NousResearch/hermes-agent without forking it.",
    "reviewedAt": "2026-10-04"
  },
  "nesquena/hermes-webui": {
    "url": "https://github.com/nesquena/hermes-webui/blob/main/README.md",
    "note": "Reaches an existing Hermes install from a browser or phone, using your current models and documenting an SSH tunnel as the access path. Native Windows setup is separate: Python 3.11+ and a virtualenv from the hermes-agent root. Near-parity with the CLI is the author's claim, not a measurement.",
    "reviewedAt": "2026-10-04"
  },
  "dodo-reach/hermes-desktop": {
    "url": "https://github.com/dodo-reach/hermes-desktop/blob/main/README.md",
    "note": "A Mac app managing Hermes locally or on another machine over plain SSH, with no gateway and no exposed port. Sessions Chat, terminal resume and workflow launch require the hermes CLI on whichever machine runs it. Shipped as a zipped app; first launch needs right-click then Open, which the README notes does not disable Gatekeeper and does not need sudo.",
    "reviewedAt": "2026-10-04"
  },
  "eynzof/hermes-cn-desktop": {
    "url": "https://github.com/Eynzof/Hermes-CN-Desktop/blob/main/README.md",
    "note": "A Windows-first Hermes desktop app in Tauri, Rust and TypeScript with a Chinese interface. Ships a named Windows x64 installer; local dashboard development expects either Hermes-CN-Core or a Hermes CLI already on the machine.",
    "reviewedAt": "2026-10-04"
  },
  "rlaope/oh-my-hermes": {
    "url": "https://github.com/rlaope/oh-my-hermes/blob/main/README.md",
    "note": "Bundles a coding layer, long-term memory and an operating layer onto Hermes without replacing it. One install script, curl-to-sh on Unix or PowerShell on Windows. The project publishes INSTALL_FOR_AGENTS.md pinned to a resolved commit SHA so an agent installs a fixed revision rather than a moving branch.",
    "reviewedAt": "2026-10-04"
  },
  "mnemosyne-oss/mnemosyne": {
    "url": "https://github.com/mnemosyne-oss/mnemosyne/blob/main/README.md",
    "note": "A SQLite-backed memory layer describing itself as Hermes-first, reaching Hermes through both MCP and a plugin. Its own compatibility table marks the Hermes integration native and shipping enabled while other harnesses need setup, and its data directory defaults to ~/.hermes/mnemosyne/data. One pure-Python dependency; memory stays on the machine.",
    "reviewedAt": "2026-10-04"
  },
  "tt-a1i/archify": {
    "url": "https://github.com/tt-a1i/archify/blob/main/integrations/hermes-agent/README.md",
    "note": "Documents an opt-in Hermes skill installation for interactive architecture diagrams. Requires Node.js 18 or newer and a session restart. This community integration uses the Node renderer; it adds no native Python render tools and is not an agent-switcher target. Docker needs the installed files available inside the mounted volume. Generated diagrams are not live-infrastructure verification.",
    "reviewedAt": "2026-09-28"
  },
  "rtk-ai/rtk": {
    "url": "https://github.com/rtk-ai/rtk/blob/main/README.md",
    "note": "Compact terminal output through a native Hermes command-rewriting plugin. Install RTK using its documented platform instructions, then initialize the Hermes adapter and restart the session. Only supported terminal commands are rewritten. Keep access to original output for debugging; savings depend on the actual workload.",
    "reviewedAt": "2026-09-28"
  },
  "egonex-ai/understand-anything": {
    "url": "https://github.com/Egonex-AI/Understand-Anything/blob/main/README.md",
    "note": "Explore a codebase through a generated knowledge graph. Review the project installer, select the documented hermes platform, then ask the understand skill to analyze your repository. Indexing is an analysis aid, not proof that generated relationships are correct. Review installation effects and sensitive code access.",
    "reviewedAt": "2026-09-28"
  },
  "browser-use/browser-use": {
    "url": "https://github.com/browser-use/browser-use/blob/main/README.md",
    "note": "Give a Hermes session browser tools through the Browser Use CLI skill. Follow the README CLI path using Python and uv, register the skill and connect the intended browser. The local CLI and hosted cloud are different setups. Review browser access and service costs before choosing a cloud option.",
    "reviewedAt": "2026-09-28"
  },
  "affaan-m/ecc": {
    "url": "https://github.com/affaan-m/ECC/blob/main/README.md",
    "note": "Bring the ECC workflow instructions and skills into a Hermes project. Use the documented selective installer with the minimal Hermes target after reviewing the setup guide. The Hermes adapter is experimental/minimal. Upstream explicitly does not claim full Claude feature parity; memory runtime features require separate setup.",
    "reviewedAt": "2026-09-28"
  },
  "msitarzewski/agency-agents": {
    "url": "https://github.com/msitarzewski/agency-agents/blob/main/README.md",
    "note": "Load relevant specialist instructions on demand through a Hermes plugin. Generate the Hermes integration, install the router and restart Hermes. Search and inspect a specialist before loading or delegating. The integration uses a lazy router instead of preloading all specialists. Review the selected specialist instructions and delegation permissions.",
    "reviewedAt": "2026-09-28"
  },
  "graphify-labs/graphify": {
    "url": "https://github.com/Graphify-Labs/graphify/blob/main/README.md",
    "note": "Build a queryable graph from code and supporting project documents. Install Graphify using its upstream instructions, then install its Hermes integration and index the intended project. The Hermes adapter writes instruction and skill files. Inspect those changes and validate graph findings against the source.",
    "reviewedAt": "2026-09-28"
  },
  "alishahryar1/free-claude-code": {
    "url": "https://github.com/Alishahryar1/free-claude-code/blob/main/README.md",
    "note": "Launch Hermes against models configured in the FCC gateway. Complete FCC setup and configure a provider, then use the documented Hermes launcher. Provider availability, quotas and terms can change. A project name containing free is not a guarantee of free inference; inspect your selected provider.",
    "reviewedAt": "2026-09-28"
  },
  "garrytan/gstack": {
    "url": "https://github.com/garrytan/gstack/blob/main/README.md",
    "note": "Use the explicitly documented Hermes methodology and instruction tier. Follow the other-agent setup instructions for the Hermes host, or review the instruction digest for a project-local setup. Hermes receives methodology artifacts and an instruction digest, not the same full runtime integration advertised for other hosts. Browser pairing is a separate workflow.",
    "reviewedAt": "2026-09-28"
  },
  "multica-ai/multica": {
    "url": "https://github.com/multica-ai/multica/blob/main/README.md",
    "note": "Assign work to an installed Hermes CLI through a shared agent workspace. Set up a Multica runtime on a host where Hermes is already installed and authenticated, then select Hermes for an agent. Multica does not supply the agent CLI. It is source-available; inspect its license, permissions and runtime isolation before adopting it.",
    "reviewedAt": "2026-09-28"
  },
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
