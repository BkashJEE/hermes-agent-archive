# AGENTS.md

Conventions for any agent working in this repo (Codex, Claude Code, or a human).

## What this is

A private static site cataloguing **Hermes Agent** craft — user stories, skills, prompts,
settings, commands, hidden tricks and community builds — for the owner's followers, and
as a content bank the owner mines for posts.

**Scope rule: only Hermes Agent related things are stored here.** Content about other
agents or harnesses does not belong, however good it is. The archive was pivoted from
Claude Code on 2026-09-23 and those entries were removed, not migrated.

Plain HTML, CSS and vanilla ES modules. **No framework, no build step, no dependencies,
no server.** Content is JSON files in `data/`. Keep it that way: if a change needs npm
packages or a bundler, it is the wrong change.

## Run it

```bash
npm start      # http://localhost:4179 — needs a server, fetch() can't read file://
npm run check  # validates every data file; run before committing data changes
npm run sync   # fetch public metrics, then shelve them
npm run key    # paste API keys into a gitignored .env
```

## The rule that matters most

**No number on this site may be invented.** Not a star count, not a view count, not an
estimate, not a placeholder that looks real.

- Metrics come from public APIs via `scripts/fetch-signals.mjs`, or carry a `credit` field naming their source. Credited analytics must be labelled on cards and excluded from public-popularity evidence.
- A repo that fails to resolve retains its stored write-up, but is hidden unless more than 50,000 stars can be verified.
- An item with no public metric renders its tags and `no public metric`.
- A source that failed at fetch time is named in the page footer.
- X and Facebook have no free API. Entries from there are hand-curated **with a real
  permalink** and no engagement figure.

If you cannot source a number, leave the shelf thinner. That is the product.

## Layout

```
index.html              the page
assets/css/style.css    theme; colors are tokens on :root
assets/js/app.js        load, filter, rank, drawer
data/index.json         sections, sources, sorts
data/<section>.json     the curated content
data/live.json          GENERATED — never hand-edit
data/research/          inputs and outputs for ranking work
scripts/                fetch, route, rank, validate, key entry
```

## Adding content

Append to the right file in `data/`, then `npm run check` — it fails on duplicate ids,
unknown sources, malformed dates and non-http URLs.

```json
{
  "id": "unique-slug",
  "title": "What it is",
  "summary": "One line that earns the click.",
  "detail": "Full explanation. Blank lines become paragraphs.",
  "snippet": "optional copy-paste block",
  "tags": ["tag-one"],
  "source": "x | reddit | hn | fb | github | docs",
  "url": "https://permalink",
  "date": "2026-09-23"
}
```

## Sourcing pipeline

`fetch-signals.mjs` pulls GitHub stars/forks (seeded repos plus a discovery search),
Hacker News points, and Reddit upvotes. `route-signals.mjs` decides which section each
signal belongs on — via Jev when `TYPESAFE_API_KEY` is set, via keyword rules otherwise.

Discovery floors default to 50,000 GitHub stars, 300 HN points and 200 Reddit upvotes;
Jev judges relevance and quality.
Section limits are configurable in the sourcing scripts. Sourced cards are marked `SOURCED`; a fetched
duplicate of a curated URL is dropped, because hand-written entries win.

**Known weakness:** the keyword fallback cannot tell a use case from ecosystem news, so
fetched stories can land on the wrong shelf. The Jev router's `none` option
and `worth_keeping` check fix this. Do not try to fix it with more regexes.

## Typography and colour

Keep Inter and JetBrains Mono and the portfolio colour tokens. The optional
broadsheet layout changes structure, not the approved fonts or palette.

## Secrets

`.env` is gitignored and written at mode 600 by `npm run key`. Never read it, echo it,
print it to logs, or commit it. Never add a key to a data file, a workflow, or a script
default. Scripts read from `process.env`; a shell export wins over the file.

## Additive only — nothing is ever deleted

The archive accumulates. No pipeline stage may remove an entry that is already in it.

- `fetch-signals.mjs` merges into `data/live.json`; a source that fails keeps its last
  known value marked `stale` rather than dropping it.
- `import-hermes-stories.mjs` merges by id; an entry pulled from the source page keeps
  its place in the archive even if it later disappears upstream.
- A seeded repo that does not resolve stays in stored data. The rendered archive
  requires a verified count of more than 50,000 stars.

This rule exists because a single GitHub rate-limit once wiped a shelf and a 248k-star
repo out of `live.json`. Recovery was `git show <sha>:data/live.json`.

## Scripts must fail honestly

A script that cannot do its job exits non-zero and leaves existing data untouched.
Specifically: abort on the first auth failure rather than retrying identically 36 times,
and never overwrite good data with an empty result. Both rules exist because both bugs
happened here.

## Git

- Every change goes through a pull request. Do not commit to `main`.
- No AI attribution in commit messages or PR descriptions — no `Co-Authored-By` trailer,
  no "Generated with" line. This is the repo owner's standing preference.
- Commit subject in the imperative, body explaining *why*.

## Animation must never own a value

Every figure, bar width and chart line is written at its real value first; the
animation plays over the top. A hidden tab throttles `requestAnimationFrame` to
nothing, and an animation that carries the value leaves `0` on screen — a number
nobody measured, which is the one thing this site must not show.

Use the Web Animations API for widths and strokes (the resting style stays correct),
`document.hidden` and `prefers-reduced-motion` as early exits.

Never use `fill: 'backwards'` for this. It pins the element at the 0% frame until the
animation starts, so an animation that never advances — a headless render, a paused
compositor — leaves an empty bar where a real figure belongs. Bake any stagger into the
keyframes with offsets instead, and leave the fill mode alone.

## Browser gotchas

Before deployment, run `vercel deploy --dry --json` and verify every runtime asset
and configured JSON file is included. Directory exceptions in `.vercelignore`
must not end in `/`: that excluded all assets and data in a previous deployment.
Deploy with `--prod --skip-domain`, verify the staged URL, then promote it.

The local server caches aggressively — a hash change does not reload the page, so verify
CSS and JS edits with a real reload (`?v=<timestamp>`), not a hash navigation.

`.empty`, `.active-filters` and `.drawer` set `display` on a class, which outranks the
browser's `[hidden]` rule. The global `[hidden]{display:none!important}` in the
stylesheet is load-bearing — do not remove it.

## GitHub visibility cutoff

Require more than 50,000 fetched public stars for every GitHub repository on every
shelf, including URL-only entries. Unknown counts are excluded. Apply the same
threshold to discovery and routing. Keep stored content so a later qualifying count
can restore it. Non-GitHub stories without public metrics remain eligible.

Trending means positive GitHub star growth between two public measurements, 1 hour
to 14 days apart, with the latest no older than 14 days. Sort by measured growth
per day; never use publication dates, total stars alone, or Jev opinion as growth.
Missing history, stale fetches and non-positive growth do not qualify. The fetcher
records observation times and previous counts. Historical API snapshots can seed
this with `node scripts/backfill-trends.mjs <commit-sha>`; never invent baselines.

## Archive ranking

`npm run rank` classifies actual archive entries with Jev and writes
`data/rankings.json`. The old feature-idea experiment is `npm run rank:ideas`.
Rank by usefulness and observed public popularity, never by date. Missing public
engagement is unknown, not zero popularity. Model scores are internal editorial
judgments and must never be rendered as public engagement metrics. Keep cache keys
sensitive to content and fetched evidence; stale entries are unclassified.

## Deployment privacy

The owner authorized public website access on 2026-09-24. Keep the production
site public and preview deployments protected with Standard Protection
(`ssoProtection.deploymentType = prod_deployment_urls_and_all_previews`).
The GitHub repository remains private. Visitors may browse and copy but cannot
edit or publish. Do not grant collaborators editing access, change other projects,
or enable public submissions without the owner's approval.

The GitHub floor defaults to 50,000 in `assets/js/github-policy.js`. `MIN_STARS` may
raise or lower it; non-negative integers are accepted and invalid values fail
before writes. Fetches record `githubMinStars` so rendering and routing use the
same policy. Use `npm run fetch -- --github-only` to update GitHub independently
when other source credentials are unavailable. Failed fetches preserve the last
good snapshot and exit non-zero.
