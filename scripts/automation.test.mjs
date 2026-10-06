import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = f => readFile(new URL(f, import.meta.url), 'utf8');

/**
 * Both scheduled workflows once threw away the work of every healthy source because one
 * source was unavailable. Harvest died writing its own log; the refresh aborted before the
 * stale-merge it was supposed to perform, and was switched off after failing every day.
 */

test('a failing source cannot abort the step that reports it', async () => {
  const harvest = await read('../.github/workflows/harvest.yml');
  // The runner uses `bash -e`. A heredoc opened around a command that may exit non-zero
  // never writes its closing delimiter: "Matching delimiter not found 'HARVEST_EOF'".
  assert.ok(!/<<HARVEST_EOF/.test(harvest), 'no heredoc delimiter around a fallible command');
  assert.match(harvest, /set \+e\s+npm run harvest/, 'harvest runs with errexit off');
  assert.match(harvest, /echo "exit=\$\?" >> "\$GITHUB_OUTPUT"/, 'its exit code is recorded, not thrown');

  const refresh = await read('../.github/workflows/refresh.yml');
  assert.match(refresh, /set \+e\s+node scripts\/fetch-signals\.mjs/, 'the fetch runs with errexit off');
  for (const [name, wf] of [['harvest', harvest], ['refresh', refresh]])
    assert.match(wf, /if: steps\.\w+\.outputs\.exit != '0'/, `${name} still reports the failure at the end`);
});

test('program output is never interpolated into a shell script', async () => {
  // `${{ steps.*.outputs.* }}` inside `run:` pastes text this repository does not control
  // — including upstream error messages — straight into bash.
  const harvest = await read('../.github/workflows/harvest.yml');
  assert.ok(!/\$\{\{\s*steps\.harvest\.outputs\.summary/.test(harvest));
  assert.match(harvest, /cat "\$RUNNER_TEMP\/harvest\.log"/, 'the log is read from a file instead');
});

test('the fetcher writes before it fails, and never throws away a healthy source', async () => {
  const src = await read('./fetch-signals.mjs');
  assert.ok(!/if \(warnings\.length\) throw/.test(src),
    'a warning must not abort the run before the stale-merge AGENTS.md requires');
  // The non-zero exit has to come after the write, or the figures are lost anyway.
  const write = src.indexOf("writeFile(join(ROOT, 'data/live.json')");
  const exit = src.indexOf('process.exitCode = 1');
  assert.ok(write > 0 && exit > write, 'process.exitCode is set after data/live.json is written');
});

test('an unconfigured source is still disclosed to the reader', async () => {
  /* Reddit without credentials is expected rather than broken, so it no longer fails the
     run — but a reader still has to be told there is no figure, which is the whole
     promise of the page. Silencing that would be worse than the failing run. */
  const app = await read('../assets/js/app.js');
  assert.match(app, /state\.live\?\.warnings \|\| \[\]\), \.\.\.\(state\.live\?\.unconfigured/,
    'the footer notice covers both buckets');
  assert.match(app, /\(live\.unconfigured \|\| \[\]\)\.length/,
    'the dashboard count covers both buckets');
});
