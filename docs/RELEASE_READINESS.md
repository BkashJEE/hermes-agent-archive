# Release readiness

This document separates prepared infrastructure from unfinished archive content. It is not a security certification or a claim that criticism has been eliminated.

Last reviewed 2026-09-25 after merging PRs #25 and #26. These changes are on main; the last verified production deployment remains `dc6f2ec`. Merging and deploying are separate steps.

## Prepared in the open-source readiness proposal

- Existing MIT code license retained with a separate scope and third-party notice.
- Independent-project statement, ranking limitations and privacy documentation.
- Contribution, correction, bug-report and private vulnerability-reporting paths.
- Owner review and separate publication control; no contributor Vercel access.
- Loopback-only local server restricted to public runtime files, with tests for private paths and symlinks.
- Pinned checkout/setup actions, read-only pull-request validation and job timeouts.

At the preparation check, the repository was already public, GitHub secret scanning and push protection were enabled, and no open secret-scanning alerts were returned. Private vulnerability reporting was enabled. This does not prove that the entire repository history contains no secrets or that the application has received a comprehensive security audit.

## Addressed since the previous review

The items below are merged into main. They require a separate owner-approved deployment before they appear on the live site.

- **Merged — open PRs integrated.** #17, #20, #22, #23 and #24 are merged and #19 was closed as a duplicate of #22. No implementation replaced another, and the strict 50,000-star default survived: `MIN_GITHUB_STARS` is `50000`, the comparison is strictly greater, and the ranking tests assert both that 50,000 fails and that 50,001 passes.

- **Merged in PR #25 — the prompt extractor exists and has been run.** It was previously a zero-byte file, as was its excerpt record, so nothing had ever checked that shelf. All twelve prompts verify against the pages they cite: ten exact code-block matches, one substring, one quoted in prose rather than fenced. `scripts/prompt-excerpts.json` stores the text of every block read, so `--offline` re-checks the same claims and an upstream edit appears as a diff. Corrupting a snippet or an anchor makes the run exit non-zero without replacing the last good excerpt record. A regression test also covers failed network requests.

  The earlier note asked for these to be reproduced "from the correct source", on the grounds that they cite official documentation rather than the community stories. They do cite official documentation, and each one is now confirmed to be there. Whether the shelf should instead draw from community stories is an editorial decision and remains the owner's; it is not a correctness defect.

- **Merged in PR #25 — three broken documentation links repaired.** Entries pointed at headings that do not exist, because the id slugger was reused to build URLs. It collapses runs of punctuation, while the documentation generator removes punctuation in place and maps each remaining space to its own hyphen. A separate anchor slugger now reproduces all 233 headings across the seven cited pages, and `scripts/check-links.mjs` re-checks every anchored link.

- **Merged in PR #25 — attribution gap closed for listed repositories.** Thirteen GitHub entries named no author; the owner was derivable from the URL in every case. Official documentation stays uncredited to a person deliberately. `check-links.mjs` now fails if a third-party entry names neither an author nor a credit.

- **Merged in PR #26 — accessibility and layout reviewed at 375px and 1920px.** A skip link addresses a Level A bypass block — 62 of 99 focusable controls sat before the main content. The heading outline no longer begins at `h4`, the `no public metric` label is no longer the smallest text on the page, the active sort is readable on a phone, and "Clear filters" appears only when a filter is set. Verified unchanged: no horizontal overflow, header and list bar pin on scroll, `[hidden]` still wins, reduced motion respected, drawer keeps its dialog semantics, and no text fails AA contrast.

- **Merged in PR #25 — two scripts rewrote data merely by being imported.** A test run had silently added five entries to two shelves. Both now act only when invoked as a command.

## Still required before describing the archive as complete

- **Skills coverage and Hidden Tricks.** Skills holds four entries and Hidden Tricks holds none. The shelf now says so plainly rather than implying a filter is hiding something, but an empty shelf is still an empty shelf. Populate only with verified, attributed discoveries.

- **Remaining official documentation imports.** Messaging, CLI, quickstart, architecture, integrations, features overview and the Nemotron guide are outstanding. The CLI importer currently finds five entries not yet in the archive; they were deliberately kept out of the anchor repair so that change stayed reviewable.

- **Entry-by-entry provenance and rights review.** Not started. Source credit alone is not blanket redistribution permission. Resolve reported attribution, quote or permission concerns before promoting affected content. The automated checks confirm that a link exists and that an author is named; they say nothing about whether republishing the quoted text is permitted.

- **Deployment verification.** Confirm a fresh clone works without credentials, verify public deployment contents and links, and publish only the owner-approved release. Regenerate any social image carrying archive counts from that release's data.

## Current counts

674 stored entries across nine content shelves, plus Dashboard and Trending, which are computed:
Use Cases 326, Commands 220, Settings 89, Prompts 12, My Work 11, Works With 8, Skills 4,
People Build 4, Hidden Tricks 0.

670 were eligible to display at the last release. Stored and displayed are not the same number
and should not be reconciled by changing either: an entry is stored permanently and shown only
while it still qualifies, so a repository that drops below the star floor keeps its write-up and
leaves the shelf.

Combined verification: `npm run check` passes for 674 stored entries and `npm test` passes all 43 tests. `npm run links` checks attribution and 76 documentation anchors across seven pages; it does not test social-site reachability. All 12 prompts pass both live verification (`npm run prompts -- --report`) and the offline check. Browser checks at 375px and 1920px confirm no horizontal overflow, 16px phone gutters, working skip/filter focus and drawer focus trapping/restoration.

Normal pipeline operations remain additive. Handle exceptional rights or privacy redactions explicitly, with the maintainer's decision recorded and protection against automatic re-import; do not silently erase an archive or automatically restore disputed material.
