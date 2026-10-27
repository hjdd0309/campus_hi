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

// 과목을 보통 듣는 학년 범위(과목 → [시작, 끝], 1~4학년). 형식이 맞는 것만 남긴다.
export function cleanLevels(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const valid = (level) =>
    Array.isArray(level) && level.length === 2 && level.every((n) => Number.isInteger(n) && n >= 1 && n <= 4) && level[0] <= level[1];
  return Object.fromEntries(Object.entries(value).filter(([, level]) => valid(level)));
}

// 사람이 정해 둔 학년별 과목 후보(학년 → [과목, ...]). 형식이 맞는 것만 남긴다.
export function cleanPicks(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([year, subjects]) => /^[1-6]$/.test(year) && Array.isArray(subjects))
      .map(([year, subjects]) => [year, subjects.filter((subject) => typeof subject === "string" && subject)])
      .filter(([, subjects]) => subjects.length),
  );
}

// 그 학년이 과목의 학년 범위에서 얼마나 먼지. 5·6학년은 4학년으로 보고, 범위를 모르면 1.5로 본다.
function distance(year, level) {
  if (!level) return 1.5;
  const y = Math.min(year, 4);
  return Math.max(0, level[0] - y, y - level[1]);
}

// 학과군 실습 학년에 보여줄 과목. 교과목 중 이름이 patterns에 맞고 이론 수업에 쓰지 않은(used) 과목에서,
// 그 학년에 보통 듣는 과목, 범위가 조금 어긋나거나 모르는 과목(앞쪽 패턴부터), 크게 어긋나는 과목 순서로 고른다.
// 학년 범위가 없는 과목(알고리즘분석 등)도 패턴이 앞이면 범위가 한 학년 어긋나는 과목보다 먼저 나온다. 없으면 null.
export function pickPracticeSubject(curriculum, patterns = [], year = 3, levels = {}, used = new Set()) {
  let best = null;
  curriculum.forEach((subject, index) => {
    if (used.has(subject)) return;
    const pattern = patterns.findIndex((re) => re.test(subject));
    if (pattern < 0) return;
    const gap = distance(year, Object.hasOwn(levels, subject) ? levels[subject] : null);
    const rank = [gap === 0 ? 0 : gap < 2 ? 1 : 2, pattern, gap, index];
    if (!best || before(rank, best.rank)) best = { subject, rank };
  });
  return best?.subject ?? null;
}

// 순위 [a, b, ...]가 앞 항목부터 견주어 더 작은지.
function before(rank, other) {
  const i = rank.findIndex((value, at) => value !== other[at]);
  return i >= 0 && rank[i] < other[i];
}

// 이론 수업 학년(years)마다 과목을 하나씩 고른다. 사람이 정해 둔 과목(picks)이 교과목에 있으면 그 과목을 쓰고,
// 없으면 연습 문제가 있는 과목, 그 학년에 보통 듣는 과목(levels), 앞 학년과 유형이 다른 연습 문제 순서로 고른다.
// 나머지가 같으면 교과목 목록의 순서를 따르므로 같은 학과는 언제나 같은 과목이 나온다.
export function pickLessons(curriculum, years = [1, 2], lessonGames = {}, levels = {}, picks = {}) {
  const picked = [];
  for (const year of years) {
    const chosen = (picks[year] || []).find((subject) => curriculum.includes(subject) && !picked.some((item) => item.subject === subject));
    if (chosen) {
      picked.push({ subject: chosen, game: gameFor(chosen, lessonGames) });
      continue;
    }
    let best = null;
    curriculum.forEach((subject, index) => {
      if (picked.some((item) => item.subject === subject)) return;
      const game = gameFor(subject, lessonGames);
      const level = Object.hasOwn(levels, subject) ? levels[subject] : null;
      const rank = [game ? 0 : 1, distance(year, level), game && picked.some((item) => item.game === game) ? 1 : 0, index];
      if (!best || before(rank, best.rank)) best = { subject, game, rank };
    });
    if (!best) break;
    picked.push({ subject: best.subject, game: best.game });
  }
  return picked;
}
