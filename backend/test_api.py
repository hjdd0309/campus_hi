import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from fastapi.testclient import TestClient
from backend import main
from backend.main import app

# 테스트는 실제 data/partners.json 대신 이 목록을 쓴다(제휴 목록이 바뀌어도 테스트가 흔들리지 않게).
TEST_PARTNERS = {"경희대학교": {"since": "2026-10-28", "example": True}}


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.folder = tempfile.TemporaryDirectory()
        cls.partners_path = Path(cls.folder.name) / "partners.json"

    @classmethod
    def tearDownClass(cls):
        cls.folder.cleanup()

    def use_partners(self, entries):
        self.partners_path.write_text(json.dumps(entries, ensure_ascii=False), encoding="utf-8")
        main.partners.cache_clear()

    def setUp(self):
        self.client = TestClient(app)
        patcher = mock.patch.object(main, "PARTNERS_PATH", self.partners_path)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(main.partners.cache_clear)
        self.use_partners(TEST_PARTNERS)

    def test_course_school_curriculum_contract(self):
        response = self.client.post("/api/course_list", json={"interests": "디자인"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("산업디자인학과", response.json()["course_list"])
        schools = [item["school"] for item in self.client.post("/api/school_list", json={"course": "산업디자인학과"}).json()["school_list"]]
        self.assertIn("경희대학교", schools)
        # 제휴 대학(경희대학교)이 먼저, 그다음 이름순.
        self.assertEqual(schools, sorted(schools, key=lambda school: (school != "경희대학교", school)))
        curriculum = self.client.post("/api/curriculum_list", json={"school": "경희대학교", "course": "산업디자인학과"})
        self.assertEqual(curriculum.status_code, 200)
        subjects = curriculum.json()["curriculum_list"]
        self.assertGreater(len(subjects), 0)
        self.assertTrue(all(isinstance(subject, str) for subject in subjects))
        self.assertEqual(len(subjects), len(set(subjects)))
        self.assertEqual(curriculum.json()["category"], "예체능")
        self.assertEqual(curriculum.json()["duration"], "4년")
        self.assertEqual(curriculum.json()["region"], "경기도")

    def test_every_listed_program_is_undergraduate_with_subjects(self):
        from backend.main import catalog
        data = catalog()
        self.assertGreater(len(data.programs), 10000)
        for (school, course), program in data.programs.items():
            self.assertNotIn("대학원", school)
            self.assertTrue(program["curriculum"])
        for course, schools in data.schools.items():
            self.assertTrue(all((school, course) in data.programs for school in schools))
        self.assertEqual(self.client.post("/api/school_list", json={"course": "없는학과-999"}).json(), {"school_list": []})

    def test_programs_without_a_major_to_experience_are_excluded(self):
        from backend.main import catalog, excluded
        data = catalog()
        # 입학 뒤 전공을 정하는 과정, 교양 과정, 학년이 하나뿐인 1년 과정은 학년별 체험을 만들 수 없어 뺀다.
        for course in ("자유전공학부", "자율전공학과", "교양학부", "경영대학 무전공학과", "IT대학 자율학부"):
            self.assertNotIn(course, data.schools, course)
            self.assertEqual(self.client.post("/api/school_list", json={"course": course}).json(), {"school_list": []})
        self.assertFalse(any(study.startswith("1년") for study in (program["duration"] for program in data.programs.values())))
        self.assertTrue(any("전공심화" in program["duration"] for program in data.programs.values()))
        # 이름에 비슷한 글자가 들어간 실제 전공은 남긴다.
        for course in ("국제비서사무전공", "문화교양학과", "과학기술법무전공"):
            self.assertIn(course, data.schools, course)
        self.assertFalse(excluded("자율주행공학과", "4년"))
        self.assertTrue(excluded("간호학과", "1년(전공심화)"))
        self.assertFalse(excluded("간호학과", "2년(전공심화)"))
        self.assertFalse(excluded("간호학과", "모름"))

    def test_search_filter_and_paging(self):
        everything = self.client.post("/api/course_list", json={"interests": "전체"}).json()
        self.assertEqual(len(everything["course_list"]), 30)
        self.assertGreater(everything["total"], 5000)
        first = self.client.post("/api/course_list", json={"interests": "전체", "query": " 컴퓨터 공학 ", "limit": 2}).json()
        second = self.client.post("/api/course_list", json={"interests": "전체", "query": "컴퓨터공학", "limit": 2, "offset": 2}).json()
        self.assertEqual(first["total"], second["total"])
        self.assertEqual(len(first["course_list"]), 2)
        self.assertFalse(set(first["course_list"]) & set(second["course_list"]))
        self.assertTrue(all("컴퓨터공학" in name for name in first["course_list"] + second["course_list"]))
        exact = self.client.post("/api/course_list", json={"interests": "전체", "query": "심리학과"}).json()["course_list"]
        self.assertEqual(exact[0], "심리학과")
        self.assertIn("상담심리학과", exact)
        prefix = self.client.post("/api/course_list", json={"interests": "전체", "query": "컴퓨터"}).json()["course_list"]
        self.assertTrue(prefix[0].startswith("컴퓨터"))
        engineering = self.client.post("/api/course_list", json={"interests": "공학", "limit": 100}).json()["course_list"]
        self.assertIn("컴퓨터공학과", engineering)
        self.assertNotIn("간호학과", engineering)
        past_end = self.client.post("/api/course_list", json={"interests": "전체", "offset": 99999}).json()
        self.assertEqual(past_end["course_list"], [])
        for body in ({"interests": "전체", "limit": 0}, {"interests": "전체", "limit": 1000}, {"interests": "전체", "offset": -1}):
            self.assertEqual(self.client.post("/api/course_list", json=body).status_code, 400)

    def test_onboarding_keywords_all_find_courses(self):
        for keyword in ("디자인", "영상 / 콘텐츠", "음악", "연기", "체육", "심리", "교육", "사회", "경영", "컴퓨터", "데이터", "공학", "생명과학", "인문사회", "자연과학", "예체능", "의학"):
            self.assertGreater(self.client.post("/api/course_list", json={"interests": keyword}).json()["total"], 0, keyword)
            self.assertGreater(self.client.post("/api/program_list", json={"interests": keyword}).json()["total"], 0, keyword)

    def similar(self, school, course, interests="전체"):
        return self.client.post("/api/program_list", json={"interests": interests, "school": school, "course": course}).json()

    def test_program_list_suggests_similar_programs_at_the_wanted_school(self):
        # 서울대학교에는 "전자"가 들어간 학과가 없지만(남서울대·동서울대 결과만 있다), 전기·정보공학부가 같은 과목을 가르친다.
        result = self.similar("서울대학교", "전자")
        self.assertGreater(result["total"], 0)
        self.assertNotIn("서울대학교", {item["school"] for item in result["programs"]})
        self.assertEqual(result["similar_programs"][0], {"school": "서울대학교", "course": "전기·정보공학부", "category": "공학", "duration": "4년", "region": "서울특별시", "partner": False, "partner_example": False})
        self.assertEqual(self.similar("서울대", "전자")["similar_programs"], result["similar_programs"])
        self.assertEqual(result["similar_courses"], [])
        software = [item["course"] for item in self.similar("고려대학교", "소프트웨어")["similar_programs"]]
        self.assertEqual(software[0], "컴퓨터학과")
        self.assertLessEqual(len(software), 3)
        # 검색어가 이름에 들어간 학과가 전국에 없으면 오타를 고친 학과의 과목으로 찾는다.
        self.assertTrue(all(item["school"] == "서울대학교" and "건축" in item["course"] for item in self.similar("서울대", "견축")["similar_programs"]))
        # 관심 분야 필터와 상관없이 추천한다.
        self.assertEqual(self.similar("서울대학교", "전기", "인문사회")["similar_programs"][0]["course"], "전기·정보공학부")
        # 찾는 학교에서 결과가 나왔거나, 비슷한 학과가 없거나, 학교가 없으면 추천하지 않는다.
        self.assertEqual(self.similar("연세대학교", "전자")["similar_programs"], [])
        self.assertEqual(self.similar("서울대학교", "호텔")["similar_programs"], [])
        self.assertEqual(self.similar("없는학교", "전자")["similar_programs"], [])
        self.assertEqual(self.similar("서울대학교", "")["similar_programs"], [])

    def test_program_list_suggests_course_names_for_typos(self):
        self.assertEqual(self.similar("", "견축")["similar_courses"][:2], ["건축학과", "건축공학과"])
        self.assertEqual(self.similar("", "컴퓨타")["similar_courses"][0], "컴퓨터공학과")
        self.assertEqual(self.similar("", "기게공학")["similar_courses"][0], "기계공학과")
        self.assertEqual(self.similar("", "간오", "공학")["similar_courses"][0], "간호학과")
        for course in ("ㅁㄴㅇ", "x" * 100, "블록체인의미래"):
            self.assertEqual(self.similar("", course)["similar_courses"], [], course)
        self.assertEqual(self.similar("", "")["similar_courses"], [])
        # 결과가 있으면 보내지 않는다.
        self.assertEqual(self.similar("", "건축")["similar_courses"], [])
        self.assertTrue(all(len(self.similar("", word)["similar_courses"]) <= 5 for word in ("견축", "경엉")))

    def test_program_list_searches_school_and_course(self):
        everything = self.client.post("/api/program_list", json={"interests": "전체"}).json()
        self.assertEqual(everything["total"], 12732)
        self.assertEqual(len(everything["programs"]), 30)
        self.assertEqual(set(everything["programs"][0]), {"school", "course", "category", "duration", "region", "partner", "partner_example"})
        both = self.client.post("/api/program_list", json={"interests": "전체", "school": "경희대", "course": "산업디자인"}).json()["programs"]
        self.assertEqual(both[0], {"school": "경희대학교", "course": "산업디자인학과", "category": "예체능", "duration": "4년", "region": "경기도", "partner": True, "partner_example": True})
        exact = self.client.post("/api/program_list", json={"interests": "전체", "course": "심리학과", "limit": 100}).json()["programs"]
        self.assertTrue(all(item["course"] == "심리학과" for item in exact[:27]))
        school = self.client.post("/api/program_list", json={"interests": "공학", "school": "가천대학교", "limit": 100}).json()
        self.assertGreater(school["total"], 5)
        self.assertTrue(all(item["school"] == "가천대학교" and (item["category"] == "공학" or "공학" in item["course"]) for item in school["programs"]))
        self.assertFalse(any("대학원" in item["school"] for item in everything["programs"] + school["programs"]))
        first = self.client.post("/api/program_list", json={"interests": "예체능", "limit": 5}).json()["programs"]
        second = self.client.post("/api/program_list", json={"interests": "예체능", "limit": 5, "offset": 5}).json()["programs"]
        self.assertFalse({(item["school"], item["course"]) for item in first} & {(item["school"], item["course"]) for item in second})
        self.assertEqual(self.client.post("/api/program_list", json={"interests": "전체", "school": "없는학교", "course": "없는학과"}).json(), {"programs": [], "total": 0, "similar_programs": [], "similar_courses": []})
        # 학교 검색어는 학교명에서만, 학과 검색어는 학과명에서만 찾는다.
        self.assertEqual(self.client.post("/api/program_list", json={"interests": "전체", "school": "산업디자인"}).json()["total"], 0)
        # 찾는 학과가 있으면 비슷한 학과는 보내지 않는다.
        self.assertEqual(everything["similar_programs"] + everything["similar_courses"], [])
        found = self.client.post("/api/program_list", json={"interests": "전체", "school": "경희대학교", "course": "산업디자인"}).json()
        self.assertEqual(found["similar_programs"] + found["similar_courses"], [])
        # 예전 한 칸 검색(query)은 받지 않는다.
        self.assertEqual(self.client.post("/api/program_list", json={"interests": "전체", "query": "경희대"}).status_code, 400)

    def test_program_list_matches_words_inside_names(self):
        search = lambda **body: self.client.post("/api/program_list", json={"interests": "전체", "limit": 100, **body}).json()
        # 줄임말처럼 이름 일부만 써도 찾고, 검색어로 시작하는 학교를 먼저 보여준다.
        seoul = search(school="서울대", course="전기")["programs"]
        self.assertIn({"school": "서울대학교", "course": "전기·정보공학부"}, [{"school": p["school"], "course": p["course"]} for p in seoul])
        self.assertEqual(seoul[0]["school"], "서울대학교")
        self.assertTrue(all("서울대" in p["school"] and "전기" in p["course"] for p in seoul))
        # 띄어쓰기와 구두점(·)을 무시하고, 낱말은 순서와 상관없이 모두 들어 있으면 찾는다.
        for course in ("전기 전자", "전자 전기", "전기·전자"):
            names = {p["course"] for p in search(school="홍익대", course=course)["programs"]}
            self.assertIn("전자·전기공학부", names, course)
        self.assertEqual(search(school="홍익대", course="전자전기")["programs"][0]["course"], "전자·전기공학부")
        # 구두점만 쓴 검색어는 없는 것으로 본다.
        self.assertEqual(search(school="·", course="  ")["total"], 12732)
        self.assertEqual(self.client.post("/api/program_list", json={"interests": ""}).status_code, 400)

    def curriculum(self, school, course):
        response = self.client.post("/api/curriculum_list", json={"school": school, "course": course})
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_verified_department_gets_subject_years(self):
        result = self.curriculum("경희대학교", "컴퓨터공학부 컴퓨터공학과")
        years = result["years"]
        self.assertEqual(set(years), {"subjects", "source_url", "curriculum_year", "checked_at"})
        self.assertTrue(years["source_url"].startswith("https://"))
        self.assertEqual(years["curriculum_year"], 2026)
        # 과목명은 원본 교과목명 그대로이고, 학년은 수업연한 안의 정수다. 학기 구분은 없다.
        self.assertGreater(len(years["subjects"]), 0)
        self.assertTrue(set(years["subjects"]) <= set(result["curriculum_list"]))
        self.assertTrue(all(isinstance(year, int) and 1 <= year <= 4 for year in years["subjects"].values()))
        self.assertEqual((years["subjects"]["객체지향프로그래밍"], years["subjects"]["컴퓨터구조"], years["subjects"]["데이터베이스"]), (1, 2, 3))
        self.assertNotIn("terms", result)

    def test_department_without_year_data_gets_none(self):
        result = self.curriculum("경희대학교", "산업디자인학과")
        self.assertIsNone(result["years"])
        self.assertNotIn("terms", result)
        self.assertGreater(len(result["curriculum_list"]), 0)

    def test_year_data_is_sent_regardless_of_partnership_and_only_for_real_subjects(self):
        from unittest import mock
        entry = {"school": "서울대학교", "course": "전기·정보공학부", "url": "https://example.ac.kr/c", "curriculum_year": None, "checked_at": "2026-10-28", "status": "verified", "subjects": {"없는과목": 1}}
        with mock.patch("backend.main.year_curricula", return_value={("서울대학교", "전기·정보공학부"): entry}):
            # 교과목에 없는 과목만 있으면 보내지 않는다.
            self.assertIsNone(self.curriculum("서울대학교", "전기·정보공학부")["years"])
            subject = self.curriculum("서울대학교", "전기·정보공학부")["curriculum_list"][0]
            entry["subjects"] = {subject: 2, "없는과목": 1}
            result = self.curriculum("서울대학교", "전기·정보공학부")
        self.assertIs(result["partner"], False)
        self.assertEqual(result["years"], {"subjects": {subject: 2}, "source_url": "https://example.ac.kr/c", "curriculum_year": None, "checked_at": "2026-10-28"})

    def test_school_and_program_lists_mark_partners(self):
        schools = self.client.post("/api/school_list", json={"course": "산업디자인학과"}).json()["school_list"]
        self.assertTrue(all(set(item) == {"school", "partner", "partner_example"} and isinstance(item["partner"], bool) for item in schools))
        self.assertEqual([item["school"] for item in schools if item["partner"]], ["경희대학교"])
        # 제휴 대학이 맨 위, 나머지는 이름순.
        self.assertEqual(schools[0], {"school": "경희대학교", "partner": True, "partner_example": True})
        self.assertEqual([item["school"] for item in schools[1:]], sorted(item["school"] for item in schools[1:]))
        programs = self.client.post("/api/program_list", json={"interests": "전체", "course": "산업디자인학과", "limit": 100}).json()["programs"]
        self.assertTrue(all(item["partner"] is (item["school"] == "경희대학교") for item in programs))
        # 검색 결과 안의 제휴 대학만 맨 위로 올린다. 결과의 구성은 그대로이고, 나머지의 순서도 그대로다.
        from unittest import mock
        with mock.patch("backend.main.partners", return_value={}):
            plain = self.client.post("/api/program_list", json={"interests": "전체", "course": "산업디자인학과", "limit": 100}).json()["programs"]
        pairs = lambda items: [(item["school"], item["course"]) for item in items]
        self.assertTrue(programs[0]["partner"])
        self.assertEqual(sorted(pairs(programs)), sorted(pairs(plain)))
        self.assertEqual(pairs(programs), pairs([item for item in plain if item["school"] == "경희대학교"] + [item for item in plain if item["school"] != "경희대학교"]))

    def test_partners_lead_only_within_matching_results(self):
        search = lambda **body: self.client.post("/api/program_list", json={"interests": "전체", "limit": 100, **body}).json()
        # 경희대에 없는 학과를 찾으면 제휴 대학을 끼워 넣지 않는다.
        therapy = search(course="물리치료학과")["programs"]
        self.assertTrue(therapy and all(not item["partner"] and "물리치료" in item["course"] for item in therapy))
        # 다른 학교를 찾으면 제휴 대학이 나오지 않는다.
        self.assertTrue(all(item["school"] == "서울대학교" or "서울대" in item["school"] for item in search(school="서울대")["programs"]))
        # 여러 쪽으로 나눠 받아도 제휴 대학은 첫 쪽 맨 위에만 있다.
        first = self.client.post("/api/program_list", json={"interests": "전체", "course": "컴퓨터", "limit": 5}).json()["programs"]
        second = self.client.post("/api/program_list", json={"interests": "전체", "course": "컴퓨터", "limit": 5, "offset": 5}).json()["programs"]
        self.assertTrue(all(item["partner"] for item in first[:3]))
        self.assertFalse(any(item["partner"] for item in second))

    def test_real_example_and_non_partners(self):
        # 실제 제휴(example 없음), 예시 제휴(example: true), 제휴 아님 세 경우.
        self.use_partners({"고려대학교": {"since": "2026-10-28"}, "경희대학교": {"since": "2026-10-28", "example": True}})
        real, example, none = (
            {"partner": True, "partner_example": False},
            {"partner": True, "partner_example": True},
            {"partner": False, "partner_example": False},
        )
        fields = lambda item: {"partner": item["partner"], "partner_example": item["partner_example"]}
        for school, expected in (("고려대학교", real), ("경희대학교", example), ("서울대학교", none)):
            programs = self.client.post("/api/program_list", json={"interests": "전체", "school": school, "limit": 5}).json()["programs"]
            self.assertTrue(programs and all(item["school"] == school and fields(item) == expected for item in programs), school)
        schools = self.client.post("/api/school_list", json={"course": "경영학과"}).json()["school_list"]
        self.assertEqual(fields(next(item for item in schools if item["school"] == "가천대학교")), none)
        # 실제 제휴와 예시 제휴 모두 맨 위에 온다(그 안은 이름순).
        self.assertEqual([item["school"] for item in schools[:2]], ["경희대학교", "고려대학교"])
        self.assertEqual([fields(item) for item in schools[:2]], [example, real])
        khu = self.curriculum("경희대학교", "컴퓨터공학부 컴퓨터공학과")
        self.assertEqual(fields(khu), example)
        self.assertEqual(fields(self.curriculum("고려대학교", "컴퓨터학과")), real)
        self.assertEqual(fields(self.curriculum("가천대학교", "컴퓨터공학과")), none)
        # 과목별 학년은 제휴 여부와 상관없이 같다.
        self.use_partners({})
        self.assertEqual(self.curriculum("경희대학교", "컴퓨터공학부 컴퓨터공학과")["years"], khu["years"])

    def test_partner_file_drops_bad_entries(self):
        self.use_partners({
            "경희대학교": {"since": "2026-10-28", "example": True},
            "고려대학교": {"since": "2026-10-28"},
            "서울대학교": {"since": "어제"},
            "연세대학교": {},
            "가천대학교": {"since": "2026-10-28", "example": "yes"},
            "국민대학교": "2026-10-28",
            "없는대학교": {"since": "2026-10-28"},
        })
        with self.assertLogs("uvicorn.error", "WARNING"):
            self.assertEqual(main.partners(), {"경희대학교": {"since": "2026-10-28", "example": True}, "고려대학교": {"since": "2026-10-28", "example": False}})
        main.partners.cache_clear()
        with mock.patch.object(main, "PARTNERS_PATH", Path(self.folder.name) / "none.json"):
            self.assertEqual(main.partners(), {})

    def test_course_names_with_commas_stay_intact(self):
        result = self.client.post("/api/course_list", json={"interests": "전체", "query": "PEP"}).json()["course_list"]
        self.assertIn("PEP(정치학,경제학,철학)연계전공", result)

    def test_validation_and_not_found(self):
        for body in ({}, {"interests": " "}, {"interests": 3}):
            response = self.client.post("/api/course_list", json=body)
            self.assertEqual(response.status_code, 400)
            self.assertIsInstance(response.json()["detail"], str)
        response = self.client.post("/api/curriculum_list", json={"school": "없는학교", "course": "없는학과"})
        self.assertEqual(response.status_code, 404)
        graduate = self.client.post("/api/curriculum_list", json={"school": "가천대학교 일반대학원", "course": "심리학과"})
        self.assertEqual(graduate.status_code, 404)

    def test_empty_search_returns_empty_list(self):
        self.assertEqual(self.client.post("/api/course_list", json={"interests": "없는분야-999"}).json(), {"course_list": [], "total": 0})

    def test_unknown_api_path_returns_json_404(self):
        for response in (self.client.get("/api/nope"), self.client.post("/api/nope", json={})):
            self.assertEqual(response.status_code, 404)
            self.assertIsInstance(response.json()["detail"], str)

    def test_oversized_and_unsized_bodies_are_rejected(self):
        big = self.client.post("/api/course_list", json={"interests": "가" * 20000})
        self.assertEqual(big.status_code, 413)
        self.assertIsInstance(big.json()["detail"], str)
        chunked = self.client.post("/api/course_list", content=iter([b'{"interests":"design"}']), headers={"Content-Type": "application/json"})
        self.assertEqual(chunked.status_code, 411)

    def test_security_and_cache_headers(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.headers["x-content-type-options"], "nosniff")
        self.assertEqual(response.headers["x-frame-options"], "DENY")
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_unexpected_error_returns_json_without_internals(self):
        from unittest import mock
        client = TestClient(app, raise_server_exceptions=False)
        with mock.patch("backend.main.catalog", side_effect=RuntimeError("secret path")):
            response = client.post("/api/school_list", json={"course": "심리학과"})
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("secret", response.text)
        self.assertIsInstance(response.json()["detail"], str)


if __name__ == "__main__":
    unittest.main()
