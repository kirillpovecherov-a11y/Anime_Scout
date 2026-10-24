# Approved-source downloader (MVP bridge)

Anime Scout already searches Sakugabooru and exports a `schema_version: 1` manifest of selected/approved posts. Editorial approval **does not grant usage rights**. This tool downloads only items with an explicit, post-specific `rights: allowed` and a nonempty permission/license `basis`.

## One-command import (Windows, macOS, Linux)

Prerequisite: Python 3.10+ and FFmpeg/ffprobe. Export `anime_scout_sakugabooru_manifest.json` from Anime Scout. Create `clearances.json` **only** for the footage you are authorized to download and reuse:

```json
{"101": {"rights": "allowed", "basis": "My original footage / link to applicable license"}}
```

Then run:

```sh
python tools/download_approved.py --manifest anime_scout_sakugabooru_manifest.json --clearances clearances.json --output downloads/scout-bin-01
```

The output contains `101.mp4` etc. and `download_report.json` with hashes. Limits: direct HTTPS Sakugabooru media, per-file 300 MiB, no redirects to other hosts, mandatory ffprobe validation, no overwriting, no YouTube downloading. The script refuses the entire manifest when any selected item lacks explicit clearance; it never guesses licensing. This tool is intended for explicitly licensed/original footage; typical anime posts will remain unverified.

## Connect to renderer

After merging my_ai_agent PR #50, use `POST /api/scout/source-bins` multipart with `manifest`, `clearances`, and files named `<post_id>.<ext>`. Then upload separately cleared reference audio via `POST /api/assets`, render with `POST /api/scout/source-bins/{bin_id}/renders`, and download completed job. The importer adds file acquisition but **does not yet make the renderer publicly reachable or run it automatically**; that remains a separate step.

Tests (no real downloads): `python -m unittest discover -s tests -p 'test_approved_download.py'`.
