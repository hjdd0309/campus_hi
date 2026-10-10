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
TERMS = [
    {"year": 1, "semester": 1, "subjects": ["드로잉", "평면디자인", "입체디자인"]},
    {"year": 2, "semester": 0, "subjects": ["UX디자인", " 디지털디자인 ", "드로잉 "]},
    {"year": 2, "semester": 0, "subjects": ["UX 디자인"]},
]
FIVE = ["가", "나", "다", "라", "마"]


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

    def test_validate_cleans_merges_and_scores(self):
        years, ratio = pipeline.validate(SCHOOL, COURSE, TERMS)
        self.assertEqual(years, [
            {"year": 1, "semester": 1, "subjects": ["드로잉", "평면디자인", "입체디자인"]},
            {"year": 2, "semester": 0, "subjects": ["UX디자인", "디지털디자인", "드로잉"]},
        ])
        self.assertEqual(ratio, 1.0)

    def test_validate_rejects_bad_data(self):
        for terms in (
            [{"year": 5, "semester": 1, "subjects": FIVE}],
            [{"year": 0, "semester": 1, "subjects": FIVE}],
            [{"year": True, "semester": 1, "subjects": FIVE}],
            [{"year": 1, "semester": 3, "subjects": FIVE}],
            [{"year": 1, "semester": 1, "subjects": ["드로잉", "", "  "]}],
        ):
            with self.assertRaises(ValueError):
                pipeline.validate(SCHOOL, COURSE, terms)
        with self.assertRaises(ValueError):
            pipeline.validate("없는대학교", COURSE, TERMS)
        with self.assertRaises(ValueError):
            pipeline.validate("가천대학교 일반대학원", "심리학과", TERMS)

    def test_normalize_ignores_notation_differences(self):
        self.assertEqual(pipeline.normalize("기초 산업디자인 Ⅱ (Basic Design)"), pipeline.normalize("기초산업디자인2"))
        self.assertNotEqual(pipeline.normalize("공간디자인1"), pipeline.normalize("공간디자인2"))

    def test_year_limit_follows_duration(self):
        self.assertEqual([pipeline.max_year(text) for text in ("4년", "2년", "2.5년", "6년", "1년(전공심화)", "")], [4, 2, 3, 6, 4, 4])

    def run_collect(self, results, extracted, raw=b"<html>v1</html>", **options):
        calls = []

        def extractor(school, course, content, kind, content_type):
            calls.append((school, course, kind))
            if isinstance(extracted, Exception):
                raise extracted
            return extracted

        with tempfile.TemporaryDirectory() as folder, mock.patch.object(pipeline, "SNAPSHOT_DIR", Path(folder)):
            pipeline.collect([{"school": SCHOOL, "course": COURSE, "url": "https://example.ac.kr/c"}], results, extractor=extractor, fetcher=lambda url: (raw, "html", "text/html"), log=lambda line: None, **options)
        return calls

    def test_collect_publishes_only_well_matched_results(self):
        results = {}
        self.run_collect(results, {"found": True, "reason": "편성표", "terms": TERMS}, today="2026-10-10")
        entry = results[pipeline.key_of(SCHOOL, COURSE)]
        self.assertEqual((entry["status"], entry["match_ratio"], entry["fetched_at"]), ("verified", 1.0, "2026-10-10"))
        self.assertEqual(list(pipeline.published(results)), [(SCHOOL, COURSE)])

        unknown = [{"year": 1, "semester": 1, "subjects": ["지어낸과목1", "지어낸과목2", "지어낸과목3", "지어낸과목4", "드로잉"]}]
        results = {}
        self.run_collect(results, {"found": True, "reason": "", "terms": unknown})
        self.assertEqual(results[pipeline.key_of(SCHOOL, COURSE)]["status"], "review")
        self.assertEqual(pipeline.published(results), {})

        results = {}
        self.run_collect(results, {"found": False, "reason": "과목 설명만 있음", "terms": []})
        self.assertEqual(results[pipeline.key_of(SCHOOL, COURSE)]["status"], "not_found")
        self.assertEqual(pipeline.published(results), {})

    def test_collect_skips_unchanged_pages_and_reextracts_changed_ones(self):
        results = {}
        good = {"found": True, "reason": "", "terms": TERMS}
        self.assertEqual(len(self.run_collect(results, good, today="2026-10-10")), 1)
        self.assertEqual(len(self.run_collect(results, good, today="2026-11-01")), 0)
        entry = results[pipeline.key_of(SCHOOL, COURSE)]
        self.assertEqual((entry["fetched_at"], entry["checked_at"]), ("2026-10-10", "2026-11-01"))
        self.assertEqual(len(self.run_collect(results, good, raw=b"<html>v2</html>", today="2026-12-01")), 1)
        self.assertEqual(results[pipeline.key_of(SCHOOL, COURSE)]["fetched_at"], "2026-12-01")
        self.assertEqual(len(self.run_collect(results, good, raw=b"<html>v2</html>", force=True)), 1)

    def test_collect_failure_keeps_previous_published_data(self):
        results = {}
        self.run_collect(results, {"found": True, "reason": "", "terms": TERMS})
        self.run_collect(results, RuntimeError("API 오류"), raw=b"<html>v2</html>")
        entry = results[pipeline.key_of(SCHOOL, COURSE)]
        self.assertEqual(entry["status"], "verified")
        self.assertIn("API 오류", entry["error"])
        self.assertTrue(entry["years"])

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

    def test_fetch_refuses_non_http_urls(self):
        for url in ("file:///etc/passwd", "ftp://example.com/a", "javascript:alert(1)"):
            with self.assertRaises(ValueError):
                pipeline.fetch(url)

    def test_manual_import_and_roundtrip(self):
        subjects = ((1, "드로잉"), (1, "평면디자인"), (2, "UX디자인"), (3, "서비스디자인"), (4, "졸업논문(산업디자인학전공)"))
        rows = [{"school": SCHOOL, "course": COURSE, "year": str(year), "semester": "1", "subject": subject} for year, subject in subjects]
        results = {}
        self.assertEqual(pipeline.import_rows(rows, results, today="2026-10-10"), 1)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "years.json"
            pipeline.save_results(results, path)
            self.assertEqual(pipeline.load_results(path), results)
        self.assertEqual(results[pipeline.key_of(SCHOOL, COURSE)]["status"], "verified")
        with self.assertRaises(ValueError):
            pipeline.import_rows([{"school": SCHOOL, "course": COURSE, "year": "일", "semester": "1", "subject": "드로잉"}], {})

    def test_extraction_request_shape(self):
        import anthropic

        answer = json.dumps({"found": True, "reason": "표", "terms": TERMS})
        reply = mock.Mock(stop_reason="end_turn", content=[mock.Mock(type="text", text=answer)])
        with mock.patch.object(anthropic, "Anthropic") as client:
            create = client.return_value.beta.messages.create
            create.return_value = reply
            self.assertEqual(pipeline.extract_with_claude(SCHOOL, COURSE, PAGE.encode(), "html", "text/html; charset=utf-8")["terms"], TERMS)
            request = create.call_args.kwargs
            self.assertEqual(request["model"], "claude-opus-5-5")
            self.assertIn("1학년 | 2학기 | 평면디자인", request["messages"][0]["content"][0]["text"])
            self.assertEqual(request["output_config"]["format"]["type"], "json_schema")
            pipeline.extract_with_claude(SCHOOL, COURSE, b"%PDF-1.7 data", "pdf", "application/pdf")
            self.assertEqual(create.call_args.kwargs["messages"][0]["content"][0]["source"]["media_type"], "application/pdf")
            reply.stop_reason = "refusal"
            with self.assertRaises(ValueError):
                pipeline.extract_with_claude(SCHOOL, COURSE, PAGE.encode(), "html", "")

    def test_api_serves_only_verified_year_data(self):
        from fastapi.testclient import TestClient

        from backend import main

        results = {}
        pipeline.import_rows([{"school": SCHOOL, "course": COURSE, "year": "1", "semester": "1", "subject": name} for name in ("드로잉", "평면디자인", "입체디자인", "UX디자인", "디지털디자인")], results, today="2026-10-10")
        results["가천대학교|컴퓨터공학과"] = {"school": "가천대학교", "course": "컴퓨터공학과", "status": "review", "url": "", "checked_at": "2026-10-10", "years": [{"year": 1, "semester": 1, "subjects": FIVE}]}
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
        self.assertEqual(served["terms"][0]["subjects"][0], "드로잉")
        self.assertEqual(served["checked_at"], "2026-10-10")
        self.assertIsNone(hidden)


if __name__ == "__main__":
    unittest.main()
