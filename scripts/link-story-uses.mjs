#!/usr/bin/env node
/**
 * Link each story to the archive entries it names.
 *
 *   npm run uses            # write `uses` on every use case that names something
 *   npm run uses -- --dry   # report coverage, write nothing
 *
 * Use Cases is the largest shelf and the least actionable: 416 stories, 5 with anything
 * to copy. The stories are narrative — a measured 12 of 416 contain any command-shaped
 * text, and most of that is noise — so there is nothing to promote to a snippet without
 * inventing it. What a story does do is name what it used: "/voice", "the Obsidian
 * skill", "hermes send", "a cron". The archive already holds a verified entry for 280
 * commands, 312 skills and 114 settings, each with its own install command or snippet.
 *
 * So this writes `uses`: the ids of entries whose name appears in the story's own text.
 * The reader gets "mentioned in this story → Obsidian, Himalaya", each one click from a
 * copyable step. Nothing is inferred; the match is the entry's name in the post's words.
 *
 * Excluded on purpose: names inside URLs (a link to github.com is not "uses the GitHub
 * skill"), self-referential titles ("Hermes Agent"), and generic section labels.
 */

import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { serialise } from './json-format.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_USES = 4;
const GENERIC = /^(hermes( agent)?|agent|hermes agent archive|overview|getting started|quick ?start|installation|cli|api|docs|skills?|plugins?|memory|tools?|setup|config(uration)?|core|examples?|github)$/i;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The names worth matching, with the entry each one leads to. */
export function buildKeys({ commands = [], skills = [], settings = [] }) {
  const keys = [];
  for (const c of commands) {
    const m = (c.title || '').match(/^(\/[a-z][\w-]*)/)
           || (c.snippet || '').match(/^(\/[a-z][\w-]*|hermes [a-z][\w-]*(?: [a-z][\w-]*)?)/m);
    if (m && !/^hermes (chat|agent)$/i.test(m[1]))
      keys.push({ id: c.id, shelf: 'commands', name: m[1], re: new RegExp(`(^|[^\\w/])${esc(m[1])}(?![\\w-])`, 'i') });
  }
  for (const s of skills) {
    const t = (s.title || '').trim();
    if (t.length >= 5 && /^[A-Za-z][\w .+-]{3,30}$/.test(t) && !GENERIC.test(t))
      keys.push({ id: s.id, shelf: 'skills', name: t, re: new RegExp(`(^|[^\\w])${esc(t)}(?![\\w-])`, 'i') });
  }
  for (const s of settings) {
    const m = (s.title || '').match(/([a-z_]+\.[a-z_.]+)/);
    if (m) keys.push({ id: s.id, shelf: 'settings', name: m[1], re: new RegExp(esc(m[1]), 'i') });
  }
  return keys;
}

/** The text a story is judged on: its own words, with every URL removed first. */
export const prose = item => `${item.detail || ''}\n${item.summary || ''}`.replace(/https?:\/\/\S+/g, ' ').replace(/\b[\w.-]+\.(com|io|dev|ai|org|net)\b\S*/gi, ' ');

export function usesFor(item, keys) {
  const text = prose(item);
  const found = [];
  for (const k of keys) {
    if (k.id === item.id) continue;
    if (k.re.test(text) && !found.some(f => f.id === k.id)) found.push(k);
    if (found.length >= MAX_USES) break;
  }
  return found.map(k => k.id);
}

async function main() {
  const dry = process.argv.includes('--dry');
  const load = async f => JSON.parse(await readFile(join(ROOT, 'data', f), 'utf8')).items;
  const keys = buildKeys({ commands: await load('commands.json'), skills: await load('skills.json'), settings: await load('settings.json') });

  const path = join(ROOT, 'data', 'use-cases.json');
  const original = await readFile(path, 'utf8');
  const shelf = JSON.parse(original);
  let linked = 0, changed = 0;
  for (const item of shelf.items) {
    const uses = usesFor(item, keys);
    const before = JSON.stringify(item.uses || []);
    if (uses.length) { item.uses = uses; linked++; } else delete item.uses;
    if (JSON.stringify(item.uses || []) !== before) changed++;
  }
  console.log(`${keys.length} names · ${linked} of ${shelf.items.length} stories name something the archive holds (${Math.round(linked / shelf.items.length * 100)}%) · ${changed} changed`);
  if (dry) { console.log('--dry: nothing written.'); return; }
  if (!changed) { console.log('nothing changed; the file is left exactly as it was.'); return; }
  await writeFile(`${path}.tmp`, serialise(original, shelf));
  await rename(`${path}.tmp`, path);
  console.log('wrote data/use-cases.json');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
