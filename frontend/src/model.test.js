import test from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  LESSON_COUNT,
  lessonYear,
  departments,
  fields,
  createDepartment,
  loadState,
  recommend,
  recommendationScores,
  completeLesson,
  initialState,
} from "./model.js";

test("모든 전공과 API 학과는 졸업작품을 포함한 세 단계로 구성된다", () => {
  for (const d of [
    ...departments,
    createDepartment("산업디자인학과", "경희대학교", [
      "기초디자인",
      "제품설계",
      "고급설계",
      "종합설계",
    ]),
  ]) {
    assert.equal(d.lessons.length, 3);
    assert.equal(d.years.length, 3);
    assert.equal(d.lessons[2], "4학년 졸업작품");
  }
  assert.deepEqual([0, 1, 2, 3].map(lessonYear), [1, 2, 4, 4]);
});
test("손상된 저장 데이터는 초기 상태로 복구하고 진행률 범위를 제한한다", () => {
  assert.deepEqual(loadState({ getItem: () => "{broken" }), initialState);
  const state = loadState({
    getItem: () =>
      JSON.stringify({
        current: "missing",
        journeys: { design: { completed: 99 }, invalid: {} },
        notes: { a: 2, "design-0": "기록" },
      }),
  });
  assert.equal(state.current, "design");
  assert.equal(state.journeys.design.completed, LESSON_COUNT);
  assert.equal(state.journeys.invalid, undefined);
  assert.deepEqual(state.notes, { "design-0": "기록" });
});
test("작성 중인 노트는 새로고침 후 복구하고 잘못된 값은 버린다", () => {
  const restored = loadState({
    getItem: () =>
      JSON.stringify({
        journeys: { design: { completed: 0 } },
        drafts: { "design-0": "쓰던 글", "missing-0": "없는 학과", "design-1": 3, design: "키 오류" },
      }),
  });
  assert.deepEqual(restored.drafts, { "design-0": "쓰던 글" });
});
test("온보딩의 모든 관심 키워드는 추천 계열과 연결된다", () => {
  const keywords = ["디자인", "영상·콘텐츠", "미술", "공연", "심리", "교육", "사회", "경영", "컴퓨터", "데이터", "공학", "생명과학"];
  for (const keyword of keywords)
    assert.ok(
      Math.max(...Object.values(recommendationScores([keyword], []))) > 0,
      keyword,
    );
});
test("관심 분야와 활동에 따라 추천 계열이 바뀐다", () => {
  assert.equal(recommend(["심리", "교육"], ["listen"])[0].id, "인문사회");
  assert.equal(recommend(["디자인"], ["draw"])[0].id, "예체능");
  assert.equal(recommend(["컴퓨터"], [])[0].id, "공학");
  assert.equal(recommend([], ["science"])[0].id, "자연과학");
  assert.equal(recommend([], []).length, fields.length);
});
test("실습 완료는 한 단계씩 진행되며 빈 기록, 중복, 휴학 중 진행을 막는다", () => {
  const state = {
    ...structuredClone(initialState),
    journeys: { design: { completed: 0, paused: false } },
  };
  assert.equal(completeLesson(state, "design", 0, " "), state);
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
});
test("세 단계 완료 후 다른 학과의 진행 상태와 저장된 작품을 유지한다", () => {
  let state = {
    ...structuredClone(initialState),
    artworks: { design: "data:image/png;base64,AA==" },
    journeys: {
      design: { completed: 0, paused: false },
      psychology: { completed: 1, paused: true },
    },
  };
  for (let i = 0; i < LESSON_COUNT; i++)
    state = completeLesson(state, "design", i, `기록 ${i}`);
  assert.equal(state.journeys.design.completed, 3);
  assert.equal(Object.keys(state.notes).length, 3);
  assert.deepEqual(state.journeys.psychology, { completed: 1, paused: true });
  assert.equal(completeLesson(state, "design", 3, "추가"), state);
  assert.equal(state.artworks.design, "data:image/png;base64,AA==");
});
test("기존 8단계 기록을 삭제하지 않고 세 단계로 이관한다", () => {
  const legacy = {
    journeys: { design: { completed: 8 }, psychology: { completed: 4 } },
    notes: {
      "design-0": "첫 기록",
      "design-1": "두 번째",
      "design-7": "마지막",
    },
    reports: [{ id: "design", date: "2026-10-09" }],
  };
  const migrated = loadState({
    getItem: (key) => (key === STORAGE_KEY ? null : JSON.stringify(legacy)),
  });
  assert.equal(migrated.journeys.design.completed, 3);
  assert.equal(migrated.journeys.psychology.completed, 1);
  assert.match(migrated.notes["design-0"], /첫 기록\n\n두 번째/);
  assert.equal(migrated.notes["design-2"], "마지막");
  assert.equal(migrated.reports.length, 1);
});
test("API로 선택한 대학과 교육과정은 새로고침 후 복구된다", () => {
  const d = createDepartment("산업디자인학과", "경희대학교", [
    "기초설계",
    "제품설계",
  ]);
  const state = {
    ...structuredClone(initialState),
    catalog: [d],
    current: d.id,
    journeys: { [d.id]: { completed: 2, paused: false } },
  };
  const restored = loadState({ getItem: () => JSON.stringify(state) });
  assert.equal(restored.current, d.id);
  assert.equal(restored.catalog[0].school, "경희대학교");
  assert.equal(restored.journeys[d.id].completed, 2);
});


test("어느 학교·학과든 만들 수 있고 계열에 맞는 기본 구성을 쓴다", () => {
  const d = createDepartment("컴퓨터공학과", "가천대학교", ["자료구조", "운영체제"], "공학");
  assert.equal(d.id, "api:가천대학교:컴퓨터공학과");
  assert.equal(d.category, "공학");
  assert.equal(d.icon, "code");
  assert.deepEqual(d.lessons, ["자료구조", "운영체제", "4학년 졸업작품"]);
  assert.equal(d.jobs, undefined);
  const unknown = createDepartment("새학과", "새대학교", ["과목"], "없는계열");
  assert.equal(unknown.icon, "cap");
  assert.equal(unknown.lessons.length, 3);
  assert.deepEqual(createDepartment("산업디자인학과", "경희대학교", ["드로잉"], "예체능").jobs, departments[0].jobs);
});
test("저장된 학과 목록은 형식이 맞는 것만 복구한다", () => {
  const restored = loadState({ getItem: () => JSON.stringify({
    catalog: [
      { name: "컴퓨터공학과", school: "가천대학교", curriculum: ["자료구조", 3], category: "공학" },
      { name: "", school: "대학교", curriculum: [] },
      { name: "학과", school: "대학교" },
      { name: "간호학과", school: "대학교", curriculum: [], category: "<script>" },
    ],
    current: "api:가천대학교:컴퓨터공학과",
    journeys: { "api:가천대학교:컴퓨터공학과": { completed: 1 }, computer: { completed: 3 } },
    reports: [{ id: "computer", date: "2026-10-09" }],
  }) });
  assert.deepEqual(restored.catalog.map((d) => d.id), ["api:가천대학교:컴퓨터공학과", "api:대학교:간호학과"]);
  assert.deepEqual(restored.catalog[0].curriculum, ["자료구조"]);
  assert.equal(restored.catalog[1].category, "");
  assert.deepEqual(Object.keys(restored.journeys), ["api:가천대학교:컴퓨터공학과"]);
  assert.deepEqual(restored.reports, []);
  assert.equal(restored.current, "api:가천대학교:컴퓨터공학과");
});
