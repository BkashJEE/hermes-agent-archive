![Hermes Agent Archive — one dot for every entry](assets/hero.png)

# Hermes Agent Archive

**Sourced entries, counted from the loaded archive. Public metrics or explicitly credited figures — never guessed.**

A community archive of the Hermes Agent craft people actually use — **user stories, skills,
prompts, settings, commands, hidden tricks** and **community builds** — filterable by
where it showed up (X, Reddit, Discord, Hacker News, GitHub, YouTube, blogs, podcasts).

What people actually build with Hermes Agent — quoted, credited, and linked to the post
it came from. Zero dependencies, no build step, content in plain JSON.

## What it looks like

### The archive
Filter by source, tag, author or time. `Cmd/Ctrl+K` searches every entry.

![Use cases shelf](docs/images/use-cases.png)

### The dashboard
Counted live from what is loaded. Each metric kind stays on its own row — stars, points,
impressions and upvotes measure different things and are never summed into one figure.

![Dashboard](docs/images/dashboard.png)

### My Work
The author's own posts, with impression counts credited to their X analytics exports.
Every figure on the site states where it came from.

![My Work shelf](docs/images/my-work.png)

## Run it locally

Anyone can run their own copy. Install Git and Python 3; Node.js 20+ is only needed
for the npm shortcuts, validation and optional data-refresh scripts.

```bash
git clone https://github.com/BkashJEE/hermes-agent-archive.git
cd hermes-agent-archive
python3 -m http.server 4179 --bind 127.0.0.1
```

Open http://localhost:4179. On Windows, use `py -3` instead of `python3`.
If Node.js is installed, `npm start` runs the same local server.
No `npm install`, API keys, Vercel account or build step is needed to browse the
included archive. A local copy has its own browser preferences; edits there cannot
change the public site.

## Contribute

[Suggest an entry](https://github.com/BkashJEE/hermes-agent-archive/issues/new?template=submit-entry.yml)
or fork the repository and open a pull request. Include the original source,
author or repository owner, and a concrete Hermes use case. Repository cards need
more than 50,000 fetched stars and documented Hermes support.

[Contribution guide](CONTRIBUTING.md) · [Live dashboard](https://hermes-agent-archive.vercel.app)

Submissions are proposals. The owner reviews changes before publishing to the
shared dashboard. Contributors do not receive access to the Vercel account.

Original site code is available under the [MIT license](LICENSE). Third-party
quotes, imported documentation and project branding retain their source rights;
they are not relicensed by the site's code license.

The page reads its JSON over `fetch()`, so it needs a server — opening `index.html`
straight off disk will show a load error with this reminder.

## Refresh the live numbers

```bash
npm run fetch                          # 60 GitHub requests/hour
GITHUB_TOKEN=ghp_xxx npm run fetch     # 5000/hour
```

This writes `data/live.json` with real stars, forks and Hacker News points. Re-run it
whenever you want the rankings to move. The owner’s daily updater researches new
entries and proposes changes for review; `.github/workflows/refresh.yml` is a
manual fallback that also opens a pull request. Forks do not inherit the owner’s
updater or API credentials.

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

## How repository discovery works

The fetcher checks reviewed repositories in `assets/js/github-policy.js` using
the public GitHub API. It also searches for `"hermes-agent"` in repository names,
descriptions and READMEs with more than 50,000 stars, excluding forks and archives.
There is no publication-date filter. Unreviewed matches are logged for upstream
Hermes documentation review; a search match does not automatically add a card.

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
| GitHub | More than 50,000 stars + documented Hermes support | `MIN_STARS=100000` |
| Hacker News | 300 points | `MIN_HN_POINTS=500` |
| Reddit | 200 upvotes | `MIN_REDDIT_UPVOTES=400` |

Each shelf also caps at 10 sourced items, keeping the most popular — one fetch should
never bury what you wrote by hand. Override with `MAX_PER_SECTION`.

```bash
MIN_STARS=100000 npm run sync     # a harsher bar for one run
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

## Images

```bash
node scripts/make-og.mjs      # regenerate assets/social-preview.png from real counts
node scripts/make-hero.mjs    # regenerate assets/hero.png — one dot per entry
```

The social card states how many entries and credited people the archive holds, so it is
generated from the data rather than maintained by hand — a card showing a number the site
no longer has is the same failure as inventing one. Needs `chromium` on PATH, because
Inter and JetBrains Mono are loaded from Google Fonts and would otherwise be substituted.

Screenshots in `docs/images/` are captured the same way, against a local server.

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

Production is https://hermes-agent-archive.vercel.app. The repository is public; publishing remains owner-controlled.
Vercel serves plain static files with no build or install step. `.vercelignore`
allows only the HTML, assets, and runtime JSON; update it when adding a data file.
Secrets, maintenance scripts, and research inputs are excluded from the upload.

For a review build, run `npx vercel@60.0.0 deploy` without `--prod`; Standard
Protection keeps the preview private. Do not use a production-target deployment
for unapproved review: `--skip-domain` can still update a generated project alias.

After owner approval and merging the reviewed PR into `main`, deploy from a clean checkout:

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

Deployment is manual; a repository push does not publish automatically. The
daily updater prepares a PR and never merges or promotes it. The manual refresh
workflow also proposes changes; enable it in Actions if that fallback is needed.
The former weekly refresh and GitHub Pages workflows are disabled.

## Repository visibility and contribution access

The owner authorized public repository access on 2026-09-25. Anyone can clone or
fork it, file issues and propose pull requests. Only the owner currently has write
access. Main requires review and the `validate` check, with administrator control
retained by the owner. Code-owner review routes proposed changes to BkashJEE once
this contribution setup is merged. Vercel account access is separate and is not
granted to contributors. This project publishes only to Vercel.

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

### Repository eligibility and Trending

Repository entries need more than 50,000 stars in a fetched public API snapshot.
Missing counts do not qualify. The same rule applies to curated and discovered
repositories; stored content is retained. Discussions and community stories mirrored
on GitHub are not repository entries and do not inherit the hosting repo's stars.

Choose **Trending · star growth** under Rank by to filter to repositories with
positive measured growth. Two snapshots must be 1 hour–14 days apart, with the
latest within 14 days. Results are ordered by stars gained per day, and each card
shows the actual gain and measurement interval. Missing history, stale fetches and
non-positive growth are excluded. The ordinary Jev sorting remains date independent.

The fetcher records observation timestamps and prior star counts on each refresh.
To bootstrap history from a committed API snapshot (without changing counts), run
`node scripts/backfill-trends.mjs <snapshot-commit-sha>`.

### Public site, protected previews

The canonical production URL is public. Vercel Standard Protection remains
`prod_deployment_urls_and_all_previews`: previews and deployment-specific URLs
require authorized access. Keep fork protection enabled and do not create public
bypass links or grant contributors team access.

Repository eligibility also requires reviewed upstream Hermes documentation in
`assets/js/github-policy.js`. Search results alone are not proof of support.
New repos need a second real public observation before they can appear as trending.
