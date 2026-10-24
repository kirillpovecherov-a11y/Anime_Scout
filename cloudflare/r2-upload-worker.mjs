// Cloudflare Worker: authenticated uploads of user-owned/cleared MP4 sources to R2.
// No third-party scraping. R2 binding VIDEO_BUCKET and secret UPLOAD_TOKEN required.
const MAX_BYTES = 100 * 1024 * 1024;
const ORIGIN = "https://kirillpovecherov-a11y.github.io";
const cors = {"Access-Control-Allow-Origin": ORIGIN, "Access-Control-Allow-Methods": "OPTIONS, PUT, GET", "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Source-Rights, X-Rights-Basis", "Vary": "Origin"};
const respond = (body, status=200) => new Response(JSON.stringify(body), {status, headers: {"Content-Type":"application/json", "Cache-Control":"no-store", ...cors}});
function validName(s) { return /^[a-zA-Z0-9_-]{1,60}\.mp4$/.test(s); }
function authorized(req, env) {
  const expected = env.UPLOAD_TOKEN;
  const got = req.headers.get("Authorization");
  return Boolean(expected && got && got === "Bearer " + expected);
}
export default {
  async fetch(request, env) {
    const u = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, {status:204,headers:cors});
    if (!env.VIDEO_BUCKET) return respond({ok:false,error:"r2_binding_missing"},503);
    if (!authorized(request,env)) return respond({ok:false,error:"unauthorized"},401);
    if (u.pathname === "/health" && request.method === "GET") return respond({ok:true,r2:true});
    if (u.pathname !== "/sources" || request.method !== "PUT") return respond({ok:false,error:"not_found"},404);
    const name = u.searchParams.get("name") || "";
    if (!validName(name)) return respond({ok:false,error:"invalid_filename"},400);
    if (request.headers.get("Content-Type")?.split(";")[0] !== "video/mp4") return respond({ok:false,error:"mp4_only"},415);
    if (request.headers.get("X-Source-Rights") !== "allowed" || !(request.headers.get("X-Rights-Basis") || "").trim())
      return respond({ok:false,error:"rights_clearance_required"},403);
    const length = Number(request.headers.get("Content-Length"));
    if (!Number.isSafeInteger(length) || length <= 0 || length > MAX_BYTES) return respond({ok:false,error:"invalid_content_length_or_size"},413);
    const body = await request.arrayBuffer();
    if (body.byteLength !== length || body.byteLength > MAX_BYTES) return respond({ok:false,error:"size_mismatch"},413);
    const bytes = new Uint8Array(body);
    if (bytes.length < 12 || String.fromCharCode(...bytes.slice(4,8)) !== "ftyp")
      return respond({ok:false,error:"not_mp4_container"},415);
    const key = "source-bins/" + name;
    const existing = await env.VIDEO_BUCKET.head(key);
    if (existing) return respond({ok:false,error:"already_exists"},409);
    await env.VIDEO_BUCKET.put(key,body,{httpMetadata:{contentType:"video/mp4"},customMetadata:{rights:"allowed",rightsBasis:request.headers.get("X-Rights-Basis").slice(0,500)}});
    return respond({ok:true,key,bytes:body.byteLength},201);
  }
};
