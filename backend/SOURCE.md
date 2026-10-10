# Litton 연동

대학·학과 데이터와 API 계약의 출처는 [dotorihanjum/litton](https://github.com/dotorihanjum/litton)입니다.

- 기준 커밋: `15e843282be12ea3819211f394f52b9ba4907b69`
- 원본 데이터: `backend/datafile_local/output.csv`
- 포함 데이터: `data/courses.csv.gz` — 원본 CSV를 변경 없이 gzip 압축
- 계약: 루트 `API명세서.md`와 `frontend/src/api.ts`

기준 커밋에는 실행 가능한 서버 진입점이 포함되어 있지 않아 FastAPI 서버를 추가했습니다. 원본 명세는 목록을 쉼표로 구분한 문자열로 주고받지만, 학과명에 쉼표가 들어간 경우가 있어(예: `PEP(정치학,경제학,철학)연계전공`) 이 서버는 문자열 배열을 사용합니다.

## 제공 범위

원본 30,806행 중 학부 과정이면서 교과목이 등록된 학교·학과만 제공합니다(학교 390곳, 학과명 7,112개, 학교·학과 조합 13,347개).

- 학교명에 `대학원`이 들어간 행, 폐과, `주요교과목명`이 비어 있는 행은 제외합니다.
- 같은 학교·학과가 여러 행이면 교과목을 합치고 중복을 없앱니다.
- 같은 학과도 학교마다 계열 표기가 달라, 그 학과명에 가장 많이 쓰인 계열을 학과의 계열로 씁니다.
- 원본에는 **학년·학기 정보가 없습니다.** 교과목은 학년 구분 없는 목록입니다.

## API

| 메서드 | 경로 | 요청 | 응답 |
| --- | --- | --- | --- |
| POST | `/api/course_list` | `{"interests":"공학","query":"컴퓨터","offset":0,"limit":30}` | `{"course_list":["컴퓨터공학과","..."],"total":33}` |
| POST | `/api/school_list` | `{"course":"산업디자인학과"}` | `{"school_list":["경희대학교","..."]}` |
| POST | `/api/curriculum_list` | `{"school":"경희대학교","course":"산업디자인학과"}` | `{"curriculum_list":["3D Design 1","..."],"category":"예체능","duration":"4년","region":"경기도","years":null,"games":{"과목명":"ox"}}` |
| POST | `/api/lesson_game` | `{"subject":"데이터베이스"}` | `{"game":{"type":"blank","course_name":"데이터베이스","...":"..."}}` |
| GET | `/api/health` | 없음 | `{"status":"ok","source":"litton","records":13347}` |

`interests`는 `전체`, 계열명(`인문사회`, `공학`, `자연과학`, `예체능`, `의학`) 또는 학과명에 포함될 키워드입니다. `query`, `offset`, `limit`은 생략할 수 있고, 목록은 개설 대학이 많은 학과부터 정렬됩니다.

`games`는 그 학과의 교과목 중 공개된 연습 문제가 있는 과목과 그 유형입니다. `/api/lesson_game`은 과목명(띄어쓰기·대소문자 무시)으로 연습 문제를 찾고, 없으면 404를 반환합니다.

빈 필드나 잘못된 자료형은 400, 존재하지 않는 대학·학과 조합은 404를 반환합니다. 오류 응답은 `{"detail":"메시지"}` 형식입니다. 검색 결과가 없으면 빈 배열을 반환합니다.

진행 상태와 실습 기록, 작품은 브라우저에 저장됩니다. 사용자 계정·학습 기록 API는 없으므로 서버로 전송하지 않습니다.

## 연습 문제 형식

`data/lesson_games.jsonl`에 과목 하나가 한 줄(JSON)로 들어 있습니다. 이 문제는 원본 데이터에 있는 것이 아니라 AI가 과목명을 보고 쓴 것이고, 정답을 가린 채 따로 풀어 본 결과가 정답과 모두 같고 지적 사항이 없는 것만 공개합니다(`backend/lesson_games.py`). 서버는 `status`가 `verified`인 줄만 내보냅니다.

공통 필드:

| 필드 | 내용 | 상한 |
| --- | --- | --- |
| `type` | `blank`, `ox`, `order`, `match`, `sort` 중 하나 | |
| `course_name` | 과목명. 교과목 목록에 있는 이름이어야 함 | |
| `title` | 화면에 보이는 제목 | 20자 |
| `items` | 문항(유형별 형식은 아래) | |
| `explanation` | 다 풀고 나서 보여주는 전체 해설 | 120자 |
| `generated_at`, `model` | 만든 시각과 만든 모델. `ingest`가 채움 | |
| `status` | `review`(검토 대기), `verified`(공개), `failed`(버림), `unsuitable`(문제로 만들 수 없는 과목) | |
| `check` | 독립 풀이 결과(`matched`, `issues`, `checked_at`). 서버 응답에는 없음 | |

유형별 필드(402×874 화면의 본문 폭에 맞춘 상한):

| 유형 | 필드 | 규칙 |
| --- | --- | --- |
| `blank` 빈칸 채우기 | `items[]`: `text`, `choices`, `answer`, `explanation` | 3문항. `text`(60자)에 빈칸 `___`(밑줄 3개)이 정확히 1개. 선지 3개(각 12자, 서로 다름). `answer`는 정답 선지의 번호(0~2). 문항 해설 80자 |
| `ox` OX 퀴즈 | `items[]`: `text`, `answer`, `explanation` | 5문항. `text` 60자. `answer`는 `true`(O) 또는 `false`(X)이고 O와 X가 각각 1개 이상. 문항 해설 80자 |
| `order` 순서 맞추기 | `prompt`, `items[]`: `text` | `prompt` 40자. 4~5단계를 정답 순서대로 적음(각 24자, 서로 다름) |
| `match` 짝 맞추기 | `prompt`, `items[]`: `left`, `right` | `prompt` 40자. 4~6쌍. `left` 10자, `right` 22자, 각각 서로 다름 |
| `sort` 분류하기 | `prompt`, `categories`, `items[]`: `text`, `category` | `prompt` 40자. 카테고리 2~3개(각 8자). 항목 6~8개(각 14자, 서로 다름). `category`는 카테고리 번호이고 카테고리마다 항목 2개 이상 |

`unsuitable`인 줄에는 `course_name`, `status`, `reason`, `generated_at`, `model`만 있습니다.

독립 풀이(`verify-ingest`에 넣는 JSONL)는 한 줄이 `{"subject":"과목명","answers":[...],"issues":["..."]}`입니다. `answers`는 `quiz` 명령이 내보낸 문제 기준으로 적습니다(번호는 0부터): `blank`는 문항별 선지 번호, `ox`는 문항별 `true`/`false`, `order`는 올바른 순서대로 적은 `items` 번호, `match`는 `left` 순서대로 짝이 되는 `right` 번호, `sort`는 `items` 순서대로 카테고리 번호. `issues`에는 사실 오류, 모호한 문제, 정답이 여럿인 문제를 적고, 없으면 빈 배열입니다.
