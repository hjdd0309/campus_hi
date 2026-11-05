import csv
from collections import Counter
import json
import re
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from backend import course_activity as ca

SCHOOL, COURSE = "경희대학교", "컴퓨터공학부 컴퓨터공학과"
QUOTE_A = "Implement a binary search tree with insert and delete operations."
QUOTE_B = "이번 과제는 연결 리스트로 스택과 큐를 직접 구현하는 것이다."
PAGES = {
    "https://github.com/a/ds": [f"README\n{QUOTE_A}\nmore text"],
    "https://blog.example.com/x": [],  # 검색 결과에 주소만 나오고 본문은 직접 받아야 하는 페이지
    "https://blog.example.com/y": ["전혀 다른 내용만 있는 페이지입니다."],
}
FETCHED = {"https://blog.example.com/x": f"<글> {QUOTE_B.replace(' ', '  ')} 끝", "https://blog.example.com/y": "직접 받아도 다른 내용만 있습니다."}
SCHOOLS = {"https://github.com/a/ds": "가대학교", "https://blog.example.com/x": "나대학교"}


def usage(cost=0.01):
    return {"model": "claude-opus-5-5", "input_tokens": 1000, "output_tokens": 100, "web_search_requests": 1, "web_fetch_requests": 0, "cost_usd": cost, "price_assumed": False}


def item(url, quote, kind="코드 작성·디버깅", source="학생결과물", school=""):
    return {"내용": f"{url} 활동", "유형": [kind], "학교": school, "근거_URL": url, "근거_문장": quote, "출처_종류": source}


SEARCH_RESULT = {
    "과목명": "자료구조",
    "활동_유형": ["코드 작성·디버깅"],
    "실제_활동": [
        item("https://github.com/a/ds", QUOTE_A),
        item("https://blog.example.com/x", QUOTE_B),
        item("https://made.up/page", "검색에서 나온 적 없는 주소의 문장입니다."),
        item("https://github.com/a/ds", ""),
        item("https://everytime.kr/lecture/1", "에브리타임 강의평에 적힌 문장입니다."),
        item("https://blog.example.com/y", "이 문장은 페이지 어디에도 없습니다."),
    ],
    "대표_과제": "트리·리스트 구현",
    "시험_형태": "필기 시험",
    "신뢰도": "높음",
    "근거_부족_항목": [],
}


class Fake:
    def __init__(self, stage1_level="낮음", search_error=None, judge_reject=()):
        self.calls = []
        self.stage1_level = stage1_level
        self.search_error = search_error
        self.judge_reject = set(judge_reject)

    def classify(self, prompt):
        self.calls.append("stage1")
        evidence = []
        if "[파일: 자료구조.txt]" in prompt:
            evidence = [{"내용": "트리 구현 과제", "유형": ["코드 작성·디버깅"], "파일": "자료구조.txt", "근거_문장": "과제 1: 이진 탐색 트리를 구현한다."}]
        return {"활동_유형": ["코드 작성·디버깅", "없는 유형"], "신뢰도": self.stage1_level, "판단_근거": "과목명", "근거": evidence}, usage()

    def search(self, prompt):
        self.calls.append("stage2")
        if self.search_error:
            raise self.search_error
        return json.loads(json.dumps(SEARCH_RESULT)), usage(), {url: list(texts) for url, texts in PAGES.items()}

    def judge(self, prompt):
        self.calls.append("verify")
        numbers = [int(value) for value in re.findall(r'<항목 번호="(\d+)">', prompt)]
        urls = re.findall(r"^출처: (\S+)$", prompt, re.M)
        return {"results": [
            {"번호": number, "일치": url not in self.judge_reject, "출처_종류": "학생결과물", "학교": SCHOOLS.get(url, ""), "이유": "근거와 맞음"}
            for number, url in zip(numbers, urls)
        ]}, usage(0.005)


class CourseActivityTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.out = Path(self.folder.name) / "out"
        self.syllabi = Path(self.folder.name) / "syllabi"

    def tearDown(self):
        self.folder.cleanup()

    def run_pipeline(self, client, **options):
        return ca.run(SCHOOL, COURSE, client=client, out_dir=self.out, syllabus_dir=self.syllabi, fetcher=FETCHED.get, today="2026-11-05", log=lambda line: None, **options)

    def test_group_key_merges_notation_variants_only(self):
        self.assertEqual({ca.group_key(name) for name in ("자료구조", "자료구조론", "데이터구조", "자료 구조", "자료구조(Data Structures)")}, {"자료구조"})
        self.assertEqual(ca.group_key("운영체제 1"), ca.group_key("운영체제Ⅱ"))
        self.assertEqual(ca.group_key("컴퓨터비젼"), ca.group_key("컴퓨터비전"))
        self.assertNotEqual(ca.group_key("알고리즘"), ca.group_key("알고리즘분석"))
        # "이론"은 떼지 않고, 너무 짧은 이름의 "론"도 떼지 않는다.
        self.assertEqual(ca.group_key("그래프이론"), "그래프이론")
        self.assertEqual(ca.group_key("법학원론"), "법학원론")
        self.assertEqual(ca.group_key("경제학원론"), "경제학")

    def test_find_program_needs_one_department(self):
        self.assertEqual(ca.find_program(SCHOOL, "컴퓨터공학과"), (SCHOOL, COURSE))
        self.assertEqual(ca.find_program(SCHOOL, "컴퓨터공학부"), (SCHOOL, "컴퓨터공학부"))
        with self.assertRaisesRegex(ValueError, "여럿"):
            ca.find_program(SCHOOL, "컴퓨터")
        with self.assertRaisesRegex(ValueError, "들어간 학과가 없"):
            ca.find_program(SCHOOL, "없는학과")
        with self.assertRaisesRegex(ValueError, "학교"):
            ca.find_program("없는대학교", "컴퓨터공학과")

    def test_select_courses_groups_department_subjects(self):
        groups = ca.select_courses(SCHOOL, COURSE)
        self.assertEqual(sum(len(group["names"]) for group in groups.values()), 77)
        self.assertEqual(groups[ca.group_key("최신기술콜로키움1")]["names"], ["최신기술콜로키움1", "최신기술콜로키움2"])

    def test_locate_ignores_spacing_and_rejects_short_or_missing_quotes(self):
        self.assertIsNotNone(ca.locate("binary search  tree, with insert", f"x {QUOTE_A} y"))
        self.assertIsNone(ca.locate("tree", QUOTE_A))
        self.assertIsNone(ca.locate("red black tree rotation", QUOTE_A))

    def test_parse_json_takes_last_result_object(self):
        text = '조사 계획 {"메모": 1}\n```json\n{"실제_활동": [], "과목명": "가"}\n```\n끝 {"실제_활동": [1], "과목명": "나"}'
        self.assertEqual(ca.parse_json(text)["과목명"], "나")
        with self.assertRaises(ValueError):
            ca.parse_json("JSON이 없는 답")

    def test_evidence_collects_search_fetch_and_citation_pages(self):
        blocks = [
            SimpleNamespace(type="web_search_tool_result", content=[SimpleNamespace(url="https://www.Example.com/a/"), SimpleNamespace(url="https://b.org/x#frag")]),
            SimpleNamespace(type="web_search_tool_result", content=SimpleNamespace(type="web_search_tool_result_error")),
            SimpleNamespace(type="web_fetch_tool_result", content=SimpleNamespace(type="web_fetch_result", url="https://c.net/p", content=SimpleNamespace(source=SimpleNamespace(type="text", data="본문")))),
            SimpleNamespace(type="text", text="요약", citations=[SimpleNamespace(url="https://b.org/x", cited_text="인용문")]),
        ]
        pages = ca.evidence_of(blocks)
        self.assertEqual(pages, {"https://example.com/a": [], "https://b.org/x": ["인용문"], "https://c.net/p": ["본문"]})

    def test_check_items_drops_unsupported_claims(self):
        items = ca.sanitize_search(SEARCH_RESULT)["실제_활동"]
        kept, dropped = ca.check_items(items, PAGES, [], FETCHED.get)
        self.assertEqual([entry["근거_URL"] for entry, _ in kept], ["https://github.com/a/ds", "https://blog.example.com/x"])
        self.assertEqual([entry["이유"] for entry in dropped], ["검색에서 나오지 않은 주소", "근거 없음", "막은 사이트", "근거 문장을 출처에서 찾지 못함"])
        # 직접 받지 못한 페이지, 너무 긴 근거 문장(원문을 옮긴 것), 유형 없는 항목도 버린다.
        long = ca.sanitize_search({"실제_활동": [item("https://github.com/a/ds", "가" * 400)]})["실제_활동"]
        self.assertEqual(len(long[0]["근거_문장"]), ca.MAX_QUOTE)
        self.assertEqual(ca.check_items(long, PAGES, [], FETCHED.get)[1][0]["이유"], "근거 문장이 너무 김")
        _, dropped = ca.check_items([item("https://blog.example.com/x", QUOTE_B)], PAGES, [], lambda url: None)
        self.assertEqual(dropped[0]["이유"], "출처를 열 수 없음")
        _, dropped = ca.check_items([{**item("https://github.com/a/ds", QUOTE_A), "유형": []}], PAGES, [], FETCHED.get)
        self.assertEqual(dropped[0]["이유"], "활동 유형 없음")

    def test_confidence_needs_two_schools_for_high(self):
        def passed(school, kind="코드 작성·디버깅", source="학생결과물"):
            return {"유형": [kind], "학교": school, "출처_종류": source}

        self.assertEqual(ca.confidence([passed("가대학교"), passed("나대학교")]), "높음")
        self.assertEqual(ca.confidence([passed("가대학교"), passed("가 대학교")]), "중간")
        self.assertEqual(ca.confidence([passed("가대학교"), passed("나대학교", kind="계산·증명")]), "중간")
        self.assertEqual(ca.confidence([passed("가대학교"), passed("")]), "중간")
        self.assertEqual(ca.confidence([passed("가대학교", source="강의계획서"), passed("나대학교", source="강의계획서")]), "낮음")

    def test_representative_task_needs_real_task_evidence(self):
        group = {"key": "가", "name": "가", "names": ["가"]}
        stage1 = {"result": {"활동_유형": []}}
        stage2 = {"result": {**ca.sanitize_search(SEARCH_RESULT), "대표_과제": "Unity 텀 프로젝트", "시험_형태": "필기"}}
        syllabus_only = [{"유형": ["창작·제작"], "학교": "가대학교", "출처_종류": "강의계획서"}]
        final = ca.finalize(group, stage1, stage2, syllabus_only)
        self.assertEqual((final["대표_과제"], final["시험_형태"]), ("근거 없음", "근거 없음"))
        final = ca.finalize(group, stage1, stage2, [*syllabus_only, {"유형": ["창작·제작"], "학교": "", "출처_종류": "교수페이지"}, {"유형": ["계산·증명"], "학교": "", "출처_종류": "시험"}])
        self.assertEqual((final["대표_과제"], final["시험_형태"]), ("Unity 텀 프로젝트", "필기"))

    def test_run_writes_verified_results_and_reports(self):
        client = Fake()
        self.run_pipeline(client, max_courses=2)
        self.assertEqual(client.calls, ["stage1", "stage2", "verify"] * 2)
        finals = [json.loads(line) for line in (self.out / "final.jsonl").read_text(encoding="utf-8").splitlines()]
        self.assertEqual(len(finals), 2)
        first = finals[0]
        self.assertEqual((first["과목명"], first["신뢰도"], first["활동_유형"]), ("가상/증강현실이론및실습", "높음", ["코드 작성·디버깅"]))
        self.assertEqual([entry["학교"] for entry in first["실제_활동"]], ["가대학교", "나대학교"])
        # 시험 근거는 통과하지 못해 시험 형태는 남기지 않는다.
        self.assertEqual((first["대표_과제"], first["시험_형태"]), ("트리·리스트 구현", "근거 없음"))
        stage1 = [json.loads(line) for line in (self.out / "stage1_classification.jsonl").read_text(encoding="utf-8").splitlines()]
        self.assertEqual(stage1[0]["result"]["활동_유형"], ["코드 작성·디버깅"])
        # 검색 원본에는 페이지 주소만 남고 페이지 글은 저장하지 않는다.
        raw = (self.out / "stage2_search.jsonl").read_text(encoding="utf-8")
        self.assertNotIn("more text", raw)
        self.assertIn("https://github.com/a/ds", raw)

        with (self.out / "review.csv").open(encoding="utf-8-sig", newline="") as file:
            rows = list(csv.reader(file))
        self.assertEqual(rows[0], ca.REVIEW_COLUMNS)
        self.assertEqual(len(rows), 1 + 77)
        self.assertEqual(rows[1][5], "높음")
        self.assertEqual(rows[2][1], "4")  # AIoT소프트웨어는 편성표상 4학년
        self.assertEqual(rows[3][2], "(미처리)")
        self.assertTrue(all(row[-2:] == ["", ""] for row in rows[1:]))
        summary = (self.out / "summary.md").read_text(encoding="utf-8")
        self.assertIn("| 코드 작성·디버깅 | 2 |", summary)
        self.assertIn("검색에서 나오지 않은 주소: 2개", summary)
        self.assertIn("| 합계 | | 6 |", summary)
        self.assertIn("$0.05", summary)

        # 다시 돌리면 처리한 묶음은 건너뛴다.
        again = Fake()
        self.run_pipeline(again, max_courses=2)
        self.assertEqual(again.calls, ["stage1", "stage2", "verify"] * 2)
        self.assertEqual(len((self.out / "final.jsonl").read_text(encoding="utf-8").splitlines()), 4)

    def test_rejected_claims_and_no_evidence_keep_low_confidence(self):
        client = Fake(judge_reject={"https://github.com/a/ds", "https://blog.example.com/x"})
        state = self.run_pipeline(client, max_courses=1)
        entry = state.verify[state.order[0]]
        self.assertIsNone(entry["final"])
        self.assertEqual(Counter(drop["이유"] for drop in entry["dropped"])["주장과 근거 불일치"], 2)
        with (self.out / "review.csv").open(encoding="utf-8-sig", newline="") as file:
            row = list(csv.reader(file))[1]
        self.assertEqual((row[2], row[5]), ("(1차 추정) 코드 작성·디버깅", "낮음"))
        self.assertIn("검증을 통과한 근거 없음", (self.out / "summary.md").read_text(encoding="utf-8"))

    def test_dry_run_makes_no_calls(self):
        lines = []
        ca.run(SCHOOL, COURSE, client=None, dry_run=True, out_dir=self.out, syllabus_dir=self.syllabi, log=lines.append)
        self.assertFalse(self.out.exists())
        text = "\n".join(lines)
        self.assertIn("교과목 77개 · 묶음 74개", text)
        self.assertIn("2차 검색 74회", text)
        self.assertIn("호출하지 않았습니다", text)

    def test_budget_stops_before_a_call_would_exceed_it(self):
        client = Fake()
        self.run_pipeline(client, budget_usd=0.05)
        # 1차 분류(예상 $0.03)는 되지만, 검색(예상 $0.45)을 더하면 넘으므로 그 앞에서 멈춘다.
        self.assertEqual(client.calls, ["stage1"])
        self.assertTrue((self.out / "stage1_classification.jsonl").exists())
        self.assertTrue((self.out / "summary.md").exists())

    def test_failures_are_recorded_and_retried(self):
        self.run_pipeline(Fake(search_error=RuntimeError("검색 실패")), max_courses=1)
        state = ca.Run(SCHOOL, COURSE, self.out, self.syllabi)
        self.assertIn("검색 실패", state.stage2[state.order[0]]["error"])
        self.assertNotIn(state.order[0], state.verify)
        retry = Fake()
        self.run_pipeline(retry, max_courses=1)
        self.assertEqual(retry.calls, ["stage2", "verify"])

        class AuthenticationError(Exception):
            pass

        with self.assertRaises(AuthenticationError):
            self.run_pipeline(Fake(search_error=AuthenticationError("키 없음")), max_courses=1)

    def test_syllabus_can_skip_search_but_alone_stays_low(self):
        self.syllabi.mkdir()
        (self.syllabi / "자료구조.txt").write_text("평가: 과제 1: 이진 탐색 트리를 구현한다. 기말고사.", encoding="utf-8")
        (self.syllabi / "없는과목.txt").write_text("내용", encoding="utf-8")
        client = Fake(stage1_level="높음")
        state = ca.Run(SCHOOL, COURSE, self.out, self.syllabi)
        self.assertEqual(state.unmatched_files, ["없는과목.txt"])
        key = ca.group_key("자료구조")
        state.process(client, key, ca.Budget(), "2026-11-05", FETCHED.get, log=lambda line: None)
        self.assertEqual(client.calls, ["stage1", "verify"])
        final = state.verify[key]["final"]
        self.assertEqual((final["신뢰도"], final["실제_활동"][0]["출처_종류"], final["실제_활동"][0]["근거_URL"]), ("낮음", "강의계획서", "강의계획서:자료구조.txt"))
        # 강의계획서가 없는 과목은 모델이 높음이라 해도 낮음으로 두고 검색한다.
        other = Fake(stage1_level="높음")
        state.process(other, ca.group_key("알고리즘"), ca.Budget(), "2026-11-05", FETCHED.get, log=lambda line: None)
        self.assertEqual(state.stage1[ca.group_key("알고리즘")]["result"]["신뢰도"], "낮음")
        self.assertEqual(other.calls, ["stage1", "stage2", "verify"])

    def test_usage_counts_searches_and_unknown_models(self):
        self.assertEqual(ca.usage_of("claude-opus-5-5", 1_000_000, 100_000, searches=5)["cost_usd"], 4.0 + 2.0 + 0.05)
        unknown = ca.usage_of("claude-opus-4-8", 1_000_000, 0)
        self.assertEqual((unknown["cost_usd"], unknown["price_assumed"]), (4.0, True))

    def test_manual_mode_waits_for_answers_and_checks_every_source(self):
        work = Path(self.folder.name) / "work"
        client = ca.FileClient(work)

        def answer(stage, value):
            requests = ca.load_jsonl(work / "requests" / f"{stage}.jsonl")
            self.assertEqual(len(requests), 1)
            request = next(iter(requests.values()))
            value = value(request["prompt"]) if callable(value) else value
            (work / f"{stage}.jsonl").write_text(json.dumps({"key": request["key"], "prompt_id": request["prompt_id"], "answer": value}, ensure_ascii=False) + "\n", encoding="utf-8")

        def verdicts(prompt):
            return Fake().judge(prompt)[0]

        self.run_pipeline(client, max_courses=1)
        answer("stage1", {"활동_유형": ["코드 작성·디버깅"], "신뢰도": "낮음", "판단_근거": "과목명", "근거": []})
        self.run_pipeline(client, max_courses=1)
        answer("stage2", SEARCH_RESULT)
        self.run_pipeline(client, max_courses=1)
        answer("verify", verdicts)
        state = self.run_pipeline(client, max_courses=1)
        entry = state.verify[state.order[0]]
        # 나온 페이지 기록이 없으니 "검색에서 나오지 않은 주소"로 거르지 않고 직접 받아 대조한다(made.up은 받을 수 없음).
        reasons = sorted(drop["이유"] for drop in entry["dropped"])
        self.assertEqual(reasons, ["근거 문장을 출처에서 찾지 못함", "근거 없음", "막은 사이트", "출처를 열 수 없음", "출처를 열 수 없음"])
        # github 페이지는 FETCHED에 없어 받을 수 없으므로, 직접 받은 blog 하나만 남는다.
        self.assertEqual([item["근거_URL"] for item in entry["final"]["실제_활동"]], ["https://blog.example.com/x"])
        self.assertEqual(entry["final"]["신뢰도"], "중간")
        self.assertIn("Claude Code", (self.out / "summary.md").read_text(encoding="utf-8"))

    def test_claude_search_continues_paused_turns_and_sums_usage(self):
        def response(stop, content, searches):
            usage = SimpleNamespace(input_tokens=1000, output_tokens=100, cache_creation_input_tokens=0, cache_read_input_tokens=500, server_tool_use=SimpleNamespace(web_search_requests=searches, web_fetch_requests=0))
            return SimpleNamespace(stop_reason=stop, model="claude-opus-5-5", usage=usage, content=content)

        found = SimpleNamespace(type="web_search_tool_result", content=[SimpleNamespace(url="https://github.com/a/ds")])
        answer = SimpleNamespace(type="text", text='```json\n{"실제_활동": [], "과목명": "자료구조"}\n```', citations=None)
        replies = [response("pause_turn", [found], 3), response("end_turn", [answer], 2)]
        sent = []

        class Stream:
            def __init__(self, params):
                sent.append(params)

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def get_final_message(self):
                return replies.pop(0)

        claude = ca.Claude.__new__(ca.Claude)
        claude.client = SimpleNamespace(beta=SimpleNamespace(messages=SimpleNamespace(stream=lambda **params: Stream(params))))
        result, usage, pages = claude.search("조사해 줘")
        self.assertEqual((result["과목명"], list(pages)), ("자료구조", ["https://github.com/a/ds"]))
        self.assertEqual((usage["input_tokens"], usage["web_search_requests"], usage["cost_usd"]), (3000, 5, round(2 * (1500 * 4 + 100 * 20) / 1e6 + 0.05, 4)))
        # 멈춘 차례는 앞의 응답을 assistant로 붙여 다시 보내고, 막은 사이트를 검색·열람 도구 모두에 건다.
        self.assertEqual([message["role"] for message in sent[1]["messages"]], ["user", "assistant"])
        self.assertTrue(all(tool["blocked_domains"] == ca.BLOCKED for tool in sent[0]["tools"]))

        replies[:] = [response("refusal", [], 0)]
        with self.assertRaisesRegex(RuntimeError, "거절"):
            claude.search("조사해 줘")


if __name__ == "__main__":
    unittest.main()
