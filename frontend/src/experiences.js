// 체험 틀(A·B·C·D·F)의 데이터 형식 검사와 채점, 그리고 지금 쓰는 체험 데이터. 화면은 Templates.jsx에 있다.
// 틀(코드)은 그대로 두고 데이터만 더해 체험을 늘린다(개발기획서_체험구조.md 2-3).
//   A 문지르기·칠하기 / B 순서 맞추기 / C 분류하기 / D 반응 실험 / F 계획 조립 (E 장면에서 찾기는 그림이 준비된 뒤에 만든다)
import { scramble, shuffle } from "./lessonGames.js";

const text = (value, max) =>
  typeof value === "string" && value.trim() && [...value].length <= max ? value : null;
const list = (value, min, max) =>
  Array.isArray(value) && value.length >= min && value.length <= max ? value : null;
const distinct = (values) => new Set(values).size === values.length;
const all = (items) => (items && items.every(Boolean) ? items : null);

// 장면 그림이 있는 틀(A)이 쓸 수 있는 그림. 그림 파일은 Templates.jsx가 이 이름으로 연결한다.
export const SCENES = ["sand", "paint"];
const PARTICLES = ["dust", "paint"];

function cleanRub(raw) {
  const phases = all(
    list(raw.phases, 1, 3)?.map((phase) =>
      text(phase?.label, 10) && SCENES.includes(phase.scene) && PARTICLES.includes(phase.particles)
        ? { label: phase.label, scene: phase.scene, particles: phase.particles }
        : null,
    ),
  );
  return phases && { phases };
}

// 순서 맞추기. items는 올바른 순서대로 적는다. swap이 "adjacent"면 이웃한 두 카드만 바꿀 수 있다(버블 정렬).
function cleanOrder(raw) {
  const adjacent = raw.swap === "adjacent";
  const items = all(list(raw.items, 4, 6)?.map((item) => text(item, adjacent ? 4 : 24)));
  return items &&
    distinct(items) &&
    ["adjacent", "move"].includes(raw.swap) &&
    text(raw.prompt, 80) &&
    (raw.explanation === undefined || text(raw.explanation, 160))
    ? { swap: raw.swap, prompt: raw.prompt, items, explanation: raw.explanation || "" }
    : null;
}

// 분류하기. 카드마다 칸(slot)별로 알맞은 보기를 고른다. 칸이 하나면 분류, 둘이면 분개처럼 짝을 고른다.
function cleanClassify(raw) {
  const slots = all(
    list(raw.slots, 1, 2)?.map((slot) => {
      const options = all(
        list(slot?.options, 2, 8)?.map((option) =>
          text(option?.id, 20) && text(option.label, 16) ? { id: option.id, label: option.label } : null,
        ),
      );
      return text(slot?.label, 10) && options && distinct(options.map((o) => o.id)) ? { label: slot.label, options } : null;
    }),
  );
  const items =
    slots &&
    all(
      list(raw.items, 3, 8)?.map((item) =>
        text(item?.text, 60) &&
        text(item.why, 100) &&
        Array.isArray(item.answer) &&
        item.answer.length === slots.length &&
        item.answer.every((id, i) => slots[i].options.some((option) => option.id === id))
          ? { text: item.text, answer: item.answer, why: item.why }
          : null,
      ),
    );
  return items &&
    text(raw.prompt, 120) &&
    text(raw.noun, 6) &&
    text(raw.unit, 2) &&
    text(raw.retry, 60) &&
    text(raw.explanation, 120)
    ? { prompt: raw.prompt, slots, items, noun: raw.noun, unit: raw.unit, retry: raw.retry, explanation: raw.explanation }
    : null;
}

// 반응 실험. 자극마다 알맞은 보기를 빨리 고르고, 두 조건의 평균 반응 시간을 비교한다.
// 자극은 만드는 방식(generator)으로 정한다. 지금은 힉의 법칙(신호가 하나일 때와 여럿일 때)뿐이다.
const GENERATORS = ["hick"];
function cleanReaction(raw) {
  const choices = all(
    list(raw.choices, 2, 4)?.map((choice) =>
      text(choice?.id, 20) && text(choice.label, 4) && /^#[0-9a-f]{6}$/i.test(choice.color)
        ? { id: choice.id, label: choice.label, color: choice.color }
        : null,
    ),
  );
  const conditions = all(list(raw.conditions, 2, 2)?.map((label) => text(label, 14)));
  return choices &&
    distinct(choices.map((c) => c.id)) &&
    conditions &&
    GENERATORS.includes(raw.generator) &&
    Number.isInteger(raw.pairs) &&
    raw.pairs >= 4 &&
    raw.pairs <= 12 &&
    text(raw.prompt, 120) &&
    text(raw.notice, 60) &&
    text(raw.effect, 160) &&
    text(raw.noEffect, 200) &&
    text(raw.tooFew, 80) &&
    text(raw.footnote, 100)
    ? {
        choices,
        conditions,
        generator: raw.generator,
        pairs: raw.pairs,
        prompt: raw.prompt,
        notice: raw.notice,
        effect: raw.effect,
        noEffect: raw.noEffect,
        tooFew: raw.tooFew,
        footnote: raw.footnote,
      }
    : null;
}

// 계획 조립. 계획서의 세 칸마다 고를 수 있는 보기 카드가 있고, 고른 뒤 직접 고쳐 쓸 수 있다.
function cleanPlan(raw) {
  const prompts = all(
    list(raw.prompts, 3, 3)?.map((prompt) => {
      const options = all(list(prompt?.options, 2, 4)?.map((option) => text(option, 30)));
      return text(prompt?.label, 20) && text(prompt.placeholder, 60) && options && distinct(options)
        ? { label: prompt.label, placeholder: prompt.placeholder, options }
        : null;
    }),
  );
  return prompts && text(raw.intro, 140) ? { intro: raw.intro, prompts } : null;
}

export const templates = {
  A: { title: "문지르기", clean: cleanRub },
  B: { title: "순서 맞추기", clean: cleanOrder },
  C: { title: "분류하기", clean: cleanClassify },
  D: { title: "반응 실험", clean: cleanReaction },
  F: { title: "계획 조립", clean: cleanPlan },
};

// 체험 데이터를 검사한다. 형식이 맞지 않으면 null이다.
// learn(알아두기)은 수업의 "배우기"와 "기록" 단계에 보여주는 2~3줄 설명으로, 없어도 된다.
export function cleanExperience(raw) {
  if (!raw || typeof raw !== "object" || !Object.hasOwn(templates, raw.template)) return null;
  const body = templates[raw.template].clean(raw);
  const learn = raw.learn === undefined || raw.learn === "" ? "" : text(raw.learn, 120);
  return body && text(raw.title, 20) && text(raw.task, 60) && learn !== null
    ? { template: raw.template, title: raw.title, task: raw.task, learn, ...body }
    : null;
}

// ---- B 순서 맞추기: 순서는 items의 번호 배열이고, 제자리면 order[i] === i다.
// 이웃 교환만으로 정렬할 때 필요한 최소 교환 횟수는 순서가 뒤집힌 쌍(역순 쌍)의 수와 같다.
export function inversions(order) {
  let count = 0;
  for (let i = 0; i < order.length; i++)
    for (let j = i + 1; j < order.length; j++) if (order[i] > order[j]) count++;
  return count;
}
export const isSorted = (order) => inversions(order) === 0;
export function swapAdjacent(order, index) {
  if (index < 0 || index >= order.length - 1) return order;
  const next = [...order];
  [next[index], next[index + 1]] = [next[index + 1], next[index]];
  return next;
}
// 섞은 시작 순서. 이웃 교환일 때는 너무 쉬운 배치를 피해 역순 쌍이 최대의 40% 이상이 되게 한다.
export function startOrder(size, swap, random = Math.random) {
  if (swap !== "adjacent") return scramble(size, random);
  const least = Math.ceil((size * (size - 1)) / 2 * 0.4);
  const ordered = Array.from({ length: size }, (_, i) => i);
  for (let attempt = 0; attempt < 50; attempt++) {
    const order = shuffle(ordered, random);
    if (inversions(order) >= least) return order;
  }
  return ordered.reverse();
}

// ---- C 분류하기
export const checkPicks = (item, picks) => item.answer.every((id, i) => picks[i] === id);

// ---- D 반응 실험
// 힉의 법칙: 앞의 pairs문제는 늘 첫 번째 보기의 신호(condition 0 = 신호 하나),
// 뒤의 pairs문제는 모든 보기 중 하나(condition 1 = 신호 여럿)가 나온다. 두 묶음을 섞지 않는다.
export function makeTrials(data, random = Math.random) {
  const signal = (choice, condition) => ({ text: "●", color: choice.color, answer: choice.id, condition });
  const single = Array.from({ length: data.pairs }, () => signal(data.choices[0], 0));
  const many = shuffle(
    Array.from({ length: data.pairs }, (_, i) => signal(data.choices[i % data.choices.length], 1)),
    random,
  );
  return [...single, ...many];
}
// responses: [{ condition, correct, ms }]. 평균 반응 시간은 맞힌 시행만으로 구한다.
export function summarizeReaction(responses) {
  const mean = (condition) => {
    const times = responses.filter((r) => r.condition === condition && r.correct).map((r) => r.ms);
    return times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
  };
  const first = mean(0);
  const second = mean(1);
  return {
    correct: responses.filter((r) => r.correct).length,
    total: responses.length,
    means: [first, second],
    difference: first === null || second === null ? null : second - first,
  };
}

// ---- 지금 쓰는 체험 데이터. 내용(실험 설명, 회계 처리 등)은 사실과 맞아야 하므로 고칠 때 근거를 확인한다.
const ACCOUNTS = [
  { id: "cash", label: "현금 (자산)" },
  { id: "goods", label: "상품 (자산)" },
  { id: "equipment", label: "비품 (자산)" },
  { id: "payable", label: "외상매입금 (부채)" },
  { id: "loan", label: "차입금 (부채)" },
  { id: "capital", label: "자본금 (자본)" },
  { id: "rent", label: "임차료 (비용)" },
];

const raw = {
  // 학과군 실습의 바탕이 되는 체험(groupData.js의 base). 학과군 데이터가 learn 등을 덧붙인다.
  sorting: {
    template: "B",
    title: "버블 정렬 직접 해보기",
    task: "이웃한 두 카드만 바꾸면서 카드를 작은 수부터 차례로 놓아요.",
    swap: "adjacent",
    prompt: "카드를 작은 수부터 차례로 놓아요. 단, 이웃한 두 카드만 서로 바꿀 수 있어요. 카드 사이의 ⇄ 버튼을 눌러 바꿔요.",
    items: ["1", "3", "4", "6", "8", "9"],
    explanation:
      "이웃끼리만 바꿀 수 있을 때 필요한 최소 횟수는 순서가 뒤집힌 쌍의 개수와 같아요. 버블 정렬이 바로 이 방식이라, 카드가 많아질수록 교환 횟수가 빠르게 늘어요. 그래서 더 빠른 정렬 방법을 배우게 돼요.",
  },
  journal: {
    template: "C",
    title: "분개 연습",
    task: "거래마다 무엇이 늘고 줄었는지 따져 차변과 대변으로 나눠 적어요.",
    prompt:
      "거래를 보고 차변과 대변에 올 계정을 골라요. 자산이 늘거나 비용이 생기면 차변, 부채·자본이 늘거나 자산이 줄면 대변이에요. 부채가 줄면 차변이에요.",
    slots: [
      { label: "차변 (왼쪽)", options: ACCOUNTS },
      { label: "대변 (오른쪽)", options: ACCOUNTS },
    ],
    items: [
      {
        text: "현금 1,000,000원을 출자해 가게를 열었다.",
        answer: ["cash", "capital"],
        why: "현금(자산)이 늘었으니 차변, 자본금(자본)이 늘었으니 대변이에요.",
      },
      {
        text: "상품 300,000원어치를 외상으로 사 왔다.",
        answer: ["goods", "payable"],
        why: "상품(자산)이 늘었으니 차변, 갚아야 할 외상매입금(부채)이 늘었으니 대변이에요.",
      },
      {
        text: "은행에서 500,000원을 빌려 현금으로 받았다.",
        answer: ["cash", "loan"],
        why: "현금(자산)이 늘었으니 차변, 차입금(부채)이 늘었으니 대변이에요.",
      },
      {
        text: "이번 달 가게 임차료 100,000원을 현금으로 냈다.",
        answer: ["rent", "cash"],
        why: "임차료(비용)가 생겼으니 차변, 현금(자산)이 줄었으니 대변이에요.",
      },
      {
        text: "외상으로 산 상품 대금 300,000원을 현금으로 갚았다.",
        answer: ["payable", "cash"],
        why: "외상매입금(부채)이 줄었으니 차변, 현금(자산)이 줄었으니 대변이에요.",
      },
    ],
    noun: "거래",
    unit: "건",
    retry: "아직 아니에요. 무엇이 늘고 무엇이 줄었는지 다시 생각해 보세요.",
    explanation: "회계는 모든 거래를 이렇게 차변과 대변에 같은 금액으로 나누어 적는 데서 시작해요.",
  },
  // 졸업 과제: model.js의 finals가 학과에 맞는 것을 고른다.
  artwork: {
    template: "A",
    title: "졸업작품",
    task: "작품을 문질러 사포질한 뒤 색을 칠해 졸업작품을 완성해요.",
    phases: [
      { label: "사포질하기", scene: "sand", particles: "dust" },
      { label: "도색하기", scene: "paint", particles: "paint" },
    ],
  },
  capstone: {
    template: "F",
    title: "캡스톤 디자인",
    task: "해결할 문제와 만들 방법을 골라 캡스톤 디자인 계획서를 완성해요.",
    intro:
      "공학 계열은 마지막 학년에 팀을 이뤄 실제 문제를 해결하는 결과물을 만드는 캡스톤 디자인을 하는 경우가 많아요. 나만의 계획서를 써봐요.",
    prompts: [
      {
        label: "해결하고 싶은 문제",
        placeholder: "주변에서 불편하다고 느낀 문제를 하나 골라 적어주세요.",
        options: ["등하굣길에서 겪는 불편", "학교 안에서 자주 생기는 문제", "가족이 집에서 겪는 불편"],
      },
      {
        label: "누구에게, 왜 필요한가요?",
        placeholder: "이 문제가 해결되면 누가 어떤 점에서 좋아질까요?",
        options: ["매일 같은 불편을 겪는 친구들", "몸이 불편한 사람들", "우리 동네 어르신들"],
      },
      {
        label: "어떻게 만들어 볼 건가요?",
        placeholder: "무엇을 만들지, 앞 학년에서 체험한 내용을 어떻게 쓸지 적어주세요.",
        options: ["앞 학년에서 배운 원리로 시제품을 만든다", "앱이나 프로그램으로 만든다", "설계도를 그리고 모형으로 확인한다"],
      },
    ],
  },
  thesis: {
    template: "F",
    title: "졸업 연구",
    task: "궁금한 질문과 알아볼 방법을 골라 졸업 연구 계획서를 완성해요.",
    intro:
      "많은 학과가 마지막 학년에 스스로 정한 질문을 탐구하는 졸업 논문이나 졸업 연구로 배움을 마무리해요. 나만의 연구 계획서를 써봐요.",
    prompts: [
      {
        label: "탐구하고 싶은 질문",
        placeholder: "이 전공을 체험하며 가장 궁금해진 점을 질문으로 적어주세요.",
        options: ["체험하며 가장 궁금해진 점", "이 전공이 사회에서 쓰이는 방식", "앞 학년 수업에서 더 알고 싶은 점"],
      },
      {
        label: "왜 궁금한가요?",
        placeholder: "이 질문이 나에게, 또는 다른 사람에게 왜 중요한가요?",
        options: ["나의 진로를 정하는 데 도움이 돼서", "주변 사람들의 문제와 이어져 있어서", "아직 잘 몰랐던 내용이라서"],
      },
      {
        label: "어떻게 알아볼 건가요?",
        placeholder: "자료 조사, 관찰, 실험, 인터뷰 중 어떤 방법으로 답을 찾을지 적어주세요.",
        options: ["자료 조사", "관찰", "실험", "인터뷰"],
      },
    ],
  },
  showcase: {
    template: "F",
    title: "졸업 발표",
    task: "보여줄 무대와 준비 방법을 골라 졸업 발표 계획서를 완성해요.",
    intro:
      "예술·체육 계열은 졸업 공연, 연주회, 발표회처럼 사람들 앞에서 배움을 보여주며 마무리하는 경우가 많아요. 나만의 발표 계획서를 써봐요.",
    prompts: [
      {
        label: "무대에 올리고 싶은 것",
        placeholder: "어떤 공연, 연주, 경기, 작품을 보여주고 싶은지 적어주세요.",
        options: ["공연", "연주", "경기", "작품 전시"],
      },
      {
        label: "무엇을 전하고 싶나요?",
        placeholder: "보는 사람이 무엇을 느끼거나 알게 되면 좋을까요?",
        options: ["이 전공에서 느낀 즐거움", "연습으로 달라진 나의 모습", "관객이 함께 느낄 감정"],
      },
      {
        label: "어떻게 준비할 건가요?",
        placeholder: "무엇을 연습하고 누구와 함께 준비할지 적어주세요.",
        options: ["매일 조금씩 혼자 연습한다", "친구들과 팀을 이뤄 준비한다", "피드백을 받으며 다듬는다"],
      },
    ],
  },
};

// 검사를 통과한 데이터만 쓴다. 형식이 틀린 데이터는 null이 되고 테스트에서 걸린다.
export const experiences = Object.fromEntries(Object.entries(raw).map(([id, data]) => [id, cleanExperience(data)]));
