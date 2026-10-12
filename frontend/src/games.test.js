import test from "node:test";
import assert from "node:assert/strict";
import { games, gameFor, pickLessons } from "./games.js";
import {
  createDepartment,
  completeLesson,
  loadState,
  cleanYears,
  initialState,
  STORAGE_KEY,
} from "./model.js";

test("과목명에 맞는 게임을 찾고, 맞는 게임이 없으면 붙이지 않는다", () => {
  assert.equal(gameFor("심리학개론"), "stroop");
  assert.equal(gameFor("인지심리학"), "stroop");
  assert.equal(gameFor("자료구조 및 실습"), "sorting");
  assert.equal(gameFor("알고리즘"), "sorting");
  assert.equal(gameFor("회계원리"), "journal");
  assert.equal(gameFor("운영체제"), null);
  assert.equal(gameFor("상담심리학"), null);
  assert.equal(gameFor(""), null);
});
test("체험 과목은 게임이 있는 과목을 먼저, 서로 다른 게임으로 고른다", () => {
  assert.deepEqual(pickLessons(["C언어", "자료구조", "알고리즘", "회계원리"]), [
    { subject: "자료구조", game: "sorting" },
    { subject: "회계원리", game: "journal" },
  ]);
  assert.deepEqual(pickLessons(["C언어", "자료구조", "알고리즘"]), [
    { subject: "자료구조", game: "sorting" },
    { subject: "C언어", game: null },
  ]);
  assert.deepEqual(pickLessons(["운영체제"]), [{ subject: "운영체제", game: null }]);
  assert.deepEqual(pickLessons([]), []);
  assert.deepEqual(
    pickLessons(["C언어", "자료구조", "운영체제", "회계원리"], 3).map((item) => item.subject),
    ["자료구조", "회계원리", "C언어"],
  );
  assert.deepEqual(pickLessons(["자료구조", "알고리즘"], 1), [{ subject: "자료구조", game: "sorting" }]);
  assert.deepEqual(pickLessons(["자료구조"], 0), []);
});
test("게임이 있는 수업은 게임을 마쳐야 완료된다", () => {
  const d = createDepartment("컴퓨터공학과", "가천대학교", ["C언어", "자료구조"], "공학", null, "3년");
  assert.deepEqual(d.lessons, ["자료구조", "C언어", "캡스톤 디자인"]);
  assert.deepEqual(d.games, ["sorting", null, null]);
  const state = {
    ...structuredClone(initialState),
    catalog: [d],
    journeys: { [d.id]: { completed: 0, paused: false } },
  };
  assert.equal(completeLesson(state, d.id, 0, "기록"), state);
  const wrong = { ...state, plays: { [`${d.id}-0`]: { game: "stroop", summary: "" } } };
  assert.equal(completeLesson(wrong, d.id, 0, "기록"), wrong);
  const played = { ...state, plays: { [`${d.id}-0`]: { game: "sorting", summary: "교환 7번" } } };
  const next = completeLesson(played, d.id, 0, "기록");
  assert.equal(next.journeys[d.id].completed, 1);
  assert.equal(completeLesson(next, d.id, 1, "게임 없는 수업").journeys[d.id].completed, 2);
});
test("게임 결과와 학년별 편성은 형식이 맞는 것만 복구한다", () => {
  const d = createDepartment("심리학과", "가천대학교", ["심리학개론"], "인문사회", {
    terms: [
      { year: 1, semester: 1, subjects: ["심리학개론", 3, ""] },
      { year: 9, semester: 1, subjects: ["범위 밖"] },
      { year: 2, semester: 5, subjects: ["학기 오류"] },
      { year: 2, semester: 0, subjects: [] },
    ],
    source_url: "javascript:alert(1)",
    checked_at: "2026-10-10",
  });
  assert.deepEqual(d.yearly, {
    terms: [{ year: 1, semester: 1, subjects: ["심리학개론"] }],
    source_url: "",
    checked_at: "2026-10-10",
  });
  assert.equal(cleanYears(null), null);
  assert.equal(cleanYears({ terms: "x" }), null);
  assert.equal(cleanYears({ terms: [] }), null);
  assert.equal(
    cleanYears({ terms: [{ year: 1, semester: 0, subjects: ["가"] }], source_url: "https://a.ac.kr/c" }).source_url,
    "https://a.ac.kr/c",
  );
  const restored = loadState({
    getItem: (key) =>
      key !== STORAGE_KEY ? null :
      JSON.stringify({
        catalog: [d],
        plays: {
          [`${d.id}-0`]: { game: "stroop", summary: "16문제 중 15개 정답" },
          [`${d.id}-1`]: { game: "없는게임", summary: "x" },
          "missing-0": { game: "stroop", summary: "x" },
          [`${d.id}-2`]: { game: "stroop" },
        },
      }),
  });
  assert.deepEqual(restored.plays, {
    [`${d.id}-0`]: { game: "stroop", summary: "16문제 중 15개 정답" },
  });
  assert.deepEqual(restored.catalog[0].yearly, d.yearly);
  assert.deepEqual(restored.catalog[0].games, ["stroop", null, null, null]);
  assert.ok(games.every((game) => game.title && game.pattern instanceof RegExp));
});
