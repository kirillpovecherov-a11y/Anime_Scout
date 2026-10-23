import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const ctx=vm.createContext({document:{getElementById:()=>null},URL,setTimeout,clearTimeout});
vm.runInContext(readFileSync(new URL('../sakuga.js',import.meta.url),'utf8')+';globalThis.api=Sakuga;',ctx);
const s=ctx.api;
const post=(id=1)=>({id,file_ext:'mp4',file_url:'https://www.sakugabooru.com/data/test.mp4',preview_url:'/data/preview/test.jpg',width:1280,height:720,file_size:2048});
test('normalization excludes images and unsafe URLs and retains source metadata',()=>{
 const p=s.normalize(post());assert.equal(p.id,1);assert.equal(p.width,1280);assert.equal(p.height,720);assert.equal(p.file_size,2048);assert.equal(p.duration,null);
 assert.equal(s.normalize({...post(),file_ext:'jpg'}),null);
 assert.equal(s.normalize({...post(),file_url:'javascript:alert(1)'}),null);
 assert.equal(s.normalize({...post(),file_url:'https://evil.example/movie.mp4'}),null);
 assert.equal(s.normalize({...post(),file_url:''}),null);
});
test('deduplication preserves selection and decisions',()=>{
 const items=[{...s.normalize(post()),status:'approved',selected:true,duration:12}];
 s.merge(items,[post(),post(2),post(2)]);assert.equal(items.length,2);assert.equal(items[0].duration,12);assert.equal(items[0].selected,true);
});
test('restore handles corruption and retains valid local decisions',()=>{
 assert.equal(s.restore({getItem:()=>'{'}).items.length,0);
 assert.equal(s.restore(undefined).target,10);
 const original={target:20,items:[{...post(),duration:5,status:'approved',selected:true},{...post(2),duration:null,status:'pending',selected:true}]};
 const restored=s.restore({getItem:()=>JSON.stringify(original)});
 assert.equal(restored.target,20);assert.equal(restored.items[0].selected,true);assert.equal(restored.items[0].status,'approved');
 const summary=s.summary(restored.items);assert.equal(summary.seconds,5);assert.equal(summary.unknown,1);
 const m=s.manifest(restored);assert.equal(m.items.length,1);assert.equal(m.items[0].file_size,2048);assert.equal(m.download_requested,false);assert.equal(m.items[0].rights,'unverified');
});
test('metadata resolves duration and cleans media; errors, invalid durations, timeout are isolated',async()=>{
 for(const mode of ['ok','error','infinite','timeout']){
  let cleaned=false;
  const create=()=>({duration:mode==='infinite'?Infinity:12.5,removeAttribute(){cleaned=true;this.src='';},load(){if(!this.src)return;if(mode==='ok'||mode==='infinite')queueMicrotask(()=>this.onloadedmetadata?.());else if(mode==='error')queueMicrotask(()=>this.onerror?.());}});
  assert.equal(await s.metadata(post().file_url,create,5),mode==='ok'?12.5:null);assert.equal(cleaned,true);
 }
});
