# Entry social cards

Render specific entries with system Chromium (no npm installation or build step):

```sh
node scripts/make-entry-og.mjs prompt-parallel-research
node scripts/make-entry-og.mjs --missing
node scripts/make-entry-og.mjs --missing --dry-run
node scripts/make-entry-og.mjs prompt-parallel-research --out-dir /tmp/entry-cards
```

Output: `assets/og/entries/<id>.png`, 1200×630. Each card carries the recorded title, credit, source, shelf and agent. The template shares the existing root tokens and Inter/JetBrains Mono fonts. Internet access is needed for those fonts. A single Chromium process renders a batch; no Electron is used.

`--missing` skips valid existing cards and repairs invalid image headers/dimensions. It does not detect edited content: pass an id without `--missing` to regenerate that card. Unknown ids fail before writes. A failed render preserves the existing batch. The generator renders stored entries, including entries currently hidden by eligibility policy; generation does not publish them or establish their eligibility.

## Measured cost

The full 973-entry corpus was rendered locally: **32,385,011 bytes (30.88 MiB)**. Individual PNGs ranged from 20,975 to 57,560 bytes. This is a measured full batch, not an extrapolation.

The 973 generated PNGs are gitignored and excluded from Vercel inputs by `assets/og/entries/**` in `.vercelignore`. They add zero committed PNG bytes in this change and are not automatically deployed. Vercel dry runs verified every runtime asset and configured JSON file is included, and all 973 generated PNGs are excluded. A separate dry-run comparison with the bulk exclusion removed included all 973 PNGs: exactly 32,385,011 additional uncompressed image bytes, before any transport compression. The directory preview was deployed without the bulk images.

To publish selected cards later, force-add only the reviewed PNGs and explicitly allow their exact paths after the exclusion in `.vercelignore`. Verify the resulting file list with `vercel deploy --dry --json`. Do not remove the bulk exclusion without evaluating its cost.

## Integration boundary

This change does not generate entry HTML pages, a sitemap or robots rules. Hash fragments are not sent to social crawlers. Per-entry cards need the separate pre-rendered-page work to reference their public image URLs through server-readable metadata. Merely copying a hash URL still uses the existing site-wide social preview.
