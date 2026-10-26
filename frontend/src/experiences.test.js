import test from "node:test";
import assert from "node:assert/strict";
import {
  checkPicks,
  cleanExperience,
  experiences,
  inversions,
  isSorted,
  makeTrials,
  startOrder,
  summarizeReaction,
  swapAdjacent,
  templates,
} from "./experiences.js";
import { finals } from "./model.js";
import { groupData } from "./groupData.js";

// 테스트가 매번 같은 결과를 내도록 고정된 난수를 쓴다.
function seeded(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

test("지금 쓰는 체험 데이터는 모두 형식 검사를 통과한다", () => {
  for (const [id, data] of Object.entries(experiences)) assert.ok(data, `${id} 형식이 틀림`);
  assert.deepEqual(
    Object.fromEntries(Object.entries(experiences).map(([id, data]) => [id, data.template])),
    { sorting: "B", journal: "C", artwork: "A", capstone: "F", thesis: "F", showcase: "F" },
  );
  // 졸업 과제와, 학과군 데이터가 바탕으로 쓰는 체험은 모두 데이터가 있다.
  for (const final of Object.values(finals)) assert.ok(final.name);
  for (const group of Object.values(groupData))
    for (const entry of [group.practice, group.final]) if (entry.base) assert.ok(experiences[entry.base], entry.base);
  assert.ok(Object.keys(templates).length <= 6);
});

test("형식이 틀린 체험 데이터는 거른다", () => {
  const base = experiences.sorting;
  assert.equal(cleanExperience(null), null);
  assert.equal(cleanExperience({ ...base, template: "Z" }), null);
  assert.equal(cleanExperience({ ...base, title: "" }), null);
  assert.equal(cleanExperience({ ...base, title: "가".repeat(21) }), null);
  assert.equal(cleanExperience({ ...base, task: undefined }), null);
  // B: 단계 수, 중복, 이웃 교환일 때 카드 글자 수
  assert.equal(cleanExperience({ ...base, items: ["1", "2", "3"] }), null);
  assert.equal(cleanExperience({ ...base, items: ["1", "1", "3", "4"] }), null);
  assert.equal(cleanExperience({ ...base, items: ["가나다라마", "2", "3", "4"] }), null);
  assert.ok(cleanExperience({ ...base, swap: "move", items: ["가나다라마", "2", "3", "4"] }));
  assert.equal(cleanExperience({ ...base, swap: "jump" }), null);
  // C: 정답이 보기에 없거나 칸 수와 다르면 안 된다.
  const journal = experiences.journal;
  assert.equal(cleanExperience({ ...journal, items: [{ ...journal.items[0], answer: ["cash"] }, ...journal.items.slice(1)] }), null);
  assert.equal(cleanExperience({ ...journal, items: [{ ...journal.items[0], answer: ["cash", "nope"] }, ...journal.items.slice(1)] }), null);
  assert.equal(cleanExperience({ ...journal, slots: [] }), null);
  // D: 색은 #rrggbb, 만드는 방식은 정해진 것만
  const reaction = groupData.sports.practice;
  assert.ok(cleanExperience(reaction));
  assert.equal(cleanExperience({ ...reaction, choices: [{ ...reaction.choices[0], color: "red" }, ...reaction.choices.slice(1)] }), null);
  assert.equal(cleanExperience({ ...reaction, generator: "stroop" }), null);
  assert.equal(cleanExperience({ ...reaction, pairs: 2 }), null);
  // 알아두기(learn)는 없어도 되지만, 있으면 120자까지다.
  assert.equal(cleanExperience({ ...base, learn: "" }).learn, "");
  assert.equal(cleanExperience({ ...base, learn: "가".repeat(121) }), null);
  // A: 장면은 있는 그림만
  assert.equal(cleanExperience({ ...experiences.artwork, phases: [{ label: "칠하기", scene: "none", particles: "paint" }] }), null);
  // F: 계획서는 세 칸
  const plan = experiences.thesis;
  assert.equal(cleanExperience({ ...plan, prompts: plan.prompts.slice(0, 2) }), null);
  assert.equal(cleanExperience({ ...plan, prompts: [{ ...plan.prompts[0], options: ["하나"] }, ...plan.prompts.slice(1)] }), null);
});

test("순서 맞추기: 이웃 교환의 최소 횟수는 역순 쌍의 수와 같다", () => {
  assert.equal(inversions([0, 1, 2]), 0);
  assert.equal(inversions([2, 1, 0]), 3);
  assert.equal(inversions([1, 0, 3, 2]), 2);
  assert.deepEqual(swapAdjacent([2, 0, 1], 0), [0, 2, 1]);
  assert.deepEqual(swapAdjacent([2, 0, 1], 2), [2, 0, 1]);
  assert.deepEqual(swapAdjacent([2, 0, 1], -1), [2, 0, 1]);
  // 버블 정렬을 그대로 따라 하면 정확히 역순 쌍의 수만큼 교환한다.
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    let order = startOrder(6, "adjacent", seeded(seed));
    const minimum = inversions(order);
    assert.deepEqual([...order].sort(), [0, 1, 2, 3, 4, 5]);
    assert.ok(minimum >= 6);
    let swaps = 0;
    while (!isSorted(order))
      for (let i = 0; i < order.length - 1; i++)
        if (order[i] > order[i + 1]) {
          order = swapAdjacent(order, i);
          swaps++;
        }
    assert.equal(swaps, minimum);
  }
  // 자리 옮기기는 이미 맞춰진 순서로 시작하지 않는다.
  for (const seed of [1, 2, 3, 4, 5]) assert.ok(!isSorted(startOrder(4, "move", seeded(seed))));
});

test("분류하기: 분개 문제는 차변과 대변이 회계 원칙에 맞는다", () => {
  const data = experiences.journal;
  const [debit] = data.slots;
  const kind = (id) => debit.options.find((option) => option.id === id).label.match(/\((.+)\)/)[1];
  const name = (id) => debit.options.find((option) => option.id === id).label.split(" ")[0];
  assert.equal(data.items.length, 5);
  for (const item of data.items) {
    const [d, c] = item.answer;
    assert.notEqual(d, c);
    assert.ok(checkPicks(item, [d, c]));
    assert.ok(!checkPicks(item, [c, d]));
    assert.ok(!checkPicks(item, [d, ""]));
    assert.ok(item.why.includes(name(d)) && item.why.includes(name(c)));
  }
  assert.deepEqual(
    data.items.map((item) => item.answer.map(kind)),
    [
      ["자산", "자본"],
      ["자산", "부채"],
      ["자산", "부채"],
      ["비용", "자산"],
      ["부채", "자산"],
    ],
  );
});

test("반응 실험: 힉 실험은 신호 하나인 묶음 뒤에 신호 넷인 묶음이 온다", () => {
  const data = groupData.sports.practice;
  for (const seed of [1, 2, 3, 4, 5]) {
    const trials = makeTrials(data, seeded(seed));
    assert.equal(trials.length, 16);
    // 앞 8문제는 늘 첫 번째 색, 뒤 8문제는 네 색이 두 번씩 섞여 나온다.
    assert.ok(trials.slice(0, 8).every((t) => t.condition === 0 && t.answer === data.choices[0].id));
    const many = trials.slice(8);
    assert.ok(many.every((t) => t.condition === 1));
    for (const choice of data.choices) assert.equal(many.filter((t) => t.answer === choice.id).length, 2);
    for (const t of trials) assert.equal(t.color, data.choices.find((choice) => choice.id === t.answer).color);
  }
});
test("반응 실험 결과는 맞힌 시행의 평균 시간으로 두 조건을 비교한다", () => {
  assert.deepEqual(
    summarizeReaction([
      { condition: 0, correct: true, ms: 500 },
      { condition: 0, correct: true, ms: 700 },
      { condition: 0, correct: false, ms: 9000 },
      { condition: 1, correct: true, ms: 900 },
      { condition: 1, correct: true, ms: 1100 },
    ]),
    { correct: 4, total: 5, means: [600, 1000], difference: 400 },
  );
  const none = summarizeReaction([{ condition: 0, correct: false, ms: 300 }]);
  assert.deepEqual(none.means, [null, null]);
  assert.equal(none.difference, null);
});

test("졸업 계획서는 칸마다 고를 수 있는 보기가 있다", () => {
  for (const id of ["capstone", "thesis", "showcase"]) {
    const final = finals[id];
    assert.equal(final.kind, "plan");
    assert.equal(final.prompts.length, 3);
    for (const prompt of final.prompts) assert.ok(prompt.options.length >= 2);
  }
  assert.equal(finals.artwork.kind, "artwork");
});
