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
5. Run `npm run check` and `npm test` with Node.js 20 or newer. `npm run links`
   additionally checks source attribution and live documentation anchors; it
   reaches the network, so it is not part of the required checks.
6. Open a pull request explaining what changed and linking to the source.

For a new entry, the test suite requires a matching Jev classification. Contributors
do not need a key: submit the source through an issue, or open a draft PR and record
the expected classification failure. A maintainer runs `npm run rank` with their own
configured credentials before merging; never fabricate a ranking to make CI pass.

Prompts and Hidden Tricks also require their reviewed extractor and evidence. Do not
append a claimed trick based on keywords or change the routing guard. Follow
[Hidden Tricks extraction](docs/HIDDEN_TRICKS.md) and retain each rejection reason.

Plugin changes should include the relevant unit tests and a completed or explicitly
pending [Hermes Desktop smoke test](desktop-plugin/README.md#desktop-smoke-test).
Tests against SDK stand-ins cannot establish host-app compatibility.

Do not hand-edit `data/live.json`, invent engagement, or present editorial scores
as public metrics. The maintainer can fetch API evidence and classify new entries
with Jev. A new repository is hidden until its API count qualifies. Stale or
missing classifications appear as unclassified until refreshed.

Trending requires two real public observations, at least an hour apart. A high
star count alone is not evidence of growth. Do not create synthetic baselines.

## What happens to your submission

Nothing you send edits the live site directly. The path is the same whether you
open an issue or a pull request.

1. **You propose.** An issue form, or a pull request that appends to
   `data/<section>.json`. Either way it is a proposal.
2. **Validation runs.** Every pull request runs `npm run check` and `npm test`.
   These reject a missing field, a bad URL, an unknown source, a duplicate id or
   title, an entry with no source link, and an entry that credits nobody. You see
   the same failures locally before you push.
3. **The owner reviews.** `main` requires an approving review from the code owner
   and a passing `validate` check. Nobody else can write to it, and force pushes
   are refused.
4. **The owner publishes.** Merging accepts the change into `main`. Updating the
   live Vercel site requires a separate owner-approved deployment.

Once merged, an entry stays. No pipeline stage removes one: the metric fetcher
updates `data/live.json` and the ranking script updates `data/rankings.json`, and the automated refresh
opens a pull request for review rather than committing to `main`. A repository
that later drops below the star floor keeps its stored write-up and stops being
displayed — stored and shown are deliberately different numbers.

If you need a change reversed after it is published, say so in an issue. Rights
and privacy removals are handled explicitly and recorded, not quietly dropped.

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
