# Public X discovery review — September 29, 2026

This bounded pass reviewed nine main-post candidates from the owner's followed-account
search and a wider recent Hermes search. It did not export follower lists or private
posts. Mutual followers were visible in the network sample; this is not an exhaustive
review of the owner's followers. Account size was not used as evidence of post reach.

The owner requested unique, high-view material across the archive, not only GitHub
repositories. A 10,000-view research cutoff is provisional pending the owner's answer.
The observations below came from the public X page rendered in the browser on September
29, not a public metrics API. They are research evidence only: the new card contains no
engagement figure, and Jev's public-popularity evidence remains unknown.

## Selection and exclusions

One candidate accepted; eight rejected or deferred in this pass. Search-result counts
and permalink-page counts can differ as new views arrive; the figures below identify
what was actually observed, not current live totals.

| Source | Observed views | Decision |
| --- | ---: | --- |
| [@witcheer: Bot Screen login handoff](https://x.com/witcheer/status/2104935137653739584) | 12,279 | Add one Use Cases card. Exact steps, named author, real permalink and official documentation. It is documented, so it is not a Hidden Trick. |
| [@AlexFinn: Hermes update overview](https://x.com/AlexFinn/status/2103904905459306944) | 74,019 | Defer. The visible post lists features; the video's individual procedures have not been transcribed and verified. Do not create several cards from its headline. |
| [@melvynx: OpenAI comparison](https://x.com/melvynx/status/2104946158527508523) | 3,286 | Reject: below provisional reach floor and no actionable Hermes workflow. |
| [@rlaope: oh-my-hermes](https://x.com/rlaope/status/2104574400070857034) | 4,606 | Reject from this pass: below the provisional reach floor. No repository exception granted. |
| [@0xNeoArch: model backup hardware](https://x.com/0xNeoArch/status/2104241582476316964) | 63,915 | Defer: specific use-case idea, but no reproducible selection/backup procedure verified. Hardware figures are the author's claims, not archive measurements. |
| [@perplexitydevs: Fast Search announcement](https://x.com/perplexitydevs/status/2103241128216875283) | 250,451 | Defer: needs setup instructions and account eligibility corroboration. The linked blog could not be reviewed because browser security policy blocked it; no workaround was attempted. Do not import the quoted latency claims as measured archive metrics. |
| [@LLMpsycho: Jev skills repository](https://x.com/LLMpsycho/status/2102374604853371242) | 9,109 | Reject: below provisional reach floor; a low-star repository cannot be repackaged as an X workflow to evade repository policy. The tweet's star claim was not accepted as an API count. |
| [@BearHuddleston: webapp PR](https://x.com/BearHuddleston/status/2104109388780744775) | 138,105 | Defer: post explicitly describes a proposed PR. Verify upstream merge/release and instructions before presenting it as shipped. |
| [@tonbistudio: switch search provider](https://x.com/tonbistudio/status/2103374537182314751) | 44,886 | Defer: overlaps the Fast Search announcement; verify the actual video procedure and current account terms, then create at most one distinct card. |

## Accepted workflow

`review-x-bot-screen-login-handoff` belongs in **Use Cases**. Its specific login handoff
and source permalink were not already present in the loaded shelves. It credits
@witcheer and links to the original post. The [official Bot Screen documentation](https://hermes-agent.nousresearch.com/docs/user-guide/features/bot-screen)
corroborates Linux gateway setup, Computer Use, takeover, persistent browser profile
and security limitations. This review did not install or execute the workflow.

Reproduce the addition with `node scripts/import-reviewed-expansion.mjs`; use `--verify`
to validate cached evidence without writing. `scripts/expansion-excerpts.json` preserves
the post wording, source identity, browser observation and provisional selection floor.
The verifier rejects mismatched authors/permalinks, missing quotes, unsupported snippets,
missing or insufficient view observations, card metrics and repository/extractor bypasses.

X does not have an anonymous public refresh path configured here. `--refresh` now fails
before network access or writes when the manifest includes X; update its captured evidence
through a new public-browser review. Offline verification does not claim the post still
exists or its view count is current. Other archived entries and cached evidence remain
untouched on failures.

## Three-day coverage and publication

The existing archive automation now reviews every content shelf every three days. Its
output is a proposed change, with a fresh social update only for meaningful approved/live
changes. Reviewing a shelf does not require padding it with a new card.

- Use Cases: one reviewed addition in this proposal.
- Skills: no qualifying new X selection in this bounded pass.
- Prompts: no verified verbatim prompt selected; reviewed extractor requirement retained.
- Commands and Settings: Bot Screen and search-provider leads were checked, but the
  workflow is kept in one shelf; no repeated cards merely to fill tabs.
- Hidden Tricks: the accepted workflow is documented and therefore ineligible here.
- Works With and People Build: no newly qualified repository; the normal star floor and
  exactly three approved exceptions remain unchanged.
- My Work: no new owner-authored high-view workflow selected.
- Dashboard and Trending: computed; never pad them with manually invented activity.

Typefully setup is missing in this environment, so its queue, timezone and analytics have
not been verified. No publication time was chosen and no post was scheduled or published.
The original archive announcement permalink is still needed for the intended three-day
follow-up/quote-post series. Check both Typefully and X's native schedule before choosing
a slot, and use actual account performance when available. Do not promise higher views.
