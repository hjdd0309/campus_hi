// 미리 만들어 둔 유형별 연습 문제의 형식 검사와 채점. 화면은 TypedGames.jsx에 있다.
// 문제는 backend/lesson_games.py로 넣고, 형식과 상한은 backend/SOURCE.md에 있다(여기 검사와 같아야 한다).

export const BLANK = "___";

const text = (value, max) =>
  typeof value === "string" && value.trim() && [...value].length <= max ? value : null;
const rows = (value, min, max) =>
  Array.isArray(value) &&
  value.length >= min &&
  value.length <= max &&
  value.every((row) => row && typeof row === "object")
    ? value
    : null;
const distinct = (values) => new Set(values).size === values.length;
const all = (items) => (items && items.every(Boolean) ? items : null);

function cleanBlank(raw) {
  const items = all(
    rows(raw.items, 3, 3)?.map((item) => {
      const sentence = text(item.text, 60);
      const choices = Array.isArray(item.choices) && item.choices.length === 3 ? item.choices : [];
      return sentence &&
        sentence.split(BLANK).length === 2 &&
        sentence.split("_").length === BLANK.length + 1 &&
        choices.length === 3 &&
        choices.every((choice) => text(choice, 12)) &&
        distinct(choices) &&
        [0, 1, 2].includes(item.answer) &&
        text(item.explanation, 80)
        ? { text: sentence, choices, answer: item.answer, explanation: item.explanation }
        : null;
    }),
  );
  return items && { items };
}

function cleanOx(raw) {
  const items = all(
    rows(raw.items, 5, 5)?.map((item) =>
      text(item.text, 60) && typeof item.answer === "boolean" && text(item.explanation, 80)
        ? { text: item.text, answer: item.answer, explanation: item.explanation }
        : null,
    ),
  );
  return items && new Set(items.map((item) => item.answer)).size === 2 ? { items } : null;
}

function cleanOrder(raw) {
  const items = all(
    rows(raw.items, 4, 5)?.map((item) => (text(item.text, 24) ? { text: item.text } : null)),
  );
  return items && text(raw.prompt, 40) && distinct(items.map((item) => item.text))
    ? { prompt: raw.prompt, items }
    : null;
}

function cleanMatch(raw) {
  const items = all(
    rows(raw.items, 4, 6)?.map((item) =>
      text(item.left, 10) && text(item.right, 22) ? { left: item.left, right: item.right } : null,
    ),
  );
  return items &&
    text(raw.prompt, 40) &&
    distinct(items.map((item) => item.left)) &&
    distinct(items.map((item) => item.right))
    ? { prompt: raw.prompt, items }
    : null;
}

function cleanSort(raw) {
  const categories =
    Array.isArray(raw.categories) &&
    raw.categories.length >= 2 &&
    raw.categories.length <= 3 &&
    raw.categories.every((category) => text(category, 8)) &&
    distinct(raw.categories)
      ? raw.categories
      : null;
  const items =
    categories &&
    all(
      rows(raw.items, 6, 8)?.map((item) =>
        text(item.text, 14) && Number.isInteger(item.category) && item.category >= 0 && item.category < categories.length
          ? { text: item.text, category: item.category }
          : null,
      ),
    );
  return items &&
    text(raw.prompt, 40) &&
    distinct(items.map((item) => item.text)) &&
    categories.every((_, number) => items.filter((item) => item.category === number).length >= 2)
    ? { prompt: raw.prompt, categories, items }
    : null;
}

// 유형을 추가하려면 여기에 형식 검사를 넣고, TypedGames.jsx의 typedComponents에 같은 이름으로 화면을 등록한다.
export const lessonTypes = {
  blank: { title: "빈칸 채우기", clean: cleanBlank },
  ox: { title: "OX 퀴즈", clean: cleanOx },
  order: { title: "순서 맞추기", clean: cleanOrder },
  match: { title: "짝 맞추기", clean: cleanMatch },
  sort: { title: "분류하기", clean: cleanSort },
};
export const isLessonType = (type) => typeof type === "string" && Object.hasOwn(lessonTypes, type);

// 서버에서 받은 문제를 검사한다. 형식이 맞지 않으면 null이고, 화면은 기본 체험으로 넘어간다.
export function cleanGame(raw) {
  if (!raw || typeof raw !== "object" || !isLessonType(raw.type)) return null;
  const body = lessonTypes[raw.type].clean(raw);
  return body && text(raw.title, 20) && text(raw.explanation, 120)
    ? { type: raw.type, title: raw.title, ...body, explanation: raw.explanation }
    : null;
}

// 과목 → 유형 목록(서버의 games)에서 형식이 맞는 것만 남긴다.
export function cleanLessonGames(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, type]) => isLessonType(type)));
}

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ---- 하나씩 고르는 유형(빈칸 채우기, OX, 분류하기): 문항마다 보기 중 하나가 정답이다.
export function questionsOf(game, random = Math.random) {
  if (game.type === "blank")
    return game.items.map((item) => ({
      text: item.text,
      options: shuffle(
        item.choices.map((label, number) => ({ label, correct: number === item.answer })),
        random,
      ),
      explanation: item.explanation,
    }));
  if (game.type === "ox")
    return game.items.map((item) => ({
      text: item.text,
      options: [
        { label: "O", correct: item.answer },
        { label: "X", correct: !item.answer },
      ],
      explanation: item.explanation,
    }));
  if (game.type === "sort")
    return shuffle(game.items, random).map((item) => ({
      text: item.text,
      options: game.categories.map((label, number) => ({ label, correct: number === item.category })),
      explanation: "",
    }));
  return [];
}
export const answerOf = (question) => question.options.find((option) => option.correct).label;
// 받침이 있는 한글로 끝나면 "이에요", 그 밖에는 "예요"를 붙인다.
export function isAnswer(label) {
  const code = label.trim().charCodeAt(label.trim().length - 1);
  const closed = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
  return `‘${label}’${closed ? "이에요" : "예요"}`;
}
// picks: 문항마다 고른 보기의 번호.
export const countCorrect = (questions, picks) =>
  questions.filter((question, i) => question.options[picks[i]]?.correct).length;

// ---- 순서 맞추기: order는 지금 놓인 순서대로 적은 단계 번호. 번호가 곧 올바른 자리다.
export function scramble(size, random = Math.random) {
  const sorted = Array.from({ length: size }, (_, i) => i);
  for (let attempt = 0; attempt < 20; attempt++) {
    const order = shuffle(sorted, random);
    if (rightPlaces(order) < size) return order;
  }
  return sorted.reverse();
}
export const rightPlaces = (order) => order.filter((step, i) => step === i).length;
export function moveStep(order, index, delta) {
  const target = index + delta;
  if (index < 0 || index >= order.length || target < 0 || target >= order.length) return order;
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
