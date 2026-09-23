# Use-Case Archive

A public archive of the Claude Code craft people actually use — the most viewed, talked
about and reused **use cases, skills, prompts, settings, commands, hidden tricks** and
**community builds** — filterable by where it showed up (X, Reddit, Hacker News, Facebook,
GitHub, official docs).

Static site. No build step, no framework, no dependencies. Content is plain JSON.

```
index.html              the page
assets/css/style.css    the newsroom-console theme
assets/js/app.js        loading, filtering, ranking, detail drawer
data/index.json         sections, sources, ranges, sort options
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

## Deploy

GitHub Pages, from the `main` branch root. `.nojekyll` is present so paths starting with
underscores are served as-is.
