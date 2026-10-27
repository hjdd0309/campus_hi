import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from fastapi.testclient import TestClient

from backend import main, subject_levels


class SubjectLevelTests(unittest.TestCase):
    def test_parse_accepts_only_ranges_within_four_years(self):
        parsed, failures = subject_levels.parse(["운영체제\t2-3", "", "딥러닝\t3 - 4", "자료구조\t3-1", "알고리즘\t0-2", "컴퓨터구조", "\t1-2"])
        self.assertEqual(parsed, [("운영체제", 2, 3), ("딥러닝", 3, 4)])
        self.assertEqual(len(failures), 4)

    def test_ingest_then_verify_publishes_only_overlapping_ranges(self):
        known = {"운영체제": "운영체제", "딥러닝": "딥러닝", "자료구조": "자료구조"}
        with mock.patch.object(subject_levels, "candidates", return_value=known):
            records = {}
            added, failures = subject_levels.ingest(["운영체제\t2-3", "딥러닝\t3-4", "없는과목\t1-1"], records)
            self.assertEqual((added, len(failures)), (2, 1))
            # 이미 있는 과목은 --force 없이는 바꾸지 않는다.
            self.assertEqual(subject_levels.ingest(["운영체제\t1-1"], records)[0], 0)
            counts, failures = subject_levels.verify(["운영체제\t3-4", "딥러닝\t1-2", "자료구조\t1-1"], records)
        self.assertEqual((counts["verified"], counts["conflict"], len(failures)), (1, 1, 1))
        self.assertEqual(records["운영체제"], {"subject": "운영체제", "from": 2, "to": 3, "status": "verified", "check": {"from": 3, "to": 4}})
        self.assertEqual(records["딥러닝"]["status"], "conflict")

    def test_curriculum_list_sends_only_verified_levels(self):
        first, second = list(main.catalog().programs[("경희대학교", "산업디자인학과")]["curriculum"])[:2]
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "levels.json"
            path.write_text(json.dumps({
                main.compact(first): {"subject": first, "from": 1, "to": 1, "status": "verified"},
                main.compact(second): {"subject": second, "from": 2, "to": 3, "status": "conflict"},
            }, ensure_ascii=False), encoding="utf-8")
            main.subject_levels.cache_clear()
            try:
                with mock.patch.object(main, "LEVELS_PATH", path):
                    levels = TestClient(main.app).post("/api/curriculum_list", json={"school": "경희대학교", "course": "산업디자인학과"}).json()["levels"]
            finally:
                main.subject_levels.cache_clear()
        self.assertEqual(levels, {first: [1, 1]})


if __name__ == "__main__":
    unittest.main()
