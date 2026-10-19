import unittest

from fastapi.testclient import TestClient
from backend.main import app


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_course_school_curriculum_contract(self):
        response = self.client.post("/api/course_list", json={"interests": "디자인"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("산업디자인학과", response.json()["course_list"])
        schools = self.client.post("/api/school_list", json={"course": "산업디자인학과"}).json()["school_list"]
        self.assertIn("경희대학교", schools)
        self.assertEqual(schools, sorted(schools))
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

    def test_program_list_searches_school_and_course(self):
        everything = self.client.post("/api/program_list", json={"interests": "전체"}).json()
        self.assertEqual(everything["total"], 12732)
        self.assertEqual(len(everything["programs"]), 30)
        self.assertEqual(set(everything["programs"][0]), {"school", "course", "category", "duration", "region"})
        both = self.client.post("/api/program_list", json={"interests": "전체", "school": "경희대", "course": "산업디자인"}).json()["programs"]
        self.assertEqual(both[0], {"school": "경희대학교", "course": "산업디자인학과", "category": "예체능", "duration": "4년", "region": "경기도"})
        exact = self.client.post("/api/program_list", json={"interests": "전체", "course": "심리학과", "limit": 100}).json()["programs"]
        self.assertTrue(all(item["course"] == "심리학과" for item in exact[:27]))
        school = self.client.post("/api/program_list", json={"interests": "공학", "school": "가천대학교", "limit": 100}).json()
        self.assertGreater(school["total"], 5)
        self.assertTrue(all(item["school"] == "가천대학교" and (item["category"] == "공학" or "공학" in item["course"]) for item in school["programs"]))
        self.assertFalse(any("대학원" in item["school"] for item in everything["programs"] + school["programs"]))
        first = self.client.post("/api/program_list", json={"interests": "예체능", "limit": 5}).json()["programs"]
        second = self.client.post("/api/program_list", json={"interests": "예체능", "limit": 5, "offset": 5}).json()["programs"]
        self.assertFalse({(item["school"], item["course"]) for item in first} & {(item["school"], item["course"]) for item in second})
        self.assertEqual(self.client.post("/api/program_list", json={"interests": "전체", "school": "없는학교", "course": "없는학과"}).json(), {"programs": [], "total": 0})
        # 학교 검색어는 학교명에서만, 학과 검색어는 학과명에서만 찾는다.
        self.assertEqual(self.client.post("/api/program_list", json={"interests": "전체", "school": "산업디자인"}).json()["total"], 0)
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
