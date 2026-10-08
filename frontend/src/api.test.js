import test from "node:test";
import assert from "node:assert/strict";
import {
  getCourseList,
  getSchoolList,
  getCurriculumList,
  ApiError,
} from "./api.js";

test("Litton의 요청 필드와 응답 형식을 따른다", async (t) => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push([url, JSON.parse(options.body)]);
    const data = url.endsWith("course_list")
      ? { course_list: "산업디자인학과, 컴퓨터공학과,산업디자인학과" }
      : url.endsWith("school_list")
        ? { school_list: "경희대학교" }
        : { curriculum_list: ["기초설계", "제품설계"] };
    return new Response(JSON.stringify(data), { status: 200 });
  });
  assert.deepEqual(await getCourseList("디자인"), [
    "산업디자인학과",
    "컴퓨터공학과",
  ]);
  assert.deepEqual(await getSchoolList("산업디자인학과"), ["경희대학교"]);
  assert.deepEqual(await getCurriculumList("경희대학교", "산업디자인학과"), [
    "기초설계",
    "제품설계",
  ]);
  assert.deepEqual(requests, [
    ["/api/course_list", { interests: "디자인" }],
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
    getCurriculumList("대학", "학과"),
    (error) => error instanceof ApiError && error.status === 502,
  );
});
