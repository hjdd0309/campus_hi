"""과목을 보통 몇 학년에 듣는지(학년 범위) 관리 도구.

원본 데이터에는 과목이 몇 학년 과목인지가 없어서, 이론 수업 과목을 고를 때 쓸 학년 범위(1~4학년)를
과목마다 `data/subject_levels.json`에 따로 둔다. 범위는 사람이나 AI 에이전트가 쓰고, 쓰지 않은 별도
에이전트가 같은 과목을 범위를 보지 않고 따로 매겨서 두 범위가 겹칠 때만 공개(`verified`)한다.
대상은 공개된 연습 문제가 있는 과목이다(이론 수업에 실제로 쓰이는 과목).

    python -m backend.subject_levels todo --out 작업.tsv      # 범위가 없는 과목: 과목명, 대표 학과, 계열
    python -m backend.subject_levels ingest 범위.tsv          # 과목명<TAB>시작-끝 (검토 대기)
    python -m backend.subject_levels blind --out 검토용.tsv    # 검토 대기 과목을 범위 없이 내보내기
    python -m backend.subject_levels verify 검토.tsv           # 따로 매긴 범위와 겹치면 공개, 아니면 conflict
    python -m backend.subject_levels status

conflict로 남은 과목은 범위를 고쳐 `ingest --force`로 다시 넣으면 다음 `blind`에 실려 다시 검토된다.
"""

import argparse
import json
import re
import sys
from collections import Counter

from backend.lesson_games import load as load_games, subjects
from backend.main import LEVELS_PATH, compact

LEVEL = re.compile(r"^\s*([1-4])\s*-\s*([1-4])\s*$")


def parse(lines):
    """`과목명<TAB>시작-끝` 줄들을 (과목명, 시작, 끝)으로. 빈 줄은 건너뛰고, 형식이 틀린 줄은 실패로 모은다."""
    parsed, failures = [], []
    for number, line in enumerate(lines, 1):
        if not line.strip():
            continue
        parts = line.split("\t")
        match = LEVEL.match(parts[1]) if len(parts) >= 2 else None
        if not parts[0].strip() or not match or int(match.group(1)) > int(match.group(2)):
            failures.append(f"{number}번째 줄: `과목명<TAB>시작-끝`(1~4학년, 시작 ≤ 끝) 형식이 아닙니다: {line!r}")
            continue
        parsed.append((parts[0].strip(), int(match.group(1)), int(match.group(2))))
    return parsed, failures


def candidates():
    """범위를 매길 과목 키 → 대표 표기. 공개된 연습 문제가 있는 과목이다."""
    return {key: game["course_name"] for key, game in load_games().items() if game.get("status") == "verified"}


def load(path=None):
    path = path or LEVELS_PATH
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def save(records, path=None):
    path = path or LEVELS_PATH
    # 과목 하나를 한 줄에 써서 고친 과목이 diff에서 한 줄로 보이게 한다.
    lines = [f"{json.dumps(key, ensure_ascii=False)}: {json.dumps(record, ensure_ascii=False)}" for key, record in sorted(records.items())]
    path.write_text("{\n" + ",\n".join(lines) + "\n}\n", encoding="utf-8", newline="\n")


def ingest(lines, records, force=False):
    parsed, failures = parse(lines)
    known = candidates()
    added = 0
    for subject, start, end in parsed:
        key = compact(subject)
        if key not in known:
            failures.append(f"{subject}: 공개된 연습 문제가 있는 과목이 아닙니다.")
        elif key in records and not force:
            failures.append(f"{subject}: 이미 있습니다(고치려면 --force).")
        else:
            records[key] = {"subject": known[key], "from": start, "to": end, "status": "review"}
            added += 1
    return added, failures


def verify(lines, records):
    """따로 매긴 범위와 견준다. 겹치면 공개하고, 겹치지 않으면 conflict로 남긴다."""
    parsed, failures = parse(lines)
    counts = Counter()
    for subject, start, end in parsed:
        record = records.get(compact(subject))
        if not record or record["status"] != "review":
            failures.append(f"{subject}: 검토 대기 중인 과목이 아닙니다.")
            continue
        record["check"] = {"from": start, "to": end}
        record["status"] = "verified" if max(start, record["from"]) <= min(end, record["to"]) else "conflict"
        counts[record["status"]] += 1
    return counts, failures


def summary(records):
    known = candidates()
    counts = Counter(record["status"] for key, record in records.items() if key in known)
    return {"대상": len(known), "공개": counts["verified"], "검토 대기": counts["review"], "불일치": counts["conflict"], "남은 과목": len(set(known) - set(records))}


def write_out(lines, path):
    with open(path, "w", encoding="utf-8", newline="\n") as file:
        file.write("".join(line + "\n" for line in lines))
    print(f"{len(lines)}줄을 {path}에 썼습니다.")


def report(failures):
    for failure in failures:
        print(failure, file=sys.stderr)
    return 1 if failures else 0


def main(argv=None):
    parser = argparse.ArgumentParser(description="과목의 학년 범위 관리")
    commands = parser.add_subparsers(dest="command", required=True)
    todo = commands.add_parser("todo", help="범위가 없는 과목")
    todo.add_argument("--out", required=True)
    ingesting = commands.add_parser("ingest", help="쓴 범위 넣기")
    ingesting.add_argument("path")
    ingesting.add_argument("--force", action="store_true")
    blind = commands.add_parser("blind", help="검토 대기 과목을 범위 없이 내보내기")
    blind.add_argument("--out", required=True)
    verifying = commands.add_parser("verify", help="따로 매긴 범위 반영")
    verifying.add_argument("path")
    commands.add_parser("status", help="현황")
    args = parser.parse_args(argv)

    records = load()
    info = subjects()
    if args.command == "todo":
        rows = [f"{name}\t{info[key]['course']}\t{info[key]['category']}" for key, name in sorted(candidates().items(), key=lambda item: -info[item[0]]["programs"]) if key not in records]
        write_out(rows, args.out)
        return 0
    if args.command == "blind":
        rows = [f"{record['subject']}\t{info[key]['course']}\t{info[key]['category']}" for key, record in records.items() if record["status"] == "review"]
        write_out(rows, args.out)
        return 0
    if args.command == "ingest":
        with open(args.path, encoding="utf-8-sig") as file:
            added, failures = ingest(file.read().splitlines(), records, args.force)
        save(records)
        print(f"{added}개를 넣었습니다(검토 대기).")
        return report(failures)
    if args.command == "verify":
        with open(args.path, encoding="utf-8-sig") as file:
            counts, failures = verify(file.read().splitlines(), records)
        save(records)
        print(f"공개 {counts['verified']}개, 불일치 {counts['conflict']}개")
        return report(failures)
    print(json.dumps(summary(records), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
