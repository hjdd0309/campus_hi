// 수업 맞춤 미니게임의 규칙과 채점. 화면은 Games.jsx에 있다.
import { isLessonType } from "./lessonGames.js";

// 과목명이 pattern에 맞으면 그 수업의 체험으로 이 게임을 쓴다.
export const games = [
  {
    id: "stroop",
    title: "스트룹 실험",
    pattern: /심리학\s*(개론|입문|의\s*이해)|인지\s*심리|실험\s*심리/,
  },
  {
    id: "sorting",
    title: "버블 정렬 직접 해보기",
    pattern: /자료\s*구조|알고리즘/,
  },
  {
    id: "journal",
    title: "분개 연습",
    pattern: /회계\s*원리|회계학\s*원론|재무\s*회계|회계\s*입문|기초\s*회계/,
  },
];
const dedicatedFor = (subject) =>
  games.find((game) => game.pattern.test(subject))?.id || null;
// 그 과목의 체험: 전용 미니게임이 먼저, 없으면 미리 만들어 둔 연습 문제의 유형(lessonGames: 과목 → 유형), 그것도 없으면 null.
export function gameFor(subject, lessonGames = {}) {
  const type = Object.hasOwn(lessonGames, subject) ? lessonGames[subject] : null;
  return dedicatedFor(subject) || (isLessonType(type) ? type : null);
}
// 저장된 게임 결과가 지금도 있는 게임의 것인지.
export const isGame = (id) => games.some((game) => game.id === id) || isLessonType(id);

// 체험에 쓸 과목을 count개 고른다. 전용 미니게임이 있는 과목, 유형이 서로 다른 연습 문제, 남은 연습 문제, 나머지 과목 순서로 고른다.
export function pickLessons(curriculum, count = 2, lessonGames = {}) {
  const picked = [];
  const add = (accept) => {
    for (const subject of curriculum) {
      if (picked.length >= count) return;
      if (picked.some((item) => item.subject === subject)) continue;
      const game = gameFor(subject, lessonGames);
      if (accept(subject, game)) picked.push({ subject, game });
    }
  };
  const fresh = (game) => !!game && !picked.some((item) => item.game === game);
  add((subject, game) => !!dedicatedFor(subject) && fresh(game));
  add((subject, game) => fresh(game));
  add((subject, game) => !!game && !dedicatedFor(subject));
  add(() => true);
  return picked;
}

function shuffle(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ---- 스트룹 실험: 글자의 뜻이 아니라 글자의 색을 고른다.
export const stroopColors = [
  { id: "red", name: "빨강", hex: "#ff6b61" },
  { id: "blue", name: "파랑", hex: "#5aa9ff" },
  { id: "green", name: "초록", hex: "#44d68a" },
  { id: "yellow", name: "노랑", hex: "#ffd84d" },
];
export function makeStroopTrials(random = Math.random) {
  const trials = [];
  for (let i = 0; i < 8; i++) {
    const ink = stroopColors[i % 4];
    const others = stroopColors.filter((color) => color.id !== ink.id);
    trials.push({ word: ink.id, ink: ink.id });
    trials.push({
      word: others[Math.floor(random() * others.length)].id,
      ink: ink.id,
    });
  }
  return shuffle(trials, random);
}
// responses: [{ congruent, correct, ms }]. 평균 반응 시간은 맞힌 시행만으로 구한다.
export function summarizeStroop(responses) {
  const mean = (congruent) => {
    const times = responses
      .filter((r) => r.congruent === congruent && r.correct)
      .map((r) => r.ms);
    return times.length
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      : null;
  };
  const congruentMs = mean(true);
  const incongruentMs = mean(false);
  return {
    correct: responses.filter((r) => r.correct).length,
    total: responses.length,
    congruentMs,
    incongruentMs,
    interferenceMs:
      congruentMs === null || incongruentMs === null
        ? null
        : incongruentMs - congruentMs,
  };
}

// ---- 버블 정렬: 이웃한 두 카드만 바꿔 오름차순으로 만든다.
// 이웃 교환만으로 정렬할 때 필요한 최소 교환 횟수는 순서가 뒤집힌 쌍(역순 쌍)의 수와 같다.
export function inversions(cards) {
  let count = 0;
  for (let i = 0; i < cards.length; i++)
    for (let j = i + 1; j < cards.length; j++)
      if (cards[i] > cards[j]) count++;
  return count;
}
export const isSorted = (cards) => inversions(cards) === 0;
export function swapAdjacent(cards, index) {
  if (index < 0 || index >= cards.length - 1) return cards;
  const next = [...cards];
  [next[index], next[index + 1]] = [next[index + 1], next[index]];
  return next;
}
export function makeDeck(random = Math.random) {
  const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random).slice(0, 6);
  // 너무 쉬운 배치는 다시 섞는다. 완전히 뒤집으면 역순 쌍이 15개라 반드시 끝난다.
  for (let attempt = 0; attempt < 50; attempt++) {
    const deck = shuffle(numbers, random);
    if (inversions(deck) >= 6) return deck;
  }
  return [...numbers].sort((a, b) => b - a);
}

// ---- 분개: 거래를 차변과 대변 계정으로 나눈다.
export const accounts = [
  { id: "cash", name: "현금", kind: "자산" },
  { id: "goods", name: "상품", kind: "자산" },
  { id: "equipment", name: "비품", kind: "자산" },
  { id: "payable", name: "외상매입금", kind: "부채" },
  { id: "loan", name: "차입금", kind: "부채" },
  { id: "capital", name: "자본금", kind: "자본" },
  { id: "rent", name: "임차료", kind: "비용" },
];
export const transactions = [
  {
    text: "현금 1,000,000원을 출자해 가게를 열었다.",
    debit: "cash",
    credit: "capital",
    why: "현금(자산)이 늘었으니 차변, 자본금(자본)이 늘었으니 대변이에요.",
  },
  {
    text: "상품 300,000원어치를 외상으로 사 왔다.",
    debit: "goods",
    credit: "payable",
    why: "상품(자산)이 늘었으니 차변, 갚아야 할 외상매입금(부채)이 늘었으니 대변이에요.",
  },
  {
    text: "은행에서 500,000원을 빌려 현금으로 받았다.",
    debit: "cash",
    credit: "loan",
    why: "현금(자산)이 늘었으니 차변, 차입금(부채)이 늘었으니 대변이에요.",
  },
  {
    text: "이번 달 가게 임차료 100,000원을 현금으로 냈다.",
    debit: "rent",
    credit: "cash",
    why: "임차료(비용)가 생겼으니 차변, 현금(자산)이 줄었으니 대변이에요.",
  },
  {
    text: "외상으로 산 상품 대금 300,000원을 현금으로 갚았다.",
    debit: "payable",
    credit: "cash",
    why: "외상매입금(부채)이 줄었으니 차변, 현금(자산)이 줄었으니 대변이에요.",
  },
];
export const checkEntry = (transaction, debit, credit) =>
  transaction.debit === debit && transaction.credit === credit;
