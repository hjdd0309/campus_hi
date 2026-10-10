"""학년별 교육과정 수집 파이프라인.

학교 홈페이지의 교육과정 페이지(HTML·PDF)를 받아 학년·학기별 교과목을 추출하고,
이미 가진 교과목 목록과 대조해 검증한 뒤 `data/year_curricula.json`에 저장한다.

    python -m backend.pipeline collect            # 출처 목록 전체: 받기 → 바뀐 것만 추출
    python -m backend.pipeline collect --school 경희대학교
    python -m backend.pipeline status             # 수집 현황
    python -m backend.pipeline approve 학교 학과   # 검토 대기 항목을 사람이 확인하고 공개
    python -m backend.pipeline import 파일.csv     # 직접 정리한 편성표 넣기

출처 목록은 `data/year_sources.csv`(school,course,url)에 한 줄씩 적는다.
"""

import argparse
import base64
import csv
import hashlib
import json
import math
import re
import sys
import time
import urllib.request
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

from backend.main import catalog, compact

DATA = Path(__file__).parent / "data"
SOURCES_PATH = DATA / "year_sources.csv"
RESULTS_PATH = DATA / "year_curricula.json"
SNAPSHOT_DIR = Path(__file__).parent / ".cache" / "snapshots"
MODEL = "claude-opus-5-5"
MAX_BYTES = 20 * 1024 * 1024
MAX_TEXT_CHARS = 400_000
MIN_SUBJECTS = 5
# 추출한 과목 중 기존 교과목 목록에도 있는 비율이 이보다 낮으면 사람이 확인하기 전까지 공개하지 않는다.
AUTO_VERIFY_RATIO = 0.5

SCHEMA = {
    "type": "object",
    "properties": {
        "found": {"type": "boolean"},
        "reason": {"type": "string"},
        "terms": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "year": {"type": "integer"},
                    "semester": {"type": "integer"},
                    "subjects": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["year", "semester", "subjects"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["found", "reason", "terms"],
    "additionalProperties": False,
}

PROMPT = """이 문서는 {school} {course}의 교육과정 페이지로 등록된 자료입니다. 학부 과정의 전공 교과목을 학년·학기별로 정리해 주세요.

이 결과는 진학을 고민하는 학생에게 "이 학과는 몇 학년에 무엇을 배운다"고 보여주는 데 쓰입니다. 틀린 편성을 보여주면 학생의 판단을 그르치므로, 문서에 적힌 그대로만 옮기는 것이 가장 중요합니다.

- 문서가 과목마다 학년을 명시한 경우에만 옮깁니다. 학년이 적혀 있지 않은 과목은 과목명이나 일반적인 관행으로 학년을 짐작해 넣지 말고 빼 주세요.
- 학기가 적혀 있으면 1 또는 2, 학기 구분이 없으면 0으로 적습니다.
- 과목명은 문서의 표기를 그대로 씁니다. 학점, 시수, 이수구분, 과목코드, 영문 병기는 빼고 과목명만 남깁니다.
- 교양 과목과 대학원 과목은 빼고 전공 과목(전공기초, 전공필수, 전공선택)만 넣습니다.
- 문서에 여러 학과나 전공이 섞여 있으면 {course}에 해당하는 것만 넣습니다.
- 여러 입학년도의 편성표가 함께 있으면 가장 최근 것만 넣습니다.

다음 경우에는 found를 false로 하고 terms는 비운 뒤, reason에 이유를 한 문장으로 적어 주세요: 문서가 {school} {course}의 것이 아닌 경우, 학년별 편성이 없는 경우(과목 설명만 있거나 트랙별 목록만 있는 경우 등), 대학원 과정만 있는 경우, 내용을 읽을 수 없는 경우. found가 true일 때 reason에는 문서의 어느 부분에서 편성을 가져왔는지 한 문장으로 적습니다."""


class PageText(HTMLParser):
    """HTML을 글로 바꾼다. 표는 병합된 칸을 풀어 한 행을 한 줄(` | ` 구분)로 적어, 행마다 학년이 보이게 한다."""

    SKIP = {"script", "style", "noscript", "template", "svg", "head"}
    BLOCK = {"p", "div", "li", "br", "h1", "h2", "h3", "h4", "h5", "h6", "dt", "dd", "section", "article", "ul", "ol", "table"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.skip = 0
        self.tables = []
        self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1
        elif tag == "table":
            self.tables.append([])
        elif tag == "tr" and self.tables:
            self.tables[-1].append([])
        elif tag in ("td", "th") and self.tables and self.tables[-1]:
            spans = {name: int(value) if (value or "").isdigit() else 1 for name, value in attrs if name in ("rowspan", "colspan")}
            self.cell = {"text": [], "rowspan": min(spans.get("rowspan", 1), 200), "colspan": min(spans.get("colspan", 1), 50)}
        elif tag in self.BLOCK and self.cell is None:
            self.out.append("\n")

    def handle_endtag(self, tag):
        if tag in self.SKIP:
            self.skip = max(0, self.skip - 1)
        elif tag in ("td", "th") and self.cell is not None:
            self.tables[-1][-1].append(self.cell)
            self.cell = None
        elif tag == "table" and self.tables:
            self.out.append("\n" + self.render(self.tables.pop()) + "\n")
        elif tag in self.BLOCK and self.cell is None:
            self.out.append("\n")

    def handle_data(self, data):
        if self.skip:
            return
        (self.cell["text"] if self.cell is not None else self.out).append(data)

    @staticmethod
    def render(rows):
        grid = []
        carried = {}
        for row in rows:
            line, column = [], 0
            for cell in row + [None]:
                while column in carried:
                    text, left = carried[column]
                    line.append(text)
                    carried[column] = (text, left - 1)
                    if left <= 1:
                        del carried[column]
                    column += 1
                if cell is None:
                    break
                text = " ".join("".join(cell["text"]).split())
                for _ in range(cell["colspan"]):
                    line.append(text)
                    if cell["rowspan"] > 1:
                        carried[column] = (text, cell["rowspan"] - 1)
                    column += 1
            if any(line):
                grid.append(" | ".join(line))
        return "\n".join(grid)


def html_to_text(html):
    parser = PageText()
    parser.feed(html)
    parser.close()
    lines = (" ".join(line.split()) for line in "".join(parser.out).split("\n"))
    return "\n".join(line for line in lines if line)


def decode(raw, content_type):
    names = re.findall(r"charset=([\w-]+)", content_type or "", re.I)
    names += [name.decode() for name in re.findall(rb"<meta[^>]+charset=[\"']?([\w-]+)", raw[:4096], re.I)]
    for name in names + ["utf-8", "cp949"]:
        try:
            return raw.decode(name)
        except (LookupError, UnicodeDecodeError):
            continue
    return raw.decode("utf-8", errors="replace")


def fetch(url):
    if urlparse(url).scheme not in ("http", "https"):
        raise ValueError("http(s) 주소만 받을 수 있습니다.")
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; HiCampusCurriculumBot/1.0)"})
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = response.read(MAX_BYTES + 1)
        content_type = response.headers.get("Content-Type", "")
    if len(raw) > MAX_BYTES:
        raise ValueError("문서가 너무 큽니다(20MB 초과).")
    kind = "pdf" if raw[:5] == b"%PDF-" else "html"
    return raw, kind, content_type


def extract_with_claude(school, course, raw, kind, content_type):
    """문서에서 학년별 편성을 뽑는다. `ANTHROPIC_API_KEY`가 필요하다."""
    import anthropic

    instructions = PROMPT.format(school=school, course=course)
    if kind == "pdf":
        content = [
            {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": base64.standard_b64encode(raw).decode()}},
            {"type": "text", "text": instructions},
        ]
    else:
        text = html_to_text(decode(raw, content_type))
        if len(text) > MAX_TEXT_CHARS:
            raise ValueError(f"문서가 너무 깁니다({len(text):,}자). 교육과정만 있는 페이지 주소로 바꿔 주세요.")
        content = [{"type": "text", "text": f"<document>\n{text}\n</document>\n\n{instructions}"}]
    response = anthropic.Anthropic().beta.messages.create(
        model=MODEL,
        max_tokens=16000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        output_config={"effort": "medium", "format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{"role": "user", "content": content}],
    )
    if response.stop_reason != "end_turn":
        raise ValueError(f"추출이 끝나지 않았습니다(stop_reason={response.stop_reason}).")
    return json.loads(next(block.text for block in response.content if block.type == "text"))


def normalize(subject):
    """표기 차이(띄어쓰기, 괄호 안 영문, 로마 숫자)를 줄여 두 목록의 과목명을 견준다."""
    text = re.sub(r"[\(\[（].*?[\)\]）]", "", subject)
    for roman, digit in (("Ⅲ", "3"), ("Ⅱ", "2"), ("Ⅰ", "1"), ("Ⅳ", "4")):
        text = text.replace(roman, digit)
    return re.sub(r"[\s·ㆍ․\-_.,:&/]+", "", text).lower()


def max_year(duration):
    # 전공심화 과정은 전문학사 뒤에 이어지는 3·4학년 과정이다.
    number = re.match(r"[\d.]+", duration or "")
    if not number or "전공심화" in duration:
        return 4
    return math.ceil(float(number.group()))


def validate(school, course, terms):
    """추출 결과를 정리하고 검증한다. (terms, match_ratio)를 돌려주고, 쓸 수 없으면 ValueError를 낸다."""
    program = catalog().programs.get((school, course))
    if not program:
        raise ValueError("제공 대상(학부·교과목 등록)에 없는 학교·학과입니다.")
    limit = max_year(program["duration"])
    merged, seen = {}, set()
    for term in terms:
        year, semester = term.get("year"), term.get("semester")
        if not isinstance(year, int) or isinstance(year, bool) or not 1 <= year <= limit:
            raise ValueError(f"학년 값이 범위를 벗어났습니다: {year!r} (수업연한 {program['duration']})")
        if semester not in (0, 1, 2):
            raise ValueError(f"학기 값이 올바르지 않습니다: {semester!r}")
        for subject in term.get("subjects", []):
            name = " ".join(str(subject).split())
            key = normalize(name)
            if not key or len(name) > 100 or (year, semester, key) in seen:
                continue
            seen.add((year, semester, key))
            merged.setdefault((year, semester), []).append(name)
    subjects = [name for names in merged.values() for name in names]
    if len(subjects) < MIN_SUBJECTS:
        raise ValueError(f"추출된 과목이 너무 적습니다({len(subjects)}개).")
    known = {normalize(name) for name in program["curriculum"]}
    ratio = sum(normalize(name) in known for name in subjects) / len(subjects)
    cleaned = [{"year": year, "semester": semester, "subjects": names} for (year, semester), names in sorted(merged.items())]
    return cleaned, round(ratio, 3)


def load_results(path=None):
    path = path or RESULTS_PATH
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def save_results(results, path=None):
    path = path or RESULTS_PATH
    ordered = dict(sorted(results.items()))
    path.write_text(json.dumps(ordered, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def key_of(school, course):
    return f"{school}|{course}"


def load_sources(path=None):
    path = path or SOURCES_PATH
    if not path.exists():
        return []
    with path.open(encoding="utf-8-sig", newline="") as file:
        return [{name: (row.get(name) or "").strip() for name in ("school", "course", "url")} for row in csv.DictReader(file) if (row.get("url") or "").strip()]


def collect(sources, results, extractor=extract_with_claude, fetcher=fetch, force=False, today=None, log=print):
    """출처를 하나씩 받아 내용이 바뀐 것만 다시 추출한다. 한 건의 실패가 나머지를 막지 않는다."""
    today = today or date.today().isoformat()
    last_host = {}
    for source in sources:
        school, course, url = source["school"], source["course"], source["url"]
        key, label = key_of(school, course), f"{school} {course}"
        previous = results.get(key, {})
        try:
            if (school, course) not in catalog().programs:
                raise ValueError("제공 대상(학부·교과목 등록)에 없는 학교·학과입니다.")
            host = urlparse(url).netloc
            wait = 2 - (time.monotonic() - last_host.get(host, -10))
            if wait > 0 and fetcher is fetch:
                time.sleep(wait)
            raw, kind, content_type = fetcher(url)
            last_host[host] = time.monotonic()
            digest = hashlib.sha256(raw).hexdigest()
            if not force and previous.get("content_hash") == digest and previous.get("url") == url:
                results[key] = {**previous, "checked_at": today}
                log(f"변경 없음  {label}")
                continue
            SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
            (SNAPSHOT_DIR / f"{digest}.{kind}").write_bytes(raw)
            extracted = extractor(school, course, raw, kind, content_type)
            entry = {"school": school, "course": course, "url": url, "content_hash": digest, "fetched_at": today, "checked_at": today, "note": str(extracted.get("reason", ""))[:300]}
            if not extracted.get("found"):
                results[key] = {**entry, "status": "not_found", "match_ratio": 0, "years": []}
                log(f"편성 없음  {label}: {entry['note']}")
                continue
            years, ratio = validate(school, course, extracted.get("terms", []))
            status = "verified" if ratio >= AUTO_VERIFY_RATIO else "review"
            changed = bool(previous.get("years")) and previous["years"] != years
            results[key] = {**entry, "status": status, "match_ratio": ratio, "years": years}
            log(f"{'공개' if status == 'verified' else '검토 필요'}  {label}: 과목 {sum(len(term['subjects']) for term in years)}개, 기존 목록 일치 {ratio:.0%}{' (이전 수집본에서 바뀜)' if changed else ''}")
        except Exception as error:  # 한 학교의 실패(접속 불가, 형식 오류 등)를 기록하고 다음으로 넘어간다.
            results[key] = {**previous, "school": school, "course": course, "url": url, "error": f"{type(error).__name__}: {error}"[:300], "checked_at": today}
            if "status" not in results[key]:
                results[key].update(status="error", years=[], match_ratio=0)
            log(f"실패  {label}: {error}")
    return results


def import_rows(rows, results, today=None):
    """직접 정리한 편성표(school,course,year,semester,subject)를 넣는다. 사람이 확인한 자료로 보고 바로 공개한다."""
    today = today or date.today().isoformat()
    grouped = {}
    for number, row in enumerate(rows, start=2):
        try:
            school, course = row["school"].strip(), row["course"].strip()
            term = (int(row["year"]), int(row.get("semester") or 0))
            grouped.setdefault((school, course), {}).setdefault(term, []).append(row["subject"])
        except (KeyError, ValueError, AttributeError) as error:
            raise ValueError(f"{number}번째 줄을 읽을 수 없습니다: {error}") from error
    for (school, course), terms in grouped.items():
        years, ratio = validate(school, course, [{"year": year, "semester": semester, "subjects": subjects} for (year, semester), subjects in terms.items()])
        results[key_of(school, course)] = {"school": school, "course": course, "url": "", "content_hash": "", "fetched_at": today, "checked_at": today, "note": "직접 입력", "status": "verified", "match_ratio": ratio, "years": years}
    return len(grouped)


def published(results):
    """서비스에 내보낼 수 있는(검증된) 항목만 (학교, 학과) → 항목으로 돌려준다."""
    return {(entry["school"], entry["course"]): entry for entry in results.values() if entry.get("status") == "verified" and entry.get("years")}


def main(argv=None):
    parser = argparse.ArgumentParser(description="학년별 교육과정 수집")
    commands = parser.add_subparsers(dest="command", required=True)
    collecting = commands.add_parser("collect", help="출처를 받아 바뀐 것만 추출")
    collecting.add_argument("--school")
    collecting.add_argument("--course")
    collecting.add_argument("--force", action="store_true", help="내용이 그대로여도 다시 추출")
    commands.add_parser("status", help="수집 현황")
    approving = commands.add_parser("approve", help="검토 대기 항목 공개")
    approving.add_argument("school")
    approving.add_argument("course")
    importing = commands.add_parser("import", help="직접 정리한 CSV 넣기")
    importing.add_argument("file")
    args = parser.parse_args(argv)
    results = load_results()
    if args.command == "collect":
        sources = [source for source in load_sources() if (not args.school or source["school"] == args.school) and (not args.course or source["course"] == args.course)]
        if not sources:
            print(f"수집할 출처가 없습니다. {SOURCES_PATH}에 school,course,url을 적어 주세요.")
            return 1
        collect(sources, results, force=args.force)
        save_results(results)
    elif args.command == "status":
        counts = {}
        for entry in results.values():
            counts[entry.get("status", "error")] = counts.get(entry.get("status", "error"), 0) + 1
        print(f"전체 {len(results)}건 · " + " · ".join(f"{name} {count}" for name, count in sorted(counts.items())))
        for entry in results.values():
            if entry.get("status") != "verified" or entry.get("error"):
                print(f"  [{entry.get('status')}] {entry['school']} {entry['course']} · 일치 {entry.get('match_ratio', 0):.0%} · {entry.get('error') or entry.get('note', '')}")
    elif args.command == "approve":
        entry = results.get(key_of(args.school, args.course))
        if not entry or entry.get("status") != "review":
            print("검토 대기 중인 항목이 아닙니다.")
            return 1
        entry["status"] = "verified"
        entry["note"] = f"사람이 확인함({date.today().isoformat()}). {entry.get('note', '')}"[:300]
        save_results(results)
        print(f"공개했습니다: {args.school} {args.course}")
    elif args.command == "import":
        with open(args.file, encoding="utf-8-sig", newline="") as file:
            count = import_rows(list(csv.DictReader(file)), results)
        save_results(results)
        print(f"{count}개 학과의 편성표를 넣었습니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
