import unittest

from fastapi.testclient import TestClient
from backend.main import app


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_course_school_curriculum_contract(self):
        response = self.client.post("/api/course_list", json={"interests": "디자인"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("산업디자인학과", response.json()["course_list"].split(","))
        schools = self.client.post("/api/school_list", json={"course": "산업디자인학과"}).json()["school_list"].split(",")
        self.assertIn("경희대학교", schools)
        curriculum = self.client.post("/api/curriculum_list", json={"school": "경희대학교", "course": "산업디자인학과"})
        self.assertEqual(curriculum.status_code, 200)
        subjects = curriculum.json()["curriculum_list"]
        self.assertGreater(len(subjects), 0)
        self.assertTrue(all(isinstance(subject, str) for subject in subjects))
        self.assertEqual(len(subjects), len(set(subjects)))

    def test_validation_and_not_found(self):
        for body in ({}, {"interests": " "}, {"interests": 3}):
            response = self.client.post("/api/course_list", json=body)
            self.assertEqual(response.status_code, 400)
            self.assertIsInstance(response.json()["detail"], str)
        response = self.client.post("/api/curriculum_list", json={"school": "없는학교", "course": "없는학과"})
        self.assertEqual(response.status_code, 404)

    def test_empty_search_returns_empty_list(self):
        self.assertEqual(self.client.post("/api/course_list", json={"interests": "없는분야-999"}).json(), {"course_list": ""})
        self.assertEqual(self.client.post("/api/school_list", json={"course": "없는학과-999"}).json(), {"school_list": ""})


if __name__ == "__main__":
    unittest.main()
