import test from "node:test";
import assert from "node:assert/strict";
import {
  getCourseList,
  getSchoolList,
  getCurriculum,
  ApiError,
} from "./api.js";

test("요청 필드와 응답 형식을 따른다", async (t) => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push([url, JSON.parse(options.body)]);
    const data = url.endsWith("course_list")
      ? { course_list: ["산업디자인학과", "PEP(정치학,경제학,철학)연계전공"], total: 41 }
      : url.endsWith("school_list")
        ? { school_list: ["경희대학교"] }
        : { curriculum_list: ["기초설계", "제품설계"], category: "예체능", duration: "4년" };
    return new Response(JSON.stringify(data), { status: 200 });
  });
  assert.deepEqual(await getCourseList("디자인", "산업", 30), {
    courses: ["산업디자인학과", "PEP(정치학,경제학,철학)연계전공"],
    total: 41,
  });
  assert.deepEqual(await getSchoolList("산업디자인학과"), ["경희대학교"]);
  assert.deepEqual(await getCurriculum("경희대학교", "산업디자인학과"), {
    curriculum: ["기초설계", "제품설계"],
    category: "예체능",
    years: null,
  });
  assert.deepEqual(requests, [
    ["/api/course_list", { interests: "디자인", query: "산업", offset: 30, limit: 30 }],
    ["/api/school_list", { course: "산업디자인학과" }],
    [
      "/api/curriculum_list",
      { school: "경희대학교", course: "산업디자인학과" },
    ],
  ]);
});
test("서버 오류와 잘못된 응답은 가짜 목록으로 대체하지 않는다", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(JSON.stringify({ detail: "분야를 작성해주세요." }), {
        status: 400,
      }),
  );
  await assert.rejects(
    getCourseList(""),
    (error) =>
      error instanceof ApiError &&
      error.status === 400 &&
      error.message === "분야를 작성해주세요.",
  );
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(JSON.stringify({ curriculum_list: {} }), { status: 200 }),
  );
  await assert.rejects(
    getCurriculum("대학", "학과"),
    (error) => error instanceof ApiError && error.status === 502,
  );
  for (const body of [{ course_list: "가,나", total: 2 }, { course_list: ["가"] }]) {
    t.mock.method(
      globalThis,
      "fetch",
      async () => new Response(JSON.stringify(body), { status: 200 }),
    );
    await assert.rejects(
      getCourseList("전체", "", 0),
      (error) => error instanceof ApiError && error.status === 502,
    );
  }
});
