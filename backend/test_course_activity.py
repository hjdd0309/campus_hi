import csv
from collections import Counter
import json
import re
import tempfile
import unicodedata
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
DOC_URL = "https://ce.example.ac.kr/curriculum.pdf"
DOC_TEXT = (
    "교육과정 편성표\n순번 교과목명 학수번호 학점\n1 자료구조 CSE101 3\n2 알고리즘 CSE102 3\n" + "표 " * 80
    + "\n교과목 해설\n∙ 자료구조 (Data Structures)\n리스트, 스택, 큐, 트리를 배우고 과제 1: 이진 탐색 트리를 구현한다. 기말고사로 평가한다.\n"
    + "∙ 알고리즘 (Algorithms)\n정렬과 탐색 알고리즘을 분석한다.\n" + "끝 " * 50
)
FETCHED[DOC_URL] = DOC_TEXT
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
    "대표_과제": {"내용": "트리·리스트 구현", "근거_URL": "https://github.com/a/ds", "근거_문장": QUOTE_A, "출처_종류": "학생결과물"},
    "시험_형태": {"내용": "필기 시험", "근거_URL": "https://made.up/page", "근거_문장": "검색에서 나온 적 없는 주소의 시험 문장입니다.", "출처_종류": "시험"},
    "신뢰도": "높음",
    "근거_부족_항목": [],
    "사용한_검색어": ['"자료구조" 과제'],
}


class Fake:
    def __init__(self, stage1_level="낮음", search_error=None, judge_reject=(), docs=()):
        self.calls = []
        self.prompts = []
        self.docs = list(docs)
        self.stage1_level = stage1_level
        self.search_error = search_error
        self.judge_reject = set(judge_reject)

    def classify(self, prompt):
        self.calls.append("stage1")
        empty = {"내용": "", "문서_URL": "", "근거_문장": ""}
        result = {"활동_유형": ["코드 작성·디버깅", "없는 유형"], "신뢰도": self.stage1_level, "판단_근거": "과목명", "근거": [], "검색어": {"학수번호": [], "영문명": [], "프로젝트": []}, "대표_과제": empty, "시험_형태": empty}
        if f"[문서: {DOC_URL}" in prompt:
            result["근거"] = [{"내용": "트리 구현 과제", "유형": ["코드 작성·디버깅"], "문서_URL": DOC_URL, "근거_문장": "과제 1: 이진 탐색 트리를 구현한다."}]
            result["검색어"] = {"학수번호": ["CSE101"], "영문명": [], "프로젝트": ["이진 탐색 트리"]}
            result["대표_과제"] = {"내용": "이진 탐색 트리 구현", "문서_URL": DOC_URL, "근거_문장": "과제 1: 이진 탐색 트리를 구현한다."}
            result["시험_형태"] = {"내용": "기말고사", "문서_URL": DOC_URL, "근거_문장": "기말고사로 평가한다."}
        return result, usage()

    def find_syllabus(self, prompt):
        self.calls.append("stage0")
        return {"찾음": bool(self.docs), "문서": [dict(doc) for doc in self.docs]}, usage(), None

    def search(self, prompt):
        self.calls.append("stage2")
        self.prompts.append(prompt)
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

    def tearDown(self):
        self.folder.cleanup()

    def run_pipeline(self, client, **options):
        return ca.run(SCHOOL, COURSE, client=client, out_dir=self.out, fetcher=FETCHED.get, today="2026-11-05", log=lambda line: None, **options)

    def test_group_key_merges_notation_variants_only(self):
        self.assertEqual({ca.group_key(name) for name in ("자료구조", "자료구조론", "데이터구조", "자료 구조", "자료구조(Data Structures)")}, {"자료구조"})
        self.assertEqual(ca.group_key("운영체제 1"), ca.group_key("운영체제Ⅱ"))
        self.assertEqual(ca.group_key("컴퓨터비젼"), ca.group_key("컴퓨터비전"))
        self.assertEqual(ca.group_key("자연언어처리"), ca.group_key("자연어처리"))
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

    def test_course_list_file_replaces_catalog_subjects(self):
        path = Path(self.folder.name) / "courses.txt"
        path.write_text("# 학교 교육과정 표\n2\t자료구조\n\n3\t몰입심화학습(AI로봇)\n4\t몰입심화학습(딥엑스)\n캡스톤디자인\n2\t자료구조\n", encoding="utf-8")
        names, years = ca.load_course_list(path)
        self.assertEqual(names, ["자료구조", "몰입심화학습(AI로봇)", "몰입심화학습(딥엑스)", "캡스톤디자인"])
        self.assertEqual(years, {"자료구조": 2, "몰입심화학습(AI로봇)": 3, "몰입심화학습(딥엑스)": 4})
        state = ca.Run(SCHOOL, COURSE, self.out, courses=path)
        self.assertEqual(state.order, ["자료구조", ca.group_key("몰입심화학습"), "캡스톤디자인"])
        self.assertEqual(state.curriculum, names)
        # 1차 분류 프롬프트의 학년·다른 교과목은 목록 파일에서 온다.
        prompt = ca.stage1_prompt(SCHOOL, COURSE, state.groups[ca.group_key("몰입심화학습")], ["자료구조"], state.years, [])
        self.assertIn("학교 편성표상 학년: 3학년, 4학년", prompt)
        path.write_text("이학년\t자료구조\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "학년은 숫자"):
            ca.load_course_list(path)
        path.write_text("# 비어 있음\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "과목이 없"):
            ca.load_course_list(path)

    def test_locate_ignores_spacing_and_rejects_short_or_missing_quotes(self):
        self.assertIsNotNone(ca.locate("binary search  tree, with insert", f"x {QUOTE_A} y"))
        self.assertIsNone(ca.locate("tree", QUOTE_A))
        self.assertIsNone(ca.locate("red black tree rotation", QUOTE_A))
        # 자모 조합형(NFD)으로 적힌 페이지도 표준형 근거 문장과 맞는다(경희대 강의계획서 일부).
        decomposed = unicodedata.normalize("NFD", "학기 프로젝트(개인 별 심화 프로젝트): 발표 후 최종 보고서 제출")
        self.assertIsNotNone(ca.locate("개인 별 심화 프로젝트: 발표 후 최종 보고서", decomposed))

    def test_fetch_page_returns_composed_hangul(self):
        original = ca.pipeline.fetch
        ca.pipeline.fetch = lambda url: (unicodedata.normalize("NFD", "<p>개인 별 과제</p>").encode("utf-8"), "html", "text/html; charset=utf-8")
        try:
            self.assertIn("개인 별 과제", ca.fetch_page("https://example.ac.kr/plan"))
        finally:
            ca.pipeline.fetch = original

    def test_parse_json_takes_last_result_object(self):
        text = '조사 계획 {"메모": 1}\n```json\n{"실제_활동": [], "과목명": "가"}\n```\n끝 {"실제_활동": [1], "과목명": "나"}'
        self.assertEqual(ca.parse_json(text)["과목명"], "나")
        with self.assertRaises(ValueError):
            ca.parse_json("JSON이 없는 답")
        self.assertEqual(ca.parse_json('{"문서": [], "찾음": false}', "문서")["찾음"], False)

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

    def test_confidence_rules(self):
        def passed(school="", kind="코드 작성·디버깅", source="학생결과물", doc=None, url="https://a.example/1"):
            return {"유형": [kind], "학교": school, "출처_종류": source, "문서_종류": doc, "근거_URL": url}

        plan, plan2 = passed(source="강의계획서", doc="강의계획서", url="https://sugang.example/1"), passed(source="강의계획서", doc="강의계획서", url="https://sugang.example/2")
        description = passed(source="강의계획서", doc="교과목해설", url="https://dept.example/curriculum.pdf")
        # (c) 서로 다른 학교 결과물 2개
        level, rules = ca.confidence([passed("가대학교"), passed("나대학교")])
        self.assertEqual((level, rules), ("높음", ["(c) 서로 다른 학교 2곳의 결과물 근거가 같은 활동: 코드 작성·디버깅"]))
        self.assertEqual(ca.confidence([passed("가대학교"), passed("가 대학교")])[0], "중간")
        self.assertEqual(ca.confidence([passed("가대학교"), passed("나대학교", kind="계산·증명")])[0], "중간")
        # (a) 강의계획서 + 학생 결과물·과제 명세
        self.assertEqual(ca.confidence([plan, passed()]), ("높음", ["(a) 강의계획서와 학생결과물 근거가 같은 활동: 코드 작성·디버깅"]))
        self.assertEqual(ca.confidence([plan, passed(source="과제명세")])[0], "높음")
        self.assertEqual(ca.confidence([plan, passed(kind="계산·증명")])[0], "중간")
        # (b) 강의계획서 2개(학기·교수 다름) + 학생 결과물
        self.assertIn("(b) 강의계획서 2개와 학생결과물 근거가 같은 활동: 코드 작성·디버깅", ca.confidence([plan, plan2, passed()])[1])
        # 중간: 강의계획서만, 결과물만 / 낮음: 교과목 해설뿐(해설은 강의계획서로 치지 않음)
        self.assertEqual(ca.confidence([plan, plan2]), ("중간", []))
        self.assertEqual(ca.confidence([passed()]), ("중간", []))
        self.assertEqual(ca.confidence([description]), ("낮음", []))
        self.assertEqual(ca.confidence([description, passed()])[0], "중간")
        self.assertEqual(ca.basis_of([plan], "중간"), "강의계획서는 있지만 같은 활동을 보여주는 학생 결과물·과제 명세가 없음")

    def test_task_and_exam_prefer_specific_evidence_but_keep_syllabus(self):
        def use(name, value, source, url):
            return {"용도": name, "값": value, "출처_종류": source, "근거_URL": url}

        plan_task = use("대표_과제", "텀 프로젝트", "강의계획서", "https://sugang.example/1")
        work_task = use("대표_과제", "Unity AR 앱", "학생결과물", "https://github.com/x")
        plan_exam = use("시험_형태", "기말 45%", "강의계획서", "https://sugang.example/1")
        best, plan = ca.pick_use([plan_task, work_task], "대표_과제", ("과제명세", "학생결과물", "교수페이지"))
        self.assertEqual((best["내용"], best["출처_종류"], plan["내용"], plan["출처_종류"]), ("Unity AR 앱", "학생결과물", "텀 프로젝트", "강의계획서"))
        best, plan = ca.pick_use([plan_task], "대표_과제", ("과제명세", "학생결과물", "교수페이지"))
        self.assertEqual((best["출처_종류"], plan), ("강의계획서", None))
        self.assertEqual(ca.pick_use([], "시험_형태", ("시험",)), (None, None))
        self.assertEqual(ca.use_text(*ca.pick_use([plan_exam], "시험_형태", ("시험",))), "[강의계획서] 기말 45%")
        self.assertEqual(ca.use_text(*ca.pick_use([plan_task, work_task], "대표_과제", ("학생결과물",))), "[학생결과물] Unity AR 앱 / [강의계획서] 텀 프로젝트")
        self.assertEqual(ca.use_text(None, None), "근거 없음")

    def test_search_terms_come_from_classification_and_syllabus_text(self):
        docs = [{"문서_URL": "https://sugang.khu.ac.kr/core?attribute=lectPlan&p_subjt=SWCON313&loginYn=N", "원문_발췌": "강좌명 | 가상/증강현실이론및실습\n학수번호 | SWCON31300\n∙ 가상/증강현실이론및실습 (Virtual and Augmented Reality Programming)"}]
        terms = ca.search_terms({"검색어": {"학수번호": ["SWCON313"], "영문명": [], "프로젝트": ["Term Project"]}}, docs, ["가상/증강현실이론및실습"])
        self.assertEqual(terms, {"학수번호": ["SWCON313", "SWCON31300"], "영문명": ["Virtual and Augmented Reality Programming"], "프로젝트": ["Term Project"]})
        self.assertIn("영문명: Virtual and Augmented Reality Programming", ca.terms_text(terms))
        self.assertEqual(ca.terms_text({"학수번호": [], "영문명": [], "프로젝트": []}), "없음")
        used = ['"SWCON313" github', '"virtual and augmented reality programming" project', "경희대 가상/증강현실이론및실습 SWCON31300"]
        self.assertEqual(ca.missing_terms(terms, used), ["Term Project"])

    def test_run_writes_verified_results_and_reports(self):
        client = Fake()
        self.run_pipeline(client, max_courses=2)
        self.assertEqual(client.calls, ["stage0", "stage1", "stage2", "verify"] * 2)
        finals = [json.loads(line) for line in (self.out / "final.jsonl").read_text(encoding="utf-8").splitlines()]
        self.assertEqual(len(finals), 2)
        first = finals[0]
        self.assertEqual((first["과목명"], first["신뢰도"], first["활동_유형"]), ("가상/증강현실이론및실습", "높음", ["코드 작성·디버깅"]))
        self.assertEqual([entry["학교"] for entry in first["실제_활동"]], ["가대학교", "나대학교"])
        # 대표 과제는 검증을 통과한 학생 결과물로, 시험 근거는 검색에 나오지 않은 주소라 버려져 비어 있다.
        self.assertEqual((first["대표_과제"]["내용"], first["대표_과제"]["출처_종류"], first["시험_형태"]), ("트리·리스트 구현", "학생결과물", None))
        self.assertEqual(first["신뢰도_규칙"], ["(c) 서로 다른 학교 2곳의 결과물 근거가 같은 활동: 코드 작성·디버깅"])
        stage1 = [json.loads(line) for line in (self.out / "stage1_classification.jsonl").read_text(encoding="utf-8").splitlines()]
        self.assertEqual(stage1[0]["result"]["활동_유형"], ["코드 작성·디버깅"])
        # 검색 원본에는 페이지 주소만 남고 페이지 글은 저장하지 않는다.
        raw = (self.out / "stage2_search.jsonl").read_text(encoding="utf-8")
        self.assertNotIn("more text", raw)
        self.assertIn("https://github.com/a/ds", raw)

        with (self.out / ca.ACTIVITY_FILE).open(encoding="utf-8-sig", newline="") as file:
            rows = list(csv.reader(file))
        self.assertEqual(rows[0], ca.REVIEW_COLUMNS)
        self.assertEqual(len(rows), 1 + 77)
        self.assertEqual((rows[1][3], rows[1][4], rows[1][5]), ("[학생결과물] 트리·리스트 구현", "근거 없음", "높음"))
        self.assertEqual(rows[2][1], "4")  # AIoT소프트웨어는 편성표상 4학년
        self.assertEqual(rows[3][2], "(미처리)")
        self.assertTrue(all(row[-2:] == ["", ""] for row in rows[1:]))
        summary = (self.out / "summary.md").read_text(encoding="utf-8")
        self.assertIn("| 코드 작성·디버깅 | 2 |", summary)
        self.assertIn("검색에서 나오지 않은 주소: 4개", summary)
        self.assertIn("- 가상/증강현실이론및실습: 높음 — (c) 서로 다른 학교 2곳의 결과물 근거가 같은 활동: 코드 작성·디버깅", summary)
        self.assertIn("| 합계 | | 8 |", summary)
        self.assertIn("| 합계 | | 8 | | | | $0.07 |", summary)
        self.assertIn("가상/증강현실이론및실습: 찾지 못함", summary)

        # 다시 돌리면 처리한 묶음은 건너뛴다.
        again = Fake()
        self.run_pipeline(again, max_courses=2)
        self.assertEqual(again.calls, ["stage0", "stage1", "stage2", "verify"] * 2)
        self.assertEqual(len((self.out / "final.jsonl").read_text(encoding="utf-8").splitlines()), 4)

    def test_rejected_claims_and_no_evidence_keep_low_confidence(self):
        client = Fake(judge_reject={"https://github.com/a/ds", "https://blog.example.com/x"})
        state = self.run_pipeline(client, max_courses=1)
        entry = state.verify[state.order[0]]
        self.assertIsNone(entry["final"])
        # 활동 두 개와, 같은 github 근거를 댄 대표 과제가 불일치로 버려진다.
        self.assertEqual(Counter(drop["이유"] for drop in entry["dropped"])["주장과 근거 불일치"], 3)
        with (self.out / ca.ACTIVITY_FILE).open(encoding="utf-8-sig", newline="") as file:
            row = list(csv.reader(file))[1]
        self.assertEqual((row[2], row[5]), ("(1차 추정) 코드 작성·디버깅", "낮음"))
        self.assertIn("검증을 통과한 근거 없음", (self.out / "summary.md").read_text(encoding="utf-8"))

    def test_dry_run_makes_no_calls(self):
        lines = []
        ca.run(SCHOOL, COURSE, client=None, dry_run=True, out_dir=self.out, log=lines.append)
        self.assertFalse(self.out.exists())
        text = "\n".join(lines)
        self.assertIn("교과목 77개 · 묶음 74개", text)
        self.assertIn("강의계획서 탐색 74회", text)
        self.assertIn("2차 검색 74회", text)
        self.assertIn("호출하지 않았습니다", text)

    def test_budget_stops_before_a_call_would_exceed_it(self):
        client = Fake()
        self.run_pipeline(client, budget_usd=0.3)
        # 강의계획서 탐색(예상 $0.25)과 1차 분류(예상 $0.03)는 되지만, 검색(예상 $0.45)을 더하면 넘으므로 그 앞에서 멈춘다.
        self.assertEqual(client.calls, ["stage0", "stage1"])
        self.assertTrue((self.out / "stage1_classification.jsonl").exists())
        self.assertTrue((self.out / "summary.md").exists())

    def test_failures_are_recorded_and_retried(self):
        self.run_pipeline(Fake(search_error=RuntimeError("검색 실패")), max_courses=1)
        state = ca.Run(SCHOOL, COURSE, self.out)
        self.assertIn("검색 실패", state.stage2[state.order[0]]["error"])
        self.assertNotIn(state.order[0], state.verify)
        retry = Fake()
        self.run_pipeline(retry, max_courses=1)
        self.assertEqual(retry.calls, ["stage2", "verify"])

        class AuthenticationError(Exception):
            pass

        with self.assertRaises(AuthenticationError):
            self.run_pipeline(Fake(search_error=AuthenticationError("키 없음")), max_courses=1)

    def test_found_syllabus_is_still_searched_with_its_terms(self):
        doc = {"문서_URL": DOC_URL, "문서_종류": "강의계획서", "추출_텍스트_요약": "트리 구현 과제가 있다."}
        client = Fake(stage1_level="높음", docs=[doc])
        state = ca.Run(SCHOOL, COURSE, self.out)
        key = ca.group_key("자료구조")
        state.process(client, key, ca.Budget(), "2026-11-05", FETCHED.get, log=lambda line: None)
        # 1차가 높음이어도 2차 검색을 한다.
        self.assertEqual(client.calls, ["stage0", "stage1", "stage2", "verify"])
        record = state.stage0[key]
        self.assertEqual((record["찾음"], record["학교"], record["학과"], record["문서"][0]["문서_URL"]), (True, SCHOOL, COURSE, DOC_URL))
        self.assertIn("이진 탐색 트리를 구현한다", record["문서"][0]["원문_발췌"])
        # 강의계획서에서 얻은 학수번호·영문명·프로젝트명이 검색 프롬프트에 들어가고, 쓰지 않은 것은 기록된다.
        self.assertIn("학수번호: CSE101", client.prompts[0])
        self.assertIn("영문명: Data Structures", client.prompts[0])
        self.assertIn("프로젝트: 이진 탐색 트리", client.prompts[0])
        self.assertEqual(state.stage2[key]["빠진_검색어"], ["CSE101", "Data Structures", "이진 탐색 트리"])
        final = state.verify[key]["final"]
        self.assertEqual(final["신뢰도"], "높음")
        self.assertIn("(a) 강의계획서와 학생결과물 근거가 같은 활동: 코드 작성·디버깅", final["신뢰도_규칙"])
        self.assertEqual([item["문서_종류"] for item in final["실제_활동"] if item["근거_URL"] == DOC_URL], ["강의계획서"])
        # 대표 과제는 학생 결과물이 먼저, 강의계획서 근거도 함께. 시험 형태는 강의계획서로 채운다.
        self.assertEqual((final["대표_과제"]["내용"], final["대표_과제_강의계획서"]["내용"]), ("트리·리스트 구현", "이진 탐색 트리 구현"))
        self.assertEqual((final["시험_형태"]["내용"], final["시험_형태"]["출처_종류"], final["시험_형태_강의계획서"]), ("기말고사", "강의계획서", None))
        # 강의계획서를 못 찾은 과목은 모델이 높음이라 해도 1차는 낮음으로 둔다.
        other = Fake(stage1_level="높음")
        state.process(other, ca.group_key("알고리즘"), ca.Budget(), "2026-11-05", FETCHED.get, log=lambda line: None)
        self.assertFalse(state.stage0[ca.group_key("알고리즘")]["찾음"])
        self.assertEqual(state.stage1[ca.group_key("알고리즘")]["result"]["신뢰도"], "낮음")
        self.assertEqual(other.calls, ["stage0", "stage1", "stage2", "verify"])
        state.save()
        ca.write_reports(state)
        self.assertTrue((self.out / "stage0_syllabus.jsonl").exists())
        self.assertIn("2차 검색에서 쓰지 않은 필수 검색어", (self.out / "summary.md").read_text(encoding="utf-8"))

    def test_course_excerpt_uses_whole_short_documents_and_description_in_long_ones(self):
        self.assertEqual(ca.tidy("강좌명 | 자료구조 | 자료구조 | 교강사명\n\n  평가   방법 "), "강좌명 | 자료구조 | 교강사명\n평가 방법")
        short = "2024학년도 강의계획서\n강좌명 | 자료구조 | 자료구조\n" + "주별 내용 " * 100
        self.assertEqual(ca.course_excerpt(short, ["자료구조"]), ca.tidy(short))
        self.assertIsNone(ca.course_excerpt(short, ["알고리즘"]))
        long = "1 자료구조 CSE101 3\n" + "표 칸\n" * 3000 + "∙ 자료구조 (Data Structures)\n리스트와 트리를 배우고 이진 탐색 트리를 직접 구현하는 과제를 한다.\n" + "끝\n" * 3000
        excerpt = ca.course_excerpt(long, ["자료구조"])
        self.assertIn("이진 탐색 트리를 직접 구현", excerpt)
        self.assertLess(len(excerpt), ca.SYLLABUS_BEFORE + ca.SYLLABUS_AFTER + 10)
        # 로그인 없이 강의계획서를 보여 주는 수강신청 사이트는 막지 않는다.
        self.assertFalse(ca.login_page("https://sugang.khu.ac.kr/core?attribute=lectPlan&loginYn=N"))
        self.assertTrue(ca.login_page("https://e-campus.khu.ac.kr/course/1"))

    def test_decode_page_follows_byte_order_mark(self):
        page = '<meta charset="euc-kr"><p>숙제 17</p>'
        self.assertEqual(ca.decode_page(page.encode("utf-16"), "text/html"), page)
        self.assertEqual(ca.decode_page(b"\xef\xbb\xbf" + page.encode("utf-8"), ""), page)
        self.assertEqual(ca.decode_page("숙제".encode("cp949"), "text/html; charset=euc-kr"), "숙제")

    def test_check_documents_keeps_only_open_pages_naming_the_course(self):
        group = {"names": ["자료구조"], "name": "자료구조"}
        fetched = {DOC_URL: DOC_TEXT, "https://dept.example.ac.kr/other": "다른 과목만 있는 문서 " * 30, "https://dept.example.ac.kr/short": "로그인이 필요합니다"}
        docs = [
            {"문서_URL": DOC_URL, "문서_종류": "교과목해설", "추출_텍스트_요약": "요약"},
            {"문서_URL": DOC_URL + "#again", "문서_종류": "교과목해설", "추출_텍스트_요약": "같은 문서"},
            {"문서_URL": "https://portal.example.ac.kr/syllabus?id=1", "문서_종류": "강의계획서", "추출_텍스트_요약": ""},
            {"문서_URL": "https://dept.example.ac.kr/other", "문서_종류": "교과목해설", "추출_텍스트_요약": ""},
            {"문서_URL": "https://dept.example.ac.kr/short", "문서_종류": "강의계획서", "추출_텍스트_요약": ""},
            {"문서_URL": "https://dept.example.ac.kr/gone", "문서_종류": "없는종류", "추출_텍스트_요약": ""},
        ]
        kept, dropped = ca.check_documents({"문서": docs}, group, fetched.get)
        self.assertEqual([doc["문서_URL"] for doc in kept], [DOC_URL])
        self.assertEqual([drop["이유"] for drop in dropped], ["같은 문서", "로그인 필요 페이지", "문서에 과목명이 없음", "내용 없음(로그인·스크립트 페이지일 수 있음)", "문서를 열 수 없음"])
        # 직접 받지 못해도 검색 도구가 받은 본문이 있으면 쓴다.
        kept, _ = ca.check_documents({"문서": [docs[-1]]}, group, lambda url: None, {"https://dept.example.ac.kr/gone": [DOC_TEXT]})
        self.assertEqual(kept[0]["문서_종류"], "교과목해설")

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
        answer("stage0", {"찾음": False, "문서": []})
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
        # 대표 과제(github)·시험 형태(made.up) 근거도 직접 받아 보고, 받을 수 없어 버린다.
        self.assertEqual(reasons, ["근거 문장을 출처에서 찾지 못함", "근거 없음", "막은 사이트", *["출처를 열 수 없음"] * 4])
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
