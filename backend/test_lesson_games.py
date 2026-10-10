import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from fastapi.testclient import TestClient

from backend import lesson_games, main

# 형식 검사용 예시. 서비스 데이터가 아니다.
BLANK = {
    "type": "blank", "course_name": "데이터베이스", "title": "데이터베이스 기본 용어",
    "items": [
        {"text": "표의 한 행을 ___이라고 한다.", "choices": ["튜플", "속성", "도메인"], "answer": 0, "explanation": "행은 튜플, 열은 속성이다."},
        {"text": "행을 구별하는 열을 ___라고 한다.", "choices": ["외래키", "기본키", "인덱스"], "answer": 1, "explanation": "기본키는 행을 유일하게 구별한다."},
        {"text": "자료를 조회하는 SQL 명령은 ___이다.", "choices": ["INSERT", "DELETE", "SELECT"], "answer": 2, "explanation": "SELECT로 자료를 조회한다."},
    ],
    "explanation": "관계형 데이터베이스는 자료를 표로 저장한다.",
}
OX = {
    "type": "ox", "course_name": "컴퓨터구조", "title": "컴퓨터 구조 OX",
    "items": [{"text": f"문장 {number}", "answer": number % 2 == 0, "explanation": "해설"} for number in range(5)],
    "explanation": "전체 해설",
}
ORDER = {
    "type": "order", "course_name": "공중보건학", "title": "순서 맞추기", "prompt": "먼저 일어나는 일부터 놓아요.",
    "items": [{"text": step} for step in ("첫째", "둘째", "셋째", "넷째")],
    "explanation": "전체 해설",
}
MATCH = {
    "type": "match", "course_name": "사회복지행정론", "title": "짝 맞추기", "prompt": "용어와 설명을 짝지어요.",
    "items": [{"left": f"용어{number}", "right": f"설명{number}"} for number in range(4)],
    "explanation": "전체 해설",
}
SORT = {
    "type": "sort", "course_name": "노인복지론", "title": "분류하기", "prompt": "알맞은 쪽으로 나눠요.",
    "categories": ["가", "나"],
    "items": [{"text": f"항목{number}", "category": number % 2} for number in range(6)],
    "explanation": "전체 해설",
}
ALL = [BLANK, OX, ORDER, MATCH, SORT]


def changed(game, **fields):
    return {**json.loads(json.dumps(game)), **fields}


def lines(*games):
    return [json.dumps(game, ensure_ascii=False) for game in games]


class ValidateTests(unittest.TestCase):
    def test_valid_examples_pass_and_are_trimmed(self):
        for game in ALL:
            cleaned = lesson_games.validate(changed(game, title=f"  {game['title']} ", extra="버려짐"))
            self.assertEqual(cleaned, game)

    def bad(self, game, message):
        with self.assertRaises(ValueError) as caught:
            lesson_games.validate(game)
        self.assertIn(message, str(caught.exception))

    def test_common_fields(self):
        self.bad([], "객체")
        self.bad(changed(BLANK, type="scenario"), "유형")
        self.bad(changed(BLANK, title="가" * 21), "상한 20자")
        self.bad(changed(BLANK, title="  "), "비어")
        self.bad(changed(BLANK, explanation="가" * 121), "상한 120자")
        self.bad(changed(BLANK, explanation=3), "explanation")
        self.bad(changed(BLANK, items="x"), "items")
        self.bad(changed(BLANK, items=[1, 2, 3]), "items")

    def test_blank_rules(self):
        def item(**fields):
            return changed(BLANK, items=[{**BLANK["items"][0], **fields}] + BLANK["items"][1:])
        self.bad(changed(BLANK, items=BLANK["items"][:2]), "3개")
        self.bad(item(text="빈칸이 없다."), "빈칸")
        self.bad(item(text="___ 와 ___"), "빈칸")
        self.bad(item(text="____ 네 칸"), "빈칸")
        self.bad(item(text="가" * 58 + "___"), "상한 60자")
        self.bad(item(choices=["튜플", "속성"]), "3개")
        self.bad(item(choices=["튜플", "튜 플", "속성"]), "두 번")
        self.bad(item(choices=["가" * 13, "속성", "도메인"]), "상한 12자")
        self.bad(item(answer=3), "번호")
        self.bad(item(answer=True), "번호")
        self.bad(item(explanation="가" * 81), "상한 80자")

    def test_ox_rules(self):
        self.bad(changed(OX, items=OX["items"][:4]), "5개")
        self.bad(changed(OX, items=[{**item, "answer": True} for item in OX["items"]]), "O와 X")
        self.bad(changed(OX, items=[{**item, "answer": 1} for item in OX["items"]]), "true")
        self.bad(changed(OX, items=[{**item, "text": "가" * 61} for item in OX["items"]]), "상한 60자")

    def test_order_match_sort_rules(self):
        self.bad(changed(ORDER, items=ORDER["items"][:3]), "4~5개")
        self.bad(changed(ORDER, prompt=""), "prompt")
        self.bad(changed(ORDER, items=[{"text": "같음"}] * 4), "두 번")
        self.bad(changed(ORDER, items=[{"text": "가" * 25}] + ORDER["items"][1:]), "상한 24자")
        self.bad(changed(MATCH, items=MATCH["items"][:3]), "4~6개")
        self.bad(changed(MATCH, items=[{"left": "가" * 11, "right": "설명"}] + MATCH["items"][1:]), "상한 10자")
        self.bad(changed(MATCH, items=[{**item, "right": "같은 설명"} for item in MATCH["items"]]), "두 번")
        self.bad(changed(SORT, categories=["가"]), "2~3개")
        self.bad(changed(SORT, categories=["가", "나", "다"]), "2개 이상")
        self.bad(changed(SORT, items=[{**item, "category": 2} for item in SORT["items"]]), "번호")
        self.bad(changed(SORT, items=SORT["items"][:5]), "6~8개")
        self.bad(changed(SORT, items=[{"text": "가" * 15, "category": 0}] + SORT["items"][1:]), "상한 14자")


class QuizTests(unittest.TestCase):
    def test_quiz_hides_answers_and_expected_matches_the_game(self):
        for game in ALL:
            quiz, expected = lesson_games.quiz_of(game)
            shown = json.dumps(quiz, ensure_ascii=False)
            self.assertNotIn("answer", shown)
            self.assertNotIn("해설", shown)
            self.assertEqual(quiz["subject"], game["course_name"])
            self.assertEqual((quiz, expected), lesson_games.quiz_of(game))
        quiz, expected = lesson_games.quiz_of(BLANK)
        self.assertEqual([item["choices"][number] for item, number in zip(quiz["items"], expected)], ["튜플", "기본키", "SELECT"])
        self.assertEqual([sorted(item["choices"]) for item in quiz["items"]], [sorted(item["choices"]) for item in BLANK["items"]])
        self.assertEqual(lesson_games.quiz_of(OX)[1], [True, False, True, False, True])
        quiz, expected = lesson_games.quiz_of(ORDER)
        self.assertEqual([quiz["items"][number] for number in expected], ["첫째", "둘째", "셋째", "넷째"])
        quiz, expected = lesson_games.quiz_of(MATCH)
        self.assertEqual([quiz["right"][number] for number in expected], [item["right"] for item in MATCH["items"]])
        self.assertEqual(quiz["left"], [item["left"] for item in MATCH["items"]])
        quiz, expected = lesson_games.quiz_of(SORT)
        self.assertNotIn("category", json.dumps(quiz["items"]))
        answers = {item["text"]: item["category"] for item in SORT["items"]}
        self.assertEqual(expected, [answers[name] for name in quiz["items"]])


class StoreTests(unittest.TestCase):
    def test_ingest_validates_skips_existing_and_reports_failures(self):
        records = {}
        added, skipped, failures = lesson_games.ingest(
            lines(BLANK, changed(OX, title=""), changed(ORDER, course_name="세상에없는과목-999"), {"course_name": "현장실습", "unsuitable": "실습 기관에서 하는 활동이라 문제로 만들 내용이 없음"}) + ["", "{깨진 줄"],
            records, "test-model", stamp="2026-10-10T12:00:00+09:00",
        )
        self.assertEqual((added, skipped), (2, 0))
        self.assertEqual([number for number, reason in failures], [2, 3, 6])
        self.assertIn("title", failures[0][1])
        self.assertIn("교과목 목록에 없는", failures[1][1])
        self.assertEqual(records["데이터베이스"], {**BLANK, "generated_at": "2026-10-10T12:00:00+09:00", "model": "test-model", "status": "review"})
        self.assertEqual(records["현장실습"]["status"], "unsuitable")
        again = lesson_games.ingest(lines(changed(BLANK, title="바뀐 제목")), records, "test-model")
        self.assertEqual(again, (0, 1, []))
        self.assertEqual(records["데이터베이스"]["title"], BLANK["title"])
        lesson_games.ingest(lines(changed(BLANK, title="바뀐 제목")), records, "test-model", force=True)
        self.assertEqual(records["데이터베이스"]["title"], "바뀐 제목")

    def test_verify_ingest_publishes_only_matching_answers_without_issues(self):
        records = {}
        lesson_games.ingest(lines(*ALL), records, "test-model")
        self.assertEqual(len(lesson_games.pending_quizzes(records)), 5)
        self.assertEqual(len(lesson_games.pending_quizzes(records, 2)), 2)
        solved = [
            {"subject": BLANK["course_name"], "answers": lesson_games.quiz_of(BLANK)[1], "issues": []},
            {"subject": OX["course_name"], "answers": [True] * 5, "issues": []},
            {"subject": ORDER["course_name"], "answers": lesson_games.quiz_of(ORDER)[1], "issues": ["둘째와 셋째의 순서가 모호함"]},
            {"subject": "세상에없는과목-999", "answers": [], "issues": []},
            {"subject": MATCH["course_name"], "answers": "x"},
        ]
        verified, held, failures = lesson_games.verify_ingest(lines(*solved), records, stamp="2026-10-10T13:00:00+09:00")
        self.assertEqual((verified, held), (1, 2))
        self.assertEqual([number for number, reason in failures], [4, 5])
        self.assertEqual(records["데이터베이스"]["status"], "verified")
        self.assertEqual(records["데이터베이스"]["check"], {"matched": True, "issues": [], "checked_at": "2026-10-10T13:00:00+09:00"})
        self.assertEqual(records["컴퓨터구조"]["status"], "review")
        self.assertFalse(records["컴퓨터구조"]["check"]["matched"])
        self.assertEqual(records["공중보건학"]["status"], "review")
        self.assertEqual(records["공중보건학"]["check"]["issues"], ["둘째와 셋째의 순서가 모호함"])
        # 한 번 풀이를 거친 문제는 다시 내보내지 않고, 이미 공개된 문제는 풀이를 다시 받지 않는다.
        self.assertEqual([quiz["subject"] for quiz in lesson_games.pending_quizzes(records)], [SORT["course_name"], MATCH["course_name"]])
        self.assertEqual(lesson_games.verify_ingest(lines(solved[0]), records)[2][0][0], 1)

    def test_targets_cover_every_program_and_replace_excluded_subjects(self):
        info = lesson_games.subjects()
        needed = lesson_games.targets({})
        self.assertGreater(len(needed), 3000)
        self.assertLess(len(needed), 10000)
        self.assertEqual(needed, sorted(needed, key=lambda key: (-info[key]["programs"], key)))
        self.assertFalse(any(lesson_games.DEDICATED.search(key) for key in needed))
        first = needed[0]
        self.assertEqual(set(info[first]), {"subject", "course", "category", "programs"})
        chosen = set(needed)
        for program in main.catalog().programs.values():
            keys = {key for key in map(main.compact, program["curriculum"]) if not lesson_games.DEDICATED.search(key)}
            self.assertGreaterEqual(len(keys & chosen), min(len(keys), lesson_games.slots(program["duration"])))
        for status in ("unsuitable", "failed"):
            self.assertNotIn(first, lesson_games.targets({first: {"status": status}}))
        self.assertGreaterEqual(len(lesson_games.targets({first: {"status": "unsuitable"}})), len(needed) - 1)
        self.assertIn(first, lesson_games.targets({first: {"status": "review"}}))
        result = lesson_games.summary({first: {"status": "verified", "type": "ox"}, needed[1]: {"status": "unsuitable"}})
        self.assertEqual(result["statuses"], {"verified": 1, "unsuitable": 1})
        self.assertEqual(result["verified_types"], {"ox": 1})
        self.assertEqual(result["remaining"], result["targets"] - 1)

    def test_slots_follow_course_length(self):
        self.assertEqual([lesson_games.slots(duration) for duration in ("4년", "2년", "2.5년", "1년(전공심화)", "6년", "9년", "")], [3, 1, 2, 0, 5, 5, 3])

    def test_save_and_load_round_trip(self):
        records = {}
        lesson_games.ingest(lines(*ALL), records, "test-model")
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "games.jsonl"
            self.assertEqual(lesson_games.load(path), {})
            lesson_games.save(records, path)
            self.assertEqual(lesson_games.load(path), records)
            self.assertEqual(len(path.read_text(encoding="utf-8").splitlines()), 5)


class ApiTests(unittest.TestCase):
    def setUp(self):
        records = {}
        lesson_games.ingest(lines(BLANK, OX), records, "test-model", stamp="2026-10-10T12:00:00+09:00")
        lesson_games.verify_ingest(lines({"subject": BLANK["course_name"], "answers": lesson_games.quiz_of(BLANK)[1], "issues": []}), records)
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        path = Path(folder.name) / "games.jsonl"
        lesson_games.save(records, path)
        patcher = mock.patch("backend.main.GAMES_PATH", path)
        patcher.start()
        main.lesson_games.cache_clear()
        self.addCleanup(main.lesson_games.cache_clear)
        self.addCleanup(patcher.stop)
        self.client = TestClient(main.app)

    def test_only_verified_games_are_served(self):
        response = self.client.post("/api/lesson_game", json={"subject": " 데이터 베이스 "})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"game": {**BLANK, "generated_at": "2026-10-10T12:00:00+09:00", "model": "test-model", "status": "verified"}})
        for subject in ("컴퓨터구조", "세상에없는과목-999"):
            missing = self.client.post("/api/lesson_game", json={"subject": subject})
            self.assertEqual(missing.status_code, 404)
            self.assertIsInstance(missing.json()["detail"], str)
        for body in ({}, {"subject": ""}, {"subject": 3}, {"subject": "가" * 201}):
            self.assertEqual(self.client.post("/api/lesson_game", json=body).status_code, 400)

    def test_curriculum_lists_subjects_that_have_games(self):
        school, course = next((school, course) for (school, course), program in main.catalog().programs.items() if "데이터베이스" in program["curriculum"] and "컴퓨터구조" in program["curriculum"])
        self.assertEqual(self.client.post("/api/curriculum_list", json={"school": school, "course": course}).json()["games"], {"데이터베이스": "blank"})

    def test_missing_file_means_no_games(self):
        with mock.patch("backend.main.GAMES_PATH", Path("없는-파일.jsonl")):
            main.lesson_games.cache_clear()
            self.assertEqual(main.lesson_games(), {})
            self.assertEqual(self.client.post("/api/lesson_game", json={"subject": "데이터베이스"}).status_code, 404)
        main.lesson_games.cache_clear()


if __name__ == "__main__":
    unittest.main()
