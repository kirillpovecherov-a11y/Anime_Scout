# Anime Scout

Mobile-friendly library on GitHub Pages. Issue #3 adds YouTube Data API v3 search (default **Berserk / cinematic edit**), up to ten unique video IDs, API thumbnails, source links and optional ISO 8601 durations. Results enter the existing local library; approve/reject, JSON backup and manual entry remain available. Repeat searches preserve saved decisions.

## Server setup (separate from GitHub Pages)

GitHub Pages cannot execute the server endpoint. Deploy `worker.mjs` to Cloudflare Workers using Wrangler, with your own account:

1. Enable **YouTube Data API v3** in a Google Cloud project. Create an API key restricted to that API; configure quota limits/alerts. Never commit the key or enter it in the browser.
2. Review `wrangler.toml`; set `ALLOWED_ORIGIN` to the exact origin serving the page (no path or trailing slash).
3. Run `npx wrangler secret put YOUTUBE_API_KEY`, paste the key privately, then `npx wrangler deploy`. These steps require account access and have NOT been run by Codex.
4. In the Pages UI enter the deployed HTTPS endpoint, e.g. `https://anime-scout-api.<account>.workers.dev/search`. Only this public URL is saved locally. No key goes in GitHub Secrets for Pages, HTML, JS, URL parameters or localStorage.
5. On iPhone Safari search Berserk / cinematic edit. Verify thumbnails, links and ten results if available. Approve one, reject another, reload and verify decisions; search again to verify no duplicates. Try a nonexistent title and simulate API quota failure.

The worker sends the key only in the upstream `X-Goog-Api-Key` header. Search uses `search.list` (type=video, 25 per page, at most 3 pages); `videos.list` supplies durations. Fewer than ten matches are reported honestly. If duration lookup fails, results remain usable. API/network failures show a retryable error. No synthetic results or video downloads are implemented.

## Safety and limitations

Approval means editorial selection only; it grants no download or reuse rights. The pre-existing download queue is only a JSON export and still requires a separate rights flag; this application never downloads video. All decisions live in this browser/device; use JSON backup. Clearing storage removes them; private browsing may prevent saving. Search is not scene analysis or a rights verification service. YouTube determines ranking/availability; durations can be absent and are shown in API ISO format.

CORS restricts browser origins, **not non-browser callers**. Before exposing this publicly, configure Cloudflare rate limiting/Access as appropriate and Google API quotas to bound abuse; an unauthenticated endpoint consumes your quota. No deployment, credentials or live YouTube validation are included in this PR. The current execution environment has no YouTube key and does not allow Google API network access.

## Tests

Node.js 22+: `npm test` (no dependencies). Tests stub YouTube HTTP responses and cover deduplication/pagination, ten-result limit, durations, empty results, upstream errors, origin/input/missing-key checks, browser result integration, repeated searches preserving saved approvals, local persistence payloads, error/empty UI messages and existing inline script syntax. They make no external calls. Real iPhone rendering, Google credentials and live results require the manual setup above.
