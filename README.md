<div align="center">

<img src="frontend/src/assets/mascot-splash.png" alt="캠퍼스하이 마스코트" width="140" />

<br />

<img src="frontend/src/assets/wordmark.png" alt="캠퍼스하이" width="220" />

### 내가 만드는 더 높은 미래, 캠퍼스하이

모르고 고르던 전공을, 해보고 고르는 전공으로

<br />

[![서비스 바로가기](https://img.shields.io/badge/서비스-campushi.vercel.app-27D8CB?style=for-the-badge)](https://campushi.vercel.app/)
[![Notion](https://img.shields.io/badge/Notion-프로젝트_문서-000000?style=for-the-badge&logo=notion&logoColor=white)](https://app.notion.com/p/3f67558aa90480e49c1ce1c193cf696c)
[![Figma Make 시연](https://img.shields.io/badge/Figma_Make-시연-F24E1E?style=for-the-badge&logo=figma&logoColor=white)](https://scrum-heave-00503286.figma.site/)

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)

</div>

---

관심 분야에서 출발해 대학 학과와 교육과정을 살펴보고, 학년별 체험으로 전공을 미리 경험하는 웹 서비스입니다. 고등학생이 학과를 모르고 고르는 것이 아니라 체험해 보고 고르도록 돕습니다.

체험은 학과의 수업연한에 맞춰 학년마다 하나씩 있고(4년제는 1~4학년, 2년제는 1~2학년), 마지막 학년은 학과에 맞는 졸업 과제입니다(조형·디자인 학과는 도색 졸업작품, 공학은 캡스톤 디자인 계획서, 그 밖의 예체능은 졸업 발표 계획서, 나머지는 졸업 연구 계획서).

## 🔗 바로가기

| | 링크 |
| --- | --- |
| 🎓 서비스 | https://campushi.vercel.app/ |
| 📒 Notion 프로젝트 문서 | [캠퍼스하이](https://app.notion.com/p/3f67558aa90480e49c1ce1c193cf696c) |
| 🖱️ Figma Make 시연 | https://scrum-heave-00503286.figma.site/ |
| 🎨 Figma 디자인 파일 | [릿톤](https://www.figma.com/design/reLleJ2e3SR6iRYv31pwRc/%EB%A6%BF%ED%86%A4) |

## 📊 숫자로 보는 캠퍼스하이

| 학교 | 학과명 | 학교·학과 조합 | 공개된 연습 문제 |
| :---: | :---: | :---: | :---: |
| **388곳** | **6,844개** | **12,732개** | **1,507과목** |

2026-10-13 기준입니다(자유·자율전공, 교양 과정, 1년 과정은 학년별 체험을 만들 수 없어 제외). 대학·학과 데이터 출처는 [dotorihanjum/litton](https://github.com/dotorihanjum/litton)이고, 제공 범위는 [`backend/SOURCE.md`](backend/SOURCE.md)에 있습니다.

## 🗺️ 체험 여정

입학부터 졸업까지, 대학 생활의 흐름을 그대로 따라가며 전공을 체험합니다.

| 입학 | 전공 커리큘럼 | 전공 수업 체험 | 전공 성적표 | 졸업 |
| :---: | :---: | :---: | :---: | :---: |
| 체험 입학증 발급 | 학교별 실제 교과목 | 이론 수업 → 학과군 전공 실습 → 졸업 과제 | A+ 도장 성적표 | 졸업장 + 체험 리포트 |

| 단계 | 화면 | 하는 일 |
| --- | --- | --- |
| 관심 찾기 | 시작 → 관심 질문 → 탐색(질문·키워드) → 탐색 중 → 결과 | 관심 분야 추천 |
| 학과 알아보기 | 학교·학과 찾기 → 학과 상세 | 개설 학교와 교과목 보기 |
| 입학 | 입학증 → 환영 | 체험 시작 |
| 배우기 | 홈 → 수업 | 학년별 체험과 기록 |
| 졸업 | 성적표 → 졸업증명서 → 졸업 | 체험 리포트 |
| 기록 | 마이페이지 | 체험한 학과, 리포트 내려받기 |

## 🛠️ 기술 구성

| 영역 | 기술 | 비고 |
| --- | --- | --- |
| 프런트 | React 19 + Vite 8 + Tailwind CSS v4 | 402×874 아트보드, Figma Make 시안 디자인·모션 |
| 백엔드 | FastAPI (`backend/main.py`) | CSV를 메모리에 올려 제공, DB 없음 |
| 데이터 | dotorihanjum/litton CSV (gzip) | 학부 + 교과목 있는 행만 |
| 수집 | `backend/pipeline.py`, Claude API | 학교 홈페이지에서 학년별 편성 추출 |
| 배포 | Vercel 또는 Docker | |

## 📚 문서

자세한 기획과 디자인 문서는 Notion에 있습니다.

| 문서 | 내용 |
| --- | --- |
| 📘 [서비스 기획서 v1.0](https://app.notion.com/p/v1-0-3f77558aa90481b5914fe9ce144742f9) | 문제 정의, 서비스 상세, 차별성, 사업성 |
| 🎨 [디자인 시스템](https://app.notion.com/p/3f67558aa9048110b2e0cb427c76f18f) | 색, 글자, 부품 |
| 🗺️ [서비스 플로우 & 화면](https://app.notion.com/p/3f67558aa90481fb888de2226a4d3224) | 체험 여정과 화면 목록 |
| 🎤 [발표자료](https://app.notion.com/p/3f67558aa9048125b6c9effd3e8aedbc) | 발표 슬라이드 |
| 🛠️ [개발](https://app.notion.com/p/3f67558aa9048129917fe6de5a5fa0c8) | 기술 구성, 구현 현황, 체험 구조 개편 |
| ✅ [할 일](https://app.notion.com/p/7d0edefa98814c7ba54d00449b16411e) | 작업 목록 |

저장소 안의 문서: [`TODO.md`](TODO.md)(작업 현황), [`개발기획서_체험구조.md`](개발기획서_체험구조.md)(체험 구조 개편), [`backend/SOURCE.md`](backend/SOURCE.md)(데이터 범위와 API 형식).

## 👥 팀 한정선13알오너

| 이름 | 학과 |
| --- | --- |
| 이원준 | 컴퓨터공학과 |
| 한상연 | 컴퓨터공학과 |
| 김현정 | 소프트웨어융합학과 |
| 조민준 | 기계공학과 |
| 김영웅 | 산업디자인학과 |
| 김도희 | 산업디자인학과 |

---

## 폴더 구조
- `frontend/` : React + Vite + Tailwind CSS 화면. 디자인과 모션은 처음 만든 Figma Make 시안을 따릅니다(화면 `src/screens.jsx`, 공용 부품 `src/ui.jsx`, 화면 전환 `src/App.jsx`, 색·모션 `src/index.css`).
- `backend/` : FastAPI 서버와 학과 데이터(`data/courses.csv.gz`, 출처는 `backend/SOURCE.md`)
- `scripts/dev.mjs` : 개발 환경 준비와 실행
- `학과데이터/학교_학과/` : 과목 활동 정보 수집의 결과. `강의계획서/`(원문), `강의계획서_목록.csv`, `활동.csv`(아래 "과목 활동 정보 수집")

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
backend/.venv/Scripts/python -m unittest backend.test_api backend.test_pipeline backend.test_lesson_games backend.test_subject_levels backend.test_course_activity
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

원본 데이터에는 학년 정보가 없어서, 학교 홈페이지의 교육과정 페이지에서 과목마다 권장 학년을 따로 모읍니다(학기는 구분하지 않음). 과목명은 원본 교과목명에 맞춰 저장하고, 맞추지 못한 과목은 `unmatched`에, 여러 학년에 걸친 과목은 가장 낮은 학년으로 넣고 `multi_year`에 적습니다. 학과마다 출처 주소, 교육과정 적용 연도, 수집 날짜를 함께 저장합니다. 수집 도구는 `backend/pipeline.py`이고 결과는 `backend/data/year_curricula.json`에 쌓입니다. 검증을 통과한 학과만 화면의 "교육과정" 탭에 학년별 수업으로 나오고, 나머지 학과는 지금처럼 교과목 목록만 보여줍니다.

1. `backend/data/year_sources.csv`에 `school,course,url`을 한 줄씩 적습니다. 학교명과 학과명은 서비스에 나오는 이름과 똑같아야 하고, 주소는 그 학과의 과목별 학년이 적힌 페이지나 PDF여야 합니다. 출처를 못 찾은 학과는 url을 비워 둡니다(추측해서 넣지 않음).
2. Anthropic API 키를 `ANTHROPIC_API_KEY` 환경변수로 넣고 수집을 실행합니다.

```
backend/.venv/Scripts/python -m pip install -r backend/requirements-pipeline.txt
backend/.venv/Scripts/python -m backend.pipeline collect 경희대학교            # 그 학교의 출처가 있는 학과 전체
backend/.venv/Scripts/python -m backend.pipeline collect 경희대학교 --limit 3  # 아직 수집하지 않은 학과 중 3개만
backend/.venv/Scripts/python -m backend.pipeline report 경희대학교             # 학과별 리포트만 다시 만들기
backend/.venv/Scripts/python -m backend.pipeline status                       # 현황과 실패·검토 대기 목록
```

이미 수집한 학과(공개·검토 대기·편성 없음)는 다시 돌리지 않고, 오류가 난 학과와 출처 주소가 바뀐 학과만 다시 돌립니다. 학교가 편성을 바꿔 다시 뽑으려면 `--force`를 붙입니다. 원본 교과목에 맞춘 비율(매칭률)이 절반 이상이고 마지막 학년 앞의 학년이 모두 채워지면 바로 공개(`verified`, 리포트의 "성공")하고, 아니면 검토 대기(`review`, "부분 성공")로 두어 화면에 내보내지 않습니다. 편성이 없거나 받기·추출에 실패하면 "실패"입니다. 실행이 끝나면 학과별 결과, 매칭률, 토큰 수와 비용, 걸린 시간을 `backend/data/year_reports/학교.csv`에 남기고 요약을 출력합니다. 검토 대기 항목은 출처 페이지와 직접 비교한 뒤 공개합니다.

```
backend/.venv/Scripts/python -m backend.pipeline approve 경희대학교 산업디자인학과
```

홈페이지에 편성표가 없거나 읽을 수 없는 학과는 직접 정리한 CSV(`school,course,year,subject`, 선택으로 `alias`, `url`, `curriculum_year`)로 넣을 수 있습니다. 사람이 편성표와 대조한 자료로 보고 바로 공개합니다. `subject`는 편성표에 적힌 과목 이름입니다. 공시 자료(`courses.csv.gz`)의 교과목 이름이 다르면 `alias`에 공시 이름을 적습니다(예: 편성표 "디자인비즈니스", 공시 "산업디자인비지니스"). 띄어쓰기만 다른 이름은 자동으로 맞춥니다. 공시 자료에 없는 편성표 과목은 `extra`로 남아 학년별 과목 목록에 편성표 이름 그대로 보입니다. 넣은 CSV는 출처를 남기기 위해 `backend/data/year_imports/`에 둡니다(예: `경희대학교-산업디자인학과-2025.csv`, 2025학년도 예술·디자인대학 교육과정 [별표1]).

```
backend/.venv/Scripts/python -m backend.pipeline import backend/data/year_imports/학교-학과-연도.csv
```

단과대 전체 교육과정처럼 한 PDF에 여러 학과가 들어 있고 100쪽이 넘으면, `collect`가 학과 이름이 나오는 쪽(과 그 다음 쪽)만 골라 보냅니다(`pypdf`, `requirements-pipeline.txt`).

수집 결과는 서버를 다시 띄우거나 다시 배포해야 반영됩니다.

## 과목 활동 정보 수집

학과 게임을 설계할 때 쓰는 자료입니다. 안 들어본 과목도 "학생이 수업에서 실제로 하는 활동"을 알 수 있게, 과목마다 활동을 근거(URL·근거 문장)와 함께 모아 8개 활동 유형(코드 작성·디버깅, 계산·증명, 실험·측정·보고서, 설계·제도, 데이터 분석, 창작·제작, 사례 분석·토론·발표, 실기·임상)으로 나눕니다. 서비스 화면에는 나가지 않고, 팀원이 검토한 뒤 게임 설계 입력으로 씁니다. 도구는 `backend/course_activity.py`이고 `ANTHROPIC_API_KEY`가 필요합니다(`--dry-run`과 `report`는 필요 없음).

```
backend/.venv/Scripts/python -m backend.course_activity run --school 경희대학교 --course 컴퓨터공학과 --dry-run             # 대상 과목과 예상 호출 수·비용만
backend/.venv/Scripts/python -m backend.course_activity run --school 경희대학교 --course 컴퓨터공학과 --max-courses 3 --budget-usd 2
backend/.venv/Scripts/python -m backend.course_activity report --school 경희대학교 --course 컴퓨터공학과                   # 호출 없이 리포트만 다시
```

`--course`는 학과 이름의 일부만 적어도 그 이름이 들어간 학과가 하나뿐이면 찾습니다. 과목명은 표기만 다른 것(자료구조/자료구조론/데이터구조, 끝의 번호)을 묶어 묶음마다 한 번씩 처리합니다. 순서는 강의계획서 탐색(웹 검색) → 1차 분류(검색 없이 찾은 문서·과목명으로) → 2차 검색(강의계획서를 찾았어도 늘 함, `claude-opus-5-5` + 웹 검색. 강의계획서에서 얻은 학수번호·영문 과목명·프로젝트 이름을 검색어에 반드시 넣고, 쓰지 않은 검색어는 `빠진_검색어`로 남김) → 검증 → 리포트입니다. 검증에서는 근거 URL·근거 문장이 없거나, 그 검색에서 실제로 나온 주소가 아니거나, 근거 문장이 그 페이지에 그대로 있지 않으면 버리고, 남은 항목은 다른 모델(`claude-sonnet-5-5`)이 근거와 주장이 맞는지 대조합니다. 신뢰도는 높음이 (a) 강의계획서와 학생 결과물·과제 명세가 같은 활동 유형을 보여줌, (b) 같은 학교의 서로 다른 학기·교수 강의계획서 2개 이상과 학생 결과물 1개 이상이 같은 활동, (c) 서로 다른 학교 2곳 이상의 결과물이 같은 활동 중 하나일 때이고, 중간은 강의계획서만 있거나 결과물만 있을 때, 낮음은 교과목 해설·과목명뿐일 때입니다. `summary.md`에 과목마다 어떤 규칙으로 판정됐는지 적습니다. 대표 과제·시험 형태는 2차 검색의 구체적인 근거(과제 명세, 학생 결과물, 기출 문제)를 먼저 쓰고, 없으면 강의계획서로 채우며, 둘 다 검증을 거칩니다. `review.csv`에는 `[출처 종류] 내용` 형식으로, 강의계획서 근거가 따로 있으면 함께 적습니다.

- 강의계획서: 사람이 파일을 넣지 않고, 묶음마다 웹 검색으로 그 학교의 공개 강의계획서 조회 페이지, 학과 교육과정 PDF·교과목 해설, 교수 강의 페이지를 찾습니다. 포털·수강신청·LMS처럼 로그인이 필요한 페이지는 건너뜁니다(`LOGIN_HOSTS`). 찾은 문서는 프로그램이 직접 받아 과목명이 들어 있는지 확인하고, 과목 둘레 원문을 발췌해 `stage0_syllabus.jsonl`(과목명, 학교, 학과, 찾음, 문서마다 `문서_URL`·`문서_종류`·`추출_텍스트_요약`·`원문_발췌`, 버린 문서와 이유)에 남깁니다. 못 찾으면 `찾음: false`로 두고 과목명만으로 다음 단계를 합니다.
- 결과: `학과데이터/학교_학과/활동.csv`(팀원 검토용, 마지막 두 칸 `팀원_판정`·`팀원_메모`는 비워 둠). 다시 돌릴 때 이어서 쓰는 단계별 기록(`courses_normalized.json`, `stage0_syllabus.jsonl`, `stage1_classification.jsonl`, `stage2_search.jsonl`, `verify.jsonl`, `final.jsonl`)과 `summary.md`(유형 분포, 과목별 판정, 근거 부족 과목, 호출 수와 비용)는 저장소에 올리지 않는 작업 폴더 `backend/.cache/course_activity/work/학교_학과/`에 둡니다. 이 폴더가 없으면 처음부터 다시 돕니다(지금까지의 기록은 git 기록의 `pipelines/course_activity/outputs/`에 있음).
- API 키 없이 Claude Code로 돌릴 때는 `--manual`을 붙입니다. 답이 없는 단계마다 `backend/.cache/course_activity/학교_학과/requests/단계.jsonl`에 요청(프롬프트)을 남기고 멈추므로, Claude Code가 요청을 읽고 같은 폴더의 `stage0.jsonl`·`stage1.jsonl`·`stage2.jsonl`·`verify.jsonl`에 `{"key", "prompt_id", "answer"}`로 답을 쓴 뒤 같은 명령을 다시 돌립니다(강의계획서 탐색 → 1차 분류 → 검색 → 검증, 다섯 번). 검색은 Claude Code가 직접 하므로 어떤 페이지가 나왔는지 기록이 없어, 모든 출처를 직접 받아 근거 문장을 대조합니다. 검증 답은 검색을 하지 않은 별도 서브에이전트(Sonnet)가 그 요청 파일만 읽고 씁니다. 비용은 $0으로 기록됩니다.
- 공시 교과목 대신 학교 교육과정 표로 돌릴 때는 `--courses 파일`(한 줄에 `학년<TAB>과목명`)을 붙입니다. 그 목록의 과목만 묶어 처리하고, 학년과 "같은 학과의 다른 교과목"도 그 파일에서 씁니다. 경희대 컴퓨터공학과는 작업 폴더의 `course_list.txt`로 돌리며, 강의계획서는 수강신청 사이트 종합시간표에서 받아 `학과데이터/경희대학교_컴퓨터공학부_컴퓨터공학과/강의계획서/`에 원문, `강의계획서_목록.csv`에 과목별 목록을 두었습니다.
- 다시 돌리면 끝난 묶음은 건너뛰고 오류 난 묶음만 다시 합니다. `--budget-usd`는 다음 호출의 예상 비용을 더해 넘으면 그 앞에서 멈춥니다(예상치는 파일 위쪽 `ESTIMATE`).
- 에브리타임·카페·SNS 같은 로그인 사이트와 영상 사이트는 검색·열람에서 막고(`BLOCKED`), 학생 코드·글은 원문을 저장하지 않습니다(요약, URL, 300자 이하 근거 문장만).

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

- `next`는 모든 학과의 이론 수업 자리(마지막 학년과 그 앞 실습 학년을 뺀 학년)를 채우는 데 필요한 과목을 많이 쓰이는 순서로 줍니다(학과마다 가장 흔한 과목부터).
- 문제로 만들 내용이 없는 과목(현장실습, 캡스톤디자인 등)은 `{"course_name":"과목명","unsuitable":"이유"}`로 적습니다. 그 과목은 다시 나오지 않고, 그 학과의 다음 과목이 대상에 들어옵니다.
- `ingest`는 형식과 상한을 검사해 맞는 것만 검토 대기(`review`)로 넣고, 틀린 줄은 이유와 함께 알려줍니다. 고쳐서 다시 넣으면 됩니다.
- 풀이가 정답과 모두 같고 지적 사항이 없으면 공개(`verified`)되고, 아니면 검토 대기로 남습니다. 남은 것은 `status`로 확인해 문제를 고쳐 `ingest --force`로 다시 넣거나, 직접 확인한 뒤 `approve 과목명`, 버리려면 `reject 과목명 --reason 이유`를 씁니다.
- 문제를 쓸 때는 그 과목의 표준 교재에 공통으로 나오는 내용만 다루고, 교재나 학자에 따라 답이 갈리는 내용, 해마다 바뀌는 수치는 피합니다.
- 공개된 문제는 서버를 다시 띄우거나 다시 배포해야 반영됩니다.

유형을 추가하려면 `backend/lesson_games.py`의 `TYPES`와 `frontend/src/lessonGames.js`의 `lessonTypes`에 형식 검사를 넣고, `frontend/src/TypedGames.jsx`의 `typedComponents`에 화면을 등록합니다.

## 체험 틀

체험 화면은 정해진 틀 몇 개로만 만들고, 틀에 넣는 데이터를 늘려서 체험을 늘립니다(`개발기획서_체험구조.md`). 틀의 형식 검사와 채점, 지금 쓰는 체험 데이터는 `frontend/src/experiences.js`, 화면은 `frontend/src/Templates.jsx`에 있습니다.

| 틀 | 동작 | 지금 쓰는 데이터 |
| --- | --- | --- |
| A 문지르기·칠하기 | 장면을 문질러 단계를 넘김 | 졸업작품(사포질 → 도색) |
| B 순서 맞추기 | 카드를 올바른 순서로. 이웃 교환만 되는 옵션 | 학과군 실습 9개(버블 정렬은 이웃 교환), 연습 문제의 순서 맞추기 |
| C 분류하기 | 카드마다 칸별로 알맞은 보기 고르기 | 학과군 실습 6개(분개는 차변·대변 두 칸) |
| D 반응 실험 | 자극에 빨리 반응하고 두 조건의 반응 시간 비교 | 반응 시간 실험(체육, 힉의 법칙) |
| F 계획 조립 | 계획서 세 칸을 보기 카드로 채우고 고쳐 쓰기 | 디자인·미술을 뺀 15개 학과군의 졸업 과제(캡스톤 디자인, 졸업 연구, 졸업 발표) |

E(장면에서 찾기)는 장면 그림이 준비되면 만듭니다.

### 학년별 배치와 학과군

학과의 수업연한만큼 학년마다 체험이 하나씩 있고, 규칙 하나로 정합니다: **마지막 학년은 졸업 과제, 그 바로 앞 학년은 학과군 전공 실습, 나머지 학년은 이론 수업(과목 하나의 연습 문제)**. 4년제는 1·2학년 이론, 3학년 실습, 4학년 졸업이고, 2년제는 1학년 실습, 2학년 졸업입니다.

학과는 학과명 규칙으로 16개 학과군 중 하나에 들어가고(`frontend/src/groups.js`), 학과군마다 실습과 졸업 과제 데이터가 하나씩 있습니다(`frontend/src/groupData.js`). 규칙에 안 맞는 학과는 계열로 정합니다.

| 학과군 | 학교·학과 조합 | 3학년 실습 | 졸업 과제 |
| --- | ---: | --- | --- |
| 기계·전기·전자 | 1,593 | 제품 설계 과정 (B) | 캡스톤 디자인 (F) |
| 의약·보건 | 1,276 | 환자 응급도 분류 (C) | 졸업 연구 (F) |
| 경영·경제 | 1,045 | 분개 연습 (C) | 졸업 연구 (F) |
| 컴퓨터·AI | 998 | 버블 정렬 직접 해보기 (B, 이웃 교환) | 캡스톤 디자인 (F) |
| 교육 | 870 | 수업 설계 순서 (B) | 졸업 연구 (F) |
| 어문·인문 | 850 | 사료 구분하기 (C) | 졸업 연구 (F) |
| 자연과학 | 727 | 과학 탐구 과정 (B) | 졸업 연구 (F) |
| 디자인·미술 | 713 | 디자인 과정 (B) | 졸업작품 (A) |
| 법·행정·사회 | 707 | 어떤 법이 다룰까 (C) | 졸업 연구 (F) |
| 건축·토목 | 694 | 건물 짓는 순서 (B) | 캡스톤 디자인 (F) |
| 공연·영상·미디어 | 693 | 영상 제작 단계 (B) | 졸업 발표 (F) |
| 심리·복지 | 653 | 사회보장 제도 나누기 (C) | 졸업 연구 (F) |
| 조리·뷰티·패션 | 642 | 옷 만드는 순서 (B) | 졸업 발표 (F) |
| 화학·소재·환경공학 | 523 | 정수 처리 순서 (B) | 캡스톤 디자인 (F) |
| 체육 | 505 | 반응 시간 실험 (D) | 졸업 발표 (F) |
| 음악 | 243 | 악기 분류하기 (C) | 졸업 발표 (F) |

학과군 데이터는 AI가 쓰고, 쓰지 않은 별도 에이전트가 사실·정답·표현을 검토한 것(`status: "verified"`)만 화면에 냅니다. 체험을 바꾸거나 더하려면 `groupData.js`에 틀 형식에 맞는 항목을 넣고 검토를 거칩니다. 형식이 틀리면 검사에서 걸러지고 테스트(`experiences.test.js`, `groups.test.js`)가 실패합니다. 새 틀이 필요하면 만들기 전에 정합니다.

## 보일러플레이트 출처

- `backend/main.py` : FastAPI 공식 문서 예제 (https://fastapi.tiangolo.com, MIT License)

## 사용 오픈소스

| 구분 | 이름 | 버전 | 용도 | 라이선스 |
| --- | --- | --- | --- | --- |
| 프론트 | React | 19.3.0 | 화면 구성·상태 관리 | MIT |
| 프론트 | React DOM | 19.3.0 | 브라우저에 화면 표시 | MIT |
| 개발 도구 | Vite | 8.3.4 | 개발 서버·빌드 | MIT |
| 백엔드 | FastAPI | 0.115.12 | API 서버 | MIT |
| 백엔드 | Uvicorn | 0.34.2 | 서버 실행 | BSD-3-Clause |
| 백엔드 | Pydantic | 2.14.0* | 요청 데이터 검증 | MIT |
| 백엔드 | Starlette | 0.46.2* | FastAPI 내부 웹 처리 | BSD-3-Clause |
