import test from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  finals,
  finalFor,
  finalReady,
  planReady,
  stageYears,
  departments,
  fields,
  createDepartment,
  loadState,
  recommend,
  recommendationScores,
  completeLesson,
  initialState,
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
test("학과는 학년마다 체험이 하나씩 있고 마지막 학년은 졸업작품이다", () => {
  const subjects = ["기초디자인", "제품설계", "고급설계", "종합설계"];
  const four = createDepartment("산업디자인학과", "경희대학교", subjects, "예체능", null, "4년");
  assert.deepEqual(four.yearNumbers, [1, 2, 3, 4]);
  assert.deepEqual(four.lessons, ["기초디자인", "제품설계", "고급설계", "졸업작품"]);
  assert.equal(four.final, "artwork");
  assert.deepEqual(four.games, [null, null, null, null]);
  assert.equal(four.lessonsFromYears, false);
  const two = createDepartment("간호과", "전문대학", subjects, "자연과학", null, "2년");
  assert.deepEqual(two.yearNumbers, [1, 2]);
  assert.deepEqual(two.lessons, ["기초디자인", "졸업 연구"]);
  const advanced = createDepartment("간호학과", "전문대학", subjects, "", null, "1년(전공심화)");
  assert.deepEqual(advanced.yearNumbers, [4]);
  assert.deepEqual(advanced.lessons, ["졸업 연구"]);
  const short = createDepartment("새학과", "새대학교", ["과목"], "", null, "4년");
  assert.deepEqual(short.lessons, ["과목", "2학년 전공 탐색", "3학년 전공 탐색", "졸업 연구"]);
  for (const d of [...departments, four, two, advanced, short]) {
    assert.equal(d.lessons.length, d.yearNumbers.length);
    assert.equal(d.lessons.at(-1), finals[d.final].name);
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
  assert.deepEqual(d.lessons, ["프로그래밍기초", "자료구조", "운영체제", "캡스톤 디자인"]);
  assert.deepEqual(d.games, [null, "sorting", null, null]);
  // 어느 학년이라도 편성이 비어 있으면 학년을 지어내지 않고 교과목 목록에서 고른다.
  const partial = { ...years, terms: years.terms.filter((term) => term.year !== 3) };
  const fallback = createDepartment("컴퓨터공학과", "가천대학교", curriculum, "공학", partial, "4년");
  assert.equal(fallback.lessonsFromYears, false);
  assert.deepEqual(fallback.lessons, ["알고리즘", "프로그래밍기초", "자료구조", "캡스톤 디자인"]);
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
test("실습 완료는 한 학년씩 진행되며 빈 기록, 중복, 휴학 중 진행을 막는다", () => {
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
  state = { ...state, artworks: { design: "data:image/png;base64,AA==" } };
  state = completeLesson(state, "design", TOTAL - 1, "졸업작품 기록");
  assert.equal(state.journeys.design.completed, TOTAL);
  assert.equal(Object.keys(state.notes).length, TOTAL);
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
  assert.equal(finalReady({ artworks: { [computer.id]: "data:image/png;base64,AA==" } }, computer), false);
  assert.equal(finalReady({ capstones: { [computer.id]: { topic: "가", reason: "나", method: "다" } } }, computer), true);
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
  assert.equal(migrated.version, 3);
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
});
test("어느 학교·학과든 만들 수 있고 계열에 맞는 기본 구성을 쓴다", () => {
  const d = createDepartment("컴퓨터공학과", "가천대학교", ["자료구조", "운영체제"], "공학", null, "4년");
  assert.equal(d.id, "api:가천대학교:컴퓨터공학과");
  assert.equal(d.category, "공학");
  assert.equal(d.icon, "code");
  assert.deepEqual(d.lessons, ["자료구조", "운영체제", "3학년 전공 탐색", "캡스톤 디자인"]);
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
