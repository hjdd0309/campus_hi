import test from "node:test";
import assert from "node:assert/strict";
import { gameFor, pickLessons } from "./games.js";
import {
  createDepartment,
  completeLesson,
  loadState,
  cleanYears,
  initialState,
  STORAGE_KEY,
} from "./model.js";

test("이론 수업의 체험은 그 과목의 연습 문제 유형이다", () => {
  const types = { 데이터베이스: "ox", 운영체제: "blank", 이상한과목: "nope" };
  assert.equal(gameFor("데이터베이스", types), "ox");
  assert.equal(gameFor("운영체제", types), "blank");
  assert.equal(gameFor("이상한과목", types), null);
  // 과목명만으로 체험을 붙이던 미니게임은 없앴다(학과군 실습으로 옮김).
  assert.equal(gameFor("자료구조"), null);
  assert.equal(gameFor("심리학개론"), null);
  assert.equal(gameFor("", types), null);
});
test("이론 수업 과목은 서로 다른 유형의 연습 문제가 있는 과목부터, 교과목 순서대로 고른다", () => {
  const types = { 자료구조: "ox", 알고리즘: "ox", 회계원리: "match" };
  assert.deepEqual(pickLessons(["C언어", "자료구조", "알고리즘", "회계원리"], 2, types), [
    { subject: "자료구조", game: "ox" },
    { subject: "회계원리", game: "match" },
  ]);
  assert.deepEqual(pickLessons(["C언어", "자료구조", "알고리즘"], 3, types), [
    { subject: "자료구조", game: "ox" },
    { subject: "알고리즘", game: "ox" },
    { subject: "C언어", game: null },
  ]);
  assert.deepEqual(pickLessons(["운영체제"]), [{ subject: "운영체제", game: null }]);
  assert.deepEqual(pickLessons([]), []);
  assert.deepEqual(pickLessons(["자료구조"], 0, types), []);
  // 같은 입력이면 언제나 같은 과목을 고른다.
  assert.deepEqual(pickLessons(["C언어", "자료구조"], 2, types), pickLessons(["C언어", "자료구조"], 2, types));
});
test("학과군 실습은 체험을 마쳐야 완료된다", () => {
  const d = createDepartment("컴퓨터공학과", "가천대학교", ["C언어", "자료구조"], "공학", null, "3년");
  assert.deepEqual(d.lessons, ["C언어", "버블 정렬 직접 해보기", "캡스톤 디자인"]);
  assert.deepEqual(d.games, [null, "group:computing", null]);
  const state = {
    ...structuredClone(initialState),
    catalog: [d],
    journeys: { [d.id]: { completed: 1, paused: false } },
  };
  assert.equal(completeLesson(state, d.id, 1, "기록"), state);
  const wrong = { ...state, plays: { [`${d.id}-1`]: { game: "group:health", summary: "" } } };
  assert.equal(completeLesson(wrong, d.id, 1, "기록"), wrong);
  const played = { ...state, plays: { [`${d.id}-1`]: { game: "group:computing", summary: "교환 7번" } } };
  assert.equal(completeLesson(played, d.id, 1, "기록").journeys[d.id].completed, 2);
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
          [`${d.id}-0`]: { game: "ox", summary: "5문제 중 4개 정답" },
          [`${d.id}-1`]: { game: "없는게임", summary: "x" },
          [`${d.id}-2`]: { game: "group:welfare", summary: "제도 6개 · 한 번에 맞힌 것 5개" },
          [`${d.id}-3`]: { game: "group:nope", summary: "x" },
          "missing-0": { game: "ox", summary: "x" },
          [`${d.id}-4`]: { game: "stroop", summary: "예전 미니게임" },
        },
      }),
  });
  assert.deepEqual(restored.plays, {
    [`${d.id}-0`]: { game: "ox", summary: "5문제 중 4개 정답" },
    [`${d.id}-2`]: { game: "group:welfare", summary: "제도 6개 · 한 번에 맞힌 것 5개" },
  });
  assert.deepEqual(restored.catalog[0].yearly, d.yearly);
  assert.deepEqual(restored.catalog[0].games, [null, null, "group:welfare", null]);
});
