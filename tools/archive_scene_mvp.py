#!/usr/bin/env python3
"""Local MVP: detect shots and export up to 10 clips from a rights-cleared video.
Requires ffmpeg and ffprobe on PATH. Does not download or scrape Archive.org.
"""
import argparse
import json
import re
import subprocess
from pathlib import Path

def run(cmd):
    return subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

def probe(path):
    data = json.loads(run(["ffprobe", "-v", "error", "-show_entries",
        "format=duration:stream=width,height,codec_type", "-of", "json", str(path)]).stdout)
    video = next(s for s in data["streams"] if s.get("codec_type") == "video")
    return float(data["format"]["duration"]), video["width"], video["height"]

def boundaries(path, duration, threshold):
    # Decode reduced frames for low-memory scene detection.
    p = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-an",
        "-vf", f"scale=320:-2,select='gt(scene,{threshold})',showinfo",
        "-vsync", "vfr", "-f", "null", "-"], capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError(p.stderr[-1000:])
    times = [float(x) for x in re.findall(r"pts_time:\s*([0-9.]+)", p.stderr)]
    return sorted(set([0.0] + [t for t in times if 0 < t < duration] + [duration]))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video", help="Local MP4/MKV you have permission to edit")
    ap.add_argument("--out", default="scene_candidates")
    ap.add_argument("--count", type=int, default=10)
    ap.add_argument("--min-seconds", type=float, default=2.0)
    ap.add_argument("--max-seconds", type=float, default=8.0)
    ap.add_argument("--threshold", type=float, default=0.32)
    ap.add_argument("--export", action="store_true", help="Render silent MP4 clips")
    a = ap.parse_args()
    src = Path(a.video).resolve()
    if not src.is_file():
        ap.error("Input video not found")
    duration, width, height = probe(src)
    edges = boundaries(src, duration, a.threshold)
    candidates = []
    for start, end in zip(edges, edges[1:]):
        length = end - start
        if length >= a.min_seconds:
            clip_end = min(end, start + a.max_seconds)
            candidates.append({"start": round(start, 3), "end": round(clip_end, 3),
                               "duration": round(clip_end - start, 3)})
    # Prefer longer uninterrupted shots; deterministic order.
    chosen = sorted(candidates, key=lambda x: (-x["duration"], x["start"]))[:max(0, a.count)]
    chosen.sort(key=lambda x: x["start"])
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    for i, shot in enumerate(chosen, 1):
        shot["file"] = f"scene_{i:02d}.mp4" if a.export else None
        if a.export:
            run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", str(shot["start"]),
                 "-i", str(src), "-t", str(shot["duration"]), "-an",
                 "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
                 "-pix_fmt", "yuv420p", str(out / shot["file"])])
    manifest = {"source": str(src), "source_resolution": [width, height],
                "source_duration": duration, "rights": "verify-before-use",
                "selection_method": "scene-boundary-and-duration-only",
                "warning": "Not semantic recognition; may include reviewers, logos, or unrelated shots.",
                "scenes": chosen}
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Found {len(candidates)} candidate shots; selected {len(chosen)}. Output: {out}")

if __name__ == "__main__":
    main()
