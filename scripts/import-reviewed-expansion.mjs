#!/usr/bin/env node
/** Import only reviewed selections. Offline evidence is captured from the linked public
 * pages; --refresh rechecks those pages before writing anything. Never routes guesses. */
import './env.mjs';
import {readFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {codeBlocks, proseSections} from './extract-prompts.mjs';
import {serialise} from './json-format.mjs';
import {commitFiles} from './extract-tricks.mjs';
const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
const normal=s=>s.replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/`|​/g,'').replace(/\s+/g,' ').trim();
export function validateSelection(selection, page) {
  const {shelf,item,evidence}=selection;
  if (!['use-cases','skills','prompts','settings','commands','toolkit','builds','my-work'].includes(shelf)) throw new Error('Shelf requires its own reviewed extractor');
  for (const key of ['id','title','summary','detail','author','url']) if(typeof item?.[key]!=='string'||!item[key].trim()) throw new Error(`Missing ${key}`);
  const url=new URL(item.url);
  if(url.protocol!=='https:'||url.username||url.password) throw new Error('Invalid source URL');
  if(!['docs','github','reddit','x'].includes(item.source))throw new Error('Unsupported source type');
  if(shelf==='prompts'&&item.source!=='docs')throw new Error('Prompts require official source verification');
  if(item.source==='docs'&&url.origin!=='https://hermes-agent.nousresearch.com')throw new Error('Incorrect official source');
  if(item.source==='github'&&(url.hostname!=='github.com'||!/^\/[^/]+\/[^/]+$/.test(url.pathname)||item.credit))throw new Error('Repository entries must retain the public star policy');
  if(item.metric || item.metric2) throw new Error('Public metrics belong in the API snapshot');
  if(!Array.isArray(evidence)||!evidence.length||!page?.fetchedAt||!Array.isArray(page.sections)||!Array.isArray(page.blocks)) throw new Error('Missing source evidence');
  if(item.source==='x') {
    const match=url.pathname.match(/^\/([A-Za-z0-9_]+)\/status\/([0-9]+)$/);
    if(url.hostname!=='x.com'||!match||url.search||url.hash||item.author.toLowerCase()!==('@'+match[1]).toLowerCase())throw new Error('Expected an attributed X post permalink');
    if(page.kind!=='reviewed-public-x-post'||page.url!==item.url||page.author!==item.author||page.captureMethod!=='Public X post rendered in browser')throw new Error('X attribution or capture mismatch');
    if(item.repo||item.credit||!['use-cases','settings','commands','skills'].includes(shelf))throw new Error('X workflows cannot bypass repository or extraction policies');
    if(!Number.isSafeInteger(page.observedViews)||!Number.isSafeInteger(page.reviewMinimumViews)||page.reviewMinimumViews<=0||page.observedViews<page.reviewMinimumViews||!Number.isFinite(Date.parse(page.fetchedAt)))throw new Error('Missing qualifying view observation');
    for(const quote of evidence)if(typeof quote!=='string'||quote.length<12||!page.sections.some(s=>normal(s.text).includes(normal(quote)))||!normal(item.detail).includes(normal(quote)))throw new Error('X excerpt changed');
    if(item.snippet&&!page.sections.some(s=>normal(s.text).includes(normal(item.snippet))))throw new Error('X snippet changed');
    return; // Browser counts stay in research evidence, never card metrics or public ranking.
  }
  if(item.source==='reddit') {
    if(url.hostname!=='www.reddit.com'||!/^\/r\/hermesagent\/comments\/[a-z0-9]+\/comment\/[a-z0-9]+\/$/.test(url.pathname))throw new Error('Expected an exact community comment permalink');
    if(page.url!==item.url||page.author!==item.author||page.kind!=='reviewed-public-comment')throw new Error('Comment attribution mismatch');
    if(item.repo||item.metric||item.metric2||shelf!=='builds')throw new Error('Community reports are not repository or metric listings');
    for(const quote of evidence)if(typeof quote!=='string'||quote.length<12||!page.sections.some(s=>normal(s.text).includes(normal(quote)))||!normal(item.detail).includes(normal(quote)))throw new Error('Comment quote changed');
    return;
  }
  const anchor=decodeURIComponent(url.hash.slice(1));
  if(!anchor||!page.sections.some(s=>s.anchor===anchor)) throw new Error('Missing source anchor');
  for(const quote of evidence) {
    if(typeof quote!=='string'||quote.trim().length<12)throw new Error('Evidence excerpt too short');
    if(!page.sections.some(s=>s.anchor===anchor&&normal(s.text).includes(normal(quote))))throw new Error(`${item.id}: source evidence changed`);
  }
  if(item.snippet && !page.blocks.some(b=>b.anchor===anchor&&normal(b.text).includes(normal(item.snippet))) && !page.sections.some(s=>s.anchor===anchor&&normal(s.text).includes(normal(item.snippet))))throw new Error(`${item.id}: snippet not present at source anchor`);
}
export function planExpansion(selections,record,shelves) {
  if(!Array.isArray(selections)||!selections.length)throw new Error('No reviewed selections; archive untouched');
  const planned=structuredClone(shelves), ids=new Map(), selected=new Set();
  for(const [shelf,raw] of Object.entries(planned)) {
    if(!Array.isArray(raw.items))throw new Error(`Invalid shelf ${shelf}`);
    for(const item of raw.items)ids.set(item.id,{shelf,item});
  }
  const added={};
  for(const selection of selections) {
    validateSelection(selection,record.pages?.[selection.item?.url?.split('#')[0]]);
    const {shelf,item}=selection;
    if(!planned[shelf])throw new Error(`Unknown shelf ${shelf}`);
    if(selected.has(item.id))throw new Error(`Duplicate selection ${item.id}`);selected.add(item.id);
    const existing=ids.get(item.id);
    if(existing) {
      if(existing.shelf!==shelf||existing.item.url!==item.url)throw new Error(`Source conflict ${item.id}`);
      continue; // Preserve archived editorial work, even when the source changes.
    }
    if(planned[shelf].items.some(x=>x.title.trim().toLowerCase()===item.title.trim().toLowerCase()))throw new Error(`Duplicate title ${item.title}`);
    // One reviewed card per source anchor per shelf, not renamed duplicate cards.
    if(planned[shelf].items.some(x=>x.url===item.url && x.snippet===item.snippet))throw new Error(`Duplicate source ${item.url}`);
    planned[shelf].items.push(item);ids.set(item.id,{shelf,item});added[shelf]=(added[shelf]||0)+1;
  }
  return {shelves:planned,added};
}
export async function importExpansion(root=ROOT,{refresh=false,verify=false,fetcher=fetch}={}) {
  const manifest=JSON.parse(await readFile(join(root,'scripts/reviewed-expansion.json'),'utf8'));
  const record=JSON.parse(await readFile(join(root,'scripts/expansion-excerpts.json'),'utf8'));
  if(refresh&&manifest.entries.some(x=>new URL(x.item.url).hostname==='x.com'))throw new Error('X selections require a new public-browser review; automatic refresh unavailable; archive and cached evidence untouched');
  if(refresh)for(const url of [...new Set(manifest.entries.map(x=>x.item.url.split('#')[0]))]) {
    const location=new URL(url);
    if(location.hostname==='www.reddit.com') {
      const match=location.pathname.match(/^\/r\/hermesagent\/comments\/([a-z0-9]+)\/comment\/([a-z0-9]+)\/$/);
      if(!match)throw new Error('Expected an exact community comment');
      const response=await fetcher(`https://www.reddit.com/r/hermesagent/comments/${match[1]}.json?comment=${match[2]}`,{signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw new Error(`${url}: HTTP ${response.status}; cached evidence and archive untouched`);
      const listings=await response.json(), comments=[];
      const visit=children=>{for(const child of children??[]){if(child.kind==='t1'){comments.push(child.data);visit(child.data.replies?.data?.children);}}};
      visit(listings[1]?.data?.children);
      const comment=comments.find(x=>x.id===match[2]);
      if(!comment?.body||!comment.author||comment.author==='[deleted]')throw new Error('Comment unavailable; archive untouched');
      record.pages[url]={kind:'reviewed-public-comment',captureMethod:'Reddit public JSON',url,author:'u/'+comment.author,fetchedAt:new Date().toISOString(),sections:[{anchor:'comment',text:comment.body}],blocks:[]};
      continue;
    }
    if(location.hostname==='github.com') {
      const match=location.pathname.match(/^\/([^/]+\/[^/]+)$/);
      if(!match)throw new Error('Expected a repository source');
      const headers={accept:'application/vnd.github+json','user-agent':'hermes-agent-archive'};
      if(process.env.GITHUB_TOKEN)headers.authorization=`Bearer ${process.env.GITHUB_TOKEN}`;
      const response=await fetcher(`https://api.github.com/repos/${match[1]}/readme`,{headers,signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw new Error(`${url}: HTTP ${response.status}; no files changed`);
      const body=await response.json();
      if(body.encoding!=='base64'||!body.content)throw new Error('Unreadable README');
      const text=Buffer.from(body.content,'base64').toString('utf8');
      const excerpts=manifest.entries.filter(x=>x.item.url.split('#')[0]===url).flatMap(x=>[...x.evidence,...(x.item.snippet?[x.item.snippet]:[])]);
      if(excerpts.some(x=>!normal(text).includes(normal(x))))throw new Error(`${url}: README evidence changed`);
      record.pages[url]={fetchedAt:new Date().toISOString(),revision:body.sha,sections:[{anchor:'readme',text:excerpts.join('\n\n')}],blocks:[]};
      continue;
    }
    if(location.origin!=='https://hermes-agent.nousresearch.com')throw new Error('Unsupported refresh source');
    const res=await fetcher(url,{signal:AbortSignal.timeout(30000)});
    if(!res.ok)throw new Error(`${url}: HTTP ${res.status}; no files changed`);
    const html=await res.text(),{sections}=proseSections(html),blocks=codeBlocks(html);
    const anchors=new Set(manifest.entries.filter(x=>x.item.url.split('#')[0]===url).map(x=>new URL(x.item.url).hash.slice(1)));
    record.pages[url]={fetchedAt:new Date().toISOString(),sections:sections.filter(s=>anchors.has(s.anchor)),blocks:blocks.filter(b=>anchors.has(b.anchor))};
  }
  const cfg=JSON.parse(await readFile(join(root,'data/index.json'),'utf8')),shelves={},originals={};
  for(const section of cfg.sections){if(!section.file)continue;const path=join(root,'data',section.file),original=await readFile(path,'utf8');shelves[section.id]=JSON.parse(original);originals[section.id]={path,original};}
  const result=planExpansion(manifest.entries,record,shelves);
  // All source and archive validation completes before the first write.
  if(!verify) {
    const files=[];
    for(const [shelf,raw] of Object.entries(result.shelves))if(result.added[shelf]) {
      const {path,original}=originals[shelf];files.push({path,before:original,next:serialise(original,raw)});
    }
    if(refresh){const path=join(root,'scripts/expansion-excerpts.json');files.push({path,before:await readFile(path,'utf8'),next:JSON.stringify(record,null,2)+'\n'});}
    await commitFiles(files);
  }
  return result.added;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {console.log(await importExpansion(ROOT,{refresh:process.argv.includes('--refresh'),verify:process.argv.includes('--verify')}));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
