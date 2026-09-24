#!/usr/bin/env node
/* Bootstrap observed star growth from an existing, committed API snapshot. */
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { recordGithubObservations } from '../assets/js/trends.js';

const ref = process.argv[2];
if (!ref || !/^[a-f0-9]{7,40}$/i.test(ref)) throw new Error('Pass a committed snapshot SHA.');
const root = new URL('../', import.meta.url);
const previous = JSON.parse(execFileSync('git', ['show', `${ref}:data/live.json`], { cwd: root, encoding: 'utf8' }));
const file = new URL('../data/live.json', import.meta.url);
const current = JSON.parse(await readFile(file, 'utf8'));
if (!(Date.parse(previous.generatedAt) < Date.parse(current.generatedAt))) throw new Error('Snapshot must precede current API data.');
current.github = recordGithubObservations(current.github || [], previous, current.generatedAt);
await writeFile(file, JSON.stringify(current, null, 2) + '\n');
console.log(`Recorded earlier public observations from ${ref}; engagement counts unchanged.`);
