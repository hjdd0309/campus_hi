import test from "node:test";
import assert from "node:assert/strict";
import {
  games,
  gameFor,
  pickLessons,
  stroopColors,
  makeStroopTrials,
  summarizeStroop,
  inversions,
  isSorted,
  swapAdjacent,
  makeDeck,
  accounts,
  transactions,
  checkEntry,
} from "./games.js";
import {
  createDepartment,
  completeLesson,
  loadState,
  cleanYears,
  initialState,
} from "./model.js";

// 테스트가 매번 같은 결과를 내도록 고정된 난수를 쓴다.
function seeded(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

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
});
test("스트룹 실험은 일치 8문제와 불일치 8문제로 구성된다", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const trials = makeStroopTrials(seeded(seed));
    const ids = stroopColors.map((color) => color.id);
    assert.equal(trials.length, 16);
    assert.equal(trials.filter((t) => t.word === t.ink).length, 8);
    assert.ok(trials.every((t) => ids.includes(t.word) && ids.includes(t.ink)));
    for (const id of ids) assert.equal(trials.filter((t) => t.ink === id).length, 4);
  }
});
test("스트룹 결과는 맞힌 시행의 평균 시간으로 간섭 효과를 계산한다", () => {
  const summary = summarizeStroop([
    { congruent: true, correct: true, ms: 500 },
    { congruent: true, correct: true, ms: 700 },
    { congruent: true, correct: false, ms: 9000 },
    { congruent: false, correct: true, ms: 900 },
    { congruent: false, correct: true, ms: 1100 },
  ]);
  assert.deepEqual(summary, {
    correct: 4,
    total: 5,
    congruentMs: 600,
    incongruentMs: 1000,
    interferenceMs: 400,
  });
  const none = summarizeStroop([{ congruent: true, correct: false, ms: 300 }]);
  assert.equal(none.congruentMs, null);
  assert.equal(none.interferenceMs, null);
});
test("이웃 교환으로 정렬하는 최소 횟수는 역순 쌍의 수와 같다", () => {
  assert.equal(inversions([1, 2, 3]), 0);
  assert.equal(inversions([3, 2, 1]), 3);
  assert.equal(inversions([2, 1, 4, 3]), 2);
  assert.deepEqual(swapAdjacent([3, 1, 2], 0), [1, 3, 2]);
  assert.deepEqual(swapAdjacent([3, 1, 2], 2), [3, 1, 2]);
  assert.deepEqual(swapAdjacent([3, 1, 2], -1), [3, 1, 2]);
  // 버블 정렬을 그대로 따라 하면 정확히 역순 쌍의 수만큼 교환한다.
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    let deck = makeDeck(seeded(seed));
    const minimum = inversions(deck);
    assert.equal(deck.length, 6);
    assert.equal(new Set(deck).size, 6);
    assert.ok(minimum >= 6);
    let swaps = 0;
    while (!isSorted(deck))
      for (let i = 0; i < deck.length - 1; i++)
        if (deck[i] > deck[i + 1]) {
          deck = swapAdjacent(deck, i);
          swaps++;
        }
    assert.equal(swaps, minimum);
  }
});
test("분개 문제는 차변과 대변이 회계 원칙에 맞는다", () => {
  const kind = (id) => accounts.find((account) => account.id === id).kind;
  assert.equal(transactions.length, 5);
  for (const t of transactions) {
    assert.notEqual(t.debit, t.credit);
    assert.ok(checkEntry(t, t.debit, t.credit));
    assert.ok(!checkEntry(t, t.credit, t.debit));
    assert.ok(t.why.includes(accounts.find((a) => a.id === t.debit).name));
    assert.ok(t.why.includes(accounts.find((a) => a.id === t.credit).name));
  }
  assert.deepEqual(
    transactions.map((t) => [kind(t.debit), kind(t.credit)]),
    [
      ["자산", "자본"],
      ["자산", "부채"],
      ["자산", "부채"],
      ["비용", "자산"],
      ["부채", "자산"],
    ],
  );
});
test("게임이 있는 수업은 게임을 마쳐야 완료된다", () => {
  const d = createDepartment("컴퓨터공학과", "가천대학교", ["C언어", "자료구조"], "공학");
  assert.deepEqual(d.lessons, ["자료구조", "C언어", "4학년 졸업작품"]);
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
    getItem: () =>
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
  assert.deepEqual(restored.catalog[0].games, ["stroop", null, null]);
  assert.ok(games.every((game) => game.title && game.pattern instanceof RegExp));
});
