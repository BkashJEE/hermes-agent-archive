# Curation and ranking

This is a selected archive of Hermes Agent material, not a complete directory or a benchmark. Source attribution makes a claim traceable; it does not independently verify that a workflow succeeds.

## Repository selection

The maintained site's normal editorial cutoff is **strictly more than 50,000 fetched public GitHub stars**, plus reviewed upstream documentation of Hermes support. Exactly 50,000 and unknown counts do not qualify. Community stories and documentation are not required to have engagement counts. Stories hosted on GitHub do not inherit the hosting repository's stars.

This high cutoff deliberately excludes many smaller and newer Hermes projects. It favors established projects and is not a measure of relevance, quality, safety or maintenance. Do not describe this selection as the best or complete Hermes ecosystem. Fork maintainers can choose different policies; the source code is open, and the hosted archive's selection remains the owner's decision.

## Community exceptions

On 2026-09-28 UTC, the owner approved three specific repositories below the star floor:

- [Hermes Desktop Theme Pack by Cliff Wade](https://github.com/BkashJEE/hermes-agent-archive/issues/39).
- [Hermes Command Center by Cliff Wade](https://github.com/BkashJEE/hermes-agent-archive/issues/40).
- [Hermes Desktop Achievements, originally by Tony Simons and extended by Cliff Wade](https://github.com/BkashJEE/hermes-agent-archive/issues/41).

These cards carry an **Owner-approved exception** label, show actual fetched public
metrics and link to upstream Hermes integration instructions. Documentation review is
not a security audit or runtime verification. Unknown counts remain ineligible. This
is an exact repository allowlist, not an exemption for an author or future submissions.
Discovery and Trending retain the normal star floor. The reviewed entry manifest is
`scripts/community-submissions.json`; rerun `node scripts/import-community-submissions.mjs`
to reproduce the additive import. Fetch metrics and rerun ranking after importing.

## Evidence and sorting

- Stars, forks, points and upvotes come from recorded public API responses. Different kinds of engagement are not interchangeable.
- Explicitly credited author analytics remain labelled and are excluded from public-popularity evidence.
- Missing engagement means unknown, not zero. A retained snapshot can become stale; check observation times and source warnings before relying on it.
- Jev is an automated editorial classifier. Usefulness labels are judgments about supplied text, not user votes, verified outcomes or measured performance. Human review can challenge them; changed evidence invalidates cached assessments.
- The default ordering uses usefulness first and public popularity as a secondary criterion. Publication dates do not determine ranking.
- Trending means positive observed star growth between two public snapshots 1 hour–14 days apart, with the latest within 14 days. It is this archive's measured growth view, not GitHub's own Trending feed. Sparse sampling and collection failures limit coverage.

There is no paid placement mechanism in the application. The maintainer's own posts appear under My Work with explicit credit; their inclusion is not evidence of independent endorsement.

## Reproducibility and corrections

Data and maintenance scripts are versioned together. Browsing and tests need no API credentials. Refreshing sources or recalculating Jev assessments can require credentials and may produce different results as upstream content changes. Automated classifications are not promised to be deterministic.

The archive is still completing importer coverage. In particular, the checked-in prompt examples need a working extractor; Skills and Hidden Tricks need their planned source-backed curation; remaining official guides have not all been imported. Do not claim that every entry can already be rebuilt from a single command. See [release readiness](RELEASE_READINESS.md).

To dispute a label, attribution or inclusion, submit the entry URL, relevant evidence and requested correction. Review is handled by the maintainer, with the reason visible in the resulting issue or PR when it contains no sensitive material.
