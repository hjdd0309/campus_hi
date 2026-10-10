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
        for keyword in ("디자인", "영상·콘텐츠", "미술", "공연", "심리", "교육", "사회", "경영", "컴퓨터", "데이터", "공학", "생명과학", "인문사회", "자연과학", "예체능", "의학"):
            self.assertGreater(self.client.post("/api/course_list", json={"interests": keyword}).json()["total"], 0, keyword)

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
