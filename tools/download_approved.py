#!/usr/bin/env python3
"""Download explicitly licensed Scout selections into a source bin for my_ai_agent.

No automatic rights assumptions, no video download from YouTube, no bypasses.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from urllib.parse import urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler

ALLOWED_HOSTS = {"sakugabooru.com", "www.sakugabooru.com"}
VIDEO_SUFFIXES = {"mp4", "webm", "mov", "m4v"}
MAX_BYTES = 300 * 1024 * 1024


def check_url(url):
    p = urlparse(url)
    if p.scheme != "https" or p.hostname not in ALLOWED_HOSTS or p.username or p.password or p.port not in (None, 443):
        raise ValueError("Only direct HTTPS Sakugabooru media URLs are allowed")
    return url


class SafeRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        check_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def selected_items(manifest, clearance):
    if manifest.get("schema_version") != 1 or manifest.get("source") != "sakugabooru":
        raise ValueError("Unsupported Scout manifest")
    result = []
    seen = set()
    for item in manifest.get("items", []):
        if item.get("status") != "approved" or item.get("selected") is not True:
            continue
        post_id = item.get("id")
        if type(post_id) is not int or post_id <= 0 or post_id in seen:
            raise ValueError("Invalid or duplicate post ID")
        seen.add(post_id)
        permission = clearance.get(str(post_id), {})
        if permission.get("rights") != "allowed" or not str(permission.get("basis", "")).strip():
            raise PermissionError(f"Post {post_id}: explicit license/permission basis required")
        ext = str(item.get("file_ext", "")).lower()
        if ext not in VIDEO_SUFFIXES:
            raise ValueError(f"Post {post_id}: unsupported video format")
        url = check_url(item.get("file_url", ""))
        result.append((post_id, ext, url, permission["basis"].strip()))
    if not result:
        raise ValueError("No approved and selected videos")
    return result


def acquire(manifest, clearance, destination, opener=None, probe=True):
    entries = selected_items(manifest, clearance)  # validate ALL before network
    destination = Path(destination)
    if destination.exists() and any(destination.iterdir()):
        raise FileExistsError("Destination must be empty; existing videos are never overwritten")
    destination.mkdir(parents=True, exist_ok=True)
    opener = opener or build_opener(SafeRedirect())
    records = []
    try:
        for post_id, ext, url, basis in entries:
            final = destination / f"{post_id}.{ext}"
            sha = hashlib.sha256()
            count = 0
            fd, tmp = tempfile.mkstemp(prefix=".scout-", dir=str(destination))
            os.close(fd)
            try:
                with opener.open(Request(url, headers={"User-Agent": "AnimeScoutAuthorizedImporter/1.0"}), timeout=30) as response, open(tmp, "wb") as out:
                    check_url(response.geturl())
                    claimed = response.headers.get("Content-Length")
                    if claimed and int(claimed) > MAX_BYTES:
                        raise ValueError("Media exceeds 300 MiB limit")
                    while True:
                        block = response.read(1024 * 1024)
                        if not block:
                            break
                        count += len(block)
                        if count > MAX_BYTES:
                            raise ValueError("Media exceeds 300 MiB limit")
                        sha.update(block)
                        out.write(block)
                if count == 0:
                    raise ValueError("Empty media file")
                if probe:
                    p = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_type", "-of", "default=noprint_wrappers=1:nokey=1", tmp], capture_output=True, text=True, timeout=30)
                    if p.returncode != 0 or "video" not in p.stdout:
                        raise ValueError(f"Post {post_id}: media is not decodable video")
                os.replace(tmp, final)
            finally:
                if os.path.exists(tmp):
                    os.unlink(tmp)
            records.append({"id": post_id, "filename": final.name, "sha256": sha.hexdigest(), "bytes": count, "rights": "allowed", "basis": basis})
        (destination / "download_report.json").write_text(json.dumps({"sources": records, "downloaded": len(records)}, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        for r in records:
            (destination / r["filename"]).unlink(missing_ok=True)
        raise
    return records


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--manifest", required=True, type=Path)
    p.add_argument("--clearances", required=True, type=Path, help='JSON: {"101":{"rights":"allowed","basis":"License URL / my own footage"}}')
    p.add_argument("--output", required=True, type=Path)
    args = p.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    clearance = json.loads(args.clearances.read_text(encoding="utf-8"))
    rows = acquire(manifest, clearance, args.output)
    print(f"Downloaded {len(rows)} licensed video sources to {args.output}")
    print("Next: upload manifest, clearances, and <post_id>.<ext> files to POST /api/scout/source-bins in my_ai_agent PR #50.")


if __name__ == "__main__":
    main()
