import test from 'node:test';
import assert from 'node:assert/strict';
import {githubStarFloor, qualifiesStars, qualifiesRepository, COMMUNITY_EXCEPTIONS} from '../assets/js/github-policy.js';
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
  mergeLive(data,live,{'org/tool':{url:'https://github.com/org/tool',note:'Fixture support'}});
  assert.equal(data.builds.length,1);
  assert.equal(trendingItems(data,live.githubMinStars).length,1);
  const strict={builds:[{id:'tool',repo:'org/tool',title:'Tool'}]};
  mergeLive(strict,{...live,githubMinStars:1000},{'org/tool':{url:'https://github.com/org/tool',note:'Fixture support'}});
  assert.equal(strict.builds.length,0);
});

test('community exceptions apply only to the three approved repos and still require fetched counts and support', () => {
  assert.equal(Object.keys(COMMUNITY_EXCEPTIONS).length, 3);
  for (const repo of Object.keys(COMMUNITY_EXCEPTIONS)) {
    assert.equal(qualifiesRepository(repo, 1), true);
    assert.equal(qualifiesRepository(repo.toUpperCase(), 0), true);
    for (const unknown of [undefined, null, NaN, -1, '24']) assert.equal(qualifiesRepository(repo, unknown), false);
    assert.equal(qualifiesRepository(repo, 24, {}), false);
    assert.equal(qualifiesRepository(`${repo}-other`, 24), false);
  }
  assert.equal(qualifiesRepository('cliffwade/another-plugin', 24, {'cliffwade/another-plugin':{note:'Hermes support'}}), false);
});

test('exceptions render with a policy label but do not enter Trending below its floor', () => {
  const repo = 'cliffwade/hermes-command-center', now = Date.now();
  const item = {id:'center',title:'Center',source:'github',url:`https://github.com/${repo}`};
  const data = {builds:[structuredClone(item)]};
  mergeLive(data, {github:[{repo,stars:2,forks:0,url:item.url,observedAt:new Date(now).toISOString(),previousStars:{value:1,at:new Date(now-86400000).toISOString()}}]});
  assert.equal(data.builds.length,1);
  assert.equal(data.builds[0].metric.value,2);
  assert.equal(data.builds[0].communityException,COMMUNITY_EXCEPTIONS[repo]);
  assert.deepEqual(trendingItems(data),[]);
  const missing = {builds:[item]};
  mergeLive(missing,{github:[]});
  assert.deepEqual(missing.builds,[]);
});
