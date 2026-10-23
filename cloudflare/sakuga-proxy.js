// Read-only Sakugabooru JSON relay for Anime Scout.
// Deploy as a Cloudflare Worker; no API key or video downloads.
const ORIGIN = "https://kirillpovecherov-a11y.github.io";
const SOURCE = "https://www.sakugabooru.com/post.json";
const HEADERS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=120"
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: HEADERS });
}
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
    if (request.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405);
    if (url.pathname !== "/posts") return json({ ok: false, error: "not_found", usage: "/posts?tags=berserk&limit=10" }, 404);
    const tags = (url.searchParams.get("tags") || "berserk").trim();
    if (!/^[a-zA-Z0-9_ -]{1,80}$/.test(tags)) return json({ ok: false, error: "invalid_tags" }, 400);
    const limit = Math.min(20, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "10", 10) || 10));
    const upstream = new URL(SOURCE);
    upstream.searchParams.set("tags", tags);
    upstream.searchParams.set("limit", String(limit));
    try {
      const response = await fetch(upstream.toString(), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) return json({ ok: false, error: "upstream_error", upstream_status: response.status }, 502);
      const posts = await response.json();
      if (!Array.isArray(posts)) return json({ ok: false, error: "invalid_upstream_response" }, 502);
      return json({ ok: true, count: posts.length, posts: posts.map(p => ({
        id: p.id, tags: p.tags, file_url: p.file_url, preview_url: p.preview_url,
        file_ext: p.file_ext, width: p.width, height: p.height, file_size: p.file_size
      })) });
    } catch (e) {
      return json({ ok: false, error: "upstream_unavailable" }, 502);
    }
  }
};
