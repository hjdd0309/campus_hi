import test from "node:test";
import assert from "node:assert/strict";
import {
  lessonTypes,
  isLessonType,
  cleanGame,
  cleanLessonGames,
  questionsOf,
  answerOf,
  countCorrect,
  isAnswer,
  scramble,
  rightPlaces,
  moveStep,
} from "./lessonGames.js";
import { gameFor, isGame, pickLessons } from "./games.js";
import { createDepartment, completeLesson, loadState, initialState, STORAGE_KEY } from "./model.js";
import { getCurriculum, getLessonGame, ApiError } from "./api.js";

// 형식 검사용 예시. 서비스 데이터가 아니다.
const BLANK = {
  type: "blank",
  title: "데이터베이스 기본 용어",
  items: [
    { text: "표의 한 행을 ___이라고 한다.", choices: ["튜플", "속성", "도메인"], answer: 0, explanation: "행은 튜플, 열은 속성이다." },
    { text: "행을 구별하는 열을 ___라고 한다.", choices: ["외래키", "기본키", "인덱스"], answer: 1, explanation: "기본키는 행을 유일하게 구별한다." },
    { text: "자료를 조회하는 SQL 명령은 ___이다.", choices: ["INSERT", "DELETE", "SELECT"], answer: 2, explanation: "SELECT로 자료를 조회한다." },
  ],
  explanation: "관계형 데이터베이스는 자료를 표로 저장한다.",
};
const OX = {
  type: "ox",
  title: "OX",
  items: [0, 1, 2, 3, 4].map((n) => ({ text: `문장 ${n}`, answer: n % 2 === 0, explanation: "해설" })),
  explanation: "전체 해설",
};
const ORDER = {
  type: "order",
  title: "순서",
  prompt: "먼저 일어나는 일부터 놓아요.",
  items: ["첫째", "둘째", "셋째", "넷째"].map((text) => ({ text })),
  explanation: "전체 해설",
};
const MATCH = {
  type: "match",
  title: "짝",
  prompt: "용어와 설명을 짝지어요.",
  items: [0, 1, 2, 3].map((n) => ({ left: `용어${n}`, right: `설명${n}` })),
  explanation: "전체 해설",
};
const SORT = {
  type: "sort",
  title: "분류",
  prompt: "알맞은 쪽으로 나눠요.",
  categories: ["가", "나"],
  items: [0, 1, 2, 3, 4, 5].map((n) => ({ text: `항목${n}`, category: n % 2 })),
  explanation: "전체 해설",
};
const ALL = [BLANK, OX, ORDER, MATCH, SORT];
const withItem = (game, fields) => ({ ...game, items: [{ ...game.items[0], ...fields }, ...game.items.slice(1)] });

function seeded(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

test("유형마다 이름과 형식 검사가 등록되어 있다", () => {
  assert.deepEqual(Object.keys(lessonTypes), ["blank", "ox", "order", "match", "sort"]);
  assert.ok(Object.values(lessonTypes).every((type) => type.title && typeof type.clean === "function"));
  assert.ok(isLessonType("ox"));
  for (const bad of ["stroop", "constructor", "", null, 3]) assert.ok(!isLessonType(bad));
});

test("형식이 맞는 문제는 통과하고 화면에 쓰지 않는 필드는 버린다", () => {
  for (const game of ALL)
    assert.deepEqual(
      cleanGame({ ...game, course_name: "과목", generated_at: "2026-10-10", model: "m", status: "verified", check: {} }),
      game,
    );
});

test("형식이 틀리거나 상한을 넘는 문제는 쓰지 않는다", () => {
  const bad = [
    null,
    "문자열",
    { ...BLANK, type: "scenario" },
    { ...BLANK, title: "가".repeat(21) },
    { ...BLANK, title: " " },
    { ...BLANK, explanation: "가".repeat(121) },
    { ...BLANK, items: BLANK.items.slice(0, 2) },
    { ...BLANK, items: "x" },
    { ...BLANK, items: [1, 2, 3] },
    withItem(BLANK, { text: "빈칸이 없다." }),
    withItem(BLANK, { text: "___ 와 ___" }),
    withItem(BLANK, { text: "____ 네 칸" }),
    withItem(BLANK, { text: "가".repeat(58) + "___" }),
    withItem(BLANK, { choices: ["튜플", "속성"] }),
    withItem(BLANK, { choices: ["튜플", "튜플", "속성"] }),
    withItem(BLANK, { choices: ["가".repeat(13), "속성", "도메인"] }),
    withItem(BLANK, { answer: 3 }),
    withItem(BLANK, { answer: "0" }),
    withItem(BLANK, { explanation: "" }),
    { ...OX, items: OX.items.slice(0, 4) },
    { ...OX, items: OX.items.map((item) => ({ ...item, answer: true })) },
    withItem(OX, { answer: 1 }),
    withItem(OX, { text: "가".repeat(61) }),
    { ...ORDER, items: ORDER.items.slice(0, 3) },
    { ...ORDER, prompt: "" },
    { ...ORDER, items: ORDER.items.map(() => ({ text: "같음" })) },
    withItem(ORDER, { text: "가".repeat(25) }),
    { ...MATCH, items: MATCH.items.slice(0, 3) },
    withItem(MATCH, { left: "가".repeat(11) }),
    { ...MATCH, items: MATCH.items.map((item) => ({ ...item, right: "같은 설명" })) },
    { ...SORT, categories: ["가"] },
    { ...SORT, categories: ["가", "나", "다"] },
    { ...SORT, categories: ["가", "가".repeat(9)] },
    { ...SORT, items: SORT.items.slice(0, 5) },
    withItem(SORT, { category: 2 }),
    withItem(SORT, { text: "가".repeat(15) }),
  ];
  for (const game of bad) assert.equal(cleanGame(game), null, JSON.stringify(game));
});

test("과목 → 유형 목록은 아는 유형만 남긴다", () => {
  assert.deepEqual(cleanLessonGames({ 데이터베이스: "blank", 운영체제: "scenario", 통계: 3 }), { 데이터베이스: "blank" });
  for (const bad of [null, undefined, "x", ["blank"], 3]) assert.deepEqual(cleanLessonGames(bad), {});
});

test("하나씩 고르는 유형은 문항마다 정답 보기가 하나이고, 고른 번호로 채점한다", () => {
  const blank = questionsOf(BLANK, seeded(3));
  assert.deepEqual(blank.map(answerOf), ["튜플", "기본키", "SELECT"]);
  for (const [i, question] of blank.entries()) {
    assert.deepEqual(question.options.map((o) => o.label).sort(), [...BLANK.items[i].choices].sort());
    assert.equal(question.options.filter((o) => o.correct).length, 1);
  }
  const right = blank.map((q) => q.options.findIndex((o) => o.correct));
  assert.equal(countCorrect(blank, right), 3);
  assert.equal(countCorrect(blank, [right[0], (right[1] + 1) % 3, right[2]]), 2);
  assert.equal(countCorrect(blank, [right[0]]), 1);
  assert.equal(countCorrect(blank, []), 0);

  const ox = questionsOf(OX);
  assert.deepEqual(ox.map((q) => q.options.map((o) => o.label)), Array(5).fill(["O", "X"]));
  assert.deepEqual(ox.map(answerOf), ["O", "X", "O", "X", "O"]);
  assert.equal(countCorrect(ox, [0, 1, 0, 1, 0]), 5);
  assert.equal(countCorrect(ox, [1, 0, 1, 0, 1]), 0);

  const sort = questionsOf(SORT, seeded(5));
  assert.deepEqual(sort.map((q) => q.text).sort(), SORT.items.map((item) => item.text).sort());
  for (const question of sort) {
    assert.deepEqual(question.options.map((o) => o.label), ["가", "나"]);
    assert.equal(answerOf(question), SORT.categories[SORT.items.find((item) => item.text === question.text).category]);
  }
  assert.deepEqual(questionsOf(ORDER), []);
  assert.deepEqual(
    ["가계도", "사회보험", "SELECT", "X", "밀착된 "].map(isAnswer),
    ["‘가계도’예요", "‘사회보험’이에요", "‘SELECT’예요", "‘X’예요", "‘밀착된 ’이에요"],
  );
});

test("순서 맞추기는 섞인 상태로 시작하고, 제자리에 있는 단계 수로 채점한다", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const order = scramble(5, seeded(seed));
    assert.deepEqual([...order].sort(), [0, 1, 2, 3, 4]);
    assert.ok(rightPlaces(order) < 5);
  }
  assert.deepEqual(scramble(4, () => 0.999), [3, 2, 1, 0]);
  assert.equal(rightPlaces([0, 1, 2, 3]), 4);
  assert.equal(rightPlaces([1, 0, 2, 3]), 2);
  assert.equal(rightPlaces([3, 0, 1, 2]), 0);
  const order = [2, 0, 1];
  assert.deepEqual(moveStep(order, 0, 1), [0, 2, 1]);
  assert.deepEqual(moveStep(order, 2, -1), [2, 1, 0]);
  assert.equal(moveStep(order, 0, -1), order);
  assert.equal(moveStep(order, 2, 1), order);
  assert.deepEqual(order, [2, 0, 1]);
});

test("체험은 전용 미니게임, 연습 문제, 기본 체험 순서로 정한다", () => {
  const lessonGames = { 자료구조: "ox", 운영체제: "blank", 데이터베이스: "blank", 컴퓨터구조: "order", 이상한값: "scenario" };
  assert.equal(gameFor("자료구조", lessonGames), "sorting");
  assert.equal(gameFor("운영체제", lessonGames), "blank");
  assert.equal(gameFor("이상한값", lessonGames), null);
  assert.equal(gameFor("C언어", lessonGames), null);
  assert.equal(gameFor("constructor", lessonGames), null);
  assert.equal(gameFor("운영체제"), null);
  assert.ok(isGame("stroop") && isGame("match") && !isGame("없는게임") && !isGame(undefined));

  const curriculum = ["C언어", "운영체제", "데이터베이스", "컴퓨터구조", "자료구조", "알고리즘"];
  assert.deepEqual(pickLessons(curriculum, 3, lessonGames), [
    { subject: "자료구조", game: "sorting" },
    { subject: "운영체제", game: "blank" },
    { subject: "컴퓨터구조", game: "order" },
  ]);
  // 유형이 다른 연습 문제가 모자라면 같은 유형의 연습 문제로, 그것도 모자라면 나머지 과목으로 채운다.
  assert.deepEqual(pickLessons(curriculum, 5, lessonGames).slice(3), [
    { subject: "데이터베이스", game: "blank" },
    { subject: "C언어", game: null },
  ]);
  assert.deepEqual(pickLessons(curriculum, 2), [
    { subject: "자료구조", game: "sorting" },
    { subject: "C언어", game: null },
  ]);
  assert.deepEqual(pickLessons(["가", "나"], 2, { 나: "ox" }), [
    { subject: "나", game: "ox" },
    { subject: "가", game: null },
  ]);
});

test("연습 문제가 있는 과목이 체험에 들어가고, 저장했다 불러와도 그대로다", () => {
  const curriculum = ["C언어", "운영체제", "데이터베이스"];
  const d = createDepartment("컴퓨터공학과", "가천대학교", curriculum, "공학", null, "4년", "", { 운영체제: "match", 데이터베이스: "scenario" });
  assert.deepEqual(d.lessons, ["운영체제", "C언어", "데이터베이스", "캡스톤 디자인"]);
  assert.deepEqual(d.games, ["match", null, null, null]);
  assert.deepEqual(d.lessonGames, { 운영체제: "match" });
  assert.deepEqual(createDepartment("컴퓨터공학과", "가천대학교", curriculum, "공학", null, "4년").lessonGames, {});

  const key = `${d.id}-0`;
  const state = { ...structuredClone(initialState), catalog: [d], journeys: { [d.id]: { completed: 0, paused: false } } };
  assert.equal(completeLesson(state, d.id, 0, "기록"), state);
  // 연습 문제를 받지 못해 기본 체험으로 진행한 기록(결과가 빈 문자열)으로도 수업을 마칠 수 있다.
  for (const summary of ["4쌍 짝 맞추기 · 틀린 시도 1번", ""]) {
    const played = { ...state, plays: { [key]: { game: "match", summary } } };
    assert.equal(completeLesson(played, d.id, 0, "기록").journeys[d.id].completed, 1);
  }
  const restored = loadState({
    getItem: (name) =>
      name === STORAGE_KEY ? JSON.stringify({ ...state, plays: { [key]: { game: "match", summary: "결과" }, [`${d.id}-1`]: { game: "scenario", summary: "x" } } }) : null,
  });
  assert.deepEqual(restored.catalog[0].lessons, d.lessons);
  assert.deepEqual(restored.catalog[0].games, d.games);
  assert.deepEqual(restored.plays, { [key]: { game: "match", summary: "결과" } });
});

test("교육과정 응답의 연습 문제 목록과 문제 내용을 형식에 맞게 받는다", async (t) => {
  let reply = () => new Response(JSON.stringify({ curriculum_list: ["운영체제"], games: { 운영체제: "ox", 통계: "scenario" } }));
  t.mock.method(globalThis, "fetch", async (...args) => reply(...args));
  assert.deepEqual((await getCurriculum("대학", "학과")).games, { 운영체제: "ox" });

  const requests = [];
  reply = (url, options) => {
    requests.push([url, JSON.parse(options.body)]);
    return new Response(JSON.stringify({ game: { ...OX, course_name: "운영체제", status: "verified" } }));
  };
  assert.deepEqual(await getLessonGame("운영체제"), OX);
  assert.deepEqual(requests, [["/api/lesson_game", { subject: "운영체제" }]]);

  const failure = async () => getLessonGame("운영체제").then(() => null, (error) => error);
  reply = () => new Response(JSON.stringify({ detail: "이 과목의 연습 문제가 아직 없어요." }), { status: 404 });
  assert.equal((await failure()).status, 404);
  reply = () => new Response(JSON.stringify({ game: { ...OX, items: [] } }));
  assert.equal((await failure()).status, 422);
  reply = () => new Response(JSON.stringify({}));
  assert.equal((await failure()).status, 422);
  reply = () => {
    throw new TypeError("offline");
  };
  const offline = await failure();
  assert.ok(offline instanceof ApiError);
  assert.equal(offline.status, 0);
  assert.match(offline.message, /연습 문제를 불러오지 못했어요/);
  reply = () => new Response("<html>", { status: 502 });
  assert.equal((await failure()).status, 502);
});
