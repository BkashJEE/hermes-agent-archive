# Reviewed shelf expansion — September 28, 2026 UTC

This review adds 129 entries. The target was 20 per content shelf; source quality,
the repository policy and honest shelf descriptions take precedence over the target.

| Shelf | Added | Stored after import |
| --- | ---: | ---: |
| Use Cases | 20 | 392 |
| Skills | 20 | 79 |
| Prompts | 20 | 32 |
| Settings | 20 | 118 |
| Commands | 20 | 292 |
| People Build | 20 | 27 |
| Works With | 9 | 17 |
| Hidden Tricks | 0 | 4 |
| My Work | 0 | 11 |

There are 972 stored entries, of which 968 currently meet the display policy.
One existing Use Cases entry and three existing Works With entries remain stored
but excluded. Dashboard and Trending are computed views, not additional content
shelves. New repositories have no invented growth baseline.

## Evidence and reproducibility

`scripts/reviewed-expansion.json` records each reviewed selection and its exact
source excerpts. `scripts/expansion-excerpts.json` caches the corresponding official
documentation sections, README excerpts with revisions, or attributed community
comment excerpts. `scripts/import-reviewed-expansion.mjs` verifies the selections
and merges by ID. Existing editorial edits and archived entries are preserved.
Importing the module has no execution side effect.

Run `node scripts/import-reviewed-expansion.mjs --verify` for offline verification,
or omit `--verify` to restore missing selections. `--refresh` re-fetches sources and
validates the entire set before committing any files. A failed source request or
changed excerpt exits nonzero and preserves both data and evidence. Fixture tests
cover invalid evidence, attribution, links, snippets and failed refreshes.

The 100 documentation selections include official automation examples, optional
skills, prompt excerpts, configuration guidance and command recipes. They are
labelled as official examples, not fabricated community success stories. Skills
retain named upstream authors where supplied. Install commands are reference
content; no candidate plugin or skill was installed or executed for this review.

The 20 People Build additions are public Reddit comment reports with exact
permalinks, author handles, quoted excerpts and limitations. They describe personal
builds, including unfinished work; they are not claims of independently tested
software. Public rendered comments were reviewed with a web reader. Reddit's JSON
endpoint was blocked during this review, so the cache explicitly records that it
is a reviewed excerpt, not an API response. No votes or view counts were imported.
A full `--refresh` will fail closed while that endpoint remains unavailable; the
offline verifier remains reproducible. The source-link check validates these
permalink shapes and author fields; it is not proof of live Reddit availability.

## Repository review and exclusions

A bounded GitHub public search for `hermes in:readme stars:>50000` returned 29
repositories: 10 already had support reviews, 9 were accepted, and 10 were deferred
or rejected. The accepted additions are RTK, Understand Anything, Browser Use,
ECC, Agency Agents, Graphify, Free Claude Code, Gstack and Multica. Each has an
explicit upstream Hermes setup or support description and a fetched public count
strictly above 50,000. Adapter limitations are preserved; Multica is described as
source-available, and Gstack's Hermes tier as methodology/instructions.

The other 10 search results were:

- `vinta/awesome-python`, `punkpeye/awesome-mcp-servers`,
  `1c7/chinese-independent-developer`, `avelino/awesome-go`: directory or passing
  mentions, insufficient integration evidence in the reviewed material.
- `asgeirtj/system_prompts_leaks`: prompt mirror, not a Hermes integration.
- `mvanhorn/last30days-skill`, `zylon-ai/private-gpt`, `stablyai/orca`,
  `diegosouzapw/OmniRoute`, `rohitg00/ai-engineering-from-scratch`:
  deferred because the reviewed mention, badge, comparison or general learning
  material did not establish a sufficiently specific Hermes setup. This is a
  bounded review decision, not a claim that support cannot exist elsewhere.

A separate bounded search of 20 recent Hermes-related repositories returned only
projects below the normal floor. None was admitted through that search. These
search sets are not a claim of exhaustive ecosystem coverage.

The existing three exact CliffWade community exceptions remain unchanged and
visibly labelled. No new owner-project exception was assumed. My Work remains
unchanged pending the owner's decision about their own repositories below 50,000.

## Hidden Tricks

No new candidate earned a documented absence claim. The four existing entries
were re-reviewed against the updated official reference corpus at upstream commit
`5458de948379badc5b84ba624dc029367a28ece4`. The verifier searches 448 official
reference pages plus 10 prompt excerpt pages, accepts the same four entries and
retains 15 recorded candidate rejections. The expanded prompt evidence still
validates all 32 prompts. Classifier routing into Tricks and Prompts is unchanged.

## Validation

- `npm run check`: 972 entries valid.
- `npm test`: 87 tests pass, including five reviewed-expansion fixture tests.
- `npm run links`: source/author validation and 338 anchored documentation links
  across 49 pages pass; this command does not live-fetch Reddit comments.
- `npm run rank`: 968 current rendered classifications; missing public engagement
  remains unknown, not zero or a model-generated public metric.
- Reviewed-expansion, prompts and tricks offline verifiers pass.
- Browser checks: new integration and community drawers open; search and mobile
  navigation work; no horizontal overflow at 375px or 1920px; drawer keyboard
  focus stays inside and restores to its card; no browser console errors observed.

Code licensing does not relicense third-party quotations. Existing source notices
and rights/correction routes remain in place.
