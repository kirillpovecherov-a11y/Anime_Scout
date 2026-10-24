import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("downloader", Path(__file__).parents[1] / "tools" / "download_approved.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def fixture(url="https://www.sakugabooru.com/data/a.mp4"):
    return {"schema_version": 1, "source": "sakugabooru", "items": [
        {"id": 101, "status": "approved", "selected": True, "file_ext": "mp4", "file_url": url}
    ]}


class Response:
    headers = {"Content-Length": "4"}
    def __init__(self, url):
        self.url = url
        self.body = io.BytesIO(b"film")
    def geturl(self):
        return self.url
    def read(self, n):
        return self.body.read(n)
    def __enter__(self):
        return self
    def __exit__(self, *_):
        pass


class Opener:
    def __init__(self, url):
        self.url = url
    def open(self, req, timeout):
        return Response(self.url)


class ApprovedDownloadTest(unittest.TestCase):
    def test_requires_documented_rights(self):
        with self.assertRaises(PermissionError):
            mod.selected_items(fixture(), {})
        with self.assertRaises(PermissionError):
            mod.selected_items(fixture(), {"101": {"rights": "allowed"}})

    def test_only_approved_selected(self):
        item = fixture()
        item["items"][0]["status"] = "rejected"
        with self.assertRaises(ValueError):
            mod.selected_items(item, {"101": {"rights": "allowed", "basis": "mine"}})

    def test_rejects_redirect_to_other_host(self):
        with self.assertRaises(ValueError):
            mod.check_url("https://evil.example/a.mp4")
        with self.assertRaises(ValueError):
            mod.check_url("http://www.sakugabooru.com/video.mp4")
        with self.assertRaises(ValueError):
            mod.check_url("https://www.sakugabooru.com:9443/video.mp4")

    def test_rejects_duplicate_ids(self):
        item = fixture()
        item["items"].append(dict(item["items"][0]))
        with self.assertRaises(ValueError):
            mod.selected_items(item, {"101": {"rights": "allowed", "basis": "mine"}})

    def test_download_and_sha256(self):
        import hashlib
        with tempfile.TemporaryDirectory() as temp:
            rows = mod.acquire(fixture(), {"101": {"rights": "allowed", "basis": "my own video"}}, temp, opener=Opener(fixture()["items"][0]["file_url"]), probe=False)
            self.assertEqual((Path(temp) / "101.mp4").read_bytes(), b"film")
            self.assertEqual(rows[0]["sha256"], hashlib.sha256(b"film").hexdigest())
            self.assertEqual(json.loads((Path(temp) / "download_report.json").read_text())["downloaded"], 1)
            with self.assertRaises(FileExistsError):
                mod.acquire(fixture(), {"101": {"rights": "allowed", "basis": "mine"}}, temp, opener=Opener(fixture()["items"][0]["file_url"]), probe=False)

    def test_redirected_response_origin_is_validated(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaises(ValueError):
                mod.acquire(fixture(), {"101": {"rights": "allowed", "basis": "mine"}}, temp, opener=Opener("https://evil.example/file.mp4"), probe=False)
            self.assertFalse(list(Path(temp).glob("*.mp4")))


if __name__ == "__main__":
    unittest.main()
