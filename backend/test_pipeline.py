import csv
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from backend import pipeline

SCHOOL, COURSE = "경희대학교", "산업디자인학과"
PAGE = """<html><head><title>교육과정</title><style>td{color:red}</style><script>var x = "<td>숨김</td>";</script></head><body>
<h2>산업디자인학과 교육과정</h2>
<table>
<tr><th>학년</th><th>학기</th><th>교과목명</th><th>학점</th></tr>
<tr><td rowspan="2">1학년</td><td>1학기</td><td>드로잉</td><td>3</td></tr>
<tr><td>2학기</td><td>평면디자인</td><td>3</td></tr>
<tr><td colspan="2">2학년 공통</td><td>UX디자인</td><td>3</td></tr>
</table><p>문의: 학과 사무실</p></body></html>"""
# 1~3학년이 모두 있는 추출 결과. "UX 디자인"은 띄어쓰기만 달라 "UX디자인"에 합쳐지고, "드로잉"은 1·2학년에 걸쳐 있다.
SUBJECTS = [
    {"name": "드로잉", "years": [1]},
    {"name": "평면디자인", "years": [1]},
    {"name": "입체디자인", "years": [1]},
    {"name": "UX디자인", "years": [2]},
    {"name": " 디지털디자인 ", "years": [2]},
    {"name": "드로잉 ", "years": [2]},
    {"name": "UX 디자인", "years": [2]},
    {"name": "서비스디자인", "years": [3]},
]
FIVE = [{"name": name, "years": [1]} for name in ("가", "나", "다", "라", "마")]
FOUND = {"found": True, "reason": "편성표", "curriculum_year": 2026, "subjects": SUBJECTS}


class PipelineTests(unittest.TestCase):
    def test_html_tables_keep_year_on_every_row(self):
        text = pipeline.html_to_text(PAGE)
        self.assertIn("1학년 | 1학기 | 드로잉 | 3", text)
        self.assertIn("1학년 | 2학기 | 평면디자인 | 3", text)
        self.assertIn("2학년 공통 | 2학년 공통 | UX디자인 | 3", text)
        self.assertIn("문의: 학과 사무실", text)
        self.assertNotIn("숨김", text)
        self.assertNotIn("color:red", text)

    def test_decode_uses_declared_or_fallback_encoding(self):
        self.assertEqual(pipeline.decode("학년".encode("cp949"), "text/html; charset=euc-kr"), "학년")
        self.assertEqual(pipeline.decode('<meta charset="euc-kr">학년'.encode("cp949"), ""), '<meta charset="euc-kr">학년')
        self.assertEqual(pipeline.decode("학년".encode("utf-8"), "text/html; charset=nope"), "학년")
        self.assertEqual(pipeline.decode("학년".encode("cp949"), ""), "학년")

    def test_validate_merges_to_original_names_and_lowest_year(self):
        checked = pipeline.validate(SCHOOL, COURSE, SUBJECTS)
        # 원본 교과목 순서대로, 원본 이름으로 저장한다.
        self.assertEqual(checked["subjects"], {"UX디자인": 2, "드로잉": 1, "디지털디자인": 2, "입체디자인": 1, "평면디자인": 1, "서비스디자인": 3})
        # 여러 학년에 걸친 과목은 가장 낮은 학년을 쓰고 표시해 둔다.
        self.assertEqual(checked["multi_year"], ["드로잉"])
        self.assertEqual((checked["unmatched"], checked["missing_years"], checked["match_ratio"], checked["status"]), ([], [], 1.0, "verified"))
        # 한 과목에 범위로 적힌 학년도 같다.
        ranged = pipeline.validate(SCHOOL, COURSE, [*SUBJECTS[:5], {"name": "서비스디자인", "years": [4, 3]}])
        self.assertEqual((ranged["subjects"]["서비스디자인"], ranged["multi_year"]), (3, ["서비스디자인"]))

    def test_validate_matches_notation_differences_and_lists_the_rest(self):
        subjects = [
            {"name": "기초 산업디자인 Ⅰ", "years": [1]},  # 표기만 다름 → 기초산업디자인 1
            {"name": "3d design 1", "years": [1]},  # 대소문자·띄어쓰기 → 3D Design 1
            {"name": "졸업논문", "years": [4]},  # 괄호를 지우면 하나뿐 → 졸업논문(산업디자인학전공)
            {"name": "공간디자인", "years": [2]},  # 공간디자인1·2 중 어느 것인지 모름
            {"name": "몰입심화학습(가)", "years": [3]},  # 괄호를 지우면 같아지는 이름이 여럿
            {"name": "몰입심화학습(나)", "years": [3]},
            {"name": "지어낸과목", "years": [3]},
        ]
        checked = pipeline.validate(SCHOOL, COURSE, subjects)
        self.assertEqual(checked["subjects"], {"3D Design 1": 1, "기초산업디자인 1": 1, "졸업논문(산업디자인학전공)": 4})
        self.assertEqual(checked["unmatched"], [{"name": "공간디자인", "year": 2}, {"name": "몰입심화학습(가)", "year": 3}, {"name": "몰입심화학습(나)", "year": 3}, {"name": "지어낸과목", "year": 3}])
        self.assertEqual(checked["match_ratio"], round(3 / 7, 3))
        # 매칭률이 낮고 2·3학년이 비어 있어 공개하지 않는다.
        self.assertEqual((checked["missing_years"], checked["status"]), ([2, 3], "review"))

    def test_validate_needs_every_year_before_the_last(self):
        checked = pipeline.validate(SCHOOL, COURSE, SUBJECTS[:5])
        self.assertEqual((checked["missing_years"], checked["status"]), ([3], "review"))

    def test_validate_rejects_bad_data(self):
        for subjects in (
            [{"name": "가", "years": [5]}, *FIVE],
            [{"name": "가", "years": [0]}, *FIVE],
            [{"name": "가", "years": [True]}, *FIVE],
            [{"name": "가", "years": "1"}, *FIVE],
            [{"name": "드로잉", "years": [1]}, {"name": "", "years": [1]}, {"name": "  ", "years": [1]}, {"name": "평면디자인", "years": []}],
        ):
            with self.assertRaises(ValueError):
                pipeline.validate(SCHOOL, COURSE, subjects)
        with self.assertRaises(ValueError):
            pipeline.validate("없는대학교", COURSE, SUBJECTS)
        with self.assertRaises(ValueError):
            pipeline.validate("가천대학교 일반대학원", "심리학과", SUBJECTS)

    def test_normalize_ignores_notation_differences(self):
        self.assertEqual(pipeline.normalize("기초 산업디자인 Ⅱ (Basic Design)"), pipeline.normalize("기초산업디자인2"))
        self.assertNotEqual(pipeline.normalize("공간디자인1"), pipeline.normalize("공간디자인2"))

    def test_year_limit_follows_duration(self):
        self.assertEqual([pipeline.max_year(text) for text in ("4년", "2년", "2.5년", "6년", "1년(전공심화)", "")], [4, 2, 3, 6, 4, 4])

    def run_collect(self, results, extracted, raw=b"<html>v1</html>", url="https://example.ac.kr/c", **options):
        calls = []

        def extractor(school, course, content, kind, content_type):
            calls.append((school, course, kind))
            if isinstance(extracted, Exception):
                raise extracted
            return extracted

        with tempfile.TemporaryDirectory() as folder, mock.patch.object(pipeline, "SNAPSHOT_DIR", Path(folder)):
            pipeline.collect([{"school": SCHOOL, "course": COURSE, "url": url}], results, extractor=extractor, fetcher=lambda url: (raw, "html", "text/html"), log=lambda line: None, **options)
        return calls

    def test_collect_publishes_only_well_matched_results(self):
        results = {}
        usage = pipeline.usage_of("claude-opus-5-5", 10_000, 2_000)
        self.run_collect(results, {**FOUND, "usage": usage}, today="2026-10-10")
        entry = results[pipeline.key_of(SCHOOL, COURSE)]
        self.assertEqual((entry["status"], entry["match_ratio"], entry["fetched_at"], entry["curriculum_year"]), ("verified", 1.0, "2026-10-10", 2026))
        self.assertEqual(entry["subjects"]["드로잉"], 1)
        self.assertEqual((entry["usage"]["input_tokens"], entry["usage"]["cost_usd"]), (10_000, 0.08))
        self.assertIn("seconds", entry["usage"])
        self.assertEqual(list(pipeline.published(results)), [(SCHOOL, COURSE)])

        unknown = [{"name": f"지어낸과목{n}", "years": [n % 3 + 1]} for n in range(4)] + SUBJECTS[:1]
        results = {}
        self.run_collect(results, {**FOUND, "curriculum_year": 0, "subjects": unknown})
        entry = results[pipeline.key_of(SCHOOL, COURSE)]
        self.assertEqual((entry["status"], entry["curriculum_year"], len(entry["unmatched"])), ("review", None, 4))
        self.assertEqual(pipeline.published(results), {})

        results = {}
        self.run_collect(results, {"found": False, "reason": "과목 설명만 있음", "curriculum_year": 0, "subjects": []})
        self.assertEqual(results[pipeline.key_of(SCHOOL, COURSE)]["status"], "not_found")
        self.assertEqual(pipeline.published(results), {})

    def test_collect_skips_collected_departments_unless_forced(self):
        results = {}
        self.assertEqual(len(self.run_collect(results, FOUND, today="2026-10-10")), 1)
        # 내용이 바뀌어도 이미 수집한 학과는 다시 돌리지 않는다.
        self.assertEqual(len(self.run_collect(results, FOUND, raw=b"<html>v2</html>", today="2026-11-01")), 0)
        self.assertEqual(results[pipeline.key_of(SCHOOL, COURSE)]["fetched_at"], "2026-10-10")
        self.assertEqual(len(self.run_collect(results, FOUND, force=True, today="2026-12-01")), 1)
        self.assertEqual(results[pipeline.key_of(SCHOOL, COURSE)]["fetched_at"], "2026-12-01")
        # 출처 주소가 바뀌면 다시 수집한다.
        self.assertEqual(len(self.run_collect(results, FOUND, url="https://example.ac.kr/new")), 1)
        # 편성이 없던 학과도 다시 돌리지 않는다.
        results = {}
        self.run_collect(results, {"found": False, "reason": "", "curriculum_year": 0, "subjects": []})
        self.assertEqual(len(self.run_collect(results, FOUND)), 0)

    def test_collect_limit_counts_only_new_work(self):
        results = {}
        courses = ("산업디자인학과", "시각디자인학과", "의류디자인학과", "도예학과")
        sources = [{"school": SCHOOL, "course": course, "url": f"https://example.ac.kr/{n}"} for n, course in enumerate(courses)]
        sources.insert(1, {"school": SCHOOL, "course": "건축학과", "url": ""})
        calls = []

        def extractor(school, course, *rest):
            calls.append(course)
            return FOUND

        def run(limit):
            with tempfile.TemporaryDirectory() as folder, mock.patch.object(pipeline, "SNAPSHOT_DIR", Path(folder)):
                pipeline.collect(sources, results, extractor=extractor, fetcher=lambda url: (b"x", "html", ""), limit=limit, log=lambda line: None)

        run(2)
        self.assertEqual(calls, ["산업디자인학과", "시각디자인학과"])
        run(2)
        self.assertEqual(calls[2:], ["의류디자인학과", "도예학과"])
        # 출처가 없는 학과는 건너뛰고 결과도 남기지 않는다.
        self.assertNotIn(pipeline.key_of(SCHOOL, "건축학과"), results)

    def test_collect_failure_keeps_previous_published_data_and_retries(self):
        results = {}
        self.run_collect(results, FOUND)
        self.run_collect(results, RuntimeError("API 오류"), force=True)
        entry = results[pipeline.key_of(SCHOOL, COURSE)]
        self.assertEqual(entry["status"], "verified")
        self.assertIn("API 오류", entry["error"])
        self.assertTrue(entry["subjects"])
        # 오류가 남은 학과는 다음 수집 때 다시 돌리고, 성공하면 오류를 지운다.
        self.assertEqual(len(self.run_collect(results, FOUND)), 1)
        self.assertNotIn("error", results[pipeline.key_of(SCHOOL, COURSE)])

        results = {}
        self.run_collect(results, RuntimeError("처음부터 실패"))
        self.assertEqual(results[pipeline.key_of(SCHOOL, COURSE)]["status"], "error")
        self.assertEqual(pipeline.published(results), {})

    def test_collect_rejects_programs_outside_catalog_without_fetching(self):
        results = {}
        fetched = []
        pipeline.collect([{"school": "없는대학교", "course": "없는학과", "url": "https://example.ac.kr"}], results, extractor=None, fetcher=fetched.append, log=lambda line: None)
        self.assertEqual(fetched, [])
        self.assertEqual(results["없는대학교|없는학과"]["status"], "error")

    def test_report_lists_every_department_of_the_school(self):
        results = {}
        self.run_collect(results, {**FOUND, "usage": pipeline.usage_of("claude-opus-5-5", 10_000, 2_000)})
        sources = [
            {"school": SCHOOL, "course": COURSE, "url": "https://example.ac.kr/c"},
            {"school": SCHOOL, "course": "건축학과", "url": ""},
            {"school": SCHOOL, "course": "도예학과", "url": "https://example.ac.kr/d"},
        ]
        rows = pipeline.report_rows(SCHOOL, sources, results)
        by_course = {row["course"]: row for row in rows}
        self.assertEqual(len(rows), sum(1 for program in pipeline.catalog().programs if program[0] == SCHOOL))
        self.assertEqual((by_course[COURSE]["result"], by_course[COURSE]["match_ratio"], by_course[COURSE]["cost_usd"]), ("성공", 1.0, 0.08))
        self.assertEqual((by_course["건축학과"]["result"], by_course["도예학과"]["result"], by_course["경영학과"]["result"]), ("출처 없음", "수집 전", "출처 없음"))
        self.assertIn("성공 1", pipeline.summarize(rows))
        with tempfile.TemporaryDirectory() as folder:
            path = pipeline.write_report(SCHOOL, rows, Path(folder))
            with path.open(encoding="utf-8-sig", newline="") as file:
                self.assertEqual(len(list(csv.DictReader(file))), len(rows))

    def test_sources_keep_departments_without_url(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "sources.csv"
            path.write_text("school,course,url\n경희대학교,산업디자인학과,https://a.ac.kr\n경희대학교,건축학과,\n", encoding="utf-8")
            expected = [{"school": SCHOOL, "course": COURSE, "url": "https://a.ac.kr"}, {"school": SCHOOL, "course": "건축학과", "url": ""}]
            self.assertEqual(pipeline.load_sources(path), expected)

    def test_fetch_refuses_non_http_urls(self):
        for url in ("file:///etc/passwd", "ftp://example.com/a", "javascript:alert(1)"):
            with self.assertRaises(ValueError):
                pipeline.fetch(url)

    def test_manual_import_and_roundtrip(self):
        subjects = ((1, "드로잉"), (2, "드로잉"), (1, "평면디자인"), (2, "UX디자인"), (3, "서비스디자인"), (4, "졸업논문(산업디자인학전공)"))
        rows = [{"school": SCHOOL, "course": COURSE, "year": str(year), "subject": subject, "url": "https://a.ac.kr", "curriculum_year": "2025"} for year, subject in subjects]
        results = {}
        self.assertEqual(pipeline.import_rows(rows, results, today="2026-10-10"), 1)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "years.json"
            pipeline.save_results(results, path)
            self.assertEqual(pipeline.load_results(path), results)
        entry = results[pipeline.key_of(SCHOOL, COURSE)]
        self.assertEqual((entry["status"], entry["curriculum_year"], entry["url"], entry["subjects"]["드로잉"], entry["multi_year"]), ("verified", 2025, "https://a.ac.kr", 1, ["드로잉"]))
        with self.assertRaises(ValueError):
            pipeline.import_rows([{"school": SCHOOL, "course": COURSE, "year": "일", "subject": "드로잉"}], {})

    def test_extraction_request_shape(self):
        import anthropic

        answer = json.dumps(FOUND)
        reply = mock.Mock(stop_reason="end_turn", model="claude-opus-5-5", usage=mock.Mock(input_tokens=1000, output_tokens=500), content=[mock.Mock(type="text", text=answer)])
        with mock.patch.object(anthropic, "Anthropic") as client:
            create = client.return_value.beta.messages.create
            create.return_value = reply
            extracted = pipeline.extract_with_claude(SCHOOL, COURSE, PAGE.encode(), "html", "text/html; charset=utf-8")
            self.assertEqual(extracted["subjects"], SUBJECTS)
            self.assertEqual(extracted["usage"], {"model": "claude-opus-5-5", "input_tokens": 1000, "output_tokens": 500, "cost_usd": 0.014})
            request = create.call_args.kwargs
            self.assertEqual(request["model"], "claude-opus-5-5")
            self.assertIn("1학년 | 2학기 | 평면디자인", request["messages"][0]["content"][0]["text"])
            self.assertEqual(request["output_config"]["format"]["type"], "json_schema")
            pipeline.extract_with_claude(SCHOOL, COURSE, b"%PDF-1.7 data", "pdf", "application/pdf")
            self.assertEqual(create.call_args.kwargs["messages"][0]["content"][0]["source"]["media_type"], "application/pdf")
            # 단가를 모르는 모델이 응답하면(서버 쪽 대체) 비용은 비워 둔다.
            reply.model = "claude-opus-5"
            self.assertIsNone(pipeline.extract_with_claude(SCHOOL, COURSE, PAGE.encode(), "html", "")["usage"]["cost_usd"])
            reply.stop_reason = "refusal"
            with self.assertRaises(ValueError):
                pipeline.extract_with_claude(SCHOOL, COURSE, PAGE.encode(), "html", "")

    def test_api_serves_only_verified_year_data(self):
        from fastapi.testclient import TestClient

        from backend import main

        results = {}
        names = (("드로잉", 1), ("평면디자인", 1), ("입체디자인", 2), ("UX디자인", 2), ("디지털디자인", 3))
        pipeline.import_rows([{"school": SCHOOL, "course": COURSE, "year": str(year), "subject": name} for name, year in names], results, today="2026-10-10")
        results["가천대학교|컴퓨터공학과"] = {"school": "가천대학교", "course": "컴퓨터공학과", "status": "review", "url": "", "checked_at": "2026-10-10", "subjects": {"자료구조": 2}}
        client = TestClient(main.app)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "years.json"
            pipeline.save_results(results, path)
            main.year_curricula.cache_clear()
            try:
                with mock.patch.object(main, "YEARS_PATH", path):
                    served = client.post("/api/curriculum_list", json={"school": SCHOOL, "course": COURSE}).json()["years"]
                    hidden = client.post("/api/curriculum_list", json={"school": "가천대학교", "course": "컴퓨터공학과"}).json()["years"]
            finally:
                main.year_curricula.cache_clear()
        self.assertEqual(served["subjects"], {"UX디자인": 2, "드로잉": 1, "디지털디자인": 3, "입체디자인": 2, "평면디자인": 1})
        self.assertEqual(served["checked_at"], "2026-10-10")
        self.assertIsNone(hidden)


if __name__ == "__main__":
    unittest.main()
