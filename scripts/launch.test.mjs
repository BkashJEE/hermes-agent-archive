import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeLive, trendingItems } from '../assets/js/archive.js';
import { creditFor } from '../assets/js/credits.js';
import { cardPoints } from '../assets/js/card-preview.js';

test('trending shelf combines shelves, deduplicates repositories and enforces public evidence', () => {
  const now = Date.now();
  const record = (repo, stars, before, stale = false) => ({repo, stars, forks: 0, url: `https://github.com/${repo}`, stale,
    observedAt: new Date(now - 1000).toISOString(), previousStars: {value: before, at:new Date(now - 86400000).toISOString()}});
  const item = (id, repo) => ({id,repo,title:repo,source:'github',url:`https://github.com/${repo}`});
  const data = { toolkit:[item('a','one/fast'),item('b','two/small')],builds:[item('dup','one/fast'),{...item('c','three/slow'),repo:undefined},item('d','four/stale'),item('e','five/falling')] };
  mergeLive(data,{github:[record('one/fast',60000,59900),record('two/small',50000,49000),record('three/slow',80000,79980),record('four/stale',90000,80000,true),record('five/falling',100000,100100)]}, Object.fromEntries(['one/fast','two/small','three/slow','four/stale','five/falling'].map(repo => [repo,{note:'Fixture Hermes support'}])));
  assert.deepEqual(trendingItems(data).map(i=>i.title),['one/fast','three/slow']);
  assert.equal(data.builds.length,4); // Computed shelf does not mutate stored shelves.
});
test('community names cannot masquerade as author credits',()=>{
  assert.deepEqual(creditFor({author:'r/SideProject',source:'reddit'}),{label:'Author',name:'not recorded'});
  assert.deepEqual(creditFor({author:'u/example',source:'reddit'}),{label:'By',name:'u/example'});
});
test('card preview keeps parenthetical comparisons in a single sentence',()=>{
  const points=cardPoints({tags:['user-story'],detail:'Compare treatments (Charcoal vs. Intralipids) in a spreadsheet. Check the result before use.'});
  assert.equal(points[0],'Compare treatments (Charcoal vs. Intralipids) in a spreadsheet.');
});

test('credited analytics retain their source and never become public popularity evidence', async () => {
  const {rankingInput}=await import('../assets/js/ranking.js');
  const post={id:'mine',title:'Post',source:'x',repo:'org/tool',credit:'author analytics export',metric:{kind:'impressions',value:123}};
  const data={work:[post]}; mergeLive(data,null);
  assert.equal(data.work[0].metric.value,123);
  assert.deepEqual(rankingInput(data.work[0]).evidence,[]);
});
