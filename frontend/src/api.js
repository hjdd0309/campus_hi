export class ApiError extends Error {
  constructor(status, detail) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
  }
}
async function post(path, body, signal) {
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
    throw new ApiError(
      0,
      "학과 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
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
export async function getSchoolList(course, signal) {
  const data = await post("/school_list", { course }, signal);
  return stringList(
    data.school_list,
    "목록 형식이 올바르지 않아요. 다시 시도해주세요.",
  );
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
  };
}
