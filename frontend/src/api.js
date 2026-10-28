import { cleanGame, cleanLessonGames } from "./lessonGames.js";
import { cleanLevels, cleanPicks } from "./games.js";
import { cleanYears } from "./model.js";

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
  }
}
const FAILED = "학과 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.";
async function post(path, body, signal, failed = FAILED) {
  // AbortSignal.any는 iOS 17.4 미만 Safari에 없어서 직접 묶는다.
  const controller = new AbortController();
  const cancel = () => controller.abort();
  const timer = setTimeout(cancel, 15000);
  if (signal?.aborted) cancel();
  signal?.addEventListener("abort", cancel);
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(0, failed);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(response.status, failed);
  }
  if (!response.ok)
    throw new ApiError(
      response.status,
      typeof data.detail === "string"
        ? data.detail
        : "요청을 처리하지 못했어요.",
    );
  return data;
}
const stringList = (value, message) => {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string"))
    throw new ApiError(502, message);
  return value;
};
export async function getCourseList(interests, query, offset, signal) {
  const data = await post(
    "/course_list",
    { interests, query, offset, limit: 30 },
    signal,
  );
  if (!Number.isInteger(data.total))
    throw new ApiError(502, "목록 형식이 올바르지 않아요. 다시 시도해주세요.");
  return {
    courses: stringList(
      data.course_list,
      "목록 형식이 올바르지 않아요. 다시 시도해주세요.",
    ),
    total: data.total,
  };
}
// 학교·학과 조합을 검색한다. search는 { school, course } 검색어이고, 한 번에 30개씩 받는다.
// 찾는 학과가 없으면 similarPrograms(찾는 학교의 비슷한 학과)나 similarCourses(이름이 비슷한 학과명)가 함께 온다.
export async function getProgramList(interests, search, offset, signal) {
  const data = await post(
    "/program_list",
    { interests, school: search.school, course: search.course, offset, limit: 30 },
    signal,
  );
  const text = (value) => (typeof value === "string" ? value : "");
  const programList = (value) => Array.isArray(value) && value.every((item) => text(item?.school) && text(item?.course));
  const message = "목록 형식이 올바르지 않아요. 다시 시도해주세요.";
  if (!Number.isInteger(data.total) || !programList(data.programs) || !programList(data.similar_programs))
    throw new ApiError(502, message);
  const program = (item) => ({
    school: item.school,
    course: item.course,
    category: text(item.category),
    duration: text(item.duration),
    region: text(item.region),
    partner: item.partner === true,
  });
  return {
    programs: data.programs.map(program),
    total: data.total,
    similarPrograms: data.similar_programs.map(program),
    similarCourses: stringList(data.similar_courses, message).filter(Boolean),
  };
}
// 학과를 개설한 학교 목록: [{ school, partner }]. partner는 제휴 대학 여부다.
export async function getSchoolList(course, signal) {
  const data = await post("/school_list", { course }, signal);
  if (!Array.isArray(data.school_list) || !data.school_list.every((item) => typeof item?.school === "string" && item.school))
    throw new ApiError(502, "목록 형식이 올바르지 않아요. 다시 시도해주세요.");
  return data.school_list.map((item) => ({ school: item.school, partner: item.partner === true }));
}
export async function getCurriculum(school, course, signal) {
  const data = await post("/curriculum_list", { school, course }, signal);
  return {
    curriculum: stringList(
      data.curriculum_list,
      "교육과정 형식이 올바르지 않아요. 다시 시도해주세요.",
    ),
    category: typeof data.category === "string" ? data.category : "",
    years: data.years ?? null,
    duration: typeof data.duration === "string" ? data.duration : "",
    region: typeof data.region === "string" ? data.region : "",
    games: cleanLessonGames(data.games),
    levels: cleanLevels(data.levels),
    picks: cleanPicks(data.picks),
    partner: data.partner === true,
    // 제휴 대학의 학년·학기별 편성. 제휴 대학이 아니거나 편성 데이터가 없으면 null.
    terms: cleanYears({ terms: data.terms })?.terms ?? null,
  };
}
// 과목의 연습 문제를 받는다. 문제가 없으면 404, 받은 문제의 형식이 맞지 않으면 422 오류를 낸다.
export async function getLessonGame(subject, signal) {
  const data = await post(
    "/lesson_game",
    { subject },
    signal,
    "연습 문제를 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
  );
  const game = cleanGame(data.game);
  if (!game) throw new ApiError(422, "연습 문제 형식이 올바르지 않아요.");
  return game;
}
