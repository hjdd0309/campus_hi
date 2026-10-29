import test from "node:test";
import assert from "node:assert/strict";
import {
  getCourseList,
  getSchoolList,
  getCurriculum,
  getProgramList,
  ApiError,
} from "./api.js";

test("요청 필드와 응답 형식을 따른다", async (t) => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push([url, JSON.parse(options.body)]);
    const data = url.endsWith("course_list")
      ? { course_list: ["산업디자인학과", "PEP(정치학,경제학,철학)연계전공"], total: 41 }
      : url.endsWith("school_list")
        ? {
            school_list: [
              { school: "경희대학교", partner: true, partner_example: true },
              { school: "고려대학교", partner: true, partner_example: false },
              { school: "국민대학교", partner: false },
              // 제휴가 아닌데 예시로 온 값은 예시로 보지 않는다.
              { school: "단국대학교", partner: false, partner_example: true },
            ],
          }
        : { curriculum_list: ["기초설계", "제품설계"], category: "예체능", duration: "4년", levels: { 기초설계: [1, 2], 제품설계: [3, 2], 없는값: [0, 5], 문자: "2-3" } };
    return new Response(JSON.stringify(data), { status: 200 });
  });
  assert.deepEqual(await getCourseList("디자인", "산업", 30), {
    courses: ["산업디자인학과", "PEP(정치학,경제학,철학)연계전공"],
    total: 41,
  });
  assert.deepEqual(await getSchoolList("산업디자인학과"), [
    { school: "경희대학교", partner: true, partnerExample: true },
    { school: "고려대학교", partner: true, partnerExample: false },
    { school: "국민대학교", partner: false, partnerExample: false },
    { school: "단국대학교", partner: false, partnerExample: false },
  ]);
  assert.deepEqual(await getCurriculum("경희대학교", "산업디자인학과"), {
    curriculum: ["기초설계", "제품설계"],
    category: "예체능",
    years: null,
    duration: "4년",
    region: "",
    games: {},
    // 학년 범위는 1~4학년, 시작 ≤ 끝인 것만 받는다.
    levels: { 기초설계: [1, 2] },
    picks: {},
    partner: false,
    partnerExample: false,
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
test("과목별 학년은 형식이 맞는 과목만 받는다", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    new Response(JSON.stringify({
      curriculum_list: ["자료구조", "운영체제"],
      partner: true,
      years: {
        subjects: { 자료구조: 2, 운영체제: 9, "": 1, 컴퓨터구조: "2" },
        source_url: "https://ce.khu.ac.kr/c.pdf",
        curriculum_year: 2026,
        checked_at: "2026-10-28",
      },
    }), { status: 200 }),
  );
  const result = await getCurriculum("경희대학교", "컴퓨터공학부 컴퓨터공학과");
  assert.equal(result.partner, true);
  assert.equal(result.partnerExample, false);
  assert.deepEqual(result.years, { subjects: { 자료구조: 2 }, source_url: "https://ce.khu.ac.kr/c.pdf", curriculum_year: 2026, checked_at: "2026-10-28" });
  assert.equal("terms" in result, false);
  for (const years of ["1학년", { subjects: [] }, { subjects: { 가: 0 } }, null]) {
    t.mock.method(globalThis, "fetch", async () =>
      new Response(JSON.stringify({ curriculum_list: ["자료구조"], years }), { status: 200 }),
    );
    assert.equal((await getCurriculum("경희대학교", "산업디자인학과")).years, null);
  }
  t.mock.method(globalThis, "fetch", async () =>
    new Response(JSON.stringify({ school_list: ["경희대학교"] }), { status: 200 }),
  );
  await assert.rejects(getSchoolList("산업디자인학과"), (error) => error instanceof ApiError && error.status === 502);
});
test("학교·학과 목록은 형식이 맞을 때만 받아들인다", async (t) => {
  const requests = [];
  const program = { school: "경희대학교", course: "산업디자인학과", category: "예체능", duration: "4년", region: "경기도", partner: true, partner_example: true };
  const real = { school: "고려대학교", course: "디자인조형학부", category: "예체능", duration: "4년", region: "서울특별시", partner: true };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push([url, JSON.parse(options.body)]);
    return new Response(
      JSON.stringify({ programs: [program, real, { school: "가천대학교", course: "심리학과" }], total: 3, similar_programs: [{ school: "경희대학교", course: "시각디자인학과" }], similar_courses: [] }),
      { status: 200 },
    );
  });
  assert.deepEqual(await getProgramList("전체", { school: "경희대", course: "디자인" }, 30), {
    programs: [
      { school: "경희대학교", course: "산업디자인학과", category: "예체능", duration: "4년", region: "경기도", partner: true, partnerExample: true },
      { ...real, partnerExample: false },
      { school: "가천대학교", course: "심리학과", category: "", duration: "", region: "", partner: false, partnerExample: false },
    ],
    total: 3,
    similarPrograms: [{ school: "경희대학교", course: "시각디자인학과", category: "", duration: "", region: "", partner: false, partnerExample: false }],
    similarCourses: [],
  });
  assert.deepEqual(requests, [["/api/program_list", { interests: "전체", school: "경희대", course: "디자인", offset: 30, limit: 30 }]]);
  const empty = { programs: [], total: 0, similar_programs: [], similar_courses: [] };
  for (const body of [
    { ...empty, programs: [{ school: "", course: "학과" }], total: 1 },
    { ...empty, programs: "x", total: 1 },
    { programs: [] },
    { ...empty, similar_programs: [{ school: "경희대학교" }] },
    { ...empty, similar_courses: [3] },
    { programs: [], total: 0, similar_programs: [] },
  ]) {
    t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(body), { status: 200 }));
    await assert.rejects(
      getProgramList("전체", { school: "", course: "" }, 0),
      (error) => error instanceof ApiError && error.status === 502,
    );
  }
});
