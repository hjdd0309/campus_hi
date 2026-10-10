import csv
import gzip
import json
import logging
import re
from collections import Counter, defaultdict
from contextlib import asynccontextmanager
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field

logger = logging.getLogger("uvicorn.error")
DATA_PATH = Path(__file__).parent / "data" / "courses.csv.gz"
YEARS_PATH = Path(__file__).parent / "data" / "year_curricula.json"
DIST_PATH = Path(__file__).parent.parent / "frontend" / "dist"
MAX_BODY_BYTES = 16 * 1024
HASHED_ASSET = re.compile(r"^/assets/.+-[A-Za-z0-9_-]{8}\.(js|css)$")
CONTENT_SECURITY_POLICY = "; ".join([
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
])


@asynccontextmanager
async def lifespan(app):
    logger.info("학교·학과 %d건을 불러왔습니다.", len(catalog().programs))
    yield


app = FastAPI(title="Litton Campus API", version="2.0.0", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1024)


class RequestBody(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class CourseRequest(RequestBody):
    interests: str = Field(min_length=1, max_length=100)
    query: str = Field(default="", max_length=100)
    offset: int = Field(default=0, ge=0, le=100000)
    limit: int = Field(default=30, ge=1, le=100)


class SchoolRequest(RequestBody):
    course: str = Field(min_length=1, max_length=200)


class CurriculumRequest(SchoolRequest):
    school: str = Field(min_length=1, max_length=200)


@app.middleware("http")
async def guard(request, call_next):
    if request.method in ("POST", "PUT", "PATCH"):
        length = request.headers.get("content-length", "")
        if not length.isdigit():
            return JSONResponse(status_code=411, content={"detail": "요청 본문의 길이를 확인할 수 없습니다."})
        if int(length) > MAX_BODY_BYTES:
            return JSONResponse(status_code=413, content={"detail": "요청이 너무 큽니다."})
    response = await call_next(request)
    path = request.url.path
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    elif HASHED_ASSET.match(path):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif path not in ("/docs", "/redoc", "/openapi.json"):
        response.headers["Cache-Control"] = "no-cache"
        response.headers["Content-Security-Policy"] = CONTENT_SECURITY_POLICY
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    field = exc.errors()[0]["loc"][-1] if exc.errors() else ""
    message = {"interests": "분야를 작성해주세요.", "course": "학과를 작성해주세요.", "school": "학교를 작성해주세요."}.get(field, "필수 항목을 올바르게 작성해주세요.")
    return JSONResponse(status_code=400, content={"detail": message})


@app.exception_handler(Exception)
async def server_error(request, exc):
    logger.error("%s %s 처리 중 오류", request.method, request.url.path, exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "서버에 문제가 생겼어요. 잠시 후 다시 시도해주세요."})


def compact(text):
    return re.sub(r"\s+", "", text).lower()


class Catalog:
    """학부 과정 중 교과목이 등록된 학교·학과만 담는다(대학원, 폐과, 교과목 없는 학과 제외)."""

    def __init__(self, records):
        self.programs = {}
        schools = defaultdict(set)
        categories = defaultdict(Counter)
        for row in records:
            school, course = row["학교명"].strip(), row["학과명"].strip()
            subjects = [subject.strip() for subject in row["주요교과목명"].split("+") if subject.strip()]
            if row["학과상태명"] == "폐과" or "대학원" in school or not school or not course or not subjects:
                continue
            program = self.programs.setdefault((school, course), {"curriculum": {}, "duration": row["수업연한"].strip()})
            program["curriculum"].update(dict.fromkeys(subjects))
            schools[course].add(school)
            categories[course][row["대학자체계열명"].strip()] += 1
        self.schools = {course: sorted(names) for course, names in schools.items()}
        # 같은 학과도 학교마다 계열 표기가 달라서, 가장 많이 쓰인 계열을 그 학과의 계열로 본다.
        self.categories = {course: counts.most_common(1)[0][0] for course, counts in categories.items()}
        # 개설 대학이 많은 학과부터 보여준다.
        self.courses = [(course, compact(course), self.categories[course]) for course in sorted(schools, key=lambda name: (-len(schools[name]), name))]


@lru_cache(maxsize=1)
def year_curricula():
    """수집 파이프라인(`backend/pipeline.py`)이 검증한 학년별 편성만 돌려준다."""
    if not YEARS_PATH.exists():
        return {}
    entries = json.loads(YEARS_PATH.read_text(encoding="utf-8")).values()
    return {(entry["school"], entry["course"]): entry for entry in entries if entry.get("status") == "verified" and entry.get("years")}


@lru_cache(maxsize=1)
def catalog():
    with gzip.open(DATA_PATH, "rt", encoding="utf-8-sig", newline="") as file:
        return Catalog(csv.DictReader(file))


@app.get("/api/health")
def health():
    return {"status": "ok", "source": "litton", "records": len(catalog().programs)}


@app.post("/api/course_list")
def course_list(body: CourseRequest):
    keyword = body.interests
    aliases = {"영상·콘텐츠": ["미디어", "영상", "콘텐츠"], "미술": ["미술", "회화", "조형"], "공연": ["공연", "연극", "뮤지컬", "무용"], "데이터": ["데이터", "통계"], "생명과학": ["생명", "바이오"]}
    terms = [compact(term) for term in aliases.get(keyword, [keyword])]
    query = compact(body.query)
    matches = [(course, key) for course, key, category in catalog().courses if (keyword == "전체" or keyword == category or any(term in key for term in terms)) and query in key]
    if query:
        # 검색어와 이름이 똑같은 학과, 검색어로 시작하는 학과를 먼저 보여준다(그 안에서는 개설 대학이 많은 순서 유지).
        matches.sort(key=lambda item: (item[1] != query, not item[1].startswith(query)))
    return {"course_list": [course for course, key in matches[body.offset:body.offset + body.limit]], "total": len(matches)}


@app.post("/api/school_list")
def school_list(body: SchoolRequest):
    return {"school_list": catalog().schools.get(body.course, [])}


@app.post("/api/curriculum_list")
def curriculum_list(body: CurriculumRequest):
    data = catalog()
    program = data.programs.get((body.school, body.course))
    if not program:
        raise HTTPException(status_code=404, detail="해당 학교의 학과 정보를 찾을 수 없습니다.")
    verified = year_curricula().get((body.school, body.course))
    years = verified and {"terms": verified["years"], "source_url": verified["url"], "checked_at": verified["checked_at"]}
    return {"curriculum_list": list(program["curriculum"]), "category": data.categories[body.course], "duration": program["duration"], "years": years}


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
def unknown_api(path: str):
    raise HTTPException(status_code=404, detail="요청한 주소를 찾을 수 없습니다.")


# 빌드된 프런트엔드가 있으면 같은 서버에서 함께 제공한다(운영 배포용).
if DIST_PATH.is_dir():
    app.mount("/", StaticFiles(directory=DIST_PATH, html=True), name="frontend")
