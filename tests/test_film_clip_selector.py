import importlib.util
import pathlib
import unittest
from unittest.mock import patch

path=pathlib.Path(__file__).resolve().parents[1]/"tools"/"film_clip_selector.py"
spec=importlib.util.spec_from_file_location("film_clip_selector",path)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class FilmClipTests(unittest.TestCase):
    def test_ten_candidates(self):
        edges=list(range(0,61,3))
        shots=mod.choose(edges,count=10)
        self.assertEqual(len(shots),10)
        self.assertTrue(all(end-start<=4 for start,end in shots))
    def test_fewer_than_ten(self):
        self.assertEqual(len(mod.choose([0,2,4,6],count=10)),3)
    def test_reject_long_source(self):
        with patch.object(mod,"command") as fake:
            fake.return_value.stdout='{"format":{"duration":"61"},"streams":[{"codec_type":"video","width":640,"height":480}]}'
            with self.assertRaisesRegex(ValueError,"maximum"):
                mod.analyze("dummy.mp4",limit=60)

if __name__=="__main__":unittest.main()
