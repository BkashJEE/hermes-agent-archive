# Release readiness

Reviewed 2026-09-26 against main `4e366aa` and this preparation branch. The repository
is already public. Production was verified at `4e366aa`; preparing this branch does
not merge, tag, install into the owner's Desktop or deploy another release.

## What is available

- Public, searchable website with source links, author credits and explicit ranking limitations.
- Local browsing from a clone with Node.js 20+ and `npm start`, without dependencies or API keys.
- MIT license for original code/documentation, with separate third-party rights notices.
- Issue forms, contributor guidance, code of conduct and private vulnerability reporting.
- Owner-reviewed changes and separate Vercel publication. Visitors receive no editing access.
- Reviewed prompt and Hidden Tricks extractors with offline evidence; no classifier routing into either shelf.
- A manual-install Desktop plugin that frames the website. Its host-app compatibility remains **unverified**.

## Changes prepared in this branch

- Correct outdated README claims that Hidden Tricks is empty or lacks an extractor.
- Describe the plugin as an early preview and distinguish desktop UI from agent tools.
- Document installation, updates, backup recovery, removal and host-app troubleshooting.
- Preserve existing plugin files before explicit replacement/removal; never delete the whole directory or a package manager's ownership marker.
- Preserve the selected shelf when a palette command opens an unmounted Archive page; add the missing shelf shortcuts.
- Catch errors accessing `localStorage` itself, as well as errors reading it.
- Tell contributors how to submit entries without sharing credentials or fabricating Jev classifications.
- Prepare social copy and a screenshot/demo outline with accurate scope and one clear invitation to contribute.

## Evidence and limits

- `npm run check`: 840 stored entries across nine content shelves; Dashboard and Trending are computed.
- `npm test`: 85 tests passed, including importer, ranking, local-server, plugin and installer regression tests. Plugin tests use SDK stand-ins, not a real Hermes Desktop instance.
- A clean local clone passed both commands with an empty credential environment and no `.env` or `node_modules`. Its preview server served the four tricks and refused maintenance-script requests. Installer tests used disposable homes; the owner's installed plugin was not changed.
- The prior merged release passed source-attribution and documentation-anchor checks. The link checker does not fetch every social post or verify redistribution rights.
- GitHub read-only checks on 2026-09-26: public repository, secret scanning and push protection enabled, private vulnerability reporting enabled, zero open secret-scanning alerts returned. This is not a complete secrets-history or security audit.
- Only `.env.example` is tracked among environment/configuration paths checked; real credentials and Vercel project configuration remain ignored.

Stored counts at `4e366aa`: Use Cases 372, Commands 272, Settings 98, Skills 59,
Prompts 12, My Work 11, Works With 8, People Build 4 and Hidden Tricks 4.
Displayed totals differ because repository eligibility is checked against public metrics.

## Before announcing the plugin as supported

- Record a real [Desktop smoke test](../desktop-plugin/README.md#desktop-smoke-test)
  with exact Hermes version, operating system and commit. An installed file is insufficient.
- Test other operating systems before claiming their compatibility. No minimum supported
  Hermes Desktop version has yet been established by this project.
- Verify source links open correctly from the host's frame, and record its behavior when offline.
- Only then consider a versioned release and an upstream catalog submission. Neither is done here.

The website can be described as an early public archive today. The Desktop plugin can
be shared for testing with the limitations above. Chat search, sending cards into a
conversation, favourites and bundled offline data remain future work.

## Ongoing editorial work

- Complete the entry-by-entry provenance and rights review. Attribution does not grant
  blanket redistribution permission; do not call the entire dataset MIT licensed.
- Keep source/importer coverage current using `scripts/docs-manifest.json`; directories
  excluded by a past review should be revisited rather than assumed permanently unimportable.
- Preserve existing entries on failed refreshes. Handle rights/privacy redactions explicitly
  and prevent automatic re-import of material withdrawn after review.
- Regenerate count-bearing visuals from the approved release, or omit counts from social copy.

## Publication checklist

1. Review the PR and its checks; merge only with owner approval.
2. From a clean clone, run `npm run check` and `npm test` without credentials or dependency installation.
3. Test plugin installation only in a disposable `HERMES_HOME`; do not overwrite a user's setup during QA.
4. Inspect the Vercel dry-run file list. Keep secrets, scripts, research and plugin installation files out of the website deployment.
5. Publish only the approved revision; verify the public page and its runtime files. Keep preview protection enabled.
6. Use screenshots from that release, and review [the launch drafts](LAUNCH_POST.md) before posting. Do not publish drafts automatically.
