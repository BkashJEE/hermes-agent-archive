# Release readiness

This document separates prepared infrastructure from unfinished archive content. It is not a security certification or a claim that criticism has been eliminated.

## Prepared in the open-source readiness proposal

- Existing MIT code license retained with a separate scope and third-party notice.
- Independent-project statement, ranking limitations and privacy documentation.
- Contribution, correction, bug-report and private vulnerability-reporting paths.
- Owner review and separate publication control; no contributor Vercel access.
- Loopback-only local server restricted to public runtime files, with tests for private paths and symlinks.
- Pinned checkout/setup actions, read-only pull-request validation and job timeouts.

At the preparation check, the repository was already public, GitHub secret scanning and push protection were enabled, and no open secret-scanning alerts were returned. Private vulnerability reporting was enabled. This does not prove that the entire repository history contains no secrets or that the application has received a comprehensive security audit.

## Still required before describing the archive as complete

- Integrate the open PRs without replacing one implementation with another: #17 includes contribution setup and reviewed repository support; #20 carries the shared cutoff and environment override behavior. Both must retain the owner's strict 50,000-star default. #19 has dashboard work based on #17.
- Finish the approved Skills/Hidden Tricks source-backed curation and remaining official-guide imports. Do not promise shelf content that is absent.
- Supply and verify the prompt extractor. The checked-in prompts cite official documentation, not the community stories; reproduce them from the correct source.
- Complete an entry-by-entry provenance and rights review. Source credit alone is not blanket redistribution permission. Resolve reported attribution, quote or permission concerns before promoting affected content.
- Re-run checks on the combined branch, confirm a fresh clone works without credentials, and review 375px/1920px layouts, keyboard operation, drawer focus, reduced motion and contrast after all UI changes.
- Verify public deployment contents and links, then publish only the owner-approved release. Regenerate any social image carrying archive counts from that release's data.

Normal pipeline operations remain additive. Handle exceptional rights or privacy redactions explicitly, with the maintainer's decision recorded and protection against automatic re-import; do not silently erase an archive or automatically restore disputed material.
