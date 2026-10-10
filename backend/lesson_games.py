"""수업 연습 문제(유형 게임) 관리 도구.

과목마다 유형 하나(빈칸 채우기, OX, 순서 맞추기, 짝 맞추기, 분류하기)의 문제를 미리 만들어
`data/lesson_games.jsonl`에 쌓는다. 문제는 사람이나 AI 에이전트가 쓰고, 이 도구는 대상 과목을 뽑고
형식을 검사하고 독립 풀이 결과를 반영한다. 서버는 검증된(`verified`) 문제만 내보낸다.

    python -m backend.lesson_games next --limit 50 --out 작업.jsonl   # 다음에 만들 과목
    python -m backend.lesson_games ingest 문제.jsonl --model 모델명    # 형식 검사 후 추가(review)
    python -m backend.lesson_games quiz --out 풀이용.jsonl             # 정답을 가린 문제
    python -m backend.lesson_games verify-ingest 풀이.jsonl            # 풀이가 정답과 같으면 공개
    python -m backend.lesson_games status
    python -m backend.lesson_games approve 과목명 / reject 과목명 --reason 이유

형식은 `backend/SOURCE.md`에 있다. 유형을 추가하려면 `TYPES`에 항목을 넣고,
프런트의 `lessonGames.js`(형식 검사)와 `TypedGames.jsx`(화면)에 같은 이름으로 등록한다.
"""

import argparse
import json
import math
import random
import re
import sys
from collections import Counter
from datetime import datetime
from functools import lru_cache

from backend.main import GAMES_PATH, catalog, compact

BLANK = "___"
# 전용 미니게임이 붙는 과목(`frontend/src/games.js`의 pattern과 같아야 한다). 연습 문제를 만들지 않는다.
DEDICATED = re.compile(r"심리학\s*(개론|입문|의\s*이해)|인지\s*심리|실험\s*심리|자료\s*구조|알고리즘|회계\s*원리|회계학\s*원론|재무\s*회계|회계\s*입문|기초\s*회계")
# 다시 만들 대상에서 빼고, 그 학과의 다음 과목으로 자리를 채우는 상태.
EXCLUDED = ("unsuitable", "failed")


def text(value, limit, name):
    if not isinstance(value, str):
        raise ValueError(f"{name}: 글이 아닙니다.")
    value = " ".join(value.split())
    if not value:
        raise ValueError(f"{name}: 비어 있습니다.")
    if len(value) > limit:
        raise ValueError(f"{name}: {len(value)}자로 상한 {limit}자를 넘습니다.")
    return value


def rows(value, low, high, name):
    if not isinstance(value, list) or not low <= len(value) <= high or not all(isinstance(row, dict) for row in value):
        count = f"{low}~{high}" if low != high else str(low)
        raise ValueError(f"{name}: 항목이 {count}개여야 합니다.")
    return value


def distinct(values, name):
    if len({compact(value) for value in values}) != len(values):
        raise ValueError(f"{name}: 같은 내용이 두 번 들어 있습니다.")
    return values


def index(value, size, name):
    if type(value) is not int or not 0 <= value < size:
        raise ValueError(f"{name}: 0부터 {size - 1}까지의 번호여야 합니다.")
    return value


# ---- 유형별 형식 검사(clean)와 정답을 가린 문제(quiz). quiz는 (보여줄 문제, 기대하는 답)을 돌려준다.
def clean_blank(raw):
    items = []
    for number, item in enumerate(rows(raw.get("items"), 3, 3, "items"), start=1):
        sentence = text(item.get("text"), 60, f"items[{number}].text")
        if sentence.count(BLANK) != 1 or sentence.count("_") != len(BLANK):
            raise ValueError(f"items[{number}].text: 빈칸({BLANK})이 정확히 하나 있어야 합니다.")
        choices = item.get("choices")
        if not isinstance(choices, list) or len(choices) != 3:
            raise ValueError(f"items[{number}].choices: 선지가 3개여야 합니다.")
        choices = distinct([text(choice, 12, f"items[{number}].choices") for choice in choices], f"items[{number}].choices")
        items.append({"text": sentence, "choices": choices, "answer": index(item.get("answer"), 3, f"items[{number}].answer"), "explanation": text(item.get("explanation"), 80, f"items[{number}].explanation")})
    return {"items": items}


def quiz_blank(game, rng):
    # 선지를 섞어, 정답 자리의 규칙만 보고 맞히는 일이 없게 한다.
    items, expected = [], []
    for item in game["items"]:
        shown = list(range(len(item["choices"])))
        rng.shuffle(shown)
        items.append({"text": item["text"], "choices": [item["choices"][i] for i in shown]})
        expected.append(shown.index(item["answer"]))
    return {"items": items}, expected


def clean_ox(raw):
    items = []
    for number, item in enumerate(rows(raw.get("items"), 5, 5, "items"), start=1):
        if type(item.get("answer")) is not bool:
            raise ValueError(f"items[{number}].answer: true(O) 또는 false(X)여야 합니다.")
        items.append({"text": text(item.get("text"), 60, f"items[{number}].text"), "answer": item["answer"], "explanation": text(item.get("explanation"), 80, f"items[{number}].explanation")})
    if len({item["answer"] for item in items}) != 2:
        raise ValueError("items: O와 X가 각각 하나 이상 있어야 합니다.")
    distinct([item["text"] for item in items], "items")
    return {"items": items}


def quiz_ox(game, rng):
    return {"items": [{"text": item["text"]} for item in game["items"]]}, [item["answer"] for item in game["items"]]


def clean_order(raw):
    items = [{"text": text(item.get("text"), 24, f"items[{number}].text")} for number, item in enumerate(rows(raw.get("items"), 4, 5, "items"), start=1)]
    distinct([item["text"] for item in items], "items")
    return {"prompt": text(raw.get("prompt"), 40, "prompt"), "items": items}


def quiz_order(game, rng):
    shown = list(range(len(game["items"])))
    rng.shuffle(shown)
    # 답: 올바른 순서대로 적은, 보여준 목록에서의 번호.
    return {"prompt": game["prompt"], "items": [game["items"][i]["text"] for i in shown]}, [shown.index(i) for i in range(len(shown))]


def clean_match(raw):
    items = [{"left": text(item.get("left"), 10, f"items[{number}].left"), "right": text(item.get("right"), 22, f"items[{number}].right")} for number, item in enumerate(rows(raw.get("items"), 4, 6, "items"), start=1)]
    distinct([item["left"] for item in items], "items.left")
    distinct([item["right"] for item in items], "items.right")
    return {"prompt": text(raw.get("prompt"), 40, "prompt"), "items": items}


def quiz_match(game, rng):
    shown = list(range(len(game["items"])))
    rng.shuffle(shown)
    # 답: 왼쪽 항목 순서대로, 짝이 되는 오른쪽 항목의 번호.
    return {"prompt": game["prompt"], "left": [item["left"] for item in game["items"]], "right": [game["items"][i]["right"] for i in shown]}, [shown.index(i) for i in range(len(shown))]


def clean_sort(raw):
    categories = raw.get("categories")
    if not isinstance(categories, list) or not 2 <= len(categories) <= 3:
        raise ValueError("categories: 카테고리가 2~3개여야 합니다.")
    categories = distinct([text(category, 8, "categories") for category in categories], "categories")
    items = [{"text": text(item.get("text"), 14, f"items[{number}].text"), "category": index(item.get("category"), len(categories), f"items[{number}].category")} for number, item in enumerate(rows(raw.get("items"), 6, 8, "items"), start=1)]
    distinct([item["text"] for item in items], "items")
    used = Counter(item["category"] for item in items)
    if any(used[number] < 2 for number in range(len(categories))):
        raise ValueError("items: 카테고리마다 항목이 2개 이상 있어야 합니다.")
    return {"prompt": text(raw.get("prompt"), 40, "prompt"), "categories": categories, "items": items}


def quiz_sort(game, rng):
    shown = list(range(len(game["items"])))
    rng.shuffle(shown)
    # 답: 보여준 항목 순서대로, 속하는 카테고리의 번호.
    return {"prompt": game["prompt"], "categories": game["categories"], "items": [game["items"][i]["text"] for i in shown]}, [game["items"][i]["category"] for i in shown]


TYPES = {
    "blank": {"name": "빈칸 채우기", "clean": clean_blank, "quiz": quiz_blank},
    "ox": {"name": "OX 퀴즈", "clean": clean_ox, "quiz": quiz_ox},
    "order": {"name": "순서 맞추기", "clean": clean_order, "quiz": quiz_order},
    "match": {"name": "짝 맞추기", "clean": clean_match, "quiz": quiz_match},
    "sort": {"name": "분류하기", "clean": clean_sort, "quiz": quiz_sort},
}


def validate(raw):
    """문제 하나의 형식과 상한을 검사해 정리한 값을 돌려준다. 쓸 수 없으면 ValueError를 낸다."""
    if not isinstance(raw, dict):
        raise ValueError("JSON 객체가 아닙니다.")
    kind = raw.get("type")
    if kind not in TYPES:
        raise ValueError(f"type: 모르는 유형입니다({kind!r}).")
    return {"type": kind, "course_name": text(raw.get("course_name"), 200, "course_name"), "title": text(raw.get("title"), 20, "title"), **TYPES[kind]["clean"](raw), "explanation": text(raw.get("explanation"), 120, "explanation")}


def quiz_of(game):
    """정답을 가린 문제와 기대하는 답. 섞는 순서는 과목마다 고정이라 나중에 풀이와 견줄 수 있다."""
    quiz, expected = TYPES[game["type"]]["quiz"](game, random.Random(compact(game["course_name"])))
    return {"subject": game["course_name"], "type": game["type"], "title": game["title"], **quiz}, expected


# ---- 대상 과목
def slots(duration):
    """그 학과에서 과목 체험이 들어갈 학년 수(`frontend/src/model.js`의 stageYears에서 졸업 과제 학년을 뺀 수)."""
    number = re.match(r"[\d.]+", duration or "")
    years = math.ceil(float(number.group())) if number else 4
    return min(6, max(1, years)) - 1


@lru_cache(maxsize=1)
def subjects():
    """과목 키 → 그 과목을 둔 학교·학과 수, 대표 표기, 대표 학과와 계열."""
    data = catalog()
    counts, names, courses = Counter(), {}, {}
    for (school, course), program in data.programs.items():
        for key, name in {compact(subject): subject for subject in program["curriculum"]}.items():
            counts[key] += 1
            names.setdefault(key, Counter())[name] += 1
            courses.setdefault(key, Counter())[course] += 1
    info = {}
    for key, count in counts.items():
        course = courses[key].most_common(1)[0][0]
        info[key] = {"subject": names[key].most_common(1)[0][0], "course": course, "category": data.categories[course], "programs": count}
    return info


def targets(records):
    """모든 학과의 체험 자리를 채우는 데 필요한 과목 키. 학과마다 가장 흔한 과목부터 고르고, 많이 쓰이는 순서로 돌려준다."""
    info = subjects()
    needed = set()
    for program in catalog().programs.values():
        # 띄어쓰기만 다른 표기가 한 과목으로 묶이므로, 묶인 뒤의 키로 전용 게임 과목을 가려낸다.
        keys = {key for key in map(compact, program["curriculum"]) if not DEDICATED.search(key)}
        usable = [key for key in keys if records.get(key, {}).get("status") not in EXCLUDED]
        needed.update(sorted(usable, key=lambda key: (-info[key]["programs"], key))[:slots(program["duration"])])
    return sorted(needed, key=lambda key: (-info[key]["programs"], key))


# ---- 저장
def load(path=None):
    path = path or GAMES_PATH
    if not path.exists():
        return {}
    with path.open(encoding="utf-8") as file:
        return {compact(record["course_name"]): record for record in (json.loads(line) for line in file if line.strip())}


def save(records, path=None):
    path = path or GAMES_PATH
    lines = [json.dumps(records[key], ensure_ascii=False) for key in sorted(records)]
    path.write_text("".join(line + "\n" for line in lines), encoding="utf-8", newline="\n")


def read_lines(path):
    with open(path, encoding="utf-8-sig") as file:
        return [line for line in file.read().splitlines()]


def now():
    return datetime.now().astimezone().isoformat(timespec="seconds")


# ---- 명령
def ingest(lines, records, model, stamp=None, force=False):
    """작성한 문제(JSONL)를 검사해 검토 대기(review)로 넣는다. (넣은 수, 건너뛴 수, [(줄 번호, 이유)])를 돌려준다."""
    stamp = stamp or now()
    added, skipped, failures = 0, 0, []
    for number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        try:
            raw = json.loads(line)
            if isinstance(raw, dict) and "unsuitable" in raw:
                record = {"course_name": text(raw.get("course_name"), 200, "course_name"), "status": "unsuitable", "reason": text(raw["unsuitable"], 200, "unsuitable"), "generated_at": stamp, "model": model}
            else:
                record = {**validate(raw), "generated_at": stamp, "model": model, "status": "review"}
            key = compact(record["course_name"])
            if key not in subjects():
                raise ValueError(f"course_name: 교과목 목록에 없는 과목입니다({record['course_name']}).")
            if key in records and not force:
                skipped += 1
                continue
            records[key] = record
            added += 1
        except (ValueError, AttributeError) as error:  # json.JSONDecodeError도 ValueError다.
            failures.append((number, str(error)))
    return added, skipped, failures


def pending_quizzes(records, limit=None):
    """아직 독립 풀이를 거치지 않은 검토 대기 문제를 정답을 가려 돌려준다."""
    waiting = [record for key, record in sorted(records.items()) if record.get("status") == "review" and "check" not in record]
    return [quiz_of(record)[0] for record in waiting[:limit]]


def verify_ingest(lines, records, stamp=None):
    """독립 풀이(JSONL: subject, answers, issues)를 정답과 견준다. 답이 모두 같고 지적이 없으면 공개한다."""
    stamp = stamp or now()
    verified, held, failures = 0, 0, []
    for number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        try:
            solved = json.loads(line)
            record = records.get(compact(text(solved.get("subject"), 200, "subject")))
            if not record or record.get("status") != "review":
                raise ValueError(f"검토 대기 중인 문제가 아닙니다({solved.get('subject')}).")
            issues = solved.get("issues", [])
            if not isinstance(issues, list) or not isinstance(solved.get("answers"), list):
                raise ValueError("answers와 issues는 목록이어야 합니다.")
            issues = [" ".join(str(issue).split())[:300] for issue in issues if str(issue).strip()][:10]
            matched = solved["answers"] == quiz_of(record)[1]
            record["check"] = {"matched": matched, "issues": issues, "checked_at": stamp}
            if matched and not issues:
                record["status"] = "verified"
                verified += 1
            else:
                held += 1
        except (ValueError, AttributeError) as error:
            failures.append((number, str(error)))
    return verified, held, failures


def summary(records):
    done = Counter(record.get("status", "") for record in records.values())
    kinds = Counter(record["type"] for record in records.values() if record.get("status") == "verified")
    needed = targets(records)
    return {"statuses": dict(done), "verified_types": dict(kinds), "targets": len(needed), "remaining": sum(key not in records for key in needed)}


def report(failures):
    for number, reason in failures:
        print(f"  {number}번째 줄: {reason}")


def write_out(lines, path):
    body = "".join(json.dumps(line, ensure_ascii=False) + "\n" for line in lines)
    if path:
        with open(path, "w", encoding="utf-8", newline="\n") as file:
            file.write(body)
        print(f"{len(lines)}건을 {path}에 저장했습니다.")
    else:
        sys.stdout.write(body)


def main(argv=None):
    parser = argparse.ArgumentParser(description="수업 연습 문제 관리")
    commands = parser.add_subparsers(dest="command", required=True)
    following = commands.add_parser("next", help="다음에 만들 과목")
    following.add_argument("--limit", type=int, default=50)
    following.add_argument("--out")
    ingesting = commands.add_parser("ingest", help="작성한 문제 넣기")
    ingesting.add_argument("file")
    ingesting.add_argument("--model", default="claude-code", help="문제를 쓴 모델 이름")
    ingesting.add_argument("--force", action="store_true", help="이미 있는 과목도 덮어쓰기")
    quizzing = commands.add_parser("quiz", help="정답을 가린 문제 내보내기")
    quizzing.add_argument("--limit", type=int)
    quizzing.add_argument("--out")
    verifying = commands.add_parser("verify-ingest", help="독립 풀이 반영")
    verifying.add_argument("file")
    commands.add_parser("status", help="현황")
    approving = commands.add_parser("approve", help="검토 대기 문제를 사람이 확인하고 공개")
    approving.add_argument("subject")
    rejecting = commands.add_parser("reject", help="문제를 버리고 다시 나오지 않게 함")
    rejecting.add_argument("subject")
    rejecting.add_argument("--reason", default="")
    args = parser.parse_args(argv)
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    records = load()
    if args.command == "next":
        info = subjects()
        waiting = [key for key in targets(records) if key not in records]
        write_out([info[key] for key in waiting[:max(0, args.limit)]], args.out)
        print(f"남은 대상 {len(waiting)}개", file=sys.stderr)
    elif args.command == "ingest":
        added, skipped, failures = ingest(read_lines(args.file), records, args.model, force=args.force)
        save(records)
        print(f"추가 {added}건 · 이미 있어 건너뜀 {skipped}건 · 실패 {len(failures)}건")
        report(failures)
        return 1 if failures else 0
    elif args.command == "quiz":
        write_out(pending_quizzes(records, args.limit), args.out)
    elif args.command == "verify-ingest":
        verified, held, failures = verify_ingest(read_lines(args.file), records)
        save(records)
        print(f"공개 {verified}건 · 검토 대기 유지 {held}건 · 실패 {len(failures)}건")
        report(failures)
        return 1 if failures else 0
    elif args.command == "status":
        result = summary(records)
        print(f"전체 {len(records)}건 · " + " · ".join(f"{name} {result['statuses'].get(name, 0)}" for name in ("verified", "review", "failed", "unsuitable")))
        print("공개된 유형: " + " · ".join(f"{TYPES[kind]['name']} {result['verified_types'].get(kind, 0)}" for kind in TYPES))
        print(f"대상 과목 {result['targets']}개 중 남은 과목 {result['remaining']}개")
        for record in records.values():
            if record.get("status") == "review":
                check = record.get("check")
                note = "독립 풀이 전" if not check else ("답 불일치" if not check["matched"] else "") + " ".join(check["issues"])
                print(f"  [review] {record['course_name']} ({TYPES[record['type']]['name']}) · {note}")
    else:
        record = records.get(compact(args.subject))
        if args.command == "approve":
            if not record or record.get("status") != "review":
                print("검토 대기 중인 문제가 아닙니다.")
                return 1
            record["status"] = "verified"
            record["check"] = {**record.get("check", {}), "approved_at": now()}
            print(f"공개했습니다: {record['course_name']}")
        else:
            if not record:
                print("등록된 문제가 아닙니다.")
                return 1
            record["status"] = "failed"
            record["reason"] = " ".join(args.reason.split())[:200]
            print(f"버렸습니다: {record['course_name']}")
        save(records)
    return 0


if __name__ == "__main__":
    sys.exit(main())
