import test from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  finals,
  finalFor,
  finalOf,
  finalReady,
  planReady,
  stageYears,
  departments,
  fields,
  QUESTIONS,
  KEYWORD_GROUPS,
  createDepartment,
  loadState,
  recommend,
  recommendationScores,
  completeLesson,
  initialState,
  stageLabel,
  skipLesson,
  isSkipped,
  progressOf,
  yearSubjects,
  addCurious,
  isCurious,
  PARTNER_LABEL,
  PARTNER_EXAMPLE_NOTE,
  partnerBadge,
  cardTone,
  showsExampleNote,
  homeSubjects,
  electiveKey,
  electiveOf,
  electiveSubjects,
  saveElective,
  completedElectives,
  electiveReportText,
  lessonStarted,
  markStarted,
  departmentFrom,
  refreshDepartment,
  refreshEnrolled,
} from "./model.js";

const TOTAL = departments[0].lessons.length;
const only = (key, value) => ({
  getItem: (name) => (name === key ? JSON.stringify(value) : null),
});

test("수업연한에 따라 체험할 학년이 정해진다", () => {
  assert.deepEqual(stageYears("4년"), [1, 2, 3, 4]);
  assert.deepEqual(stageYears("2년"), [1, 2]);
  assert.deepEqual(stageYears("3년"), [1, 2, 3]);
  assert.deepEqual(stageYears("2.5년"), [1, 2, 3]);
  assert.deepEqual(stageYears("6년"), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(stageYears("7년"), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(stageYears("1년(전공심화)"), [4]);
  assert.deepEqual(stageYears("2년(전공심화)"), [3, 4]);
  assert.deepEqual(stageYears(""), [1, 2, 3, 4]);
  assert.deepEqual(stageYears(undefined), [1, 2, 3, 4]);
});
test("마지막 학년은 졸업 과제, 그 앞 학년은 학과군 실습, 나머지 학년은 이론 수업이다", () => {
  const subjects = ["기초디자인", "제품설계", "고급설계", "종합설계"];
  const four = createDepartment("산업디자인학과", "경희대학교", subjects, "예체능", null, "4년");
  assert.deepEqual(four.yearNumbers, [1, 2, 3, 4]);
  assert.deepEqual(four.lessons, ["기초디자인", "제품설계", "디자인 과정", "졸업작품"]);
  assert.equal(four.studyGroup, "design");
  assert.equal(finalOf(four).kind, "artwork");
  assert.deepEqual(four.games, [null, null, "group:design", null]);
  assert.equal(four.lessonsFromYears, false);
  // 2년제: 1학년 실습, 2학년 졸업 과제
  const two = createDepartment("간호과", "전문대학", subjects, "자연과학", null, "2년");
  assert.deepEqual(two.yearNumbers, [1, 2]);
  assert.deepEqual(two.lessons, ["환자 응급도 분류", "졸업 연구"]);
  assert.deepEqual(two.games, ["group:health", null]);
  // 3년제·6년제·전공심화도 같은 규칙이다.
  const three = createDepartment("치위생과", "전문대학", subjects, "자연과학", null, "3년");
  assert.deepEqual(three.lessons, ["기초디자인", "환자 응급도 분류", "졸업 연구"]);
  const six = createDepartment("약학과", "약학대학", subjects, "자연과학", null, "6년");
  assert.deepEqual(six.yearNumbers, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(six.lessons.slice(4), ["환자 응급도 분류", "졸업 연구"]);
  const deep = createDepartment("간호학과", "전문대학", subjects, "", null, "2년(전공심화)");
  assert.deepEqual(deep.yearNumbers, [3, 4]);
  assert.deepEqual(deep.lessons, ["환자 응급도 분류", "졸업 연구"]);
  // 학년이 하나뿐이면(서버는 이런 과정을 내보내지 않지만) 실습 없이 졸업 과제만 남는다.
  const advanced = createDepartment("간호학과", "전문대학", subjects, "", null, "1년(전공심화)");
  assert.deepEqual(advanced.yearNumbers, [4]);
  assert.deepEqual(advanced.lessons, ["졸업 연구"]);
  // 과목이 모자라면 학년을 지어내지 않고 "전공 탐색"으로 둔다.
  const short = createDepartment("새학과", "새대학교", ["과목"], "", null, "4년");
  assert.deepEqual(short.lessons, ["과목", "2학년 전공 탐색", "어떤 법이 다룰까", "졸업 연구"]);
  // 같은 학과군은 같은 실습, 학과군이 다르면 다른 실습과 졸업 과제다.
  const a = createDepartment("기계공학과", "가대학교", subjects, "공학", null, "4년");
  const b = createDepartment("전자공학과", "나대학교", ["회로이론"], "공학", null, "4년");
  const c = createDepartment("경영학과", "다대학교", subjects, "인문사회", null, "4년");
  assert.deepEqual(a.practice, b.practice);
  assert.notDeepEqual(a.practice, c.practice);
  assert.notEqual(finalOf(a).name, finalOf(c).name);
  for (const d of [...departments, four, two, three, six, deep, advanced, short, a, b, c]) {
    assert.equal(d.lessons.length, d.yearNumbers.length);
    assert.equal(d.lessons.at(-1), finalOf(d).name);
  }
});
test("검증된 과목별 학년이 있으면 그 학년의 과목으로 체험을 만든다", () => {
  const years = {
    subjects: { 프로그래밍기초: 1, 컴퓨터구조: 2, 자료구조: 2, 운영체제: 3 },
    source_url: "https://example.ac.kr/c",
    curriculum_year: 2026,
    checked_at: "2026-10-10",
  };
  const curriculum = ["알고리즘", "프로그래밍기초", "자료구조", "운영체제", "컴퓨터구조"];
  const d = createDepartment("컴퓨터공학과", "가천대학교", curriculum, "공학", years, "4년");
  assert.equal(d.lessonsFromYears, true);
  // 이론 학년(1·2학년)은 그 학년의 과목으로, 3학년은 학과군 실습이다(이름은 실습과 이어지는 과목인 알고리즘).
  assert.deepEqual(d.lessons, ["프로그래밍기초", "자료구조", "알고리즘", "캡스톤 디자인"]);
  assert.deepEqual(d.games, [null, null, "group:computing", null]);
  // 이론 학년 중 하나라도 모은 학년이 없으면 학년 배치를 추정한 것으로 보고, 그 학년은 교과목 목록에서 고른다.
  const partial = { ...years, subjects: { 프로그래밍기초: 1, 운영체제: 3 } };
  const fallback = createDepartment("컴퓨터공학과", "가천대학교", curriculum, "공학", partial, "4년");
  assert.equal(fallback.lessonsFromYears, false);
  // 2학년은 모은 학년과 어긋나지 않는 과목(1·3학년으로 알려진 과목 제외) 중에서 고른다.
  assert.deepEqual(fallback.lessons.slice(0, 2), ["프로그래밍기초", "알고리즘"]);
  // 실습 학년의 학년 정보는 없어도 된다.
  const noThird = { ...years, subjects: { 프로그래밍기초: 1, 컴퓨터구조: 2 } };
  assert.equal(createDepartment("컴퓨터공학과", "가천대학교", curriculum, "공학", noThird, "4년").lessonsFromYears, true);
});
test("과목의 학년은 모은 학년 → 사람이 정한 과목 → 보통 듣는 학년 순서로 쓴다", () => {
  const curriculum = ["객체지향프로그래밍", "데이터베이스", "컴퓨터구조", "이산구조", "운영체제"];
  const games = { 데이터베이스: "blank", 컴퓨터구조: "ox", 이산구조: "match" };
  // 사람이 2학년에 데이터베이스를 먼저 정해 두었고, 보통 듣는 학년도 2학년이다.
  const picks = { 1: ["객체지향프로그래밍"], 2: ["데이터베이스", "컴퓨터구조"] };
  const levels = { 데이터베이스: [2, 3], 컴퓨터구조: [2, 2], 이산구조: [1, 2] };
  const guessed = createDepartment("컴퓨터공학과", "가나대학교", curriculum, "공학", null, "4년", "", games, levels, picks);
  assert.deepEqual(guessed.lessons.slice(0, 2), ["객체지향프로그래밍", "데이터베이스"]);
  // 학교 홈페이지에서 데이터베이스가 3학년이라고 모았으면 2학년에 쓰지 않고, 정해 둔 다음 후보(컴퓨터구조)를 쓴다.
  const years = { subjects: { 객체지향프로그래밍: 1, 이산구조: 1, 컴퓨터구조: 2, 데이터베이스: 3 } };
  const real = createDepartment("컴퓨터공학과", "가나대학교", curriculum, "공학", years, "4년", "", games, levels, picks);
  assert.deepEqual(real.lessons.slice(0, 2), ["객체지향프로그래밍", "컴퓨터구조"]);
  // 정해 둔 과목이 없으면 모은 학년의 과목 중 연습 문제가 있는 과목부터 고른다.
  const noPicks = createDepartment("컴퓨터공학과", "가나대학교", curriculum, "공학", years, "4년", "", games, levels);
  assert.deepEqual(noPicks.lessons.slice(0, 2), ["이산구조", "컴퓨터구조"]);
  // 모은 학년이 있는 학과는 학년 배치를 추정했다고 알리지 않는다.
  assert.equal(yearSubjects(real).estimated, false);
  assert.equal(yearSubjects(guessed).estimated, true);
});
test("손상된 저장 데이터는 초기 상태로 복구하고 진행률 범위를 제한한다", () => {
  assert.deepEqual(loadState({ getItem: () => "{broken" }), initialState);
  assert.deepEqual(loadState({ getItem: () => null }), initialState);
  const state = loadState(
    only(STORAGE_KEY, {
      current: "missing",
      journeys: { design: { completed: 99 }, psychology: { completed: -3 }, invalid: {} },
      notes: { a: 2, "design-0": "기록", "design-99": "범위 밖" },
    }),
  );
  assert.equal(state.current, "design");
  assert.equal(state.journeys.design.completed, TOTAL);
  assert.equal(state.journeys.psychology.completed, 0);
  assert.equal(state.journeys.invalid, undefined);
  assert.deepEqual(state.notes, { "design-0": "기록", [`design-${TOTAL - 1}`]: "범위 밖" });
});
test("홈에 보여 주던 학과는 입학 기록이 있을 때만 복구한다", () => {
  const journeys = { design: { completed: 1 }, psychology: { completed: 0 } };
  assert.equal(loadState(only(STORAGE_KEY, { journeys, studying: "psychology" })).studying, "psychology");
  assert.equal(loadState(only(STORAGE_KEY, { journeys, studying: "missing" })).studying, null);
  assert.equal(loadState(only(STORAGE_KEY, { journeys: {}, studying: "design" })).studying, null);
  assert.equal(loadState(only(STORAGE_KEY, { journeys, studying: { id: "design" } })).studying, null);
});

test("작성 중인 노트는 새로고침 후 복구하고 잘못된 값은 버린다", () => {
  const restored = loadState(
    only(STORAGE_KEY, {
      journeys: { design: { completed: 0 } },
      drafts: { "design-0": "쓰던 글", "missing-0": "없는 학과", "design-1": 3, design: "키 오류" },
    }),
  );
  assert.deepEqual(restored.drafts, { "design-0": "쓰던 글" });
});
test("온보딩의 모든 관심 키워드는 추천 계열과 연결된다", () => {
  const keywords = KEYWORD_GROUPS.flatMap((group) => group.items);
  assert.equal(keywords.length, 13);
  for (const keyword of keywords)
    assert.ok(
      Math.max(...Object.values(recommendationScores([keyword], {}))) > 0,
      keyword,
    );
  // 질문의 모든 보기는 실제로 있는 계열과 연결된다.
  assert.equal(QUESTIONS.length, 7);
  for (const q of QUESTIONS) {
    assert.equal(q.options.length, 5);
    for (const option of q.options)
      assert.ok(fields.some((field) => field.id === option.field), option.label);
  }
});
test("관심 분야와 활동에 따라 추천 계열이 바뀐다", () => {
  assert.equal(recommend(["심리", "교육"], { 1: ["친구와 이야기 나누기"] })[0].id, "인문사회");
  assert.equal(recommend(["디자인"], { 2: ["그림이나 이미지로 표현하기"] })[0].id, "예체능");
  assert.equal(recommend(["컴퓨터"], {})[0].id, "공학");
  assert.equal(recommend([], { 2: ["규칙과 원리를 알아내기"], 3: ["수학 · 과학"] })[0].id, "자연과학");
  // 키워드 하나(3점)보다 같은 계열의 답 두 개(4점)가 더 세다.
  assert.equal(recommend(["심리"], { 1: ["무언가 만들거나 고치기"], 2: ["직접 만들고 실험하기"] })[0].id, "공학");
  assert.equal(recommend([], {}).length, fields.length);
  assert.equal(recommend([], undefined).length, fields.length);
  const restored = loadState(
    only(STORAGE_KEY, { answers: { 1: ["친구와 이야기 나누기", "없는 보기"], 2: "문자열", 9: ["범위 밖"] } }),
  );
  assert.deepEqual(restored.answers, { 1: ["친구와 이야기 나누기"] });
});
test("실습 완료는 한 학년씩 진행되며 중복, 휴학 중 진행을 막는다", () => {
  const state = {
    ...structuredClone(initialState),
    journeys: { design: { completed: 0, paused: false } },
  };
  // 느낀 점을 적지 않으면 기록 없이 완료된다(건너뛰기). 쓰던 임시 글은 지운다.
  const skipped = completeLesson({ ...state, drafts: { "design-0": " " } }, "design", 0, " ");
  assert.equal(skipped.journeys.design.completed, 1);
  assert.equal(skipped.notes["design-0"], undefined);
  assert.deepEqual(skipped.drafts, {});
  const next = completeLesson(state, "design", 0, "  첫 관찰  ");
  assert.equal(next.journeys.design.completed, 1);
  assert.equal(next.notes["design-0"], "첫 관찰");
  assert.equal(completeLesson(next, "design", 0, "중복"), next);
  const drafted = { ...state, drafts: { "design-0": "쓰던 글", "design-1": "다음 글" } };
  assert.deepEqual(completeLesson(drafted, "design", 0, "첫 관찰").drafts, {
    "design-1": "다음 글",
  });
  assert.equal(completeLesson(next, "design", 2, "건너뛰기"), next);
  const paused = {
    ...next,
    journeys: { design: { completed: 1, paused: true } },
  };
  assert.equal(completeLesson(paused, "design", 1, "쉬는 중"), paused);
  assert.equal(completeLesson(state, "missing", 0, "없는 학과"), state);
});
test("마지막 학년은 졸업작품이 있어야 완료되고, 다른 학과의 진행 상태는 유지된다", () => {
  let state = {
    ...structuredClone(initialState),
    journeys: {
      design: { completed: 0, paused: false },
      psychology: { completed: 1, paused: true },
    },
  };
  for (let i = 0; i < TOTAL; i++)
    state = completeLesson(state, "design", i, `기록 ${i}`);
  assert.equal(state.journeys.design.completed, TOTAL - 1);
  state = { ...state, artworks: { design: true } };
  // 졸업작품은 느낀 점을 적지 않아도 완료된다.
  state = completeLesson(state, "design", TOTAL - 1, "");
  assert.equal(state.journeys.design.completed, TOTAL);
  assert.equal(Object.keys(state.notes).length, TOTAL - 1);
  const loaded = loadState(
    only(STORAGE_KEY, { artworks: { design: true, psychology: "data:image/png;base64,AA==", missing: true } }),
  );
  assert.deepEqual(loaded.artworks, { design: true, psychology: true });
  assert.deepEqual(loadState(only(STORAGE_KEY, { artworks: { design: "javascript:1", psychology: 1 } })).artworks, {});
  assert.deepEqual(state.journeys.psychology, { completed: 1, paused: true });
  assert.equal(completeLesson(state, "design", TOTAL, "추가"), state);
  // 2년제 학과는 두 번째 학년이 마지막이고, 조형·디자인 학과가 아니면 계획서를 써야 완료된다.
  const two = createDepartment("간호과", "전문대학", ["기본간호학"], "", null, "2년");
  let short = {
    ...structuredClone(initialState),
    catalog: [two],
    artworks: { [two.id]: "data:image/png;base64,AA==" },
    journeys: { [two.id]: { completed: 0, paused: false } },
  };
  // 1학년은 학과군 실습이라 체험을 마쳐야 완료된다.
  assert.equal(completeLesson(short, two.id, 0, "1학년"), short);
  short = { ...short, plays: { [`${two.id}-0`]: { game: "group:health", summary: "환자 6명" } } };
  short = completeLesson(short, two.id, 0, "1학년");
  assert.equal(completeLesson(short, two.id, 1, "작품만 있고 계획서 없음"), short);
  short = { ...short, capstones: { [two.id]: { topic: "질문", reason: "이유", method: " " } } };
  assert.equal(completeLesson(short, two.id, 1, "빈 칸이 있음"), short);
  short = { ...short, capstones: { [two.id]: { topic: "질문", reason: "이유", method: "방법" } } };
  short = completeLesson(short, two.id, 1, "2학년");
  assert.equal(short.journeys[two.id].completed, 2);
  assert.equal(completeLesson(short, two.id, 2, "없는 학년"), short);
});
test("졸업 과제는 학과에 맞게 정해진다", () => {
  assert.equal(finalFor("산업디자인학과", "예체능"), "artwork");
  assert.equal(finalFor("시각디자인과", "공학"), "artwork");
  assert.equal(finalFor("회화과", "예체능"), "artwork");
  assert.equal(finalFor("컴퓨터공학과", "공학"), "capstone");
  assert.equal(finalFor("실용음악과", "예체능"), "showcase");
  assert.equal(finalFor("체육학과", "예체능"), "showcase");
  assert.equal(finalFor("심리학과", "인문사회"), "thesis");
  assert.equal(finalFor("간호학과", "자연과학"), "thesis");
  assert.equal(finalFor("의학과", "의학"), "thesis");
  assert.equal(finalFor("새학과", ""), "thesis");
  for (const final of Object.values(finals)) {
    assert.ok(final.name);
    if (final.kind === "plan") {
      assert.ok(final.intro);
      assert.equal(final.prompts.length, 3);
      assert.ok(final.prompts.every((prompt) => prompt.label && prompt.placeholder));
    }
  }
  assert.equal(planReady({ topic: "가", reason: "나", method: "다" }), true);
  assert.equal(planReady({ topic: "가", reason: "나", method: "  " }), false);
  assert.equal(planReady({ topic: "가", reason: 3, method: "다" }), false);
  assert.equal(planReady(undefined), false);
  const design = createDepartment("산업디자인학과", "경희대학교", ["드로잉"], "예체능");
  const computer = createDepartment("컴퓨터공학과", "가천대학교", ["자료구조"], "공학");
  assert.equal(finalReady({ artworks: { [design.id]: "data:image/png;base64,AA==" } }, design), true);
  assert.equal(finalReady({ artworks: {}, capstones: { [design.id]: { topic: "가", reason: "나", method: "다" } } }, design), false);
  // 컴퓨터·AI는 AI 가르치기를 끝까지 해봐야(artworks에 기록) 완료되고, 다른 공학은 계획서를 채워야 한다.
  assert.equal(computer.final.kind, "project");
  assert.equal(finalReady({ artworks: { [computer.id]: true } }, computer), true);
  assert.equal(finalReady({ artworks: {}, capstones: { [computer.id]: { topic: "가", reason: "나", method: "다" } } }, computer), false);
  const machine = createDepartment("기계공학과", "가천대학교", ["정역학"], "공학");
  assert.equal(finalReady({ artworks: { [machine.id]: true } }, machine), false);
  assert.equal(finalReady({ capstones: { [machine.id]: { topic: "가", reason: "나", method: "다" } } }, machine), true);
});
test("계획서는 형식이 맞는 것만 복구한다", () => {
  const restored = loadState(
    only(STORAGE_KEY, {
      capstones: {
        psychology: { topic: "질문", reason: 7, method: "가".repeat(900), extra: "버림" },
        design: "문자열",
        missing: { topic: "없는 학과" },
      },
    }),
  );
  assert.deepEqual(Object.keys(restored.capstones), ["psychology"]);
  assert.deepEqual(Object.keys(restored.capstones.psychology), ["topic", "reason", "method"]);
  assert.equal(restored.capstones.psychology.reason, "");
  assert.equal(restored.capstones.psychology.method.length, 500);
});
test("3단계였던 기록을 학년별 구조로 옮긴다", () => {
  const two = { name: "간호과", school: "전문대학", curriculum: ["기본간호학"], duration: "2년" };
  const migrated = loadState(
    only("mirae-campus-v2", {
      catalog: [two],
      journeys: {
        design: { completed: 3 },
        psychology: { completed: 2, paused: true },
        "api:전문대학:간호과": { completed: 2 },
      },
      notes: { "design-0": "첫 기록", "design-1": "두 번째", "design-2": "졸업작품 생각" },
      drafts: { "psychology-2": "쓰던 졸업작품 글" },
      reports: [{ id: "design", date: "2026-10-09" }],
    }),
  );
  assert.equal(migrated.version, 4);
  assert.equal(migrated.journeys.design.completed, TOTAL);
  assert.deepEqual(migrated.journeys.psychology, { completed: 2, paused: true });
  assert.equal(migrated.journeys["api:전문대학:간호과"].completed, 1);
  assert.deepEqual(migrated.notes, {
    "design-0": "첫 기록",
    "design-1": "두 번째",
    [`design-${TOTAL - 1}`]: "졸업작품 생각",
  });
  assert.deepEqual(migrated.drafts, { [`psychology-${TOTAL - 1}`]: "쓰던 졸업작품 글" });
  assert.equal(migrated.reports.length, 1);
});
test("v3 기록은 학년 자리의 수업이 바뀌었으면 버리지 않고 이전 체험 기록으로 옮긴다", () => {
  const id = "api:가천대학교:컴퓨터공학과";
  // v3 때는 3학년도 과목(운영체제)이었고, 지금은 학과군 실습이다.
  const old = {
    id,
    name: "컴퓨터공학과",
    school: "가천대학교",
    curriculum: ["C언어", "자료구조", "운영체제"],
    category: "공학",
    duration: "4년",
    lessons: ["C언어", "자료구조", "운영체제", "캡스톤 디자인"],
  };
  const migrated = loadState(
    only("hi-campus-v3", {
      catalog: [old],
      journeys: { [id]: { completed: 3, paused: false } },
      notes: { [`${id}-0`]: "C언어 기록", [`${id}-2`]: "운영체제 기록" },
      drafts: { [`${id}-2`]: "쓰던 글", [`${id}-1`]: "  " },
      plays: { [`${id}-2`]: { game: "match", summary: "x" }, [`${id}-0`]: { game: "ox", summary: "5문제 중 5개 정답" } },
    }),
  );
  assert.equal(migrated.version, 4);
  assert.deepEqual(migrated.catalog[0].lessons, ["C언어", "자료구조", "버블 정렬 직접 해보기", "캡스톤 디자인"]);
  assert.equal(migrated.journeys[id].completed, 3);
  assert.deepEqual(migrated.notes, { [`${id}-0`]: "C언어 기록" });
  assert.deepEqual(migrated.plays, { [`${id}-0`]: { game: "ox", summary: "5문제 중 5개 정답" } });
  assert.deepEqual(migrated.drafts, { [`${id}-1`]: "  " });
  assert.deepEqual(migrated.archive, [
    { id, title: "운영체제", note: "운영체제 기록" },
    { id, title: "운영체제", note: "쓰던 글" },
  ]);
  // 새 구조로 저장한 뒤 다시 불러와도 이전 체험 기록은 남고, 없는 학과의 기록과 빈 기록은 버린다.
  const again = loadState(
    only(STORAGE_KEY, {
      ...migrated,
      archive: [...migrated.archive, { id: "missing", title: "x", note: "y" }, { id, title: "빈 기록", note: " " }],
    }),
  );
  assert.deepEqual(again.archive, migrated.archive);
});
test("v3의 과목 자리가 지금은 같은 이름의 학과군 실습이어도 바뀐 자리로 보고 이전 기록으로 옮긴다", () => {
  const id = "api:가천대학교:컴퓨터공학과";
  const old = { id, name: "컴퓨터공학과", school: "가천대학교", curriculum: ["C언어", "운영체제", "알고리즘"], category: "공학", duration: "4년", lessons: ["C언어", "운영체제", "알고리즘", "캡스톤 디자인"] };
  const migrated = loadState(only("hi-campus-v3", { catalog: [old], journeys: { [id]: { completed: 3 } }, notes: { [`${id}-2`]: "알고리즘 기록" } }));
  // 3학년 이름은 그대로 알고리즘이지만 하는 활동은 학과군 실습으로 바뀌었다.
  assert.equal(migrated.catalog[0].lessons[2], "알고리즘");
  assert.equal(migrated.catalog[0].games[2], "group:computing");
  assert.deepEqual(migrated.notes, {});
  assert.deepEqual(migrated.archive, [{ id, title: "알고리즘", note: "알고리즘 기록" }]);
});
test("8단계였던 기록을 삭제하지 않고 학년별 구조로 옮긴다", () => {
  const migrated = loadState(
    only("mirae-campus-v1", {
      journeys: { design: { completed: 8 }, psychology: { completed: 4 } },
      notes: { "design-0": "첫 기록", "design-1": "두 번째", "design-7": "마지막" },
      reports: [{ id: "design", date: "2026-10-09" }],
    }),
  );
  assert.equal(migrated.journeys.design.completed, TOTAL);
  assert.equal(migrated.journeys.psychology.completed, TOTAL / 2);
  assert.match(migrated.notes["design-0"], /첫 기록\n\n두 번째/);
  assert.equal(migrated.notes[`design-${TOTAL - 1}`], "마지막");
  assert.equal(migrated.reports.length, 1);
});
test("새 구조로 저장된 기록이 있으면 예전 기록보다 먼저 쓴다", () => {
  const state = loadState({
    getItem: (key) =>
      JSON.stringify({ journeys: { design: { completed: key === STORAGE_KEY ? 1 : 3 } } }),
  });
  assert.equal(state.journeys.design.completed, 1);
});
test("API로 선택한 대학과 교육과정은 새로고침 후 복구된다", () => {
  const d = createDepartment("산업디자인학과", "경희대학교", ["기초설계", "제품설계"], "예체능", null, "2년");
  const state = {
    ...structuredClone(initialState),
    catalog: [d],
    current: d.id,
    journeys: { [d.id]: { completed: 1, paused: false } },
  };
  const restored = loadState(only(STORAGE_KEY, state));
  assert.equal(restored.current, d.id);
  assert.equal(restored.catalog[0].school, "경희대학교");
  assert.deepEqual(restored.catalog[0].yearNumbers, [1, 2]);
  assert.deepEqual(restored.catalog[0].lessons, d.lessons);
  assert.equal(restored.journeys[d.id].completed, 1);
  assert.equal(restored.catalog[0].partner, false);
});
test("제휴 대학 표시는 새로고침 후에도 남고, true가 아닌 값은 제휴로 보지 않는다", () => {
  const d = createDepartment("산업디자인학과", "경희대학교", ["기초설계"], "예체능", null, "4년", "", null, null, null, true);
  assert.equal(d.partner, true);
  const restored = loadState(only(STORAGE_KEY, { ...structuredClone(initialState), catalog: [d, { ...d, id: "x", school: "가천대학교", partner: "true" }] }));
  assert.deepEqual(restored.catalog.map((item) => item.partner), [true, false]);
});
test("예시 제휴는 표시만 다르고 체험은 실제 제휴·제휴 아님과 같으며, 예시 여부가 없는 옛 기록은 모름(null)으로 읽는다", () => {
  const years = { subjects: { 자료구조: 1, 운영체제: 2 } };
  const make = (partner, example) =>
    createDepartment("컴퓨터공학과", "경희대학교", ["자료구조", "운영체제"], "공학", years, "4년", "", null, null, null, partner, example);
  const example = make(true, true);
  const real = make(true, false);
  const none = make(false, true);
  assert.deepEqual([example.partnerExample, real.partnerExample, none.partnerExample], [true, false, false]);
  assert.deepEqual({ ...example, partnerExample: false }, real);
  assert.deepEqual({ ...example, partner: false, partnerExample: false }, none);
  // 저장했다 읽으면 그대로다.
  const restored = loadState(only(STORAGE_KEY, { ...structuredClone(initialState), catalog: [example, real, none] }));
  assert.deepEqual(restored.catalog.map((item) => [item.partner, item.partnerExample]), [[true, true], [true, false], [false, false]]);
  // 예시 여부를 저장하기 전의 기록: 제휴였으면 모름(null), 아니면 false.
  const { partnerExample: _, ...old } = example;
  const before = loadState(only(STORAGE_KEY, { ...structuredClone(initialState), catalog: [old, { ...old, id: "x", partner: false }] }));
  assert.deepEqual(before.catalog.map((item) => item.partnerExample), [null, false]);
  assert.deepEqual(before.catalog[0].lessons, example.lessons);
});
test("어느 학교·학과든 만들 수 있고 계열에 맞는 기본 구성을 쓴다", () => {
  const d = createDepartment("컴퓨터공학과", "가천대학교", ["자료구조", "운영체제"], "공학", null, "4년");
  assert.equal(d.id, "api:가천대학교:컴퓨터공학과");
  assert.equal(d.category, "공학");
  assert.equal(d.icon, "code");
  assert.deepEqual(d.lessons, ["자료구조", "운영체제", "버블 정렬 직접 해보기", "캡스톤 디자인"]);
  assert.equal(d.jobs, undefined);
  const unknown = createDepartment("새학과", "새대학교", ["과목"], "없는계열");
  assert.equal(unknown.icon, "cap");
  assert.equal(unknown.lessons.length, 4);
  assert.deepEqual(createDepartment("산업디자인학과", "경희대학교", ["드로잉"], "예체능").jobs, departments[0].jobs);
});
test("저장된 학과 목록은 형식이 맞는 것만 복구한다", () => {
  const restored = loadState(
    only(STORAGE_KEY, {
      catalog: [
        { name: "컴퓨터공학과", school: "가천대학교", curriculum: ["자료구조", 3], category: "공학", duration: 4 },
        { name: "", school: "대학교", curriculum: [] },
        { name: "학과", school: "대학교" },
        { name: "간호학과", school: "대학교", curriculum: [], category: "<script>" },
      ],
      current: "api:가천대학교:컴퓨터공학과",
      journeys: { "api:가천대학교:컴퓨터공학과": { completed: 1 }, computer: { completed: 3 } },
      reports: [{ id: "computer", date: "2026-10-09" }],
    }),
  );
  assert.deepEqual(restored.catalog.map((d) => d.id), ["api:가천대학교:컴퓨터공학과", "api:대학교:간호학과"]);
  assert.deepEqual(restored.catalog[0].curriculum, ["자료구조"]);
  assert.deepEqual(restored.catalog[0].yearNumbers, [1, 2, 3, 4]);
  assert.equal(restored.catalog[1].category, "");
  assert.deepEqual(Object.keys(restored.journeys), ["api:가천대학교:컴퓨터공학과"]);
  assert.deepEqual(restored.reports, []);
  assert.equal(restored.current, "api:가천대학교:컴퓨터공학과");
});

// 학기별 체험(2026-10-28~10-29)으로 저장된 제휴 학과: 이론 학년을 학기 자리(1-1·1-2·2-1·2-2)로 나눴었다.
const TERMS = [
  { year: 1, semester: 1, subjects: ["선형대수", "객체지향프로그래밍", "이산구조"] },
  { year: 1, semester: 2, subjects: ["미분방정식", "객체지향프로그래밍"] },
  { year: 2, semester: 1, subjects: ["자료구조", "컴퓨터구조"] },
  { year: 2, semester: 2, subjects: ["자료구조", "논리회로"] },
];
const CS = ["알고리즘", "자료구조", "운영체제", "선형대수", "객체지향프로그래밍"];
const GAMES = { 선형대수: "match", 객체지향프로그래밍: "match", 자료구조: "sort" };
const ID = "api:경희대학교:컴퓨터공학과";
const semesterRecord = () => ({
  id: ID,
  name: "컴퓨터공학과",
  school: "경희대학교",
  curriculum: CS,
  category: "공학",
  duration: "4년",
  region: "경기도",
  yearly: { terms: TERMS, source_url: "https://ce.khu.ac.kr/c.pdf", checked_at: "2026-10-28" },
  terms: TERMS,
  yearNumbers: [1, 1, 2, 2, 3, 4],
  semesters: [1, 2, 1, 2, 0, 0],
  options: [...TERMS.map((term) => term.subjects), null, null],
  lessons: ["선형대수", "미분방정식", "과목 고르기", "과목 고르기", "알고리즘", "캡스톤 디자인"],
  games: [null, null, null, null, "group:computing", null],
  lessonGames: GAMES,
  partner: true,
  partnerExample: true,
});

test("학기 자리로 저장된 제휴 학과는 학년 자리로 옮기고, 같은 학년의 학기 기록은 합친다", () => {
  const saved = {
    ...structuredClone(initialState),
    catalog: [semesterRecord()],
    current: ID,
    studying: ID,
    // 1-1·1-2·2-1을 지났고(1-2는 휴강), 2-2를 하는 중이었다.
    journeys: { [ID]: { completed: 3, paused: false, skipped: [1] } },
    notes: { [`${ID}-0`]: "1-1 기록", [`${ID}-1`]: "1-2 기록", [`${ID}-2`]: "2-1 기록", [`${ID}-4`]: "실습 기록" },
    drafts: { [`${ID}-3`]: "2-2 쓰던 글" },
    plays: { [`${ID}-0`]: { game: "match", summary: "4쌍 중 4개" } },
    choices: { [`${ID}-2`]: "컴퓨터구조" },
  };
  const restored = loadState(only(STORAGE_KEY, JSON.parse(JSON.stringify(saved))));
  const d = restored.catalog[0];
  assert.deepEqual(d.yearNumbers, [1, 2, 3, 4]);
  assert.equal(d.semesters, undefined);
  assert.equal(d.options, undefined);
  assert.equal(d.lessons.length, 4);
  assert.deepEqual([0, 1, 2, 3].map((i) => stageLabel(d, i)), ["1학년", "2학년", "3학년", "4학년"]);
  // 예전 학기별 편성은 과목마다 가장 낮은 학년으로 읽어, 이론 학년은 그 학년의 과목으로 만든다.
  assert.equal(d.lessonsFromYears, true);
  assert.deepEqual(d.yearly.subjects, { 선형대수: 1, 객체지향프로그래밍: 1, 이산구조: 1, 미분방정식: 1, 자료구조: 2, 컴퓨터구조: 2, 논리회로: 2 });
  // 2학년의 학기를 다 마치지 않았으므로 1학년까지 마친 것으로 본다. 휴강한 1-2는 1학년 자리의 미이수로 남는다.
  assert.deepEqual(restored.journeys[ID], { completed: 1, paused: false, skipped: [0] });
  assert.deepEqual(restored.notes, { [`${ID}-0`]: "1-1 기록\n\n1-2 기록", [`${ID}-1`]: "2-1 기록", [`${ID}-2`]: "실습 기록" });
  assert.deepEqual(restored.drafts, { [`${ID}-1`]: "2-2 쓰던 글" });
  assert.deepEqual(restored.plays, { [`${ID}-0`]: { game: "match", summary: "4쌍 중 4개" } });
  assert.equal("choices" in restored, false);
  assert.equal(restored.current, ID);
  // 졸업한 기록은 졸업 그대로, 첫 학기를 하던 기록은 처음 그대로다.
  const graduated = loadState(only(STORAGE_KEY, { ...saved, journeys: { [ID]: { completed: 6, paused: false } } }));
  assert.equal(graduated.journeys[ID].completed, 4);
  const fresh = loadState(only(STORAGE_KEY, { ...saved, journeys: { [ID]: { completed: 0, paused: true } } }));
  assert.deepEqual(fresh.journeys[ID], { completed: 0, paused: true });
  // 학기 자리의 실습(4번)을 하던 기록은 실습 학년(2번)을 하던 것으로 옮긴다.
  const practicing = loadState(only(STORAGE_KEY, { ...saved, journeys: { [ID]: { completed: 4, paused: false } } }));
  assert.equal(practicing.journeys[ID].completed, 2);
  // 학년 자리로 옮긴 기록을 다시 저장했다 읽어도 그대로다.
  const again = loadState(only(STORAGE_KEY, JSON.parse(JSON.stringify(restored))));
  assert.deepEqual([again.catalog[0].lessons, again.journeys, again.notes], [d.lessons, restored.journeys, restored.notes]);
});

test("휴강하면 미이수로 남기고 다음 자리로 넘어가며, 쓰던 기록과 체험은 그대로 둔다", () => {
  const state = {
    ...structuredClone(initialState),
    journeys: { design: { completed: 1, paused: false } },
    drafts: { "design-1": "쓰던 글" },
  };
  const skipped = skipLesson(state, "design", 1);
  assert.deepEqual(skipped.journeys.design, { completed: 2, paused: false, skipped: [1] });
  assert.deepEqual(skipped.drafts, { "design-1": "쓰던 글" });
  assert.equal(isSkipped(skipped.journeys.design, 1), true);
  // 차례가 아닌 자리, 휴학 중, 없는 학과는 휴강할 수 없다.
  assert.equal(skipLesson(state, "design", 0), state);
  assert.equal(skipLesson(state, "design", 2), state);
  const paused = { ...state, journeys: { design: { completed: 1, paused: true } } };
  assert.equal(skipLesson(paused, "design", 1), paused);
  assert.equal(skipLesson(state, "missing", 0), state);
  // 진행 상황: 지나온 자리 2개 중 1개가 미이수라 이수는 1개다.
  assert.deepEqual(progressOf(skipped.journeys.design, TOTAL), { completed: 2, skipped: [1], passed: 1, finished: false });
  assert.deepEqual(progressOf(undefined, TOTAL), { completed: 0, skipped: [], passed: 0, finished: false });
});

test("졸업 과제까지 휴강해도 졸업하고, 미이수는 이수율에서 빠진다", () => {
  let state = { ...structuredClone(initialState), journeys: { design: { completed: 0, paused: false } } };
  state = completeLesson(state, "design", 0, "");
  state = skipLesson(state, "design", 1);
  state = completeLesson(state, "design", 2, "");
  // 졸업작품을 하지 않았어도 휴강하면 넘어간다.
  state = skipLesson(state, "design", 3);
  const progress = progressOf(state.journeys.design, TOTAL);
  assert.deepEqual(progress, { completed: TOTAL, skipped: [1, 3], passed: 2, finished: true });
  assert.equal(Math.round((progress.passed / TOTAL) * 100), 50);
});

test("미이수 과목은 다시 들어 완료하면 이수로 바뀌고, 진행 자리는 그대로다", () => {
  let state = { ...structuredClone(initialState), journeys: { design: { completed: 0, paused: false } } };
  state = skipLesson(state, "design", 0);
  state = completeLesson(state, "design", 1, "");
  const retaken = completeLesson(state, "design", 0, "다시 들었어요");
  assert.deepEqual(retaken.journeys.design, { completed: 2, paused: false, skipped: [] });
  assert.equal(retaken.notes["design-0"], "다시 들었어요");
  // 이미 이수한 자리, 아직 오지 않은 자리는 다시 들을 수 없다.
  assert.equal(completeLesson(retaken, "design", 0, "또"), retaken);
  assert.equal(completeLesson(retaken, "design", 3, "앞지르기"), retaken);
  // 미이수인 졸업 과제도 졸업작품을 마쳐야 이수로 바뀐다.
  let done = { ...structuredClone(initialState), journeys: { design: { completed: TOTAL - 1, paused: false } } };
  done = skipLesson(done, "design", TOTAL - 1);
  assert.equal(completeLesson(done, "design", TOTAL - 1, ""), done);
  done = completeLesson({ ...done, artworks: { design: true } }, "design", TOTAL - 1, "");
  assert.deepEqual(done.journeys.design.skipped, []);
  assert.equal(done.journeys.design.completed, TOTAL);
});

test("미이수 기록은 새로고침 뒤에도 남고, 이 필드가 없던 예전 기록은 미이수 없이 그대로 읽는다", () => {
  const saved = loadState(only(STORAGE_KEY, { journeys: { design: { completed: 3, paused: false, skipped: [1, 1, 2, 3, -1, "0", 0.5] } } }));
  assert.deepEqual(saved.journeys.design, { completed: 3, paused: false, skipped: [1, 2] });
  const old = loadState(only(STORAGE_KEY, { journeys: { design: { completed: 2, paused: false } }, notes: { "design-0": "기록" } }));
  assert.deepEqual(old.journeys.design, { completed: 2, paused: false });
  assert.equal(old.notes["design-0"], "기록");
  assert.deepEqual(old.curious, []);
  for (const key of ["hi-campus-v3", "mirae-campus-v2"]) {
    const legacy = loadState(only(key, { journeys: { design: { completed: 1 } } }));
    assert.equal(progressOf(legacy.journeys.design, TOTAL).skipped.length, 0);
  }
});

test("학년별 과목: 체험하는 과목은 열림, 그 학년의 다른 교과목은 잠김이고 학년을 모르는 과목은 넣지 않는다", () => {
  const curriculum = ["자료구조", "운영체제", "이산수학", "선형대수", "컴퓨터네트워크", "해당없음", "졸업연구"];
  const levels = { 자료구조: [2, 3], 운영체제: [3, 4], 이산수학: [1, 2], 선형대수: [1, 1], 컴퓨터네트워크: [3, 3], 해당없음: [1, 1] };
  const games = { 자료구조: "ox", 이산수학: "blank" };
  const d = createDepartment("컴퓨터공학과", "가나대학교", curriculum, "공학", null, "4년", "", games, levels);
  const list = yearSubjects(d);
  assert.equal(list.estimated, true);
  assert.deepEqual(list.years.map((item) => item.year), [1, 2, 3, 4]);
  // 체험하는 자리는 실제 교과목일 때만 들어간다(졸업 과제처럼 과목이 아닌 이름은 빠진다).
  for (const [i, item] of list.years.entries())
    assert.deepEqual(item.open, curriculum.includes(d.lessons[i]) ? [{ index: i, title: d.lessons[i] }] : []);
  assert.ok(!curriculum.includes(d.lessons[3]));
  assert.deepEqual(list.years[3].open, []);
  const all = list.years.flatMap((item) => item.others);
  // 체험하는 과목은 잠긴 목록에 다시 나오지 않고, 학년 범위가 없는 졸업연구와 '해당없음'은 빠진다.
  for (const lesson of d.lessons) assert.ok(!all.includes(lesson));
  assert.ok(!all.includes("졸업연구"));
  assert.ok(!all.includes("해당없음"));
  // 과목은 보통 듣기 시작하는 학년 하나에만 들어간다.
  assert.equal(new Set(all).size, all.length);
  const yearOf = (subject) => list.years.find((item) => item.others.includes(subject))?.year;
  for (const subject of all) assert.equal(yearOf(subject), levels[subject][0]);
  // 학교 홈페이지에서 모은 학년이 있는 학과는 그 학년을 그대로 쓴다.
  const years = { subjects: { 프로그래밍기초: 1, 미적분학: 1, 컴퓨터구조: 2, 확률통계: 2 } };
  const exact = createDepartment("컴퓨터공학과", "가나대학교", ["프로그래밍기초", "미적분학", "컴퓨터구조", "확률통계"], "공학", years, "4년");
  const exactList = yearSubjects(exact);
  assert.equal(exactList.estimated, false);
  assert.deepEqual(exactList.years[0].others, ["미적분학"]);
  assert.deepEqual(exactList.years[1].others, ["확률통계"]);
});

test("궁금해요는 학교·학과·과목마다 한 번만 남고, 저장했다 불러와도 형식이 맞는 것만 남는다", () => {
  const item = { school: "가나대학교", course: "컴퓨터공학과", subject: "운영체제" };
  const now = new Date("2026-10-29T01:02:03Z");
  const once = addCurious(structuredClone(initialState), item, now);
  assert.deepEqual(once.curious, [{ ...item, createdAt: "2026-10-29T01:02:03.000Z" }]);
  assert.equal(isCurious(once, item), true);
  assert.equal(isCurious(once, { ...item, subject: "자료구조" }), false);
  assert.equal(addCurious(once, item), once);
  assert.equal(addCurious(once, { ...item, subject: "" }), once);
  const twice = addCurious(once, { ...item, subject: "자료구조" }, now);
  assert.equal(twice.curious.length, 2);
  const loaded = loadState(
    only(STORAGE_KEY, {
      curious: [
        ...twice.curious,
        twice.curious[0],
        { ...item, subject: "네트워크", createdAt: "not a date" },
        { ...item, subject: 3, createdAt: now.toISOString() },
        { ...item, subject: "보안", createdAt: now.toISOString(), email: "a@b.c" },
        null,
      ],
    }),
  );
  assert.deepEqual(loaded.curious, [...twice.curious, { ...item, subject: "보안", createdAt: now.toISOString() }]);
  assert.deepEqual(loadState(only(STORAGE_KEY, { curious: "x" })).curious, []);
});

test("제휴 배지는 예시든 실제든 '제휴 학교' 하나이고, 예시 여부를 모르는 옛 기록과 제휴가 아닌 학교에는 붙지 않는다", () => {
  assert.equal(PARTNER_LABEL, "제휴 학교");
  assert.equal(partnerBadge(true, true), "제휴 학교");
  assert.equal(partnerBadge(true, false), "제휴 학교");
  assert.equal(partnerBadge(true, null), null);
  assert.equal(partnerBadge(false, false), null);
  assert.equal(partnerBadge("true", true), null);
});

test("검색 결과 카드는 제휴 학교만 노란색이고 나머지는 흰색이다", () => {
  assert.equal(cardTone(true), "cream");
  assert.equal(cardTone(false), "white");
  assert.equal(cardTone(undefined), "white");
  assert.equal(cardTone("true"), "white");
});

test("서비스 예시 안내는 예시 제휴 학교가 하나라도 보일 때만 띄운다", () => {
  assert.equal(PARTNER_EXAMPLE_NOTE, "* 제휴 학교 표시는 서비스 예시입니다");
  const plain = { school: "가나대학교", partner: false, partnerExample: false };
  const example = { school: "경희대학교", partner: true, partnerExample: true };
  const real = { school: "다라대학교", partner: true, partnerExample: false };
  assert.equal(showsExampleNote([]), false);
  assert.equal(showsExampleNote([plain]), false);
  assert.equal(showsExampleNote([real, plain]), false);
  assert.equal(showsExampleNote([plain, example]), true);
  assert.equal(showsExampleNote([{ partner: true, partnerExample: null }]), false);
  // 저장된 학과(학과 상세)도 같은 기준이다.
  const d = createDepartment("간호학과", "경희대학교", ["기본간호학"], "", null, "4년", "", null, null, null, true, true);
  assert.equal(showsExampleNote([d]), true);
  assert.equal(partnerBadge(d.partner, d.partnerExample), "제휴 학교");
});

test("홈의 이 학년 과목: 지금 체험하는 과목과 같은 학년의 다른 교과목이고, 학년이 올라가면 바뀐다", () => {
  const curriculum = ["자료구조", "운영체제", "이산수학", "선형대수", "컴퓨터네트워크", "미적분학", "확률통계", "프로그래밍입문", "졸업연구"];
  const levels = { 자료구조: [2, 3], 운영체제: [3, 4], 이산수학: [1, 2], 선형대수: [1, 1], 컴퓨터네트워크: [3, 3], 미적분학: [1, 1], 확률통계: [1, 2], 프로그래밍입문: [1, 1] };
  const d = createDepartment("컴퓨터공학과", "가나대학교", curriculum, "공학", null, "4년", "", { 자료구조: "ox", 이산수학: "blank" }, levels);
  const first = homeSubjects(d, { completed: 0, paused: false });
  assert.equal(first.year, 1);
  assert.deepEqual(first.main, { index: 0, title: d.lessons[0], done: false });
  assert.ok(!first.others.includes(d.lessons[0]));
  assert.ok(first.others.every((subject) => levels[subject][0] === 1));
  assert.equal(first.estimated, true);
  // 학년이 올라가면 그 학년의 과목으로 바뀐다.
  const second = homeSubjects(d, { completed: 1, paused: false });
  assert.equal(second.year, 2);
  assert.equal(second.main.title, d.lessons[1]);
  assert.ok(second.others.every((subject) => levels[subject][0] === 2));
  // 졸업하면 마지막 자리가 완료로 남는다.
  const done = homeSubjects(d, { completed: d.lessons.length, paused: false });
  assert.deepEqual([done.year, done.main.index, done.main.done], [4, d.lessons.length - 1, true]);
});

test("홈의 이 학년 과목은 2·3·4·6년제 모두 학년이 맞고, 다른 과목을 모르면 지금 과목만 있다", () => {
  const levels = { 기본간호학: [1, 1], 성인간호학: [2, 3], 아동간호학: [2, 2] };
  for (const [duration, years] of [["2년", [1, 2]], ["3년", [1, 2, 3]], ["4년", [1, 2, 3, 4]], ["6년", [1, 2, 3, 4, 5, 6]]]) {
    const d = createDepartment("간호학과", "가나대학교", ["기본간호학", "성인간호학", "아동간호학", "보건의료법규"], "의학", null, duration, "", null, levels);
    years.forEach((year, completed) => {
      const home = homeSubjects(d, { completed, paused: false });
      assert.equal(home.year, year, `${duration} ${completed}`);
      assert.equal(home.main.title, d.lessons[completed]);
      assert.ok(Array.isArray(home.others));
      if (year > 4) assert.deepEqual(home.others, []);
    });
  }
  assert.equal(homeSubjects(null, null), null);
});

// 2026-11-04 사용자 결정: 제휴 학교 홈에서도 같은 학년의 다른 과목을 보여주고, 잠금 없이 선택 체험으로 연다(open).
const pharmLevels = { 약물학: [2, 3], 생화학: [1, 2], 약제학: [2, 2], 유기화학: [1, 1], 물리약학: [1, 2], 약품분석학: [2, 2], 생리학: [1, 1], 미생물학: [2, 2] };
const pharmCurriculum = ["약물학", "생화학", "약제학", "약학개론", "유기화학", "물리약학", "약품분석학", "생리학", "미생물학"];
const pharm = (school, partner) => createDepartment("약학과", school, pharmCurriculum, "의학", null, "6년", "", null, pharmLevels, null, partner, partner);

test("홈의 같은 학년 다른 과목은 제휴·비제휴 모두 보여주고, 제휴 학교에서만 열려 있다", () => {
  const partner = pharm("경희대학교", true);
  const plain = pharm("가나대학교", false);
  for (const d of [partner, plain]) {
    const home = homeSubjects(d, { completed: 1, paused: false });
    assert.deepEqual(home.others, ["약품분석학", "미생물학"]);
    assert.deepEqual(home.others, yearSubjects(d).years.find((item) => item.year === 2).others);
  }
  assert.equal(homeSubjects(partner, { completed: 1, paused: false }).open, true);
  assert.equal(homeSubjects(plain, { completed: 1, paused: false }).open, false);
});

test("선택 체험 과목은 제휴 학교일 때 모든 학년의 다른 과목이고, 지금 체험 과목은 빠진다", () => {
  const partner = pharm("경희대학교", true);
  const subjects = electiveSubjects(partner);
  assert.deepEqual(subjects, ["유기화학", "물리약학", "생리학", "약품분석학", "미생물학"]);
  assert.equal(new Set(subjects).size, subjects.length);
  assert.ok(partner.lessons.every((lesson) => !subjects.includes(lesson)));
  assert.deepEqual(electiveSubjects(pharm("가나대학교", false)), []);
  assert.deepEqual(electiveSubjects(null), []);
});

test("선택 체험은 입학한 제휴 학과의 목록에 있는 과목만 저장하고, 졸업 진행은 건드리지 않는다", () => {
  const partner = pharm("경희대학교", true);
  const plain = pharm("가나대학교", false);
  const journeys = { [partner.id]: { completed: 1, skipped: [] }, [plain.id]: { completed: 0, skipped: [] } };
  const base = { ...structuredClone(initialState), catalog: [partner, plain], journeys };
  // 저장하지 않는 경우: 입학하지 않은 학과, 비제휴 학과, 목록에 없는 과목.
  const notEnrolled = { ...base, journeys: { [plain.id]: journeys[plain.id] } };
  assert.equal(saveElective(notEnrolled, partner.id, "유기화학", { note: "기록" }), notEnrolled);
  assert.equal(saveElective(base, plain.id, "유기화학", { note: "기록" }), base);
  assert.equal(saveElective(base, partner.id, "없는과목", { note: "기록" }), base);
  assert.equal(saveElective(base, partner.id, partner.lessons[0], { note: "기록" }), base);
  assert.equal(saveElective(base, "missing", "유기화학", { note: "기록" }), base);

  // 기록을 먼저 쓰고 나중에 완료해도 이어진다.
  let s = saveElective(base, partner.id, "유기화학", { note: "작용기를 정리했다" });
  assert.deepEqual(electiveOf(s, partner.id, "유기화학"), { done: false, note: "작용기를 정리했다", summary: "", tried: false });
  s = saveElective(s, partner.id, "유기화학", { summary: "5문제 중 5개 맞힘" });
  s = saveElective(s, partner.id, "유기화학", { done: true });
  assert.deepEqual(electiveOf(s, partner.id, "유기화학"), { done: true, note: "작용기를 정리했다", summary: "5문제 중 5개 맞힘", tried: true });
  // 완료 뒤 기록만 고쳐도 done은 그대로다.
  s = saveElective(s, partner.id, "유기화학", { note: "고친 기록", done: false });
  assert.deepEqual(electiveOf(s, partner.id, "유기화학"), { done: true, note: "고친 기록", summary: "5문제 중 5개 맞힘", tried: true });
  assert.equal(electiveKey(partner.id, "유기화학"), `${partner.id}|유기화학`);
  assert.equal(electiveOf(s, partner.id, "생리학"), null);
  // 길이 제한: 기록 3000자, 요약 200자.
  const long = saveElective(s, partner.id, "생리학", { note: "가".repeat(5000), summary: "나".repeat(500) });
  assert.equal(electiveOf(long, partner.id, "생리학").note.length, 3000);
  assert.equal(electiveOf(long, partner.id, "생리학").summary.length, 200);
  // 졸업 진행은 그대로다.
  assert.equal(s.journeys, base.journeys);
  assert.deepEqual(s.journeys, journeys);
  assert.deepEqual(base.electives, {});
});

test("선택 체험 기록은 다시 불러와도 남고, 잘못된 항목은 버린다", () => {
  const partner = pharm("경희대학교", true);
  let s = { ...structuredClone(initialState), catalog: [partner], journeys: { [partner.id]: { completed: 1, skipped: [] } } };
  s = saveElective(s, partner.id, "유기화학", { note: "기록", summary: "요약", done: true });
  s = saveElective(s, partner.id, "생리학", { note: "쓰는 중" });
  const saved = JSON.parse(JSON.stringify(s));
  saved.electives["missing|유기화학"] = { done: true, note: "", summary: "" };
  saved.electives[`${partner.id}|`] = { done: true, note: "", summary: "" };
  saved.electives[`${partner.id}|   `] = { done: true, note: "", summary: "" };
  saved.electives[`${partner.id}|약제학`] = { done: "yes", note: "", summary: "" };
  saved.electives[`${partner.id}|미생물학`] = "완료";
  saved.electives[`${partner.id}|약품분석학`] = { done: false, note: "다".repeat(4000), summary: "" };
  const loaded = loadState(only(STORAGE_KEY, saved));
  assert.deepEqual(Object.keys(loaded.electives).sort(), [`${partner.id}|생리학`, `${partner.id}|약품분석학`, `${partner.id}|유기화학`]);
  assert.deepEqual(electiveOf(loaded, partner.id, "유기화학"), { done: true, note: "기록", summary: "요약", tried: true });
  assert.deepEqual(electiveOf(loaded, partner.id, "생리학"), { done: false, note: "쓰는 중", summary: "", tried: true });
  assert.equal(electiveOf(loaded, partner.id, "약품분석학").note.length, 3000);
  assert.deepEqual(loaded.journeys[partner.id].completed, 1);
  assert.deepEqual(loadState(only(STORAGE_KEY, { ...saved, electives: [1, 2] })).electives, {});
  assert.deepEqual(loadState(only(STORAGE_KEY, { journeys: {} })).electives, {});
});

test("리포트의 선택 체험은 그 학과에서 마친 것만 학년 순서로 담고, 없으면 묶음을 넣지 않는다", () => {
  const partner = pharm("경희대학교", true);
  const other = pharm("나다대학교", true);
  let s = {
    ...structuredClone(initialState),
    catalog: [partner, other],
    journeys: { [partner.id]: { completed: 1, skipped: [] }, [other.id]: { completed: 0, skipped: [] } },
  };
  // 아무것도 마치지 않았으면 묶음이 없다.
  assert.deepEqual(completedElectives(s, partner), []);
  assert.equal(electiveReportText(s, partner), "");
  // 2학년 과목을 먼저 마치고, 1학년 과목은 나중에 마친다. 쓰는 중(done 아님)인 과목과 다른 학과의 기록은 빠진다.
  s = saveElective(s, partner.id, "미생물학", { tried: true });
  s = saveElective(s, partner.id, "미생물학", { note: "균을 길러 봤다", done: true });
  s = saveElective(s, partner.id, "유기화학", { summary: "5쌍 짝 맞추기 · 틀린 시도 0번", done: true });
  s = saveElective(s, partner.id, "생리학", { note: "쓰는 중" });
  s = saveElective(s, other.id, "약품분석학", { note: "다른 학과", tried: true, done: true });
  assert.deepEqual(completedElectives(s, partner), [
    { subject: "유기화학", summary: "5쌍 짝 맞추기 · 틀린 시도 0번", note: "" },
    { subject: "미생물학", summary: "", note: "균을 길러 봤다" },
  ]);
  assert.equal(
    electiveReportText(s, partner),
    "\n\n선택 체험 (졸업 진행과 별개로 해본 과목이에요)\n- 유기화학\n해본 결과: 5쌍 짝 맞추기 · 틀린 시도 0번\n\n- 미생물학\n균을 길러 봤다",
  );
  assert.deepEqual(completedElectives(s, other).map((item) => item.subject), ["약품분석학"]);
  // 데이터가 바뀌어 지금 목록에 없는 과목도 마친 기록이면 뒤에 남는다.
  const moved = { ...s, electives: { ...s.electives, [`${partner.id}|없어진과목`]: { done: true, note: "예전 기록", summary: "" } } };
  assert.deepEqual(completedElectives(moved, partner).map((item) => item.subject), ["유기화학", "미생물학", "없어진과목"]);
  // 졸업 진행은 그대로다.
  assert.deepEqual(progressOf(s.journeys[partner.id], partner.lessons.length).passed, 1);
  assert.equal(completedElectives(s, null).length, 0);
});

test("선택 체험이 생기기 전에 저장한 기록도 그대로 불러오고, 리포트에는 선택 체험 묶음이 없다", () => {
  const partner = pharm("경희대학교", true);
  const old = {
    catalog: [JSON.parse(JSON.stringify(partner))],
    journeys: { [partner.id]: { completed: partner.lessons.length, skipped: [] } },
    notes: { [`${partner.id}-0`]: "예전 기록" },
  };
  const loaded = loadState(only(STORAGE_KEY, old));
  assert.deepEqual(loaded.electives, {});
  assert.equal(loaded.notes[`${partner.id}-0`], "예전 기록");
  assert.equal(progressOf(loaded.journeys[partner.id], partner.lessons.length).finished, true);
  assert.equal(electiveReportText(loaded, partner), "");
  // electives가 없는 state(예전 형식)를 그대로 넘겨도 깨지지 않는다.
  assert.equal(electiveReportText({ ...loaded, electives: undefined }, partner), "");
});

test("선택 체험 관찰 과제는 직접 해보기를 해 본 뒤에만 마칠 수 있고, 예전 기록은 그대로 마친 것으로 둔다", () => {
  const partner = pharm("경희대학교", true);
  let s = { ...structuredClone(initialState), catalog: [partner], journeys: { [partner.id]: { completed: 1, skipped: [] } } };
  // 직접 해보기 없이 완료하려 하면 마친 것으로 남지 않는다.
  s = saveElective(s, partner.id, "생리학", { done: true });
  assert.deepEqual(electiveOf(s, partner.id, "생리학"), { done: false, note: "", summary: "", tried: false });
  // 직접 해보기 단계에 들어가면 해 본 것으로 남고, 그 뒤에는 마칠 수 있다.
  s = saveElective(s, partner.id, "생리학", { tried: true });
  assert.equal(electiveOf(s, partner.id, "생리학").tried, true);
  s = saveElective(s, partner.id, "생리학", { note: "심장 박동을 재 봤다", done: true });
  assert.deepEqual(electiveOf(s, partner.id, "생리학"), { done: true, note: "심장 박동을 재 봤다", summary: "", tried: true });
  // tried는 한 번 해 보면 그대로다.
  s = saveElective(s, partner.id, "생리학", { tried: false });
  assert.equal(electiveOf(s, partner.id, "생리학").tried, true);
  // 연습 문제를 풀어 결과(summary)가 있으면 해 본 것이다.
  s = saveElective(s, partner.id, "유기화학", { summary: "5쌍 짝 맞추기", done: true });
  assert.equal(electiveOf(s, partner.id, "유기화학").done, true);

  // tried가 없던 예전 기록: 마친 것, 문제를 푼 것, 기록을 쓴 것은 해 본 것으로, 빈 기록은 아닌 것으로 불러온다.
  const old = {
    catalog: [JSON.parse(JSON.stringify(partner))],
    journeys: { [partner.id]: { completed: 1, skipped: [] } },
    electives: {
      [`${partner.id}|생리학`]: { done: true, note: "", summary: "" },
      [`${partner.id}|유기화학`]: { done: false, note: "", summary: "5쌍" },
      [`${partner.id}|물리약학`]: { done: false, note: "쓰는 중", summary: "" },
      [`${partner.id}|미생물학`]: { done: false, note: "", summary: "" },
      [`${partner.id}|약품분석학`]: { done: false, note: "", summary: "", tried: "yes" },
    },
  };
  const loaded = loadState(only(STORAGE_KEY, old));
  assert.deepEqual(
    Object.fromEntries(Object.entries(loaded.electives).map(([key, item]) => [key.split("|")[1], [item.done, item.tried]])),
    { 생리학: [true, true], 유기화학: [false, true], 물리약학: [false, true], 미생물학: [false, false], 약품분석학: [false, false] },
  );
  assert.deepEqual(completedElectives(loaded, partner).map((item) => item.subject), ["생리학"]);
});

test("관찰 과제 수업도 해본 기록(plays)이 있어야 완료되고, 예전에 화면을 열자마자 저장된 기록도 그대로 완료할 수 있다", () => {
  const d = createDepartment("간호학과", "가나대학교", ["기본간호학", "성인간호학", "아동간호학"], "의학", null, "4년", "", { 기본간호학: "blank" });
  const game = d.games[0];
  assert.ok(game, "1학년 자리에 연습 문제 유형이 있다");
  const base = { ...structuredClone(initialState), catalog: [d], journeys: { [d.id]: { completed: 0, paused: false } } };
  // 직접 해보기를 하지 않아 해본 기록이 없으면 완료되지 않는다.
  assert.equal(completeLesson(base, d.id, 0, "기록"), base);
  // 직접 해보기 단계에 들어가 해본 기록이 생기면 완료된다(관찰 과제는 summary가 비어 있다).
  const played = { ...base, plays: { [`${d.id}-0`]: { game, summary: "" } } };
  assert.equal(completeLesson(played, d.id, 0, "기록").journeys[d.id].completed, 1);
  // 예전 버전에서 화면을 열자마자 저장된 기록(같은 모양)도 불러와서 그대로 완료할 수 있다.
  const loaded = loadState(only(STORAGE_KEY, JSON.parse(JSON.stringify(played))));
  assert.deepEqual(loaded.plays[`${d.id}-0`], { game, summary: "" });
  assert.equal(completeLesson(loaded, d.id, 0, "").journeys[d.id].completed, 1);
});

// 홈 버튼 "이어하기"·"시작하기": 지난 학년을 마쳤는지가 아니라 지금 자리의 수업을 시작했는지로 정한다.
const enrolled = (d, completed = 0) => ({ ...structuredClone(initialState), catalog: departments.some((x) => x.id === d.id) ? [] : [d], current: d.id, journeys: { [d.id]: { completed, paused: false } } });
const DEPARTMENTS = [
  departments[0],
  createDepartment("컴퓨터공학과", "가천대학교", ["자료구조", "운영체제", "알고리즘", "컴퓨터구조"], "공학", null, "4년"),
  createDepartment("간호과", "전문대학", ["기본간호학", "성인간호학"], "의학", null, "2년"),
  createDepartment("산업디자인학과", "경희대학교", ["드로잉", "평면디자인", "UX디자인", "서비스디자인", "3D Design 1"], "예체능", null, "4년", "서울특별시", null, null, null, true, true),
];

test("수업 시작 여부: 아무 기록도 없는 자리는 앞 학년을 마쳤어도 시작하지 않은 것이다(학과·학년 모두 같다)", () => {
  for (const d of DEPARTMENTS)
    for (let index = 0; index < d.lessons.length; index++) {
      const state = enrolled(d, index);
      assert.equal(lessonStarted(state, d, index), false, `${d.name} ${index + 1}번째 자리`);
      // 수업 화면을 열면(배우기만 봐도) 시작한 것이다.
      const opened = markStarted(state, `${d.id}-${index}`);
      assert.equal(lessonStarted(opened, d, index), true, `${d.name} ${index + 1}번째 자리를 연 뒤`);
      // 다른 자리를 연 기록은 이 자리와 상관없다.
      assert.equal(lessonStarted(markStarted(state, `${d.id}-${index + 1}`), d, index), false);
      assert.equal(lessonStarted(markStarted(state, `other-${index}`), d, index), false);
    }
});

test("수업 시작 여부: 쓰던 기록, 남긴 기록, 해본 체험, 체험 결과 중 하나라도 있으면 시작한 것이다", () => {
  const d = DEPARTMENTS[1];
  const key = `${d.id}-1`;
  const state = enrolled(d, 1);
  const started = (patch) => lessonStarted({ ...state, ...patch }, d, 1);
  assert.equal(started({ drafts: { [key]: "쓰던 글" } }), true);
  assert.equal(started({ drafts: { [key]: "  " } }), false, "공백만 있는 기록은 쓴 것이 아니다");
  assert.equal(started({ notes: { [key]: "남긴 글" } }), true);
  assert.equal(started({ plays: { [key]: { game: "ox", summary: "" } } }), true, "기본 체험으로 넘어간 것도 시작한 것이다");
  assert.equal(started({ results: { [key]: [null, { template: "C", summary: "분류" }] } }), true);
  assert.equal(started({ results: { [key]: [null, null] } }), false);
  // 졸업 과제 기록은 마지막 자리에만 해당한다.
  assert.equal(started({ capstones: { [d.id]: { topic: "주제", reason: "", method: "" } }, artworks: { [d.id]: true } }), false);
  const last = d.lessons.length - 1;
  const final = enrolled(d, last);
  assert.equal(lessonStarted(final, d, last), false);
  assert.equal(lessonStarted({ ...final, capstones: { [d.id]: { topic: "주제", reason: "", method: "" } } }, d, last), true);
  assert.equal(lessonStarted({ ...final, capstones: { [d.id]: { topic: "", reason: " ", method: "" } } }, d, last), false);
  assert.equal(lessonStarted({ ...final, artworks: { [d.id]: true } }, d, last), true);
});

test("수업 시작 여부: 이미 연 자리면 상태를 그대로 돌려주고, 완료·휴강해도 다음 자리는 시작 전이다", () => {
  const d = departments[0];
  const state = markStarted(enrolled(d, 0), `${d.id}-0`);
  assert.equal(markStarted(state, `${d.id}-0`), state);
  const done = completeLesson(state, d.id, 0, "");
  assert.equal(done.journeys[d.id].completed, 1);
  assert.equal(lessonStarted(done, d, 1), false, "1학년을 마친 직후 2학년은 시작하기");
  const skipped = skipLesson(markStarted(done, `${d.id}-1`), d.id, 1);
  assert.equal(lessonStarted(skipped, d, 2), false, "휴강하고 넘어간 다음 자리도 시작하기");
  // 휴강한 자리는 다시 들을 때 이어서 한다.
  assert.equal(lessonStarted(skipped, d, 1), true);
});

test("수업 시작 여부는 저장했다 불러와도 남고, started가 없던 예전 기록은 남은 기록으로 판단한다", () => {
  const d = DEPARTMENTS[1];
  const state = markStarted(enrolled(d, 1), `${d.id}-1`);
  const loaded = loadState(only(STORAGE_KEY, JSON.parse(JSON.stringify(state))));
  assert.deepEqual(loaded.started, { [`${d.id}-1`]: true });
  assert.equal(lessonStarted(loaded, loaded.catalog[0], 1), true);
  // 잘못된 값과 없는 학과의 자리는 버린다.
  const broken = loadState(only(STORAGE_KEY, { ...JSON.parse(JSON.stringify(state)), started: { [`${d.id}-1`]: "yes", "없는학과-0": true, [`${d.id}-2`]: true } }));
  assert.deepEqual(broken.started, { [`${d.id}-2`]: true });
  assert.deepEqual(loadState(only(STORAGE_KEY, { ...JSON.parse(JSON.stringify(state)), started: "x" })).started, {});
  // started가 생기기 전(v4)에 저장한 기록: 쓰던 기록이 있는 자리만 이어하기다.
  const { started, ...older } = JSON.parse(JSON.stringify({ ...enrolled(d, 1), drafts: { [`${d.id}-1`]: "쓰던 글" } }));
  const old = loadState(only(STORAGE_KEY, older));
  assert.deepEqual(old.started, {});
  assert.equal(lessonStarted(old, old.catalog[0], 1), true);
  assert.equal(lessonStarted(loadState(only(STORAGE_KEY, { ...older, drafts: {} })), old.catalog[0], 1), false);
  // 3단계(v2)로 저장한 기록: 옮긴 뒤의 지금 자리에 남은 기록으로 판단한다.
  const v2 = loadState(
    only("mirae-campus-v2", {
      journeys: { design: { completed: 1 }, psychology: { completed: 1 } },
      notes: { "design-0": "첫 기록" },
      drafts: { "psychology-1": "쓰던 두 번째 글" },
    }),
  );
  const design = departments.find((x) => x.id === "design");
  const psychology = departments.find((x) => x.id === "psychology");
  assert.equal(v2.journeys.design.completed, 1);
  assert.equal(lessonStarted(v2, design, 1), false, "1학년 기록만 있는 학과의 2학년은 시작하기");
  assert.equal(lessonStarted(v2, psychology, 1), true, "2학년에 쓰던 글이 있으면 이어하기");
  // 8단계(v1)로 저장한 기록: 반만 마친 학년 자리에 합쳐진 기록이 있으면 이어하기다.
  const v1 = loadState(only("mirae-campus-v1", { journeys: { design: { completed: 1 } }, notes: { "design-0": "첫 학기 기록" } }));
  assert.equal(v1.journeys.design.completed, 0);
  assert.equal(lessonStarted(v1, design, 0), true);
  assert.equal(lessonStarted(v1, design, 1), false);
});

// 입학한 학과를 최신 서버 데이터로 바꾸기(2026-11-04). 편성표 학년(years)이 들어오기 전에 입학한 학과는 저장본의 yearly가 null이다.
const mechCurriculum = ["공업수학", "정역학", "동역학", "열역학", "유체역학", "기계설계", "제어공학", "기계공작법"];
const mechResult = (years) => ({
  curriculum: mechCurriculum,
  category: "공학",
  years,
  duration: "4년",
  region: "서울",
  games: null,
  levels: { 공업수학: [1, 1], 정역학: [2, 2] },
  picks: null,
  partner: false,
  partnerExample: false,
});
const mechYears = { subjects: { 공업수학: 1, 정역학: 2, 동역학: 2, 열역학: 3, 유체역학: 3, 기계설계: 3, 제어공학: 4, 기계공작법: 4 } };

test("yearly 없는 저장본은 3학년 다른 과목이 비고, 최신 데이터로 바꾸면 채워지며 진행도와 기록은 그대로다", () => {
  const stale = departmentFrom("기계공학과", "가나대학교", mechResult(null));
  const fresh = departmentFrom("기계공학과", "가나대학교", mechResult(mechYears));
  assert.equal(stale.id, fresh.id);
  const journey = { completed: 2, paused: false, skipped: [1] };
  // 저장했다 다시 불러와도 옛 데이터(yearly 없음) 그대로라 3학년 다른 과목이 비어 있다.
  const saved = {
    catalog: [JSON.parse(JSON.stringify(stale))],
    journeys: { [stale.id]: journey },
    notes: { [`${stale.id}-0`]: "1학년 기록" },
    drafts: { [`${stale.id}-2`]: "3학년 쓰는 중" },
    plays: { [`${stale.id}-0`]: { game: "blank", summary: "빈칸" } },
    electives: {},
  };
  const loaded = loadState(only(STORAGE_KEY, saved));
  assert.equal(loaded.catalog[0].yearly, null);
  assert.deepEqual(homeSubjects(loaded.catalog[0], loaded.journeys[stale.id]).others, []);

  const s = refreshDepartment(loaded, fresh);
  const d = s.catalog.find((item) => item.id === fresh.id);
  assert.ok(d.yearly);
  const home = homeSubjects(d, s.journeys[fresh.id]);
  assert.equal(home.year, 3);
  assert.deepEqual(home.others, yearSubjects(fresh).years.find((item) => item.year === 3).others);
  assert.ok(home.others.length > 0);
  // 진행도는 그대로다.
  assert.equal(s.journeys, loaded.journeys);
  assert.deepEqual(s.journeys[fresh.id], { completed: 2, paused: false, skipped: [1] });
  // 학년 자리의 수업이 그대로인 자리의 기록은 그대로 두고, 바뀐 자리의 기록은 예전 수업 이름으로 archive에 옮긴다.
  for (let i = 0; i < fresh.lessons.length; i++) {
    const key = `${fresh.id}-${i}`;
    if (stale.lessons[i] === fresh.lessons[i]) {
      assert.equal(s.notes[key], loaded.notes[key]);
      assert.equal(s.drafts[key], loaded.drafts[key]);
      assert.deepEqual(s.plays[key], loaded.plays[key]);
    } else {
      assert.equal(s.notes[key], undefined);
      for (const text of [loaded.notes[key], loaded.drafts[key]].filter(Boolean))
        assert.ok(s.archive.some((item) => item.id === fresh.id && item.title === stale.lessons[i] && item.note === text), text);
    }
  }
  // 저장했다 다시 불러와도 최신 데이터가 남는다.
  const again = loadState(only(STORAGE_KEY, JSON.parse(JSON.stringify(s))));
  assert.deepEqual(homeSubjects(again.catalog[0], again.journeys[fresh.id]).others, home.others);
  // 같은 데이터로 다시 바꾸면 상태가 그대로다(다시 저장하지 않는다).
  assert.equal(refreshDepartment(s, departmentFrom("기계공학과", "가나대학교", mechResult(mechYears))), s);
});

test("학년 자리의 수업이 바뀌면 그 자리의 기록·체험 결과는 archive로 옮기고, 다른 자리와 선택 체험은 그대로 둔다", () => {
  const stale = departmentFrom("기계공학과", "가나대학교", mechResult(null));
  const lessons = [...stale.lessons];
  lessons[1] = "바뀐 2학년 수업";
  const fresh = { ...stale, lessons };
  const id = stale.id;
  const base = {
    ...structuredClone(initialState),
    catalog: [stale],
    journeys: { [id]: { completed: 2, paused: false } },
    notes: { [`${id}-0`]: "1학년 기록", [`${id}-1`]: "2학년 기록" },
    drafts: { [`${id}-1`]: "2학년 쓰던 기록", [`${id}-2`]: "3학년 쓰던 기록" },
    plays: { [`${id}-1`]: { game: "blank", summary: "" } },
    started: { [`${id}-1`]: true, [`${id}-2`]: true },
    electives: { [`${id}|열역학`]: { done: true, note: "선택", summary: "", tried: true } },
    archive: [],
  };
  const s = refreshDepartment(base, fresh);
  assert.deepEqual(s.catalog[0].lessons, lessons);
  assert.deepEqual(s.journeys, base.journeys);
  assert.deepEqual(s.notes, { [`${id}-0`]: "1학년 기록" });
  assert.deepEqual(s.drafts, { [`${id}-2`]: "3학년 쓰던 기록" });
  assert.deepEqual(s.plays, {});
  assert.deepEqual(s.started, { [`${id}-2`]: true });
  assert.deepEqual(s.electives, base.electives);
  assert.deepEqual(s.archive, [
    { id, title: stale.lessons[1], note: "2학년 기록" },
    { id, title: stale.lessons[1], note: "2학년 쓰던 기록" },
  ]);
  // 저장해 두지 않은 학과는 바꾸지 않는다.
  assert.equal(refreshDepartment(base, { ...fresh, id: "api:없는:학과" }), base);
});

test("입학한 학과만 앱 실행당 한 번 다시 받고, 받지 못하면 저장본을 그대로 쓴다", async () => {
  const stale = departmentFrom("기계공학과", "가나대학교", mechResult(null));
  const browsed = departmentFrom("물리학과", "가나대학교", { ...mechResult(null), curriculum: ["역학", "전자기학", "열역학"] });
  let state = {
    ...structuredClone(initialState),
    catalog: [stale, browsed],
    journeys: { [stale.id]: { completed: 2, paused: false } },
  };
  const update = (fn) => {
    state = fn(state);
  };
  const reports = [];
  const report = (...args) => reports.push(args);
  // 받지 못하면(네트워크 오류, 404) 저장본 그대로다.
  for (const error of [new TypeError("Failed to fetch"), Object.assign(new Error("없음"), { status: 404 })]) {
    const before = state;
    await refreshEnrolled(state, () => Promise.reject(error), update, new Set(), report);
    assert.equal(state, before);
  }
  assert.equal(reports.length, 2);
  // load 자체가 예외를 던져도 흐름을 막지 않는다.
  await refreshEnrolled(state, () => {
    throw new Error("동기 오류");
  }, update, new Set(), report);
  assert.equal(reports.length, 3);
  // 받으면 최신 데이터로 바뀐다. 둘러보기만 한 학과는 받지 않고, 같은 실행에서 다시 부르면 다시 받지 않는다.
  const asked = [];
  const seen = new Set();
  const load = async (school, course) => {
    asked.push(course);
    return mechResult(mechYears);
  };
  await refreshEnrolled(state, load, update, seen, report);
  await refreshEnrolled(state, load, update, seen, report);
  assert.deepEqual(asked, ["기계공학과"]);
  assert.ok(state.catalog.find((d) => d.id === stale.id).yearly);
  assert.deepEqual(state.journeys[stale.id], { completed: 2, paused: false });
});
