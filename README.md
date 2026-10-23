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

## Sakugabooru tag search

The independent Sakugabooru section searches `https://www.sakugabooru.com/post.json?tags=berserk&limit=10` directly from the browser (no key/proxy/backend). Choose a target of 10–20 scenes; this also sets the API result limit. API results can include images, so fewer video cards may appear. Cards retain ID, post/file/preview URLs, file extension, dimensions and size. Only HTTPS Sakugabooru media URLs are accepted. YouTube search and its separate Worker are unchanged.

Select scenes with checkboxes, then approve or reject independently. Rejection removes selection. The target limits selection, but a partial selection may be exported. The summary adds known durations and explicitly counts unknown ones. Search merges by post ID without overwriting decisions. “Все сохранённые” includes previous searches. State is local to this browser under `anime-scout-sakuga-v1`; storage errors are shown. This state is separate from the older library JSON backup.

Press “Определить длительность” on a card to request HTML5 `preload=metadata`. Playback is never started. Finite positive metadata duration is saved; media error, access/CORS failure, unsupported codec or 12-second timeout gives “не определено” without blocking other cards. Media is detached afterwards. Browsers control metadata loading: preload is a hint, **not a guarantee of range-only transfer**. There is no full-video fetch/blob, media save or automatic metadata request. If avoiding any possible full transfer is essential, do not press the metadata button. A generic media error cannot reliably distinguish CORS from codec/network/access errors.

The JSON manifest contains only selected **and approved** cards, source metadata, measured duration (or null), totals, `rights: unverified`, and `download_requested: false`. Export is not permission to download, nor a download job. No video downloading or integrations with editors/storage are added.

If API CORS/network/access fails, the UI reports it and keeps saved cards; no proxy bypass or retries are performed. API access confirmed on an iPhone does not by itself confirm cross-origin fetch from GitHub Pages. Live Sakugabooru API/media access has not been verified in this restricted environment.

Additional tests: `node test/sakuga.test.mjs`. Browser smoke tests: install Python Playwright in a development environment and run `python test/mobile_sakuga.py` with Chromium available (or `CHROMIUM_PATH`). These tests use fixtures and intercept all remote traffic; no source video is transferred. Test actual iPhone Safari separately for API CORS, preview availability and real metadata before claiming live support.

Validation in this session: 4 Sakugabooru unit tests and 5 existing YouTube tests passed. Chromium responsive smoke execution was attempted but the sandbox blocked socket operations (Operation not permitted); a retry with additional permissions was interrupted. The mobile test is provided but has not been confirmed passing. Actual iPhone Safari rendering and live source access remain unverified.
