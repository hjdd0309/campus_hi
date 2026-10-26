// 이론 수업에 쓸 과목 고르기와 저장된 체험 결과 확인. 실습·졸업 과제는 학과군 데이터(groups.js)가 정한다.
import { isLessonType } from "./lessonGames.js";
import { GROUPS } from "./groups.js";

// 그 과목의 연습 문제 유형(lessonGames: 과목 → 유형). 없으면 null.
export function gameFor(subject, lessonGames = {}) {
  const type = Object.hasOwn(lessonGames, subject) ? lessonGames[subject] : null;
  return isLessonType(type) ? type : null;
}
// 저장된 체험 결과가 지금도 있는 체험의 것인지: 연습 문제 유형이거나 학과군 실습(group:학과군).
export const isGame = (id) =>
  isLessonType(id) || (typeof id === "string" && GROUPS.some((group) => id === `group:${group.id}`));

// 이론 수업에 쓸 과목을 count개 고른다. 유형이 서로 다른 연습 문제가 있는 과목, 남은 연습 문제, 나머지 과목 순서로,
// 교과목 목록의 순서를 따라 고르므로 같은 학과는 언제나 같은 과목이 나온다.
export function pickLessons(curriculum, count = 2, lessonGames = {}) {
  const picked = [];
  const add = (accept) => {
    for (const subject of curriculum) {
      if (picked.length >= count) return;
      if (picked.some((item) => item.subject === subject)) continue;
      const game = gameFor(subject, lessonGames);
      if (accept(game)) picked.push({ subject, game });
    }
  };
  add((game) => !!game && !picked.some((item) => item.game === game));
  add((game) => !!game);
  add(() => true);
  return picked;
}
