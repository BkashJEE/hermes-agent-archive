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

- Metrics come from public APIs via `scripts/fetch-signals.mjs`, or they don't exist.
- A repo that fails to resolve is **hidden**, never shown with a guessed figure.
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
data/index.json         sections, sources, ranges, sorts
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

Popularity floors (25,000 stars · 300 HN points · 200 upvotes) apply at both stages, and
each section caps at 10 sourced items. Sourced cards are marked `SOURCED`; a fetched
duplicate of a curated URL is dropped, because hand-written entries win.

**Known weakness:** the keyword fallback cannot tell a use case from ecosystem news, so
fetched stories can land on the wrong shelf. The Jev router's `none` option
and `worth_keeping` check fix this. Do not try to fix it with more regexes.

## Typography

Anthropic brand standard, not the portfolio's pairing:

- `--sans` **Poppins** (Arial fallback) — headings, labels, pills, buttons, nav
- `--body` **Lora** (Georgia fallback) — card summaries and drawer prose
- `--mono` **JetBrains Mono** — code snippets and figures only, where alignment matters

Colours still come from the portfolio (amber on near-black); only the fonts follow the
brand standard. Do not swap either back to Inter.

## Secrets

`.env` is gitignored and written at mode 600 by `npm run key`. Never read it, echo it,
print it to logs, or commit it. Never add a key to a data file, a workflow, or a script
default. Scripts read from `process.env`; a shell export wins over the file.

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

## Browser gotchas

The local server caches aggressively — a hash change does not reload the page, so verify
CSS and JS edits with a real reload (`?v=<timestamp>`), not a hash navigation.

`.empty`, `.active-filters` and `.drawer` set `display` on a class, which outranks the
browser's `[hidden]` rule. The global `[hidden]{display:none!important}` in the
stylesheet is load-bearing — do not remove it.
