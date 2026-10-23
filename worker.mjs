const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
export async function searchYouTube(anime, style, key, fetcher = fetch) {
  async function api(resource, params) {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
    url.search = new URLSearchParams(params);
    const response = await fetcher(url, {headers:{'X-Goog-Api-Key':key},signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw Error('YouTube API unavailable');
    return response.json();
  }
  const results = new Map();
  let pageToken;
  // Bounded pagination: never promise ten if YouTube has fewer matches.
  for (let page=0; page<3 && results.size<10; page++) {
    const data = await api('search', {part:'snippet',type:'video',maxResults:'25',q:`${anime} ${style}`,...(pageToken?{pageToken}:{})});
    for (const item of data.items || []) {
      const id = item.id?.videoId;
      if (!/^[\w-]{11}$/.test(id || '') || results.has(id)) continue;
      const snippet = item.snippet || {};
      results.set(id, {videoId:id,title:snippet.title || 'Без названия',thumbnail:snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '',url:`https://www.youtube.com/watch?v=${id}`,duration:null});
      if(results.size===10) break;
    }
    pageToken=data.nextPageToken;
    if(!pageToken) break;
  }
  let durationUnavailable=false;
  if(results.size) {
    try {
      const details=await api('videos',{part:'contentDetails',id:[...results.keys()].join(',')});
      for(const item of details.items || []) if(results.has(item.id)) results.get(item.id).duration=item.contentDetails?.duration || null;
    } catch { durationUnavailable=true; }
  }
  return {items:[...results.values()],durationUnavailable};
}
export default {
  async fetch(request, env) {
    const origin=request.headers.get('Origin');
    const cors=origin===env.ALLOWED_ORIGIN?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
    const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,...cors}});
    if(origin!==env.ALLOWED_ORIGIN) return reply({error:'Origin not allowed'},403);
    if(request.method!=='GET') return reply({error:'Method not allowed'},405);
    const url=new URL(request.url);
    if(url.pathname!=='/search') return reply({error:'Not found'},404);
    const anime=(url.searchParams.get('anime') || '').trim();
    const style=(url.searchParams.get('style') || 'cinematic edit').trim();
    if(!anime || anime.length>120 || style.length>120) return reply({error:'Введите название и стиль (до 120 символов).'},400);
    if(!env.YOUTUBE_API_KEY) return reply({error:'Сервер поиска не настроен.'},503);
    try { return reply(await searchYouTube(anime,style,env.YOUTUBE_API_KEY)); }
    catch { return reply({error:'YouTube недоступен или квота исчерпана. Попробуйте позже.'},502); }
  }
};
