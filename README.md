# Hermes Agent Archive

A private archive of the Hermes Agent craft people actually use — **user stories, skills,
prompts, settings, commands, hidden tricks** and **community builds** — filterable by
where it showed up (X, Reddit, Discord, Hacker News, GitHub, YouTube, blogs, podcasts).

Static site. No build step, no framework, no dependencies. Content is plain JSON.

```
index.html              the page
assets/css/style.css    the newsroom-console theme
assets/js/app.js        loading, filtering, ranking, detail drawer
data/index.json         sections, sources, sort options
data/*.json             one file per section — this is the content
data/live.json          generated: real numbers from public APIs
scripts/fetch-signals.mjs   pulls GitHub / HN / Reddit metrics
scripts/check-data.mjs      validates every data file
```

## Run it locally

```bash
npm start          # http://localhost:4179
```

The page reads its JSON over `fetch()`, so it needs a server — opening `index.html`
straight off disk will show a load error with this reminder.

## Refresh the live numbers

```bash
npm run fetch                          # 60 GitHub requests/hour
GITHUB_TOKEN=ghp_xxx npm run fetch     # 5000/hour
```

This writes `data/live.json` with real stars, forks and Hacker News points. Re-run it
whenever you want the rankings to move — `.github/workflows/refresh.yml` already does it
weekly and commits the result.

**GitHub and Hacker News work with no credentials.** Reddit does not: its anonymous
`.json` endpoints now redirect to a login page from most networks, so the script needs
application-only OAuth.

1. Create a free **script** app at <https://www.reddit.com/prefs/apps>
2. Export the two values it gives you and re-run:

```bash
REDDIT_CLIENT_ID=xxx REDDIT_CLIENT_SECRET=yyy npm run fetch
```

Until then the Reddit section stays empty and the page says so in the footer — it will
never show an invented number in its place.

## How "People Build" fills itself

Two passes, both against the public GitHub API:

1. **Seeded** — the repos named in `data/builds.json`, resolved by full name so a renamed
   or transferred project follows its new slug instead of 404ing.
2. **Discovered** — a search for `claude-code in:name,description,topics` with
   `fork:false archived:false is:public pushed:>=<today-30d>`, `sort=stars`, 60 candidates.
   That's what surfaces projects nobody has curated yet.

Discovered results are deduped against the seeds, and dropped if they're private, a fork,
archived, disabled, or don't actually name Claude in the slug/description or carry the
`claude-code` topic — GitHub's matcher is looser than the query implies.

## Keys

```bash
npm run key
```

Three ways in, use whichever works in your terminal:

```bash
npm run key              # bordered paste box (needs raw-mode support)
npm run key -- --plain   # plain line prompt, if the box does not render
cp .env.example .env && chmod 600 .env && ${EDITOR:-nano} .env   # just edit the file
```

A terminal prompt for the four optional keys. Input is hidden as you paste, values are
written to `.env` with owner-only permissions, and `.env` is gitignored. Every script
loads it automatically; anything exported in your shell still wins over the file.

| Key | What it unlocks | Without it |
| --- | --- | --- |
| `TYPESAFE_API_KEY` | Jev routing and archive classification | keyword rules route; ranking is unavailable |
| `GITHUB_TOKEN` | 5000 API requests/hour instead of 60 | fine for one run, rate-limits on repeats |
| `REDDIT_CLIENT_ID` / `_SECRET` | the Reddit section | stays empty — Reddit refuses anonymous reads |

## Where the user stories come from

```bash
node scripts/import-hermes-stories.mjs
```

All 326 community stories published at
<https://hermes-agent.nousresearch.com/docs/user-stories>, parsed from the page and
written to `data/use-cases.json`. Each keeps its headline, quote, author, date and link
to the original post exactly as Nous published them — nothing is paraphrased. The
importer fails loudly if the page markup changes rather than importing half a shelf.

## The Jev builder directory

```bash
node scripts/import-jev-hermes.mjs
```

Pulls the Hermes-related entries out of <https://www.jev-use-cases.com> — it renders 18
tiles but ships all ~700 records in its flight payload, so one fetch gets the set. Only
entries that mention Hermes are kept; at the last run that was 3 of 699.

Imported directory figures remain in the source records but are not displayed or used
as popularity evidence. Only the public API snapshot supplies engagement metrics.

## Only popular things get sourced

This is a "most viewed, most talked about" shelf, so nothing reaches it on topic alone —
it has to have been noticed. Floors are enforced twice: at fetch time, so unpopular
things are never collected, and again at routing, so anything fetched under looser
settings is caught.

| Source | Floor | Override |
| --- | --- | --- |
| GitHub | 1,000 stars | `MIN_STARS=50000` |
| Hacker News | 300 points | `MIN_HN_POINTS=500` |
| Reddit | 200 upvotes | `MIN_REDDIT_UPVOTES=400` |

Each shelf also caps at 10 sourced items, keeping the most popular — one fetch should
never bury what you wrote by hand. Override with `MAX_PER_SECTION`.

```bash
MIN_STARS=50000 npm run sync     # a harsher bar for one run
```

## Sourcing feeds every section, not just builds

`npm run sync` is the whole pipeline:

```bash
npm run fetch    # pull real GitHub / HN / Reddit numbers  -> data/live.json
npm run route    # decide which shelf each signal belongs on
```

Routing has two implementations with the same output. With `TYPESAFE_API_KEY` set it
asks Jev a Choice across the seven sections plus a `none` escape, and a Noul on whether
a reader would actually learn something — so ecosystem news and promo posts get dropped
instead of shelved. Without a key it falls back to deterministic keyword rules, which
work but cannot tell a use case from a news item.

Routed items appear in their section marked `SOURCED`, keeping the title, link, author
and metric they were fetched with. Anything already curated by hand wins: a fetched
duplicate of a curated URL is dropped.

## Ranking candidate features with Jev

`scripts/rank-with-jev.mjs` scores candidate capabilities against what this site
actually is and what it's bad at, using TypeSafe's Jev. Three Score questions (fit,
visitor value, effort) plus one Noul (is this better as content than as a feature),
asked together over the same state. Code owns the weighting, so you can re-order
without re-running inference:

```bash
export TYPESAFE_API_KEY=...
node scripts/rank-with-jev.mjs
node scripts/rank-with-jev.mjs --weights 0.5,0.4,0.1   # re-weight fit,value,effort
```

Candidates live in `data/research/jev-use-cases.json` (top posts from the public Jev
builder directory); results are written to `data/research/jev-ranking.json`. The key
stays in your shell and is never written to the repo.

## The honesty rule

**No number on this site is invented.**

- GitHub stars/forks, HN points and Reddit upvotes come from public APIs, fetched.
- A seeded repo that doesn't resolve is *hidden*, not shown with a guess.
- Anything without a public metric renders as `NO PUBLIC NUMBER` with a `CURATED` tag.
- X and Facebook have no free public API, so entries from there are added by hand
  **with a real permalink** — never with an estimated view count.

If you keep that rule, the site stays worth reading. If you don't, it becomes another
engagement-bait list.

## Add an item

Append to the right file in `data/`:

```json
{
  "id": "unique-slug",
  "title": "What it is",
  "summary": "One line that earns the click.",
  "detail": "The full explanation. Blank lines become paragraphs.",
  "snippet": "optional copy-paste block",
  "tags": ["tag-one", "tag-two"],
  "source": "x | reddit | hn | fb | github | docs",
  "url": "https://permalink",
  "author": "@handle",
  "date": "2026-09-22"
}
```

Then:

```bash
npm run check
```

It fails on duplicate ids, unknown sources, malformed dates and non-http URLs.

## Deployment

Production is https://hermes-agent-archive.vercel.app. The repository stays private.
Vercel serves plain static files with no build or install step. `.vercelignore`
allows only the HTML, assets, and runtime JSON; update it when adding a data file.
Secrets, maintenance scripts, and research inputs are excluded from the upload.

After merging a reviewed PR into `main`, deploy from a clean checkout:

```bash
npm test
npm run check
npx vercel@60.0.0 link --project hermes-agent-archive --scope bkashjee-2377s-projects
npx vercel@60.0.0 deploy --dry --json
npx vercel@60.0.0 deploy --prod --skip-domain --scope bkashjee-2377s-projects
# Verify the returned deployment URL, then promote that exact release:
npx vercel@60.0.0 promote <deployment-url> --scope bkashjee-2377s-projects
```

Check the dry-run manifest includes every asset and configured data file, and excludes
secrets, scripts, and research files. Vercel's include patterns use `!assets` and
`!data` without trailing slashes so it traverses those directories.

Deployment is manual; a repository push does not publish automatically.
The weekly refresh job updates Jev classifications when its key is configured.

## Repository visibility

This repo is private for now, and it's a content source as much as a site — the sections
are the shelves you pull posts from.

GitHub Pages does not serve private repos on a free plan, so
`.github/workflows/pages.yml` is set to `workflow_dispatch` only. Read it locally with
`npm start`.

When you want it public: flip the repo to public, uncomment the `push` trigger in that
workflow, and it deploys to Pages from the `main` branch root. `.nojekyll` is already
there so underscore-prefixed paths are served as-is.

`.github/workflows/refresh.yml` keeps working either way — a private repo can still
fetch and commit updated numbers on its weekly schedule.

## Rank the archive with Jev

Run `npm run rank` with `TYPESAFE_API_KEY` configured. It classifies the actual
curated and sourced entries and writes `data/rankings.json` atomically only after
every required classification succeeds. Existing results survive an API or auth
failure; unchanged inputs reuse their classifications. Use `npm run rank -- --force`
only when intentionally reassessing the whole archive. Run this after importing
content or refreshing public metrics. The browser marks changed or new entries as
unclassified until the job succeeds, instead of reusing stale assessments.

The default order is Jev usefulness band, observed popularity tier, fine usefulness
score, then title/id for stable ties. The popularity option reverses the first two
criteria. Dates are attribution only, never ranking inputs or tie-breakers. Unknown
popularity is distinct from limited traction and sorts after known popularity.

Popularity evidence comes only from `data/live.json` public API fetches, never
hand-written metrics or engagement claims in quotes. Jev assesses usefulness from
the write-up. The UI exposes assessment labels, not model scores disguised as
public metrics. The old feature-idea experiment remains `npm run rank:ideas`.

Run `npm test` for ranking policy and cache regression checks.
