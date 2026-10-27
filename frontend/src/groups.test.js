import test from "node:test";
import assert from "node:assert/strict";
import { FALLBACK, GROUPS, buildGroupExperience, groupExperience, groupName, groupOf } from "./groups.js";
import { groupData } from "./groupData.js";
import { cleanExperience } from "./experiences.js";

test("학과명으로 학과군을 정하고, 경계에 걸린 학과는 정한 우선순위를 따른다", () => {
  const cases = {
    컴퓨터공학과: "computing",
    간호학과: "health",
    의예과: "health",
    경영학과: "business",
    기계공학과: "machine",
    건축학과: "building",
    화학공학과: "chemeng",
    화학과: "science",
    산업디자인학과: "design",
    실용음악과: "music",
    연기예술학과: "stage",
    체육학과: "sports",
    사회복지학과: "welfare",
    행정학과: "society",
    영어영문학과: "humanities",
    유아교육과: "education",
    // 경계: 교사 양성 과정은 교육, 패션은 패턴·봉제 중심이라 조리·뷰티·패션, 산업공학은 공학 설계
    체육교육과: "education",
    미술교육과: "education",
    패션디자인학과: "craft",
    실내건축디자인학과: "design",
    산업공학과: "machine",
    산업경영공학과: "machine",
    // 비슷한 글자에 잘못 걸리지 않는다
    문헌정보학과: "humanities",
    항공서비스학과: "business",
    "영미문학.문화학과": "humanities",
    펫케어과: "science",
  };
  for (const [course, group] of Object.entries(cases)) assert.equal(groupOf(course, ""), group, course);
  // 어느 규칙에도 안 맞으면 계열로, 계열도 없으면 법·행정·사회로 간다.
  assert.equal(groupOf("미래융합학부", "인문사회"), FALLBACK.인문사회);
  assert.equal(groupOf("미래융합학부", "예체능"), FALLBACK.예체능);
  assert.equal(groupOf("새학부", ""), "society");
  assert.equal(groupOf(undefined, "공학"), "machine");
  assert.equal(groupName("music"), "음악");
  assert.equal(GROUPS.length, 16);
  assert.deepEqual(new Set(Object.values(FALLBACK)).size <= GROUPS.length, true);
});

test("모든 학과군에 검토를 통과한 실습과 졸업 과제가 있다", () => {
  for (const group of GROUPS) {
    const practice = groupExperience(group.id, "practice");
    const final = groupExperience(group.id, "final");
    assert.ok(practice, `${group.id} 실습`);
    assert.ok(final, `${group.id} 졸업 과제`);
    // 실습은 수업 안에 들어가는 틀(B·C·D), 졸업 과제는 작품(A), AI 가르치기(G, 컴퓨터·AI) 또는 계획서(F)다.
    assert.ok(["B", "C", "D"].includes(practice.template), group.id);
    assert.ok(practice.learn, `${group.id} 알아두기`);
    assert.equal(final.template, { design: "A", computing: "G" }[group.id] || "F", group.id);
    if (final.template === "F") for (const prompt of final.prompts) assert.ok(prompt.options.length >= 2);
  }
  // 학과군마다 실습이 서로 다르다.
  const titles = GROUPS.map((group) => groupExperience(group.id, "practice").title);
  assert.equal(new Set(titles).size, titles.length);
});

test("검토 대기이거나 형식이 틀린 학과군 데이터는 쓰지 않는다", () => {
  const entry = groupData.music.practice;
  assert.ok(cleanExperience(buildGroupExperience({ ...entry, status: "review" })));
  assert.equal(groupExperience("없는학과군", "practice"), null);
  // status가 verified가 아닌 데이터와 형식이 틀린 데이터는 groupExperience가 거른다.
  const original = groupData.music.practice;
  groupData.music.practice = { ...original, status: "review" };
  assert.equal(groupExperience("music", "practice"), null);
  groupData.music.practice = { ...original, items: [] };
  assert.equal(groupExperience("music", "practice"), null);
  groupData.music.practice = original;
  assert.ok(groupExperience("music", "practice"));
});
