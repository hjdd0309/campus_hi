import test from "node:test";
import assert from "node:assert/strict";
import { cleanLevels, cleanPicks, gameFor, pickLessons, pickPracticeSubject } from "./games.js";
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
  assert.deepEqual(pickLessons(["C언어", "자료구조", "알고리즘", "회계원리"], [1, 2], types), [
    { subject: "자료구조", game: "ox" },
    { subject: "회계원리", game: "match" },
  ]);
  assert.deepEqual(pickLessons(["C언어", "자료구조", "알고리즘"], [1, 2, 3], types), [
    { subject: "자료구조", game: "ox" },
    { subject: "알고리즘", game: "ox" },
    { subject: "C언어", game: null },
  ]);
  assert.deepEqual(pickLessons(["운영체제"]), [{ subject: "운영체제", game: null }]);
  assert.deepEqual(pickLessons([]), []);
  assert.deepEqual(pickLessons(["자료구조"], [], types), []);
  // 같은 입력이면 언제나 같은 과목을 고른다.
  assert.deepEqual(pickLessons(["C언어", "자료구조"], [1, 2], types), pickLessons(["C언어", "자료구조"], [1, 2], types));
});
test("학과군 실습은 체험을 마쳐야 완료된다", () => {
  const d = createDepartment("컴퓨터공학과", "가천대학교", ["C언어", "자료구조"], "공학", null, "3년");
  // 실습 학년은 교과목의 이어지는 과목(자료구조) 이름으로 보여주고, 하는 활동은 학과군 실습이다.
  assert.deepEqual(d.lessons, ["C언어", "자료구조", "캡스톤 디자인"]);
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
    subjects: { 심리학개론: 1, 범위밖: 9, 문자: "2", "": 1 },
    source_url: "javascript:alert(1)",
    curriculum_year: "2026",
    checked_at: "2026-10-10",
  });
  assert.deepEqual(d.yearly, { subjects: { 심리학개론: 1 }, source_url: "", curriculum_year: null, checked_at: "2026-10-10" });
  assert.equal(cleanYears(null), null);
  assert.equal(cleanYears({ subjects: "x" }), null);
  assert.equal(cleanYears({ subjects: {} }), null);
  assert.equal(cleanYears({ subjects: ["가"] }), null);
  assert.equal(cleanYears({ subjects: { 가: 1 }, source_url: "https://a.ac.kr/c" }).source_url, "https://a.ac.kr/c");
  // 학기별 편성으로 저장된 예전 기록은 과목마다 가장 낮은 학년으로 합친다.
  assert.deepEqual(
    cleanYears({
      terms: [
        { year: 2, semester: 1, subjects: ["자료구조", 3, ""] },
        { year: 1, semester: 2, subjects: ["자료구조", "이산구조"] },
        { year: 9, semester: 1, subjects: ["범위 밖"] },
        { year: 2, semester: 0, subjects: "x" },
      ],
      checked_at: "2026-10-10",
    }).subjects,
    { 자료구조: 1, 이산구조: 1 },
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
test("사람이 정해 둔 학년별 과목이 교과목에 있으면 규칙보다 먼저 쓴다", () => {
  const types = { 딥러닝: "match", 운영체제: "sort", 객체지향프로그래밍: "match", 데이터베이스: "blank" };
  const levels = { 딥러닝: [3, 4], 운영체제: [2, 3], 객체지향프로그래밍: [1, 2], 데이터베이스: [2, 3] };
  const curriculum = ["딥러닝", "운영체제", "객체지향프로그래밍", "데이터베이스"];
  const picks = { 1: ["객체지향프로그래밍"], 2: ["없는과목", "데이터베이스", "운영체제"] };
  assert.deepEqual(pickLessons(curriculum, [1, 2], types, levels, picks), [
    { subject: "객체지향프로그래밍", game: "match" },
    { subject: "데이터베이스", game: "blank" },
  ]);
  // 정해 둔 과목이 교과목에 없으면 규칙으로 고르고, 이미 고른 과목은 다시 쓰지 않는다.
  assert.equal(pickLessons(curriculum, [1], types, levels, { 1: ["자료구조"] })[0].subject, "객체지향프로그래밍");
  assert.deepEqual(pickLessons(curriculum, [1, 2], types, levels, { 1: ["딥러닝"], 2: ["딥러닝"] }).map((item) => item.subject), ["딥러닝", "운영체제"]);
  // 연습 문제가 없는 과목도 정해 두면 그대로 쓴다.
  assert.deepEqual(pickLessons(["C언어", "딥러닝"], [1], types, {}, { 1: ["C언어"] }), [{ subject: "C언어", game: null }]);
});
test("학년별 과목 후보는 형식이 맞는 것만 받는다", () => {
  assert.deepEqual(cleanPicks({ 1: ["가", 3, ""], 2: [], 7: ["나"], x: ["다"], 3: "라" }), { 1: ["가"] });
  assert.deepEqual(cleanPicks(null), {});
});
test("학과군 실습 학년은 실습과 이어지는 과목 중 그 학년에 맞는 과목 이름으로 보여준다", () => {
  const patterns = [/^재무회계/, /^중급회계/, /^회계원리/];
  const levels = { 회계원리: [1, 1], 재무회계: [2, 2], 중급회계: [2, 3] };
  const curriculum = ["회계원리", "마케팅원론", "재무회계", "중급회계1"];
  // 3학년이면 범위가 맞는 중급회계1, 1학년(2년제)이면 회계원리.
  assert.equal(pickPracticeSubject(curriculum, patterns, 3, { ...levels, 중급회계1: [2, 3] }), "중급회계1");
  assert.equal(pickPracticeSubject(curriculum, patterns, 1, levels), "회계원리");
  // 범위가 딱 맞는 과목이 없으면 앞쪽 패턴(범위를 모르는 과목도 한 학년 어긋나는 과목과 같이 본다).
  assert.equal(pickPracticeSubject(["자료구조", "알고리즘분석"], [/^알고리즘/, /^자료구조/], 3, { 자료구조: [1, 2] }), "알고리즘분석");
  // 범위가 크게 어긋나는 과목은 뒤로 간다.
  assert.equal(pickPracticeSubject(["알고리즘", "자료구조"], [/^알고리즘/, /^자료구조/], 1, { 알고리즘: [3, 4], 자료구조: [1, 2] }), "자료구조");
  // 범위가 같으면 앞쪽 패턴, 이론 수업에 쓴 과목은 빼고, 맞는 과목이 없으면 null.
  assert.equal(pickPracticeSubject(curriculum, patterns, 2, levels), "재무회계");
  assert.equal(pickPracticeSubject(curriculum, patterns, 2, levels, new Set(["재무회계"])), "중급회계1");
  assert.equal(pickPracticeSubject(["마케팅원론"], patterns, 3, levels), null);
  assert.equal(pickPracticeSubject(curriculum, undefined, 3, levels), null);
  // 학과의 3학년 이름이 과목으로 바뀌어도 하는 활동은 학과군 실습이다.
  const d = createDepartment("경영학과", "가천대학교", curriculum, "인문사회", null, "4년", "", null, { 회계원리: [1, 1], 재무회계: [2, 2] });
  // 이론 학년(1·2학년)이 회계원리·재무회계를 먼저 쓰므로 3학년은 남은 중급회계1이다.
  assert.deepEqual(d.lessons.slice(0, 3), ["회계원리", "재무회계", "중급회계1"]);
  assert.equal(d.games[2], "group:business");
  // 맞는 과목이 없으면 실습 이름 그대로다.
  assert.equal(createDepartment("경영학과", "가천대학교", ["마케팅원론", "경영전략"], "인문사회", null, "4년").lessons[2], "분개 연습");
});
