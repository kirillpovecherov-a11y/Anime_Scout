# Anime Scout → Cloudflare R2 (staging)

This is an **authenticated R2 ingestion endpoint**, not yet an automated source downloader or renderer integration. It accepts MP4 files you own or have permission to download/reuse. It does **not** fetch YouTube/Sakugabooru media on the server or infer rights from an editorial approval.

## Setup (Cloudflare account required)

1. Create an R2 bucket named `anime-scout-sources` in your Cloudflare account. R2 must be activated for the account; billing/payment requirements may apply.
2. From repository root deploy using `npx wrangler deploy --config cloudflare/wrangler.r2.toml` (Wrangler may need the entrypoint path adjusted to your deployment working directory).
3. Set a secret with `npx wrangler secret put UPLOAD_TOKEN --config cloudflare/wrangler.r2.toml` and enter a strong random token. Never commit or put it into public GitHub Pages JavaScript.
4. Upload **only an authorized MP4** from a trusted client:

```sh
curl -X PUT "https://YOUR-WORKER.workers.dev/sources?name=clip_001.mp4" \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN" \
  -H "Content-Type: video/mp4" \
  -H "X-Source-Rights: allowed" \
  -H "X-Rights-Basis: My original footage" \
  --data-binary "@clip_001.mp4"
```

A successful response returns an R2 key such as `source-bins/clip_001.mp4`. Keys are private; there is deliberately **no public GET/download endpoint**. The renderer will need a separate authenticated R2 reader or short-lived signed URL; do not make the bucket public.

## Security and limits

This is a staging MVP. It uses a bearer token (not suitable for inclusion in public iPhone web-app source), checks size, MP4 container signature and per-file rights declaration, and refuses overwrite. It does not verify licenses independently or fully decode media. The entire file is buffered in Worker memory, so keep uploads small; 100 MiB is a hard limit, not a recommended size. Production should use signed direct-to-R2 uploads for large files, robust authentication, hash checking, rate limiting, per-user permissions and renderer ingestion. **Do not deploy this Worker as a public unauthenticated endpoint.**

No Cloudflare account configuration or deployment is performed by this PR. Test with one licensed short MP4 before using batches. The existing Sakugabooru search proxy remains unchanged.

## Integration milestones

- [x] R2 upload endpoint source code and binding configuration
- [ ] Create R2 bucket and deploy Worker in Cloudflare account
- [ ] Verify upload of one owned MP4 from iPhone/trusted client
- [ ] Implement short-lived upload grants for the iPhone UI (never embed server token)
- [ ] Implement authorized source download and rights verification
- [ ] Add renderer R2 reader and end-to-end 5-file acceptance test
- [ ] Finally enable unattended runs
