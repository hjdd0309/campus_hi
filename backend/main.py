import csv
import gzip
import json
import logging
import math
import re
from collections import Counter, defaultdict
from contextlib import asynccontextmanager
from datetime import date
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
GAMES_PATH = Path(__file__).parent / "data" / "lesson_games.jsonl"
LEVELS_PATH = Path(__file__).parent / "data" / "subject_levels.json"
PICKS_PATH = Path(__file__).parent / "data" / "lesson_picks.json"
PARTNERS_PATH = Path(__file__).parent / "data" / "partners.json"
DIST_PATH = Path(__file__).parent.parent / "frontend" / "dist"
MAX_BODY_BYTES = 16 * 1024
HASHED_ASSET = re.compile(r"^/assets/.+-[A-Za-z0-9_-]{8}\.(js|css|png|webp|svg)$")
CONTENT_SECURITY_POLICY = "; ".join([
    "default-src 'self'",
    "script-src 'self'",
    # 글꼴(Pretendard)을 jsDelivr에서 불러온다.
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "font-src 'self' https://cdn.jsdelivr.net",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
])


@asynccontextmanager
async def lifespan(app):
    logger.info("학교·학과 %d건, 연습 문제 %d건, 제휴 대학 %d곳을 불러왔습니다.", len(catalog().programs), len(lesson_games()), len(partners()))
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


class ProgramRequest(RequestBody):
    interests: str = Field(min_length=1, max_length=100)
    school: str = Field(default="", max_length=100)
    course: str = Field(default="", max_length=100)
    offset: int = Field(default=0, ge=0, le=100000)
    limit: int = Field(default=30, ge=1, le=100)


class SchoolRequest(RequestBody):
    course: str = Field(min_length=1, max_length=200)


class CurriculumRequest(SchoolRequest):
    school: str = Field(min_length=1, max_length=200)


class GameRequest(RequestBody):
    subject: str = Field(min_length=1, max_length=200)


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
    message = {"interests": "분야를 작성해주세요.", "course": "학과를 작성해주세요.", "school": "학교를 작성해주세요.", "subject": "과목을 작성해주세요."}.get(field, "필수 항목을 올바르게 작성해주세요.")
    return JSONResponse(status_code=400, content={"detail": message})


@app.exception_handler(Exception)
async def server_error(request, exc):
    logger.error("%s %s 처리 중 오류", request.method, request.url.path, exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "서버에 문제가 생겼어요. 잠시 후 다시 시도해주세요."})


def compact(text):
    return re.sub(r"\s+", "", text).lower()


# 검색에서는 띄어쓰기와 이름 속 구두점(·, ., -, 괄호 등)을 무시한다. "전기전자"로 "전기·전자공학부"를 찾을 수 있게.
# 검색어에서는 구두점도 낱말을 나누는 자리로 본다.
SEARCH_IGNORED = re.compile(r"[\s·・‧.,\-_/()\[\]&]+")


def searchable(text):
    return SEARCH_IGNORED.sub("", text).lower()


def search_words(query):
    """검색어를 띄어쓰기와 구두점으로 나눈 낱말들. "전기·전자"는 "전기", "전자" 두 낱말이 된다."""
    return [word.lower() for word in SEARCH_IGNORED.split(query) if word]


INITIALS = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
VOWELS = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"
FINALS = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"


def jamo(text):
    """한글을 자모로 푼다. "전자"는 "ㅈㅓㄴㅈㅏ"가 되어, 한 글자 오타("전지")도 자모 하나 차이로 본다."""
    letters = []
    for char in text:
        code = ord(char) - 0xAC00
        if 0 <= code < 11172:
            letters += [INITIALS[code // 588], VOWELS[code % 588 // 28], FINALS[code % 28].strip()]
        else:
            letters.append(char)
    return "".join(letters)


def letter_pairs(text):
    return {text[i:i + 2] for i in range(len(text) - 1)}


def infix_distance(query, text):
    """query를 text 안의 어느 자리에 맞추든 가장 적게 고치는 횟수(넣기·빼기·바꾸기)."""
    previous = list(range(len(query) + 1))
    best = previous[-1]
    for char in text:
        current = [0]
        for i, letter in enumerate(query, 1):
            current.append(min(previous[i] + 1, current[i - 1] + 1, previous[i - 1] + (letter != char)))
        best = min(best, current[-1])
        previous = current
    return best


# 학년별 전공 체험을 만들 수 없는 과정: 입학 뒤에 전공을 정하는 자유·자율전공, 교양 과정, 학년이 하나뿐인 1년 과정.
# 무전공은 이름 맨 앞이나 띄어쓰기·괄호 뒤에서만 본다("사무전공", "법무전공"은 실제 전공). 문화교양학과는 실제 전공이다.
UNDECIDED = re.compile(r"자유전공|자율전공|(?:^|[\s(])무전공|자유학부|자율학부|학생설계|(?<!문화)교양")


def study_years(duration):
    """수업연한("4년", "2.5년", "1년(전공심화)")을 학년 수로 바꾼다. 읽을 수 없으면 None."""
    match = re.match(r"\d+(\.\d+)?", duration)
    return math.ceil(float(match.group())) if match else None


def excluded(course, duration):
    years = study_years(duration)
    return bool(UNDECIDED.search(course)) or (years is not None and years < 2)


# 원본 교과목명의 오타. 같은 과목이 다른 이름으로 나뉘어 연습 문제·학년 범위가 연결되지 않으므로 읽을 때 바로잡는다.
SUBJECT_FIXES = {"객체지항프로그래밍": "객체지향프로그래밍"}


class Catalog:
    """학부 과정 중 교과목이 등록된 학교·학과만 담는다(대학원, 폐과, 교과목 없는 학과, 학년별 체험을 만들 수 없는 과정 제외)."""

    def __init__(self, records):
        self.programs = {}
        schools = defaultdict(set)
        categories = defaultdict(Counter)
        for row in records:
            school, course = row["학교명"].strip(), row["학과명"].strip()
            subjects = [SUBJECT_FIXES.get(subject.strip(), subject.strip()) for subject in row["주요교과목명"].split("+") if subject.strip()]
            if row["학과상태명"] == "폐과" or "대학원" in school or not school or not course or not subjects or excluded(course, row["수업연한"].strip()):
                continue
            program = self.programs.setdefault((school, course), {"curriculum": {}, "duration": row["수업연한"].strip(), "region": row["시도명"].strip()})
            program["curriculum"].update(dict.fromkeys(subjects))
            schools[course].add(school)
            categories[course][row["대학자체계열명"].strip()] += 1
        self.schools = {course: sorted(names) for course, names in schools.items()}
        # 같은 학과도 학교마다 계열 표기가 달라서, 가장 많이 쓰인 계열을 그 학과의 계열로 본다.
        self.categories = {course: counts.most_common(1)[0][0] for course, counts in categories.items()}
        # 개설 대학이 많은 학과부터 보여준다.
        self.courses = [(course, compact(course), self.categories[course]) for course in sorted(schools, key=lambda name: (-len(schools[name]), name))]
        # 학교·학과 조합 목록. 개설 대학이 많은 학과부터, 같은 학과 안에서는 학교 이름순.
        self.pairs = [(school, course, searchable(school), searchable(course), key, category) for course, key, category in self.courses for school in self.schools[course]]
        # 비슷한 학과 찾기에 쓴다. 학과명은 검색용 글자와 자모로, 과목은 띄어쓰기·구두점을 뺀 이름으로 비교한다.
        self.names = [(course, searchable(course), spelling, letter_pairs(spelling)) for course, _, _ in self.courses for spelling in [jamo(searchable(course))]]
        self.school_names = [(school, searchable(school)) for school in sorted({school for school, _ in self.programs})]
        self.courses_at = defaultdict(list)
        for school, course in self.programs:
            self.courses_at[school].append(course)
        self.subjects = {pair:{searchable(subject) for subject in program["curriculum"]} for pair, program in self.programs.items()}
        # 여러 학과에서 두루 가르치는 과목(교양영어 등)일수록 낮게 친다.
        spread = Counter(subject for subjects in self.subjects.values() for subject in subjects)
        self.weights = {subject: math.log(len(self.subjects) / count) for subject, count in spread.items()}


@lru_cache(maxsize=1)
def year_curricula():
    """수집 파이프라인(`backend/pipeline.py`)이 검증한 학년별 편성만 돌려준다."""
    if not YEARS_PATH.exists():
        return {}
    entries = json.loads(YEARS_PATH.read_text(encoding="utf-8")).values()
    return {(entry["school"], entry["course"]): entry for entry in entries if entry.get("status") == "verified" and entry.get("years")}


@lru_cache(maxsize=1)
def lesson_games():
    """`backend/lesson_games.py`로 넣은 연습 문제 중 검증된 것만 과목 키 → 문제로 돌려준다."""
    if not GAMES_PATH.exists():
        return {}
    games = {}
    with GAMES_PATH.open(encoding="utf-8") as file:
        for line in file:
            game = json.loads(line) if line.strip() else {}
            if game.get("status") == "verified":
                games[compact(game["course_name"])] = {name: value for name, value in game.items() if name != "check"}
    return games


@lru_cache(maxsize=1)
def subject_levels():
    """`backend/subject_levels.py`로 넣은 과목별 학년 범위 중 검증된 것만 과목 키 → [시작, 끝]으로 돌려준다."""
    if not LEVELS_PATH.exists():
        return {}
    records = json.loads(LEVELS_PATH.read_text(encoding="utf-8"))
    return {key: [record["from"], record["to"]] for key, record in records.items() if record.get("status") == "verified"}


@lru_cache(maxsize=1)
def lesson_picks():
    """학과마다 사람이 정해 둔 이론 수업 과목(`data/lesson_picks.json`): (학교, 학과) → {학년: [과목 후보, ...]}.
    후보는 앞에서부터 그 학과 교과목에 있는 첫 과목을 쓴다. 형식이 틀린 항목은 버린다."""
    if not PICKS_PATH.exists():
        return {}
    picks = {}
    for entry in json.loads(PICKS_PATH.read_text(encoding="utf-8")):
        years = {year: subjects for year, subjects in entry.get("years", {}).items()
                 if year in {"1", "2", "3", "4", "5", "6"} and isinstance(subjects, list) and subjects and all(isinstance(subject, str) and subject for subject in subjects)}
        if isinstance(entry.get("school"), str) and isinstance(entry.get("course"), str) and years:
            picks[(entry["school"], entry["course"])] = years
    return picks


@lru_cache(maxsize=1)
def partners():
    """제휴 대학(`data/partners.json`): 학교명 → {"since": "YYYY-MM-DD"}. 제공 대상에 없는 학교나 날짜가 틀린 항목은 버린다."""
    if not PARTNERS_PATH.exists():
        return {}
    found = {}
    for school, entry in json.loads(PARTNERS_PATH.read_text(encoding="utf-8")).items():
        try:
            date.fromisoformat(entry["since"])
        except (TypeError, KeyError, ValueError):
            logger.warning("제휴 대학 항목의 형식이 올바르지 않아 뺍니다: %s", school)
            continue
        if school not in catalog().courses_at:
            logger.warning("제휴 대학이 제공 대상 학교 목록에 없어 뺍니다: %s", school)
            continue
        found[school] = {"since": entry["since"]}
    return found


@lru_cache(maxsize=1)
def catalog():
    with gzip.open(DATA_PATH, "rt", encoding="utf-8-sig", newline="") as file:
        return Catalog(csv.DictReader(file))


@app.get("/api/health")
def health():
    return {"status": "ok", "source": "litton", "records": len(catalog().programs)}


ALIASES = {
    "영상·콘텐츠": ["미디어", "영상", "콘텐츠"],
    "영상 / 콘텐츠": ["미디어", "영상", "콘텐츠"],
    "미술": ["미술", "회화", "조형"],
    "공연": ["공연", "연극", "뮤지컬", "무용"],
    "연기": ["연기", "연극", "뮤지컬"],
    "데이터": ["데이터", "통계"],
    "생명과학": ["생명", "바이오"],
}


def matcher(keyword):
    """분야 필터: 전체, 계열명, 또는 학과명에 들어갈 키워드."""
    terms = [compact(term) for term in ALIASES.get(keyword, [keyword])]
    return lambda key, category: keyword == "전체" or keyword == category or any(term in key for term in terms)


def similar_courses(data, words, limit=5):
    """오타가 있어도 이름이 가까운 학과들. 검색어를 자모로 풀어 학과명 안 어딘가에 맞추고, 자모 네 개에 하나까지 틀려도 찾는다.
    "전지공학"은 "전기공학과"·"전자공학과"를, "견축"은 "건축학과"를 찾는다. 같은 거리 안에서는 개설 대학이 많은 순서다."""
    query = jamo("".join(words))
    allowed = len(query) // 4
    if not allowed:
        return []
    pairs = letter_pairs(query)
    found = []
    for course, _, spelling, spelling_pairs in data.names:
        # 자모 두 개씩 묶은 조각이 절반도 겹치지 않으면 거리를 재지 않는다(대부분의 학과가 여기서 걸러진다).
        if len(pairs & spelling_pairs) * 2 < len(pairs):
            continue
        distance = infix_distance(query, spelling)
        if distance <= allowed:
            found.append((distance, course))
    return [course for _, course in sorted(found, key=lambda item: item[0])[:limit]]


def wanted_schools(data, school_words):
    """학교 검색어에 걸린 학교 중 사용자가 찾는 학교. "서울대학교"는 남서울대학교에도 걸리므로,
    이름이 같은 학교가 있으면 그 학교를, 검색어로 시작하는 학교가 있으면 그 학교들을, 아니면 걸린 학교 전부를 본다."""
    query = "".join(school_words)
    matched = [(school, text) for school, text in data.school_names if all(word in text for word in school_words)]
    return ({school for school, text in matched if text == query}
            or {school for school, text in matched if text.startswith(query)}
            or {school for school, _ in matched})


def similar_programs(data, schools, words, limit=3):
    """찾는 학교에 검색한 이름의 학과가 없을 때, 그 학교에서 비슷한 것을 배우는 학과.
    전국에서 검색어가 이름에 들어간 학과(없으면 오타를 고친 학과)가 가르치는 과목을 모으고,
    학교의 학과마다 그 과목을 얼마나 가르치는지 점수를 매긴다. 서울대 "전자"는 "전기·정보공학부"를 찾는다."""
    names = [course for course, text, _, _ in data.names if all(word in text for word in words)] or similar_courses(data, words)
    reference = [(school, course) for course in names for school in data.schools[course]]
    if not reference:
        return []
    share = Counter(subject for pair in reference for subject in data.subjects[pair])
    scored = []
    for school in schools:
        for course in data.courses_at[school]:
            subjects = data.subjects[(school, course)]
            score = sum(share[subject] * data.weights[subject] for subject in subjects) / len(reference) / math.sqrt(len(subjects))
            scored.append((score, school, course))
    scored.sort(key=lambda item: -item[0])
    # 점수가 낮거나 가장 비슷한 학과보다 크게 떨어지는 학과는 엉뚱한 추천이 되므로 뺀다.
    cutoff = max(0.3, scored[0][0] * 0.4) if scored else 0
    return [(school, course) for score, school, course in scored[:limit] if score >= cutoff]


def describe(data, school, course):
    program = data.programs[(school, course)]
    return {"school": school, "course": course, "category": data.categories[course], "duration": program["duration"], "region": program["region"], "partner": school in partners()}


@app.post("/api/program_list")
def program_list(body: ProgramRequest):
    """학교·학과 조합을 검색한다. 학교 검색어의 낱말은 모두 학교명에, 학과 검색어의 낱말은 모두 학과명에 들어 있어야 한다.
    띄어쓰기와 구두점은 무시하므로 "서울대"는 "서울대학교"를, "전기 전자"나 "전기·전자"는 "전자·전기공학부"도 찾는다."""
    data = catalog()
    matches = matcher(body.interests)
    school_words, course_words = search_words(body.school), search_words(body.course)
    found = [(school, course, school_text, course_text) for school, course, school_text, course_text, key, category in data.pairs
             if matches(key, category) and all(word in school_text for word in school_words) and all(word in course_text for word in course_words)]
    school_query, course_query = "".join(school_words), "".join(course_words)
    # 검색어와 이름이 같은 것, 검색어로 시작하는 것을 먼저 보여준다(학교가 먼저, 그 안에서 학과). 나머지는 원래 순서를 지킨다.
    found.sort(key=lambda item: (
        bool(school_query) and item[2] != school_query,
        bool(school_query) and not item[2].startswith(school_query),
        bool(course_query) and item[3] != course_query,
        bool(course_query) and not item[3].startswith(course_query),
    ))
    page = found[body.offset:body.offset + body.limit]
    # 찾는 학과가 없으면 비슷한 학과를 함께 보낸다. 관심 분야 필터와는 상관없이 찾는다.
    # 학교를 골랐으면 찾는 학교에서 나온 결과가 없을 때 그 학교의 비슷한 학과를(다른 학교 결과만 있어도 보낸다),
    # 학교 없이 찾았으면 결과가 없을 때 이름이 비슷한 학과명(오타 고침)을 보낸다.
    suggested_programs, suggested_courses = [], []
    if course_words and school_words:
        schools = wanted_schools(data, school_words)
        if not any(school in schools for school, *_ in found):
            suggested_programs = [describe(data, school, course) for school, course in similar_programs(data, schools, course_words)]
    elif course_words and not found:
        suggested_courses = similar_courses(data, course_words)
    return {
        "programs": [describe(data, school, course) for school, course, _, _ in page],
        "total": len(found),
        "similar_programs": suggested_programs,
        "similar_courses": suggested_courses,
    }


@app.post("/api/course_list")
def course_list(body: CourseRequest):
    keyword = body.interests
    terms = [compact(term) for term in ALIASES.get(keyword, [keyword])]
    query = compact(body.query)
    matches = [(course, key) for course, key, category in catalog().courses if (keyword == "전체" or keyword == category or any(term in key for term in terms)) and query in key]
    if query:
        # 검색어와 이름이 똑같은 학과, 검색어로 시작하는 학과를 먼저 보여준다(그 안에서는 개설 대학이 많은 순서 유지).
        matches.sort(key=lambda item: (item[1] != query, not item[1].startswith(query)))
    return {"course_list": [course for course, key in matches[body.offset:body.offset + body.limit]], "total": len(matches)}


@app.post("/api/school_list")
def school_list(body: SchoolRequest):
    return {"school_list": [{"school": school, "partner": school in partners()} for school in catalog().schools.get(body.course, [])]}


@app.post("/api/curriculum_list")
def curriculum_list(body: CurriculumRequest):
    data = catalog()
    program = data.programs.get((body.school, body.course))
    if not program:
        raise HTTPException(status_code=404, detail="해당 학교의 학과 정보를 찾을 수 없습니다.")
    verified = year_curricula().get((body.school, body.course))
    years = verified and {"terms": verified["years"], "source_url": verified["url"], "checked_at": verified["checked_at"]}
    games = lesson_games()
    # 연습 문제가 있는 과목과 그 유형. 화면이 체험할 과목을 고를 때 쓴다.
    types = {subject: games[compact(subject)]["type"] for subject in program["curriculum"] if compact(subject) in games}
    # 과목을 보통 듣는 학년 범위. 화면이 학년마다 맞는 과목을 고를 때 쓴다.
    levels = {subject: subject_levels()[compact(subject)] for subject in program["curriculum"] if compact(subject) in subject_levels()}
    # 사람이 정해 둔 학년별 과목. 그 학과 교과목에 있는 후보만 보낸다.
    picks = {year: [subject for subject in subjects if subject in program["curriculum"]] for year, subjects in lesson_picks().get((body.school, body.course), {}).items()}
    picks = {year: subjects for year, subjects in picks.items() if subjects}
    partner = body.school in partners()
    result = {"curriculum_list": list(program["curriculum"]), "category": data.categories[body.course], "duration": program["duration"], "region": program["region"], "partner": partner, "years": years, "games": types, "levels": levels, "picks": picks}
    # 제휴 대학이고 검증된 학년·학기 편성이 있을 때만 보낸다. 편성이 없으면 지금처럼 교과목 목록만 보낸다.
    if partner and verified:
        result["terms"] = verified["years"]
    return result


@app.post("/api/lesson_game")
def lesson_game(body: GameRequest):
    game = lesson_games().get(compact(body.subject))
    if not game:
        raise HTTPException(status_code=404, detail="이 과목의 연습 문제가 아직 없어요.")
    return {"game": game}


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
def unknown_api(path: str):
    raise HTTPException(status_code=404, detail="요청한 주소를 찾을 수 없습니다.")


# 빌드된 프런트엔드가 있으면 같은 서버에서 함께 제공한다(운영 배포용).
if DIST_PATH.is_dir():
    app.mount("/", StaticFiles(directory=DIST_PATH, html=True), name="frontend")
