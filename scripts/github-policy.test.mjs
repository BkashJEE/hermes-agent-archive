import test from 'node:test';
import assert from 'node:assert/strict';
import {githubStarFloor, qualifiesStars} from '../assets/js/github-policy.js';
import {mergeLive, trendingItems} from '../assets/js/archive.js';

test('one strict default accepts 50001 and rejects 50000; overrides can lower or raise it',()=>{
  assert.equal(githubStarFloor(),50000);
  assert.equal(qualifiesStars(50000),false);
  assert.equal(qualifiesStars(50001),true);
  assert.equal(qualifiesStars(501,githubStarFloor('500')),true);
  assert.equal(qualifiesStars(1000,githubStarFloor('5000')),false);
  for (const value of ['invalid',-1,1.5,Infinity,null]) {
    assert.throws(()=>githubStarFloor(value));
  }
});
test('rendering and Trending follow the fetched policy rather than a second floor',()=>{
  const now=Date.now();
  const live={githubMinStars:499,github:[{repo:'org/tool',stars:500,forks:1,url:'https://github.com/org/tool',observedAt:new Date(now-1000).toISOString(),previousStars:{value:400,at:new Date(now-86400000).toISOString()}}]};
  const data={builds:[{id:'tool',repo:'org/tool',title:'Tool'}]};
  mergeLive(data,live);
  assert.equal(data.builds.length,1);
  assert.equal(trendingItems(data,live.githubMinStars).length,1);
  const strict={builds:[{id:'tool',repo:'org/tool',title:'Tool'}]};
  mergeLive(strict,{...live,githubMinStars:1000});
  assert.equal(strict.builds.length,0);
});
