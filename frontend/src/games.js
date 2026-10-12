// 수업 맞춤 체험을 붙이는 과목명 규칙. 체험 내용과 채점은 experiences.js, 화면은 Templates.jsx에 있다.
import { isLessonType } from "./lessonGames.js";
import { experiences } from "./experiences.js";

// 과목명이 pattern에 맞으면 그 수업의 체험으로 experiences의 같은 id 체험을 쓴다.
export const games = [
  { id: "stroop", pattern: /심리학\s*(개론|입문|의\s*이해)|인지\s*심리|실험\s*심리/ },
  { id: "sorting", pattern: /자료\s*구조|알고리즘/ },
  { id: "journal", pattern: /회계\s*원리|회계학\s*원론|재무\s*회계|회계\s*입문|기초\s*회계/ },
].map((game) => ({ ...game, title: experiences[game.id].title }));
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
