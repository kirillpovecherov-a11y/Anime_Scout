import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import worker,{searchYouTube} from '../worker.mjs';
const id=n=>String(n).padStart(11,'0');
const item=n=>({id:{videoId:id(n)},snippet:{title:'Video '+n,thumbnails:{medium:{url:'https://i.ytimg.com/vi/'+id(n)+'/mqdefault.jpg'}}}});
test('search deduplicates, paginates, caps at ten and attaches durations; key stays in header',async()=>{
 let searches=0;
 const result=await searchYouTube('Berserk','cinematic edit','secret',async(url,options)=>{
  assert.equal(url.searchParams.has('key'),false);assert.equal(options.headers['X-Goog-Api-Key'],'secret');
  if(url.pathname.endsWith('/videos')) return Response.json({items:[{id:id(0),contentDetails:{duration:'PT3M'}}]});
  searches++;assert.equal(url.searchParams.get('type'),'video');
  return Response.json(searches===1?{items:[item(0),item(0)],nextPageToken:'next'}:{items:Array.from({length:15},(_,n)=>item(n))});
 });
 assert.equal(searches,2);assert.equal(result.items.length,10);assert.equal(new Set(result.items.map(x=>x.videoId)).size,10);assert.equal(result.items[0].duration,'PT3M');assert.ok(!JSON.stringify(result).includes('secret'));
});
test('empty search and optional duration failure',async()=>{
 assert.deepEqual((await searchYouTube('x','y','k',async()=>Response.json({items:[]}))).items,[]);
 const r=await searchYouTube('x','y','k',async u=>u.pathname.endsWith('/search')?Response.json({items:[item(1)]}):new Response('',{status:403}));
 assert.equal(r.items.length,1);assert.equal(r.durationUnavailable,true);
 await assert.rejects(searchYouTube('x','y','k',async()=>new Response('',{status:403})));
});
test('endpoint rejects other origins, bad input and missing key without contacting Google',async()=>{
 const env={ALLOWED_ORIGIN:'https://example.com'};
 const req=(query,origin=env.ALLOWED_ORIGIN)=>new Request('https://api.example/search'+query,{headers:{Origin:origin}});
 assert.equal((await worker.fetch(req('?anime=x','https://evil.example'),env)).status,403);
 assert.equal((await worker.fetch(req(''),env)).status,400);
 assert.equal((await worker.fetch(req('?anime=Berserk'),env)).status,503);
});
test('browser integrates results without duplicates and keeps approval on repeated search',async()=>{
 const elements=Object.fromEntries(['youtubeStatus','youtubeSearch','anime','kind','apiEndpoint'].map(x=>[x,{value:'',addEventListener(){}}]));
 elements.anime.value='Berserk';elements.kind.value='cinematic edit';elements.apiEndpoint.value='https://api.example/search';
 const records=[],storage=new Map();let saves=0;
 const context=vm.createContext({el:id=>elements[id],records,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},URL,AbortSignal,Date,Map,Error,save(){storage.set('library',JSON.stringify(records));saves++;},safeUrl:s=>s,fetch:async()=>Response.json({items:[{videoId:id(1),title:'<script>text</script>',thumbnail:'https://i.ytimg.com/test.jpg'},{videoId:id(1)}]})});
 vm.runInContext(readFileSync(new URL('../youtube.js',import.meta.url),'utf8'),context);
 elements.apiEndpoint.value='https://api.example/search';
 await context.searchYouTube();assert.equal(records.length,1);assert.equal(records[0].rights,'unverified');
 records[0].status='approved';await context.searchYouTube();assert.equal(records.length,1);assert.equal(records[0].status,'approved');assert.equal(JSON.parse(storage.get('library'))[0].status,'approved');assert.equal(saves,2);assert.equal(elements.youtubeSearch.disabled,false);
 context.fetch=async()=>{throw Error('offline')};await context.searchYouTube();assert.match(elements.youtubeStatus.textContent,/offline/);
 context.fetch=async()=>Response.json({items:[]});await context.searchYouTube();assert.match(elements.youtubeStatus.textContent,/Ничего/);
});
test('existing page script parses; approval is independent of download permission',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
 assert.ok(html.includes("r.status==='approved'&&r.rights==='allowed'"));
 assert.ok(!html.includes("Сначала проверьте разрешение на загрузку"));
 assert.ok(html.includes('value="Berserk"'));
});
