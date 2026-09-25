# Contributing to Hermes Agent Archive

Anyone can suggest an entry, report a correction, or run their own copy. A
submission does not edit the live dashboard. BkashJEE reviews proposed changes
and decides what to publish.

## Suggest an entry without writing code

Use the **Suggest an archive entry** issue form. Include:

- The original public permalink and author or repository owner.
- A specific Hermes Agent workflow, tip, prompt, skill or integration.
- What it does, the setup it needs, and any important limitation.
- For repository cards, upstream documentation of Hermes support. Repositories
  must have **more than 50,000 public GitHub stars**; exactly 50,000 is ineligible.

A project being useful to agents in general does not establish Hermes support.
Do not submit private conversations, credentials or material you cannot share.
Preserve attribution and link to the original. Prefer your own short description
to copying long passages.

## Submit a pull request

1. Fork the repository, clone your fork, and create a branch.
2. Follow the local setup in README.md. There is no dependency installation.
3. Append content to the appropriate `data/<section>.json`; retain existing IDs.
4. Include the source, credit, useful details and a concise card preview. For a
   GitHub repo, add reviewed upstream evidence to `assets/js/github-policy.js`.
5. Run `npm run check` and `npm test` with Node.js 20 or newer.
6. Open a pull request explaining what changed and linking to the source.

Do not hand-edit `data/live.json`, invent engagement, or present editorial scores
as public metrics. The maintainer can fetch API evidence and classify new entries
with Jev. A new repository is hidden until its API count qualifies. Stale or
missing classifications appear as unclassified until refreshed.

Trending requires two real public observations, at least an hour apart. A high
star count alone is not evidence of growth. Do not create synthetic baselines.

## Review and publishing

- `main` requires a pull request and passing validation. Stale approvals are
  dismissed when a proposal changes, and the owner is the code owner.
- Outside contributors have no repository write or Vercel access. Fork workflows
  and deployments may need the owner's approval before they run.
- The owner reviews content and approves its publication. Automated metric
  refreshes also open pull requests; they do not publish themselves.
- The owner retains administrator control, including the ability to merge their
  own reviewed changes. Approval is not permission to edit other Vercel projects.

Keep the site vanilla HTML, CSS and ES modules. Preserve the fonts, palette,
keyboard access and reduced-motion behavior. Do not add dependencies or a build.

## Rights and attribution

Original site code is MIT licensed. The license does not grant rights to
third-party excerpts, imported documentation, names or branding. Preserve source
notices and the licenses in `assets/licenses/`. Submit original contributions
under the applicable site code license, and identify any third-party material.

## Review standards

Read [the methodology](docs/METHODOLOGY.md), [rights notices](NOTICE.md),
[security policy](SECURITY.md) and [community conduct](CODE_OF_CONDUCT.md).
Disclose your connection to a submitted project. Explain corrections with evidence;
critical feedback is welcome. No contribution is guaranteed acceptance or a response
by a particular deadline. Do not claim that a listed project was tested unless you
record exactly what you tested.

Only the hosted archive requires owner approval. The MIT license permits use and
modification of the original code in independent forks; it does not require the
owner to approve your own copy. Third-party content keeps its original rights.
