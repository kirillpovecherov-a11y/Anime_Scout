#!/usr/bin/env python3
"""Local-only Anime Scout video processing bridge. Python stdlib + ffmpeg."""
import json
import os
import tempfile
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from film_clip_selector import process

HOST="127.0.0.1"
PORT=int(os.environ.get("ANIME_SCOUT_PORT","8765"))
MAX_UPLOAD=100*1024*1024
ROOT=Path(tempfile.gettempdir())/"anime_scout_clips"
ROOT.mkdir(exist_ok=True)

class Handler(BaseHTTPRequestHandler):
    def headers(self,ctype="application/json",status=200,size=None):
        self.send_response(status)
        self.send_header("Content-Type",ctype)
        self.send_header("Access-Control-Allow-Origin","*")
        self.send_header("Access-Control-Allow-Methods","GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers","Content-Type")
        self.send_header("Cache-Control","no-store")
        if size is not None:self.send_header("Content-Length",str(size))
        self.end_headers()
    def reply(self,data,status=200):
        b=json.dumps(data,ensure_ascii=False).encode()
        self.headers(status=status,size=len(b))
        self.wfile.write(b)
    def do_OPTIONS(self):self.headers(status=204)
    def do_GET(self):
        p=urllib.parse.urlparse(self.path).path
        if p=="/health":return self.reply({"ok":True,"service":"Anime Scout local clip processor"})
        if p.startswith("/clips/"):
            parts=p.split("/")
            if len(parts)!=4 or not parts[2].isalnum() or not parts[3].startswith("scene_") or not parts[3].endswith(".mp4"):
                return self.reply({"error":"invalid path"},400)
            f=ROOT/parts[2]/parts[3]
            if not f.is_file():return self.reply({"error":"not found"},404)
            self.headers("video/mp4",size=f.stat().st_size)
            with f.open("rb") as fp:
                while chunk:=fp.read(65536):self.wfile.write(chunk)
            return
        self.reply({"error":"not found"},404)
    def do_POST(self):
        if self.path!="/process":return self.reply({"error":"not found"},404)
        try:
            length=int(self.headers.get("Content-Length","0"))
            if length<=0 or length>MAX_UPLOAD:return self.reply({"error":"file too large or empty (max 100MB)"},413)
            content_type=self.headers.get("Content-Type","")
            if not content_type.startswith("video/") and content_type!="application/octet-stream":
                return self.reply({"error":"send raw video file with video/* content type"},415)
            job=os.urandom(8).hex()
            folder=ROOT/job
            folder.mkdir()
            source=folder/"input.mp4"
            with source.open("wb") as fp:
                remaining=length
                while remaining:
                    data=self.rfile.read(min(65536,remaining))
                    if not data:raise ValueError("incomplete upload")
                    fp.write(data)
                    remaining-=len(data)
            manifest=process(source,folder,count=10,limit=60,quality=480,export=True)
            for scene in manifest["scenes"]:
                scene["url"]=f"http://{HOST}:{PORT}/clips/{job}/{scene['file']}"
            manifest["job"]=job
            self.reply(manifest)
        except Exception as exc:
            self.reply({"error":str(exc)[:500]},422)

if __name__=="__main__":
    print(f"Anime Scout processor: http://{HOST}:{PORT}/health")
    ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()
