/* Independent source: never downloads media for processing or grants download rights. */
const Sakuga = (() => {
  const KEY='anime-scout-sakuga-v1';
  const host='https://www.sakugabooru.com';
  function mediaUrl(value) {
    try {
      if(typeof value!=='string' || !value.trim())return '';
      const u=new URL(value,host);
      return u.protocol==='https:' && (u.hostname==='sakugabooru.com' || u.hostname.endsWith('.sakugabooru.com')) && !u.username && !u.password ? u.href : '';
    } catch {return '';}
  }
  function normalize(p) {
    if(!p || !Number.isSafeInteger(p.id) || p.id<=0) return null;
    const ext=String(p.file_ext || '').toLowerCase();
    if(!['mp4','webm','mov','m4v','ogv'].includes(ext)) return null;
    const file=mediaUrl(p.file_url);
    if(!file) return null;
    const positive=n=>Number.isFinite(n) && n>0 ? n : null;
    return {id:p.id,post_url:`${host}/post/show/${p.id}`,file_url:file,preview_url:mediaUrl(p.preview_url || ''),file_ext:ext,width:positive(p.width),height:positive(p.height),file_size:positive(p.file_size),duration:null,status:'pending',selected:false};
  }
  function restore(storage) {
    try {
      const data=JSON.parse(storage.getItem(KEY));
      if(!data || !Array.isArray(data.items)) return {target:10,items:[]};
      const seen=new Set();
      const items=data.items.slice(0,500).map(raw=>{
        const p=normalize(raw);if(!p || seen.has(p.id)) return null;seen.add(p.id);
        p.duration=Number.isFinite(raw.duration)&&raw.duration>0?raw.duration:null;
        p.status=['approved','rejected'].includes(raw.status)?raw.status:'pending';
        p.selected=raw.selected===true && p.status!=='rejected';return p;
      }).filter(Boolean);
      return {target:Number.isInteger(data.target)&&data.target>=10&&data.target<=20?data.target:10,items};
    } catch {return {target:10,items:[]};}
  }
  function merge(items,posts) {
    const seen=new Set(items.map(p=>p.id));
    for(const raw of posts) {const p=normalize(raw);if(p&&!seen.has(p.id)){items.push(p);seen.add(p.id);}}
    return items;
  }
  function summary(items) {
    const chosen=items.filter(p=>p.selected);
    return {count:chosen.length,seconds:chosen.reduce((s,p)=>s+(p.duration || 0),0),unknown:chosen.filter(p=>p.duration===null).length};
  }
  function manifest(state) {
    return {schema_version:1,source:'sakugabooru',created_at:new Date().toISOString(),target_scenes:state.target,summary:summary(state.items.filter(p=>p.status==='approved')),download_requested:false,rights:'unverified',items:state.items.filter(p=>p.selected&&p.status==='approved').map(p=>({...p,rights:'unverified',download_requested:false}))};
  }
  // Browser metadata may request byte ranges. Never call play(), fetch a media blob, or save video.
  function metadata(url,create=()=>document.createElement('video'),timeout=12000) {
    return new Promise(resolve=>{
      const v=create();let finished=false;
      const done=value=>{if(finished)return;finished=true;clearTimeout(timer);v.onloadedmetadata=null;v.onerror=null;v.removeAttribute('src');v.load();resolve(value);};
      const timer=setTimeout(()=>done(null),timeout);
      v.preload='metadata';v.muted=true;v.playsInline=true;
      v.onloadedmetadata=()=>done(Number.isFinite(v.duration)&&v.duration>0?v.duration:null);
      v.onerror=()=>done(null);
      try {v.src=url;v.load();} catch {done(null);}
    });
  }
  return {KEY,normalize,restore,merge,summary,manifest,metadata};
})();

(() => {
  const get=id=>document.getElementById(id);
  const root=get('sakugaItems');if(!root)return;
  let storage;try {storage=localStorage;} catch {}
  const state=Sakuga.restore(storage);
  let visible=state.items.map(p=>p.id),busy=false;
  const message=get('sakugaStatus');
  const target=get('sakugaTarget');
  for(let n=10;n<=20;n++){const o=document.createElement('option');o.value=n;o.textContent=n;target.append(o);}target.value=state.target;
  function persist(){try{localStorage.setItem(Sakuga.KEY,JSON.stringify(state));}catch{message.textContent='Не удалось сохранить выбор: хранилище браузера недоступно или заполнено.';}}
  function node(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;}
  function time(seconds){return seconds===null?'не определено':seconds.toFixed(1)+' с';}
  function totals(){
    const s=Sakuga.summary(state.items);
    get('sakugaTotal').textContent=`Выбрано ${s.count} / ${state.target}. Известная длительность: ${time(s.seconds)}. Не определено: ${s.unknown}. Одобрено и выбрано: ${state.items.filter(p=>p.selected&&p.status==='approved').length}.`;
  }
  function render(){
    root.replaceChildren();totals();
    const shown=state.items.filter(p=>visible.includes(p.id));
    if(!shown.length)root.append(node('p','Нет видеопостов. Выполните поиск или откройте сохранённые.'));
    for(const p of shown){
      const card=node('article');card.className='item';
      const link=node('a',`Sakugabooru #${p.id} ↗`);link.href=p.post_url;link.target='_blank';link.rel='noopener noreferrer';card.append(link);
      if(p.preview_url){const im=node('img');im.src=p.preview_url;im.alt=`Превью поста ${p.id}`;im.loading='lazy';im.className='thumb';im.onerror=()=>{im.remove();};card.append(im);}
      card.append(node('p',`${p.width || '?'} × ${p.height || '?'} · ${p.file_ext.toUpperCase()} · ${p.file_size===null?'размер неизвестен':(p.file_size/1048576).toFixed(2)+' MiB'}`));
      const duration=node('p',`Длительность: ${time(p.duration)}`);card.append(duration);
      const probe=node('button','Определить длительность');probe.className='secondary';
      probe.onclick=async()=>{probe.disabled=true;duration.textContent='Чтение метаданных…';p.duration=await Sakuga.metadata(p.file_url);duration.textContent=`Длительность: ${time(p.duration)}${p.duration===null?' (CORS, доступ, формат или тайм-аут)':''}`;persist();totals();probe.disabled=false;};card.append(probe);
      const label=node('label');const choice=node('input');choice.type='checkbox';choice.checked=p.selected;choice.style.width='auto';
      choice.onchange=()=>{if(choice.checked && Sakuga.summary(state.items).count>=state.target){choice.checked=false;message.textContent='Достигнут лимит выбранных сцен. Снимите выбор или увеличьте цель.';return;}p.selected=choice.checked;if(p.selected&&p.status==='rejected')p.status='pending';persist();render();};label.append(choice,document.createTextNode(' Включить в подборку'));card.append(label);
      card.append(node('p',{pending:'На проверке',approved:'Одобрено',rejected:'Отклонено'}[p.status]));
      const actions=node('div');actions.className='actions';
      for(const [value,title] of [['approved','Одобрить'],['rejected','Отклонить']]){const b=node('button',title);b.className=value==='approved'?'ok':'warn';b.onclick=()=>{p.status=value;if(value==='rejected')p.selected=false;persist();render();};actions.append(b);}card.append(actions);root.append(card);
    }
  }
  target.onchange=()=>{const n=Number(target.value);if(Sakuga.summary(state.items).count>n){target.value=state.target;message.textContent='Сначала уменьшите число выбранных сцен.';return;}state.target=n;persist();totals();};
  get('sakugaSearch').onclick=async()=>{
    if(busy)return;
    const tags=get('sakugaTags').value.trim();if(!tags || tags.length>200){message.textContent='Введите теги (до 200 символов).';return;}
    busy=true;get('sakugaSearch').disabled=true;message.textContent='Поиск…';
    try {
      const url=new URL('https://anime-scout-proxy.kirillpovecherov.workers.dev/posts');url.search=new URLSearchParams({tags,limit:String(state.target)});
      const response=await fetch(url,{credentials:'omit',signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error(`Источник недоступен (HTTP ${response.status}). Повторные запросы не выполняются.`);
      const payload=await response.json();if(!payload || payload.ok!==true || !Array.isArray(payload.posts))throw Error(payload?.error ? `Ошибка прокси: ${payload.error}` : 'Некорректный ответ прокси.');const posts=payload.posts;
      const normalized=posts.map(Sakuga.normalize).filter(Boolean);visible=[...new Set(normalized.map(p=>p.id))];Sakuga.merge(state.items,posts);persist();render();
      message.textContent=visible.length?`Видеопостов: ${visible.length}. Решения сохранены; поиск может вернуть меньше цели. Длительность читается отдельно по кнопке.`:'Видеопосты не найдены (изображения исключены).';
    }catch(error){message.textContent=error instanceof TypeError?'Не удалось получить API: возможны CORS, сеть или ограничение доступа. Сохранённые карточки доступны.':error.name==='TimeoutError'?'Источник не ответил вовремя. Сохранённые карточки доступны.':error.message;}
    finally{busy=false;get('sakugaSearch').disabled=false;}
  };
  get('sakugaSaved').onclick=()=>{visible=state.items.map(p=>p.id);render();};
  function exportManifest() {
    const data=Sakuga.manifest(state);
    if(!data.items.length){message.textContent='Выберите и одобрите материалы для экспорта.';return null;}
    return new File([JSON.stringify(data,null,2)],'anime_scout_sakugabooru_manifest.json',{type:'application/json'});
  }
  function downloadManifest(file) {
    const url=URL.createObjectURL(file);
    const a=node('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();
    // Safari may need the blob alive until the save sheet has finished opening.
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    message.textContent='Экспорт запущен. Если iPhone не сохранил JSON, используйте «Поделиться JSON» → «Сохранить в Файлы».';
  }
  get('sakugaExport').onclick=()=>{
    const file=exportManifest();if(file)downloadManifest(file);
  };
  const share=node('button','Поделиться JSON (iPhone)');
  share.className='secondary';share.type='button';
  get('sakugaExport').insertAdjacentElement('afterend',share);
  share.onclick=async()=>{
    const file=exportManifest();if(!file)return;
    if(typeof navigator.share==='function' && typeof navigator.canShare==='function' && navigator.canShare({files:[file]})){
      try {
        await navigator.share({files:[file],title:'Anime Scout — одобренные сцены'});
        message.textContent='Меню передачи файла закрыто. Проверьте «Файлы» → выбранную папку.';
      }catch(error){
        if(error?.name==='AbortError'){message.textContent='Сохранение отменено.';return;}
        message.textContent='Не удалось открыть меню iOS. Пробуем обычный экспорт.';
        downloadManifest(file);
      }
    }else{
      downloadManifest(file);
    }
  };
  render();
})();
