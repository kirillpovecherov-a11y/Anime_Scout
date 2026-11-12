#!/usr/bin/env python3
"""Local, permission-cleared video -> up to 10 silent clips and JSON manifest.
Requires ffmpeg/ffprobe on PATH. No scraping or automatic downloads.
"""
import argparse
import json
import re
import subprocess
from pathlib import Path

def command(args):
    return subprocess.run(args, capture_output=True, text=True, check=True)

def analyze(source, limit=60, threshold=.28):
    info=json.loads(command(["ffprobe","-v","error","-show_entries","format=duration:stream=codec_type,width,height","-of","json",str(source)]).stdout)
    duration=float(info["format"]["duration"])
    video=next(s for s in info["streams"] if s["codec_type"]=="video")
    if duration>limit+.05:
        raise ValueError(f"Source is {duration:.1f}s; maximum is {limit}s")
    result=command(["ffmpeg","-hide_banner","-i",str(source),"-an","-vf",f"scale=320:-2,select='gt(scene,{threshold})',showinfo","-vsync","vfr","-f","null","-"])
    points=[float(x) for x in re.findall(r"pts_time:\s*([\d.]+)",result.stderr)]
    edges=sorted(set([0.0,duration]+[t for t in points if 0<t<duration]))
    return duration,video,edges

def choose(edges,count=10,min_len=.5,max_len=4):
    candidates=[]
    for start,end in zip(edges,edges[1:]):
        if end-start>=min_len:
            candidates.append((start,min(end,start+max_len)))
    # Rank by usable uninterrupted length; chronological final order.
    selected=sorted(candidates,key=lambda s:(-(s[1]-s[0]),s[0]))[:count]
    return sorted(selected)

def process(source,out,count=10,limit=60,quality=480,export=True):
    duration,video,edges=analyze(source,limit)
    shots=choose(edges,count)
    out.mkdir(parents=True,exist_ok=True)
    scenes=[]
    for i,(start,end) in enumerate(shots,1):
        name=f"scene_{i:02d}.mp4"
        if export:
            command(["ffmpeg","-y","-hide_banner","-loglevel","error","-ss",str(start),"-i",str(source),"-t",str(end-start),"-an","-vf",f"scale=-2:min({quality},ih):flags=lanczos","-c:v","libx264","-preset","veryfast","-crf","22","-pix_fmt","yuv420p",str(out/name)])
        scenes.append({"start":round(start,3),"end":round(end,3),"duration":round(end-start,3),"file":name if export else None})
    manifest={"source":str(source),"source_duration":duration,"source_resolution":[video["width"],video["height"]],"max_source_seconds":limit,"preferred_height":quality,"requested_count":count,"selected_count":len(scenes),"selection":"scene changes + uninterrupted duration (not semantic recognition)","rights":"verify-before-use","scenes":scenes}
    (out/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
    return manifest

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("source",type=Path)
    parser.add_argument("--out",type=Path,default=Path("film_clips"))
    parser.add_argument("--count",type=int,default=10)
    parser.add_argument("--max-source-seconds",type=float,default=60)
    parser.add_argument("--quality",type=int,default=480,choices=[480,720,1080])
    parser.add_argument("--manifest-only",action="store_true")
    args=parser.parse_args()
    if not args.source.is_file():parser.error("Source file not found")
    result=process(args.source,args.out,args.count,args.max_source_seconds,args.quality,not args.manifest_only)
    print(f"Selected {result['selected_count']}/{args.count} scenes; manifest: {args.out/'manifest.json'}")

if __name__=="__main__":main()
