// Public endpoint only. Never put an API key in this file or localStorage.
async function searchYouTube() {
  const status=el('youtubeStatus'), button=el('youtubeSearch');
  const anime=el('anime').value.trim(), style=el('kind').value;
  const endpoint=el('apiEndpoint').value.trim();
  if(!anime) {status.textContent='Введите название аниме.';return;}
  let url;
  try {url=new URL(endpoint);if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash) throw Error();}
  catch {status.textContent='Укажите HTTPS URL серверного /search endpoint без ключей и параметров.';return;}
  try {localStorage.setItem('anime-scout-api-endpoint',url.href);} catch {}
  button.disabled=true;status.textContent='Поиск…';
  try {
    url.searchParams.set('anime',anime);url.searchParams.set('style',style);
    const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
    if(!response.ok) throw Error('Поиск недоступен: проверьте сервер, квоту API и подключение.');
    const data=await response.json();
    if(!Array.isArray(data.items)) throw Error('Некорректный ответ сервера.');
    const unique=new Map(data.items.filter(x=>/^[\w-]{11}$/.test(x.videoId)).map(x=>[x.videoId,x]));
    const items=[...unique.values()].slice(0,10);
    for(const item of items) {
      const id='youtube-'+item.videoId;
      if(records.some(r=>r.id===id || r.url===`https://www.youtube.com/watch?v=${item.videoId}`)) continue;
      records.unshift({id,anime,title:String(item.title || 'Без названия'),url:`https://www.youtube.com/watch?v=${item.videoId}`,thumb:safeUrl(item.thumbnail),frames:[],notes:item.duration?'Длительность: '+item.duration:'Длительность недоступна',rights:'unverified',status:'candidate',score:null,createdAt:new Date().toISOString()});
    }
    save();
    status.textContent=items.length?`Найдено ${items.length} уникальных видео (до 10). Уже сохранённые не дублируются.${data.durationUnavailable?' Длительности временно недоступны.':''}`:'Ничего не найдено. Измените название или стиль.';
  } catch(error) {status.textContent=error.name==='TimeoutError'?'Сервер не ответил вовремя. Повторите поиск.':error.message;}
  finally {button.disabled=false;}
}
try {el('apiEndpoint').value=localStorage.getItem('anime-scout-api-endpoint') || '';} catch {}
el('youtubeSearch').addEventListener('click',searchYouTube);
