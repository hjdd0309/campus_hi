import { departments } from "./model.js";

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
  }
}
async function post(path, body, signal) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(
      0,
      "학과 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      response.status,
      "학과 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
    );
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
const splitList = (value) => {
  if (typeof value !== "string")
    throw new ApiError(502, "목록 형식이 올바르지 않아요. 다시 시도해주세요.");
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
};
export async function getCourseList(interests, signal) {
  const data = await post("/course_list", { interests }, signal);
  return splitList(data.course_list).filter((course) =>
    departments.some((department) => department.name === course),
  );
}
export async function getSchoolList(course, signal) {
  const data = await post("/school_list", { course }, signal);
  return splitList(data.school_list);
}
export async function getCurriculumList(school, course, signal) {
  const data = await post("/curriculum_list", { school, course }, signal);
  if (
    !Array.isArray(data.curriculum_list) ||
    !data.curriculum_list.every((item) => typeof item === "string")
  )
    throw new ApiError(
      502,
      "교육과정 형식이 올바르지 않아요. 다시 시도해주세요.",
    );
  return data.curriculum_list;
}
