# Reviewed Hidden Tricks extraction

`npm run tricks` verifies the reviewed candidates in
`scripts/trick-candidates.json`, then merges them by id into `data/tricks.json`.
It never discovers or accepts candidates through a classifier. The routing guard
for Tricks and Prompts in `route-signals.mjs` remains unchanged.

## What the evidence establishes

Each accepted candidate has an existing story, a named author, a short verbatim
quotation and a commit-pinned, line-linked public Discord archive message. The
extractor checks message id, author, date, line range and quotation against that
message. The public archive is a mirror of Discord, not independent verification
that the author's implementation works. Cards explicitly describe limitations.

A literal search alone cannot prove semantic absence. Every candidate also records
an editorial explanation of the non-obvious mechanism and the closest official
instructions, including an exact excerpt and why they do not describe that mechanism.
Those excerpts and the review revision are checked on every run. Changes to the
reference revision invalidate the review; the extractor cannot renew it automatically.

The initial review considered 19 candidates, accepted 4 and rejected 15. The rejected
list and individual reasons are retained in the candidate and evidence files. The
smaller shelf is intentional: ordinary documented features, unresolved source
attribution, proposals and insufficiently detailed claims were not stretched to
meet a target count. Existing use cases are preserved.

A second review on 2026-10-11 resolved 98 of the 116 Discord-sourced stories to their
exact archived message (author, id, date, line range) at the same pinned archive
commit, read the fifteen that an editorial triage put first, accepted 3 and rejected
12 with reasons. Two rejections are worth naming because they looked strongest:
a `STANDING.md` plugin that injects a file into the system prompt every turn, which
is what the documented context files already do; and the RTK rewrite plugin, which the
documentation names directly. The triage only ordered reading; every acceptance rests
on the quotation, the permalink and the searches recorded in the candidate file.

Refreshing the corpus for that review found one upstream page deleted. A refresh
refuses to shrink coverage on its own, so the removal was reviewed — it appeared in no
closest-doc comparison, only in the lists of pages searched — and is recorded in
`scripts/trick-docs-removed.json`; only a path listed there is tolerated. All seven
accepted candidates were then re-searched and their excerpts re-checked against the
new revision (1f2b9e0, 451 pages) before their reviews were stamped.

## Corpus and scope

`scripts/prompt-excerpts.json` currently covers six guides. Searching only those
would miss documented commands elsewhere. The additional
`scripts/trick-docs.json.gz` caches every English Markdown/MDX file under
`website/docs/` in the pinned upstream revision, except `user-stories.mdx`.
That excluded page is a collection of community testimonials (the discovery input),
not a reference manual. It must not be confused with absence from the reference docs.

The gzip is a deterministic, dependency-free storage format for the complete text;
Node's built-in zlib reads it offline. `scripts/trick-evidence.json` records the
upstream revision, snapshot and candidate hashes, all searched page URLs, query
terms, matches, source paragraphs and closest-doc review for each accepted entry.
The first snapshot contains 446 reference files plus the six cached guide records.
It does not claim coverage of every external page, translation, issue or future
release. The cards state this boundary too.

Queries require all terms in one paragraph, after case/whitespace/typographic
normalization and word-boundary matching. Separate queries are alternatives. A
match rejects the candidate; a reviewer must inspect the context rather than hide it
by choosing narrower terms. Search both distinctive names and the mechanism, then
review related documentation for differently worded descriptions. An absence result
is evidence for that bounded review, never an automated semantic judgment.

Inspect the full snapshot without installing anything:

```sh
node --input-type=module -e "import {readFileSync} from 'node:fs'; import {gunzipSync} from 'node:zlib'; console.log(gunzipSync(readFileSync('scripts/trick-docs.json.gz')).toString())"
```

Upstream documentation comes from [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)
under its MIT license; see `scripts/trick-docs.NOTICE.md`. Community excerpts retain
their authors' rights and original source links, as explained in the root NOTICE.

## Commands

```sh
npm run tricks               # live provenance + current docs revision; merge by id
npm run tricks -- --report   # same live checks, no writes
npm run tricks -- --offline  # recompute searches and verify stored evidence/shelf; no network or writes
npm run tricks -- --refresh-docs # refresh reference corpus only; does not accept entries or renew reviews
```

The refresh uses GitHub's public repository API, reusing configured credentials if
available. It may need a request per reference file. Authentication failures,
rate limits, truncated trees, removed reference files and unreadable blobs abort
without replacing the last good corpus. A refresh deliberately makes old evidence
stale until a editorial reviews the candidates against the new revision. Do not edit
only the revision field to get a green result.

All candidate checks complete before either the shelf or evidence file is written.
Outputs are staged and rolled back if a write fails. Empty selections are errors;
historical entries without matching reviewed provenance are errors rather than
silently deleted or skipped. Importing the module does not run extraction, load
credentials, fetch or write files.

After a content change, run `npm run rank` with the existing configured credentials,
then `npm run check`, `npm test`, `npm run links`, and offline verification. The links
command checks attribution and official-doc anchors; it does **not** fetch every
third-party URL. The extractor separately fetches the accepted public source exports.

Fixture tests corrupt a permalink and absence evidence, require a non-zero failure,
and compare the shelf/evidence bytes before and after. They also cover author mixups,
source-shape changes, documented matches, empty input, import safety and upstream
failures. They make no network calls.
