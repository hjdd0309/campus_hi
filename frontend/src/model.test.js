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
  withChoices,
  chooseSubject,
  stageLabel,
  CHOOSE_TITLE,
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
test("검증된 학년별 편성이 있으면 그 학년의 과목으로 체험을 만든다", () => {
  const years = {
    terms: [
      { year: 1, semester: 1, subjects: ["프로그래밍기초", "이산수학"] },
      { year: 2, semester: 1, subjects: ["컴퓨터구조"] },
      { year: 2, semester: 2, subjects: ["자료구조"] },
      { year: 3, semester: 0, subjects: ["운영체제"] },
      { year: 4, semester: 1, subjects: ["캡스톤디자인"] },
    ],
    source_url: "https://example.ac.kr/c",
    checked_at: "2026-10-10",
  };
  const curriculum = ["알고리즘", "프로그래밍기초", "자료구조", "운영체제"];
  const d = createDepartment("컴퓨터공학과", "가천대학교", curriculum, "공학", years, "4년");
  assert.equal(d.lessonsFromYears, true);
  // 이론 학년(1·2학년)은 그 학년의 과목으로, 3학년은 학과군 실습이다(이름은 실습과 이어지는 과목인 알고리즘).
  assert.deepEqual(d.lessons, ["프로그래밍기초", "컴퓨터구조", "알고리즘", "캡스톤 디자인"]);
  assert.deepEqual(d.games, [null, null, "group:computing", null]);
  // 이론 학년 중 하나라도 편성이 비어 있으면 학년을 지어내지 않고 교과목 목록에서 고른다.
  const partial = { ...years, terms: years.terms.filter((term) => term.year !== 2) };
  const fallback = createDepartment("컴퓨터공학과", "가천대학교", curriculum, "공학", partial, "4년");
  assert.equal(fallback.lessonsFromYears, false);
  // 알고리즘은 이론 수업에 썼으므로 실습 학년은 다음 후보인 자료구조다.
  assert.deepEqual(fallback.lessons, ["알고리즘", "프로그래밍기초", "자료구조", "캡스톤 디자인"]);
  // 실습 학년의 편성은 없어도 된다.
  const noThird = { ...years, terms: years.terms.filter((term) => term.year !== 3) };
  assert.equal(createDepartment("컴퓨터공학과", "가천대학교", curriculum, "공학", noThird, "4년").lessonsFromYears, true);
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
test("예시 제휴는 표시만 다르고 학기별 체험은 실제 제휴와 같으며, 예시 여부가 없는 옛 기록은 모름(null)으로 읽는다", () => {
  const terms = [
    { year: 1, semester: 1, subjects: ["자료구조"] },
    { year: 1, semester: 2, subjects: ["운영체제"] },
    { year: 2, semester: 1, subjects: ["알고리즘"] },
    { year: 2, semester: 2, subjects: ["데이터베이스"] },
  ];
  const make = (partner, example) =>
    createDepartment("컴퓨터공학과", "경희대학교", ["자료구조", "운영체제"], "공학", { terms }, "4년", "", null, null, null, partner, terms, example);
  const example = make(true, true);
  const real = make(true, false);
  const none = make(false, true);
  assert.deepEqual([example.partnerExample, real.partnerExample, none.partnerExample], [true, false, false]);
  assert.deepEqual({ ...example, partnerExample: false }, real);
  assert.equal(none.options, undefined);
  // 저장했다 읽으면 그대로다.
  const restored = loadState(only(STORAGE_KEY, { ...structuredClone(initialState), catalog: [example, real, none] }));
  assert.deepEqual(restored.catalog.map((item) => [item.partner, item.partnerExample]), [[true, true], [true, false], [false, false]]);
  // 예시 여부를 저장하기 전의 기록: 제휴였으면 모름(null), 아니면 false. 학기 자리는 그대로 다시 만든다.
  const { partnerExample: _, ...old } = example;
  const before = loadState(only(STORAGE_KEY, { ...structuredClone(initialState), catalog: [old, { ...old, id: "x", partner: false }] }));
  assert.deepEqual(before.catalog.map((item) => item.partnerExample), [null, false]);
  assert.deepEqual(before.catalog[0].lessons, example.lessons);
  assert.deepEqual(before.catalog[0].options, example.options);
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

// 제휴 대학의 학기별 편성(경희대 컴퓨터공학과 편성의 일부).
const TERMS = [
  { year: 1, semester: 1, subjects: ["선형대수", "객체지향프로그래밍", "이산구조"] },
  { year: 1, semester: 2, subjects: ["미분방정식", "객체지향프로그래밍"] },
  { year: 2, semester: 1, subjects: ["자료구조", "컴퓨터구조"] },
  { year: 2, semester: 2, subjects: ["자료구조", "논리회로"] },
  { year: 3, semester: 1, subjects: ["운영체제", "알고리즘"] },
  { year: 4, semester: 1, subjects: ["캡스톤디자인"] },
];
const CS = ["알고리즘", "자료구조", "운영체제", "선형대수", "객체지향프로그래밍"];
const GAMES = { 선형대수: "match", 객체지향프로그래밍: "match", 자료구조: "sort", 미분방정식: "match" };
const semesterDept = (terms = TERMS, partner = true) =>
  createDepartment("컴퓨터공학과", "경희대학교", CS, "공학", { terms }, "4년", "경기도", GAMES, null, null, partner, terms);

test("제휴 대학의 학기별 편성이 있으면 이론 학년을 학기 자리로 나누고, 실습·졸업 과제는 학년에 하나씩 둔다", () => {
  const d = semesterDept();
  assert.deepEqual(d.yearNumbers, [1, 1, 2, 2, 3, 4]);
  assert.deepEqual(d.semesters, [1, 2, 1, 2, 0, 0]);
  assert.deepEqual(d.options, [TERMS[0].subjects, TERMS[1].subjects, TERMS[2].subjects, TERMS[3].subjects, null, null]);
  assert.deepEqual(d.lessons.slice(0, 4), Array(4).fill(CHOOSE_TITLE));
  assert.deepEqual(d.games, [null, null, null, null, "group:computing", null]);
  assert.equal(d.lessons[5], finalOf(d).name);
  assert.equal(d.lessonsFromYears, true);
  assert.deepEqual([0, 1, 4, 5].map((i) => stageLabel(d, i)), ["1학년 1학기", "1학년 2학기", "3학년", "4학년"]);
  // 3년제는 이론 학년이 1학년뿐이다.
  const three = createDepartment("컴퓨터공학과", "경희대학교", CS, "공학", null, "3년", "", GAMES, null, null, true, TERMS);
  assert.deepEqual(three.yearNumbers, [1, 1, 2, 3]);
  // 학기 구분이 없는 과목(0)은 그 학년의 모든 학기에 들어가고, 학기 구분이 없는 학년은 자리 하나다.
  const mixed = semesterDept([
    { year: 1, semester: 0, subjects: ["이산구조"] },
    { year: 1, semester: 2, subjects: ["미분방정식"] },
    { year: 2, semester: 0, subjects: ["자료구조", "논리회로"] },
  ]);
  assert.deepEqual(mixed.yearNumbers, [1, 2, 3, 4]);
  assert.deepEqual(mixed.semesters, [2, 0, 0, 0]);
  assert.deepEqual(mixed.options.slice(0, 2), [["미분방정식", "이산구조"], ["자료구조", "논리회로"]]);
  assert.equal(stageLabel(mixed, 1), "2학년");
});

test("학기별 편성이 없거나 제휴 대학이 아니면 지금과 똑같은 학년별 체험이다", () => {
  const plain = createDepartment("컴퓨터공학과", "경희대학교", CS, "공학", { terms: TERMS }, "4년", "경기도", GAMES);
  // 제휴 대학이 아니면 편성을 받아도 쓰지 않는다.
  assert.deepEqual(semesterDept(TERMS, false), plain);
  // 편성이 없는 제휴 대학은 제휴 표시만 다르다.
  const noTerms = createDepartment("컴퓨터공학과", "경희대학교", CS, "공학", { terms: TERMS }, "4년", "경기도", GAMES, null, null, true, null);
  assert.deepEqual({ ...noTerms, partner: false }, plain);
  assert.equal(noTerms.options, undefined);
  assert.equal(noTerms.semesters, undefined);
  assert.equal(stageLabel(plain, 0), "1학년");
  // 이론 학년 중 하나라도 편성이 비어 있으면 학기 자리를 만들지 않는다.
  const partial = semesterDept(TERMS.filter((term) => term.year !== 2));
  assert.equal(partial.options, undefined);
  assert.deepEqual(partial.yearNumbers, [1, 2, 3, 4]);
  // 고른 과목을 반영해도 학기 자리가 없는 학과는 그대로다.
  assert.equal(withChoices(plain, { [`${plain.id}-0`]: "자료구조" }), plain);
});

const enrolledState = (d, extra = {}) => ({
  ...structuredClone(initialState),
  catalog: [d],
  current: d.id,
  journeys: { [d.id]: { completed: 0, paused: false } },
  ...extra,
});

test("학기 자리에서는 그 학기 편성 과목 중 하나를 고르고, 다른 학기에 고른 과목은 다시 고를 수 없다", () => {
  const d = semesterDept();
  let state = enrolledState(d);
  // 편성에 없는 과목, 지금 자리가 아닌 자리는 고를 수 없다.
  assert.equal(chooseSubject(state, d.id, 0, "운영체제"), state);
  assert.equal(chooseSubject(state, d.id, 1, "미분방정식"), state);
  state = chooseSubject(state, d.id, 0, "객체지향프로그래밍");
  assert.deepEqual(state.choices, { [`${d.id}-0`]: "객체지향프로그래밍" });
  const resolved = withChoices(d, state.choices);
  assert.equal(resolved.lessons[0], "객체지향프로그래밍");
  assert.equal(resolved.games[0], "match");
  assert.deepEqual(resolved.chosen, [true, false, false, false, null, null]);
  // 과목을 바꾸면 그 자리에서 해 둔 체험과 쓰던 기록을 지운다.
  state = { ...state, plays: { [`${d.id}-0`]: { game: "match", summary: "4쌍 중 4개" } }, drafts: { [`${d.id}-0`]: "쓰던 글" } };
  state = chooseSubject(state, d.id, 0, "이산구조");
  assert.deepEqual([state.choices[`${d.id}-0`], state.plays, state.drafts], ["이산구조", {}, {}]);
  assert.equal(withChoices(d, state.choices).games[0], null);
  state = chooseSubject(state, d.id, 0, "객체지향프로그래밍");
  state = { ...state, plays: { [`${d.id}-0`]: { game: "match", summary: "다 맞힘" } } };
  state = completeLesson(state, d.id, 0, "");
  assert.equal(state.journeys[d.id].completed, 1);
  // 마친 자리의 과목은 바꿀 수 없다.
  assert.equal(chooseSubject(state, d.id, 0, "선형대수"), state);
  // 1학년 2학기에도 객체지향프로그래밍이 있지만 1학기에 골랐으므로 고를 수 없다.
  assert.equal(chooseSubject(state, d.id, 1, "객체지향프로그래밍"), state);
  assert.equal(chooseSubject(state, d.id, 1, "미분방정식").choices[`${d.id}-1`], "미분방정식");
});

test("학기 자리는 과목을 골라야 완료되고, 연습 문제가 있는 과목은 풀어야 완료된다", () => {
  const d = semesterDept();
  let state = enrolledState(d);
  assert.equal(completeLesson(state, d.id, 0, ""), state);
  state = chooseSubject(state, d.id, 0, "선형대수");
  assert.equal(completeLesson(state, d.id, 0, "").journeys[d.id].completed, 0);
  state = { ...state, plays: { [`${d.id}-0`]: { game: "match", summary: "4쌍 중 3개" } } };
  assert.equal(completeLesson(state, d.id, 0, "행렬").journeys[d.id].completed, 1);
  // 연습 문제가 없는 과목(이산구조)은 기본 체험으로 바로 완료할 수 있다.
  let basic = chooseSubject(enrolledState(d), d.id, 0, "이산구조");
  basic = completeLesson(basic, d.id, 0, "");
  assert.equal(basic.journeys[d.id].completed, 1);
});

test("학기별 체험으로 입학부터 졸업까지 갈 수 있다", () => {
  const d = semesterDept();
  let state = enrolledState(d);
  const picks = ["이산구조", "미분방정식", "컴퓨터구조", "논리회로"];
  picks.forEach((subject, i) => {
    state = chooseSubject(state, d.id, i, subject);
    const game = withChoices(d, state.choices).games[i];
    if (game) state = { ...state, plays: { ...state.plays, [`${d.id}-${i}`]: { game, summary: "다 풀었어요" } } };
    state = completeLesson(state, d.id, i, `${i}학기 기록`);
  });
  assert.equal(state.journeys[d.id].completed, 4);
  state = { ...state, plays: { ...state.plays, [`${d.id}-4`]: { game: "group:computing", summary: "정렬 완료" } } };
  state = completeLesson(state, d.id, 4, "");
  assert.equal(state.journeys[d.id].completed, 5);
  // 졸업 과제는 마쳐야 완료된다.
  assert.equal(completeLesson(state, d.id, 5, "").journeys[d.id].completed, 5);
  state = finalOf(d).kind === "plan"
    ? { ...state, capstones: { [d.id]: { topic: "주제", reason: "이유", method: "방법" } } }
    : { ...state, artworks: { [d.id]: true } };
  state = completeLesson(state, d.id, 5, "마치며");
  assert.equal(state.journeys[d.id].completed, 6);
  assert.deepEqual(withChoices(d, state.choices).lessons.slice(0, 4), picks);
});

test("학기별 학과와 고른 과목은 새로고침 뒤에도 그대로이고, 예전 v4 기록은 학년별 그대로 읽는다", () => {
  const d = semesterDept();
  const state = chooseSubject(enrolledState(d), d.id, 0, "선형대수");
  const saved = JSON.parse(JSON.stringify(state));
  const restored = loadState(only(STORAGE_KEY, saved));
  assert.deepEqual(restored.catalog[0].yearNumbers, d.yearNumbers);
  assert.deepEqual(restored.catalog[0].options, d.options);
  assert.deepEqual(restored.choices, { [`${d.id}-0`]: "선형대수" });
  // 편성에 없는 과목, 자리가 없는 번호, 다른 자리와 겹치는 과목, 문자열이 아닌 값은 버린다.
  const broken = loadState(only(STORAGE_KEY, {
    ...saved,
    choices: { [`${d.id}-0`]: "선형대수", [`${d.id}-1`]: "없는과목", [`${d.id}-4`]: "운영체제", [`${d.id}-2`]: 3, "없는학과-0": "자료구조" },
  }));
  assert.deepEqual(broken.choices, { [`${d.id}-0`]: "선형대수" });
  // 이 기능 전에 저장된 v4 기록(학과에 terms·choices가 없음)은 제휴 대학이어도 학년별 체험 그대로다.
  const old = createDepartment("컴퓨터공학과", "경희대학교", CS, "공학", { terms: TERMS }, "4년", "경기도", GAMES, null, null, true);
  const { terms, choices, ...before } = structuredClone(initialState);
  const legacy = loadState(only(STORAGE_KEY, {
    ...before,
    catalog: [JSON.parse(JSON.stringify(old))],
    current: old.id,
    journeys: { [old.id]: { completed: 2, paused: false } },
    notes: { [`${old.id}-1`]: "2학년 기록" },
  }));
  assert.equal(terms, undefined);
  assert.ok(choices);
  assert.deepEqual(legacy.catalog[0].lessons, old.lessons);
  assert.equal(legacy.catalog[0].options, undefined);
  assert.equal(legacy.journeys[old.id].completed, 2);
  assert.deepEqual(legacy.notes, { [`${old.id}-1`]: "2학년 기록" });
  assert.deepEqual(legacy.choices, {});
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

test("학기 자리는 과목을 고른 뒤에만 휴강할 수 있고, 다시 들을 때도 고른 과목 그대로다", () => {
  const d = semesterDept();
  let state = enrolledState(d);
  assert.equal(skipLesson(state, d.id, 0), state);
  state = chooseSubject(state, d.id, 0, "이산구조");
  state = skipLesson(state, d.id, 0);
  assert.deepEqual(state.journeys[d.id].skipped, [0]);
  assert.equal(state.choices[`${d.id}-0`], "이산구조");
  const game = withChoices(d, state.choices).games[0];
  if (game) state = { ...state, plays: { ...state.plays, [`${d.id}-0`]: { game, summary: "다 풀었어요" } } };
  state = completeLesson(state, d.id, 0, "");
  assert.deepEqual(state.journeys[d.id].skipped, []);
  assert.equal(state.journeys[d.id].completed, 1);
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
  for (const [i, item] of list.years.entries()) assert.deepEqual(item.open, [{ index: i, title: d.lessons[i] }]);
  const all = list.years.flatMap((item) => item.locked);
  // 체험하는 과목은 잠긴 목록에 다시 나오지 않고, 학년 범위가 없는 졸업연구와 '해당없음'은 빠진다.
  for (const lesson of d.lessons) assert.ok(!all.includes(lesson));
  assert.ok(!all.includes("졸업연구"));
  assert.ok(!all.includes("해당없음"));
  // 과목은 보통 듣기 시작하는 학년 하나에만 들어간다.
  assert.equal(new Set(all).size, all.length);
  const yearOf = (subject) => list.years.find((item) => item.locked.includes(subject))?.year;
  for (const subject of all) assert.equal(yearOf(subject), levels[subject][0]);
  // 학년별 편성을 확보한 학과는 그 편성의 학년을 그대로 쓴다.
  const years = { terms: [{ year: 1, semester: 1, subjects: ["프로그래밍기초", "미적분학"] }, { year: 2, semester: 1, subjects: ["컴퓨터구조", "확률통계"] }] };
  const exact = createDepartment("컴퓨터공학과", "가나대학교", ["프로그래밍기초", "미적분학", "컴퓨터구조", "확률통계"], "공학", years, "4년");
  const exactList = yearSubjects(exact);
  assert.equal(exactList.estimated, false);
  assert.deepEqual(exactList.years[0].locked, ["미적분학"]);
  assert.deepEqual(exactList.years[1].locked, ["확률통계"]);
  // 학기마다 과목을 고르는 제휴 학과는 잠긴 과목이 없다.
  assert.equal(yearSubjects(semesterDept()), null);
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
  const d = createDepartment("간호학과", "경희대학교", ["기본간호학"], "", null, "4년", "", null, null, null, true, null, true);
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
  // 학기마다 과목을 고르는 제휴 학과는 지금 과목만 보여준다.
  const partner = homeSubjects(semesterDept(), { completed: 0, paused: false });
  assert.equal(partner.others.length, 0);
  assert.equal(partner.main.index, 0);
  assert.equal(homeSubjects(null, null), null);
});

test("제휴 학교는 학기별 편성이 없어도 '제휴하면 열리는' 잠긴 과목을 보여주지 않는다", () => {
  const levels = { 약물학: [2, 3], 생화학: [1, 2], 약제학: [2, 2], 유기화학: [1, 1], 물리약학: [1, 2], 약품분석학: [2, 2], 생리학: [1, 1], 미생물학: [2, 2] };
  const curriculum = ["약물학", "생화학", "약제학", "약학개론", "유기화학", "물리약학", "약품분석학", "생리학", "미생물학"];
  const partner = createDepartment("약학과", "경희대학교", curriculum, "의학", null, "6년", "", null, levels, null, true, null, true);
  assert.equal(yearSubjects(partner), null);
  assert.deepEqual(homeSubjects(partner, { completed: 1, paused: false }).others, []);
  const plain = createDepartment("약학과", "가나대학교", curriculum, "의학", null, "6년", "", null, levels);
  assert.ok(yearSubjects(plain).years.some((item) => item.locked.length > 0));
});
