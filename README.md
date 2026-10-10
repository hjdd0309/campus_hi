# 캠퍼스하이

관심 분야에서 출발해 대학 학과와 교육과정을 살펴보고, 학년별 체험으로 전공을 미리 경험하는 웹 서비스입니다. 체험은 학과의 수업연한에 맞춰 학년마다 하나씩 있고(4년제는 1~4학년, 2년제는 1~2학년), 마지막 학년은 학과에 맞는 졸업 과제입니다(조형·디자인 학과는 도색 졸업작품, 공학은 캡스톤 디자인 계획서, 그 밖의 예체능은 졸업 발표 계획서, 나머지는 졸업 연구 계획서).

## 폴더 구조
- `frontend/` : React + Vite + Tailwind CSS 화면. 디자인과 모션은 처음 만든 Figma Make 시안을 따릅니다(화면 `src/screens.jsx`, 공용 부품 `src/ui.jsx`, 화면 전환 `src/App.jsx`, 색·모션 `src/index.css`).
- `backend/` : FastAPI 서버와 학과 데이터(`data/courses.csv.gz`, 출처는 `backend/SOURCE.md`)
- `scripts/dev.mjs` : 개발 환경 준비와 실행

## 개발

Node.js 22.12 이상과 Python 3.10 이상이 필요합니다.

```
npm start        # 백엔드(8000)와 프런트 개발 서버를 함께 실행
npm test         # 프런트 테스트
npm run build    # 프런트 프로덕션 빌드
```

백엔드 테스트:

```
backend/.venv/Scripts/python -m pip install -r backend/requirements-test.txt -r backend/requirements-pipeline.txt
backend/.venv/Scripts/python -m unittest backend.test_api backend.test_pipeline backend.test_lesson_games
```

## 운영 배포

`frontend/dist`가 있으면 백엔드가 화면까지 함께 제공하므로 서버 하나만 띄우면 됩니다.

```
npm run build
backend/.venv/Scripts/python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Docker로 배포할 때는 저장소 루트의 `Dockerfile`을 사용합니다. 포트는 `PORT` 환경변수(기본 8000)를 따릅니다.

```
docker build -t hi-campus .
docker run -p 8000:8000 hi-campus
```

Vercel로 배포할 때는 `vercel.json`을 사용합니다. 화면은 정적 파일로, API는 `api/index.py`를 거쳐 서버리스 함수로 제공됩니다. 파이썬 의존성은 루트 `requirements.txt`에서 읽으므로 `backend/requirements.txt`와 버전을 맞추고, 보안 헤더는 `backend/main.py`와 `vercel.json` 양쪽에 있으므로 함께 고칩니다.

```
vercel          # 프리뷰 배포
vercel --prod   # 운영 배포
```

HTTPS와 요청 빈도 제한은 서버 앞단(호스팅 플랫폼이나 리버스 프록시)에서 설정합니다. 상태 확인 주소는 `/api/health`입니다.

## 학년별 교육과정 수집

원본 데이터에는 학년 정보가 없어서, 학교 홈페이지의 교육과정 페이지에서 학년·학기별 편성을 따로 모읍니다. 수집 도구는 `backend/pipeline.py`이고 결과는 `backend/data/year_curricula.json`에 쌓입니다. 검증을 통과한 학과만 화면의 "교육과정" 탭에 학년별 수업으로 나오고, 나머지 학과는 지금처럼 교과목 목록만 보여줍니다.

1. `backend/data/year_sources.csv`에 `school,course,url`을 한 줄씩 적습니다. 학교명과 학과명은 서비스에 나오는 이름과 똑같아야 하고, 주소는 그 학과의 학년별 편성표가 있는 페이지나 PDF여야 합니다.
2. Anthropic API 키를 `ANTHROPIC_API_KEY` 환경변수로 넣고 수집을 실행합니다.

```
backend/.venv/Scripts/python -m pip install -r backend/requirements-pipeline.txt
backend/.venv/Scripts/python -m backend.pipeline collect      # 전체. --school, --course로 일부만
backend/.venv/Scripts/python -m backend.pipeline status       # 현황과 실패·검토 대기 목록
```

수집은 페이지를 받아 내용이 지난번과 같으면 건너뛰고, 바뀐 페이지만 다시 추출합니다. 학교가 편성을 바꾸면 같은 명령을 다시 돌리면 됩니다. 추출한 과목 중 기존 교과목 목록에도 있는 과목이 절반 이상이면 바로 공개(`verified`)하고, 그보다 낮으면 검토 대기(`review`)로 두어 화면에 내보내지 않습니다. 검토 대기 항목은 출처 페이지와 직접 비교한 뒤 공개합니다.

```
backend/.venv/Scripts/python -m backend.pipeline approve 경희대학교 산업디자인학과
```

홈페이지에 편성표가 없거나 읽을 수 없는 학과는 직접 정리한 CSV(`school,course,year,semester,subject`, 학기 구분이 없으면 0)로 넣을 수 있습니다.

```
backend/.venv/Scripts/python -m backend.pipeline import 편성표.csv
```

수집 결과는 서버를 다시 띄우거나 다시 배포해야 반영됩니다.

## 수업 연습 문제

전용 미니게임이 없는 과목에는 미리 만들어 둔 연습 문제가 붙습니다. 유형은 빈칸 채우기, OX 퀴즈, 순서 맞추기, 짝 맞추기, 분류하기 다섯 가지이고, 과목 하나에 유형 하나입니다. 체험은 전용 미니게임, 연습 문제, 기본 체험(관찰 과제) 순서로 정해집니다. 문제는 `backend/data/lesson_games.jsonl`에 쌓이고 서버는 검증된 것만 내보냅니다. 형식과 상한은 `backend/SOURCE.md`에 있습니다.

문제는 서비스가 돌아가는 중에 만들지 않고, AI 에이전트(Claude Code)가 미리 써서 넣습니다. API 키는 필요 없습니다. 한 번에 50개씩 아래 순서로 진행합니다. 작업 파일은 `backend/.cache/lesson_games/`에 둡니다(저장소에 올라가지 않음).

```
backend/.venv/Scripts/python -m backend.lesson_games next --limit 50 --out backend/.cache/lesson_games/next.jsonl
# next.jsonl의 과목마다 문제를 써서 batch.jsonl에 한 줄씩 적는다
backend/.venv/Scripts/python -m backend.lesson_games ingest backend/.cache/lesson_games/batch.jsonl --model 모델명
backend/.venv/Scripts/python -m backend.lesson_games quiz --out backend/.cache/lesson_games/quiz.jsonl
# quiz.jsonl(정답을 가린 문제)을 문제를 쓰지 않은 별도 에이전트가 풀어 solved.jsonl에 적는다
backend/.venv/Scripts/python -m backend.lesson_games verify-ingest backend/.cache/lesson_games/solved.jsonl
backend/.venv/Scripts/python -m backend.lesson_games status
```

- `next`는 모든 학과의 체험 자리를 채우는 데 필요한 과목을 많이 쓰이는 순서로 줍니다(학과마다 가장 흔한 과목부터).
- 문제로 만들 내용이 없는 과목(현장실습, 캡스톤디자인 등)은 `{"course_name":"과목명","unsuitable":"이유"}`로 적습니다. 그 과목은 다시 나오지 않고, 그 학과의 다음 과목이 대상에 들어옵니다.
- `ingest`는 형식과 상한을 검사해 맞는 것만 검토 대기(`review`)로 넣고, 틀린 줄은 이유와 함께 알려줍니다. 고쳐서 다시 넣으면 됩니다.
- 풀이가 정답과 모두 같고 지적 사항이 없으면 공개(`verified`)되고, 아니면 검토 대기로 남습니다. 남은 것은 `status`로 확인해 문제를 고쳐 `ingest --force`로 다시 넣거나, 직접 확인한 뒤 `approve 과목명`, 버리려면 `reject 과목명 --reason 이유`를 씁니다.
- 문제를 쓸 때는 그 과목의 표준 교재에 공통으로 나오는 내용만 다루고, 교재나 학자에 따라 답이 갈리는 내용, 해마다 바뀌는 수치는 피합니다.
- 공개된 문제는 서버를 다시 띄우거나 다시 배포해야 반영됩니다.

유형을 추가하려면 `backend/lesson_games.py`의 `TYPES`와 `frontend/src/lessonGames.js`의 `lessonTypes`에 형식 검사를 넣고, `frontend/src/TypedGames.jsx`의 `typedComponents`에 화면을 등록합니다.

## 수업 맞춤 미니게임

과목명이 규칙에 맞으면 그 수업의 체험이 미니게임으로 바뀝니다. 규칙과 채점은 `frontend/src/games.js`, 화면은 `frontend/src/Games.jsx`에 있습니다.

| 게임 | 붙는 과목 |
| --- | --- |
| 스트룹 실험 | 심리학개론, 인지심리학, 실험심리학 |
| 버블 정렬 직접 해보기 | 자료구조, 알고리즘 |
| 분개 연습 | 회계원리, 재무회계 |

게임을 추가하려면 `games.js`의 `games`에 과목명 패턴을 넣고, `Games.jsx`에 화면을 만들어 `components`에 등록합니다.

## 보일러플레이트 출처
- backend/main.py : FastAPI 공식 문서 예제
(https://fastapi.tiangolo.com, MIT License)

## 사용 오픈소스
프론트	React	19.3.0	화면 구성·상태 관리	MIT
프론트	React DOM	19.3.0	브라우저에 화면 표시	MIT
개발 도구	Vite	8.3.4	개발 서버·빌드	MIT
백엔드	FastAPI	0.115.12	API 서버	MIT
백엔드	Uvicorn	0.34.2	서버 실행	BSD-3-Clause
백엔드	Pydantic	2.14.0*	요청 데이터 검증	MIT
백엔드	Starlette	0.46.2*	FastAPI 내부 웹 처리
