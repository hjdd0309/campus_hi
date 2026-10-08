# Litton 연동

대학·학과 데이터와 API 계약의 출처는 [dotorihanjum/litton](https://github.com/dotorihanjum/litton)입니다.

- 기준 커밋: `15e843282be12ea3819211f394f52b9ba4907b69`
- 원본 데이터: `backend/datafile_local/output.csv`
- 포함 데이터: `data/courses.csv.gz` — 원본 CSV를 변경 없이 gzip 압축
- 계약: 루트 `API명세서.md`와 `frontend/src/api.ts`

기준 커밋에는 실행 가능한 서버 진입점이 포함되어 있지 않아, 같은 요청·응답 계약을 구현하는 FastAPI 서버를 추가했습니다. 학과 목록과 대학 목록은 쉼표로 구분한 문자열이며, 교육과정은 `api.ts`에 정의된 문자열 배열입니다. 폐과 데이터는 조회에서 제외합니다.

| 메서드 | 경로 | 요청 | 응답 |
| --- | --- | --- | --- |
| POST | `/api/course_list` | `{"interests":"디자인"}` | `{"course_list":"산업디자인학과,시각디자인학과,..."}` |
| POST | `/api/school_list` | `{"course":"산업디자인학과"}` | `{"school_list":"경희대학교,..."}` |
| POST | `/api/curriculum_list` | `{"school":"경희대학교","course":"산업디자인학과"}` | `{"curriculum_list":["3D Design 1","3D Design 2", "..."]}` |
| GET | `/api/health` | 없음 | `{"status":"ok","source":"litton","records":30806}` |

빈 필드나 잘못된 자료형은 400, 존재하지 않는 대학·학과 조합은 404를 반환합니다. 오류 응답은 `{"detail":"메시지"}` 형식입니다. 검색 결과가 없으면 빈 문자열 목록을 반환합니다.

진행 상태와 실습 기록, 작품은 브라우저에 저장됩니다. 원본 명세에 사용자 계정·학습 기록 API는 없으므로 서버로 전송하지 않습니다.
