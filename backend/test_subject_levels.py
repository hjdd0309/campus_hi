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


class LessonPickTests(unittest.TestCase):
    def test_source_typo_is_fixed_so_games_connect(self):
        curriculum = main.catalog().programs[("경희대학교", "컴퓨터공학부")]["curriculum"]
        self.assertIn("객체지향프로그래밍", curriculum)
        self.assertNotIn("객체지항프로그래밍", curriculum)

    def test_curriculum_list_sends_picks_that_exist_in_the_curriculum(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "picks.json"
            path.write_text(json.dumps([
                {"school": "경희대학교", "course": "컴퓨터공학부 컴퓨터공학과", "years": {"1": ["없는과목", "객체지향프로그래밍"], "2": ["없는과목"], "9": ["데이터베이스"], "3": "데이터베이스"}},
                {"school": "경희대학교", "course": "컴퓨터공학부 인공지능학과", "years": {"1": [3]}},
                {"school": 1, "course": "컴퓨터공학부", "years": {"1": ["데이터베이스"]}},
            ], ensure_ascii=False), encoding="utf-8")
            main.lesson_picks.cache_clear()
            try:
                with mock.patch.object(main, "PICKS_PATH", path):
                    client = TestClient(main.app)
                    picks = {course: client.post("/api/curriculum_list", json={"school": "경희대학교", "course": course}).json()["picks"]
                             for course in ("컴퓨터공학부 컴퓨터공학과", "컴퓨터공학부 인공지능학과", "컴퓨터공학부")}
            finally:
                main.lesson_picks.cache_clear()
        self.assertEqual(picks, {"컴퓨터공학부 컴퓨터공학과": {"1": ["객체지향프로그래밍"]}, "컴퓨터공학부 인공지능학과": {}, "컴퓨터공학부": {}})

    def test_kyung_hee_computer_departments_start_with_object_oriented_programming(self):
        client = TestClient(main.app)
        for course in ("컴퓨터공학부 컴퓨터공학과", "컴퓨터공학부", "컴퓨터공학부 인공지능학과"):
            picks = client.post("/api/curriculum_list", json={"school": "경희대학교", "course": course}).json()["picks"]
            self.assertEqual(picks["1"], ["객체지향프로그래밍"], course)
            self.assertIn(picks["2"][0], ("데이터베이스", "컴퓨터구조"), course)


if __name__ == "__main__":
    unittest.main()
