import csv
import gzip
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

app = FastAPI(title="Litton Campus API", version="1.0.0")
ALLOWED_COURSES = {"산업디자인학과", "심리학과"}
DATA_PATH = Path(__file__).parent / "data" / "courses.csv.gz"


class RequestBody(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class CourseRequest(RequestBody):
    interests: str = Field(min_length=1, max_length=100)


class SchoolRequest(RequestBody):
    course: str = Field(min_length=1, max_length=200)


class CurriculumRequest(SchoolRequest):
    school: str = Field(min_length=1, max_length=200)


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    field = exc.errors()[0]["loc"][-1] if exc.errors() else ""
    message = {"interests": "분야를 작성해주세요.", "course": "학과를 작성해주세요.", "school": "학교를 작성해주세요."}.get(field, "필수 항목을 올바르게 작성해주세요.")
    return JSONResponse(status_code=400, content={"detail": message})


@lru_cache(maxsize=1)
def rows():
    with gzip.open(DATA_PATH, "rt", encoding="utf-8-sig", newline="") as file:
        return tuple(row for row in csv.DictReader(file) if row["학과상태명"] != "폐과" and row["학과명"].strip() in ALLOWED_COURSES)


@app.get("/api/health")
def health():
    return {"status": "ok", "source": "litton", "records": len(rows())}


@app.post("/api/course_list")
def course_list(body: CourseRequest):
    keyword = body.interests
    aliases = {"기술·자연": ["공학", "자연"], "사람·사회": ["인문", "사회", "교육"], "영상·콘텐츠": ["미디어", "영상", "콘텐츠"], "미술": ["미술", "디자인"]}
    terms = aliases.get(keyword, [keyword])
    courses = {row["학과명"].strip() for row in rows() if keyword == "전체" or any(term in row["대학자체계열명"] or term in row["학과명"] for term in terms)}
    return {"course_list": ",".join(sorted(courses))}


@app.post("/api/school_list")
def school_list(body: SchoolRequest):
    schools = {row["학교명"].strip() for row in rows() if row["학과명"].strip() == body.course}
    return {"school_list": ",".join(sorted(schools))}


@app.post("/api/curriculum_list")
def curriculum_list(body: CurriculumRequest):
    matches = [row for row in rows() if row["학교명"].strip() == body.school and row["학과명"].strip() == body.course]
    if not matches:
        raise HTTPException(status_code=404, detail="해당 학교의 학과 정보를 찾을 수 없습니다.")
    curriculum = list(dict.fromkeys(subject.strip() for row in matches for subject in row["주요교과목명"].split("+") if subject.strip()))
    return {"curriculum_list": curriculum}
