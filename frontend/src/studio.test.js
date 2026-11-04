import test from "node:test";
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import {
  MIN_LINE,
  QUESTION_KINDS,
  SKETCH,
  averageScore,
  cleanResult,
  conceptCheck,
  deltaE,
  evaluate,
  findSolution,
  fitStroke,
  foundInsights,
  startValues,
  hslToRgb,
  lineError,
  lineScore,
  matchPercent,
  resultSummary,
  rgbToLab,
  scoreSketch,
  simplifyStroke,
  startColor,
} from "./studio.js";
import { cleanExperience } from "./experiences.js";
import { cleanStudio, departmentData, studioFor, subjectConfirmed } from "./departmentData.js";
import { completeLesson, createDepartment, loadState, STORAGE_KEY, studioOf, yearSubjects } from "./model.js";
import { isGame } from "./games.js";

const khu = departmentData["경희대학교|산업디자인학과"];
const sketch = khu.years[1].parts[0];
const recall = khu.years[1].parts[1];
const interview = khu.years[2].parts[0];
const handle = khu.years[2].parts[1];

// 실제 데이터: 공시 교과목(courses.csv.gz)과, 서버가 보내는 모양으로 바꾼 편성표 학년(year_curricula.json).
const ROWS = gunzipSync(readFileSync(new URL("../../backend/data/courses.csv.gz", import.meta.url))).toString("utf8").split("\n");
function curriculumOf(school, course) {
  const row = ROWS.find((line) => line.split(",")[1] === school && line.split(",")[3] === course);
  return row ? row.split(",")[4].split("+").map((name) => name.trim()) : null;
}
const YEARS = JSON.parse(readFileSync(new URL("../../backend/data/year_curricula.json", import.meta.url), "utf8"));
function servedYears(school, course) {
  const entry = YEARS[`${school}|${course}`];
  const curriculum = curriculumOf(school, course);
  if (!entry || entry.status !== "verified") return null;
  const subjects = Object.fromEntries(Object.entries(entry.subjects).filter(([name]) => curriculum.includes(name)));
  return { subjects, names: entry.names || {}, extra: entry.extra || {}, source_url: entry.url, curriculum_year: entry.curriculum_year, checked_at: entry.checked_at };
}

// 선분 a→b 위의 점들(손으로 그은 획처럼 점이 여러 개).
const along = (a, b, n = 12) => Array.from({ length: n }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / (n - 1), a[1] + ((b[1] - a[1]) * i) / (n - 1)]);
// 점 p에서 소실점 쪽으로 t만큼 간 점.
const toward = (p, vx, t, data = sketch) => [p[0] + (vx - p[0]) * t, p[1] + (data.horizon - p[1]) * t];
// 점 p를 중심으로 deg도 돌린 선의 끝점.
const rotate = (p, q, deg) => {
  const r = (deg * Math.PI) / 180;
  const [dx, dy] = [q[0] - p[0], q[1] - p[1]];
  return [p[0] + dx * Math.cos(r) - dy * Math.sin(r), p[1] + dx * Math.sin(r) + dy * Math.cos(r)];
};

test("그리기·색 맞추기 데이터는 형식 검사를 통과하고, 형식이 틀리면 거른다", () => {
  assert.ok(khu.source, "출처가 있어야 한다");
  assert.ok(khu.years[1], "1학년 형식이 틀림");
  assert.equal(sketch.template, "H");
  assert.equal(recall.template, "I");
  assert.equal(sketch.cards.length, 3);
  assert.equal(cleanExperience({ ...sketch, vanishing: [] }), null);
  assert.equal(cleanExperience({ ...sketch, vanishing: [400] }), null);
  assert.equal(cleanExperience({ ...sketch, edge: { x: 150, top: 100, bottom: 110 } }), null);
  assert.equal(cleanExperience({ ...sketch, minLines: 8, maxLines: 6 }), null);
  assert.equal(cleanExperience({ ...sketch, rounds: [{ guide: "yes", label: "가이드" }] }), null);
  assert.equal(cleanExperience({ ...sketch, cards: [{ title: "하나", body: "한 장뿐" }] }), null);
  assert.equal(cleanExperience({ ...recall, targets: [{ h: 360, s: 50, l: 50 }, ...recall.targets] }), null);
  assert.equal(cleanExperience({ ...recall, targets: recall.targets.slice(0, 2) }), null);
  assert.equal(cleanExperience({ ...recall, showMs: 100 }), null);
  // 검토 전 데이터, 과목이 겹치는 데이터는 쓰지 않는다.
  const entry = { status: "verified", subjects: [{ name: "드로잉", source: "공시" }, { name: "평면디자인", source: "공시" }], parts: [sketch, recall] };
  assert.ok(cleanStudio(entry));
  assert.equal(cleanStudio({ ...entry, status: "draft" }), null);
  assert.equal(cleanStudio({ ...entry, subjects: [entry.subjects[0], entry.subjects[0]] }), null);
  assert.equal(cleanStudio({ ...entry, subjects: ["드로잉"] }), null);
  assert.equal(cleanStudio({ ...entry, subjects: [{ name: "드로잉", source: "블로그" }] }), null);
  // 별칭은 편성표 과목에만 붙는다.
  assert.equal(cleanStudio({ ...entry, subjects: [{ name: "드로잉", source: "공시", alias: "드로잉 1" }] }), null);
  assert.ok(cleanStudio({ ...entry, subjects: [{ name: "디자인비즈니스", source: "편성표", alias: "산업디자인비지니스" }] }));
  assert.equal(cleanStudio({ ...entry, parts: [] }), null);
  assert.equal(cleanStudio({ ...entry, parts: [{ ...sketch, template: "Z" }] }), null);
});

test("학과 전용 체험의 과목은 출처(공시 교과목 또는 학교 편성표)에서 그 학년 과목으로 확인된다", () => {
  for (const [key, entry] of Object.entries(departmentData)) {
    const [school, course] = key.split("|");
    const curriculum = curriculumOf(school, course);
    assert.ok(curriculum, `${key} 학과가 데이터에 없음`);
    assert.ok(entry.source, `${key} 출처 형식이 틀림`);
    const yearly = servedYears(school, course);
    for (const [year, studio] of Object.entries(entry.years)) {
      assert.ok(studio, `${key} ${year}학년 형식이 틀림`);
      for (const subject of studio.subjects)
        assert.ok(subjectConfirmed(subject, Number(year), curriculum, yearly, entry.source), `${key} ${year}학년 ${subject.name}이(가) 출처에서 확인되지 않음`);
    }
  }
});

test("과목 출처 확인: 공시 과목은 편성표 학년과 맞아야 하고, 편성표 과목은 같은 편성표의 학년 자료가 있어야 한다", () => {
  const source = khu.source;
  const yearly = { subjects: { 드로잉: 1, 산업디자인비지니스: 3 }, names: { 산업디자인비지니스: "디자인비즈니스" }, extra: { 리빙제품디자인: 2 }, source_url: source.url, curriculum_year: 2025 };
  const curriculum = ["드로잉", "산업디자인비지니스", "UX디자인"];
  const check = (subject, year, years = yearly) => subjectConfirmed(subject, year, curriculum, years, source);
  assert.ok(check({ name: "드로잉", source: "공시" }, 1));
  assert.ok(!check({ name: "드로잉", source: "공시" }, 2), "편성표 학년과 다름");
  assert.ok(check({ name: "UX디자인", source: "공시" }, 3, null), "편성표 학년 자료가 없으면 공시 교과목만 본다");
  assert.ok(!check({ name: "UX디자인", source: "공시" }, 3), "편성표 학년 자료에 없는 과목");
  assert.ok(!check({ name: "없는과목", source: "공시" }, 1, null));
  assert.ok(check({ name: "리빙제품디자인", source: "편성표" }, 2));
  assert.ok(!check({ name: "리빙제품디자인", source: "편성표" }, 3));
  assert.ok(!check({ name: "리빙제품디자인", source: "편성표" }, 2, null), "편성표 과목은 편성표 학년 자료가 있어야 한다");
  assert.ok(!check({ name: "리빙제품디자인", source: "편성표" }, 2, { ...yearly, curriculum_year: 2024 }), "다른 해 편성표");
  assert.ok(!check({ name: "리빙제품디자인", source: "편성표" }, 2, { ...yearly, source_url: "https://other.ac.kr" }), "다른 편성표");
  assert.ok(check({ name: "디자인비즈니스", source: "편성표", alias: "산업디자인비지니스" }, 3));
  assert.ok(!check({ name: "디자인비즈니스", source: "편성표", alias: "산업디자인비지니스" }, 3, { ...yearly, names: {} }));
  assert.ok(!check({ name: "디자인비즈니스", source: "편성표" }, 3), "별칭 없이는 편성표에만 있는 과목이 아니다");
});

test("그리기: 소실점을 향하는 선과 수직선은 만점이고, 어긋날수록 점수가 내려간다", () => {
  const top = [sketch.edge.x, sketch.edge.top];
  const bottom = [sketch.edge.x, sketch.edge.bottom];
  const left = fitStroke(along(top, toward(top, sketch.vanishing[0], 0.5)));
  const right = fitStroke(along(bottom, toward(bottom, sketch.vanishing[1], 0.4)));
  const vertical = fitStroke(along([220, 90], [220, 180]));
  assert.equal(lineError(left, sketch).kind, "vp0");
  assert.ok(lineError(left, sketch).angle < 0.01);
  assert.equal(lineError(right, sketch).kind, "vp1");
  assert.equal(lineError(vertical, sketch).kind, "vertical");
  assert.equal(lineScore(lineError(left, sketch).angle, left.wobble), 100);
  // 끝점을 10도 돌리면 40점 근처로 떨어진다(1도마다 6점).
  const off = fitStroke(along([60, 200], rotate([60, 200], [60, 120], 10)));
  assert.ok(lineScore(lineError(off, sketch).angle, off.wobble) <= 45);
  // 휘어진 선은 같은 방향이어도 점수가 깎인다.
  const wavy = along([220, 90], [220, 180]).map(([x, y], i) => [x + (i % 2 ? 6 : -6), y]);
  const fitted = fitStroke(wavy);
  assert.ok(fitted.wobble > 0.05);
  assert.ok(lineScore(lineError(fitted, sketch).angle, fitted.wobble) < 90);
  assert.equal(lineScore(90, 1), 0);
});

test("그리기: 1점 투시에서는 수평선도 맞는 방향이고, 2점 투시에서는 아니다", () => {
  const flat = fitStroke(along([40, 200], [140, 200]));
  const one = { ...sketch, vanishing: [160] };
  assert.equal(lineError(flat, one).kind, "horizontal");
  assert.equal(lineError(flat, one).angle, 0);
  assert.notEqual(lineError(flat, sketch).kind, "horizontal");
  assert.ok(lineError(flat, sketch).angle > 10);
});

test("그리기: 선이 모자라면 채점하지 않고, 짧은 획은 선으로 치지 않는다", () => {
  const good = [
    along([150, 100], toward([150, 100], 12, 0.5)),
    along([150, 100], toward([150, 100], 308, 0.5)),
    along([150, 190], toward([150, 190], 12, 0.4)),
    along([150, 190], toward([150, 190], 308, 0.4)),
    along([90, 90], [90, 160]),
    along([220, 90], [220, 160]),
  ];
  const tiny = along([10, 10], [10 + MIN_LINE / 2, 10], 3);
  assert.equal(scoreSketch(good.slice(0, 5), sketch).score, null);
  assert.equal(scoreSketch([...good.slice(0, 5), tiny], sketch).score, null);
  const full = scoreSketch(good, sketch);
  assert.equal(full.lines.length, 6);
  assert.equal(full.score, 100);
  assert.equal(full.good, 6);
  const worse = scoreSketch([...good.slice(0, 5), along([60, 200], rotate([60, 200], [60, 120], 20))], sketch);
  assert.ok(worse.score < full.score);
});

test("그리기: 기록용 획은 점을 줄이고 그림판 안의 정수 좌표로 바꾼다", () => {
  const straight = along([0.4, 3.6], [200.2, 3.6], 80);
  assert.deepEqual(simplifyStroke(straight), [
    [0, 4],
    [200, 4],
  ]);
  const zigzag = Array.from({ length: 60 }, (_, i) => [i * 5, i % 2 ? 40 : 10]);
  const kept = simplifyStroke(zigzag);
  assert.ok(kept.length <= 12 && kept.length >= 2);
  assert.ok(kept.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y) && x <= SKETCH.width && y <= SKETCH.height));
  assert.deepEqual(simplifyStroke([[-5, 300], [400, -2]]), [
    [0, SKETCH.height],
    [SKETCH.width, 0],
  ]);
});

test("색: HSL→RGB→Lab 변환과 색차는 표준 값과 맞는다", () => {
  assert.deepEqual(hslToRgb({ h: 0, s: 100, l: 50 }), [255, 0, 0]);
  assert.deepEqual(hslToRgb({ h: 120, s: 100, l: 50 }), [0, 255, 0]);
  assert.deepEqual(hslToRgb({ h: 240, s: 100, l: 25 }), [0, 0, 128]);
  assert.deepEqual(hslToRgb({ h: 200, s: 0, l: 100 }), [255, 255, 255]);
  const close = (actual, expected) => actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 0.05, `${actual} ≠ ${expected}`));
  close(rgbToLab([255, 255, 255]), [100, 0, 0]);
  close(rgbToLab([255, 0, 0]), [53.24, 80.09, 67.2]);
  close(rgbToLab([0, 0, 0]), [0, 0, 0]);
  assert.equal(deltaE({ h: 10, s: 50, l: 50 }, { h: 10, s: 50, l: 50 }), 0);
  assert.ok(Math.abs(deltaE({ h: 0, s: 0, l: 0 }, { h: 0, s: 0, l: 100 }) - 100) < 0.01);
});

test("색: 일치율은 똑같으면 100%, 색차가 클수록 낮고 0% 아래로 내려가지 않는다", () => {
  const target = recall.targets[3];
  assert.equal(matchPercent(target, target), 100);
  const near = matchPercent(target, { ...target, l: target.l + 4 });
  const far = matchPercent(target, { ...target, h: (target.h + 120) % 360 });
  assert.ok(near > far);
  assert.ok(near >= 85);
  assert.equal(matchPercent({ h: 0, s: 0, l: 0 }, { h: 0, s: 0, l: 100 }), 0);
  const start = startColor(() => 0.999);
  assert.deepEqual(start, { h: 359, s: 50, l: 50 });
});

test("저장된 결과는 형식이 맞는 것만 받고, 평균은 다시 계산한다", () => {
  const drawn = { template: "H", rounds: [{ guide: false, strokes: [[[0, 0], [10, 10]]], score: 60 }, { guide: true, strokes: [[[5, 5], [20, 90], [40, 120]]], score: 82 }] };
  assert.deepEqual(cleanResult(drawn), drawn);
  assert.equal(resultSummary(drawn), "투시 스케치 60점 → 82점");
  assert.equal(cleanResult({ ...drawn, rounds: [{ ...drawn.rounds[0], score: 120 }] }), null);
  assert.equal(cleanResult({ ...drawn, rounds: [{ ...drawn.rounds[0], strokes: [[[0, 0], [999, 10]]] }] }), null);
  assert.equal(cleanResult({ ...drawn, rounds: [{ ...drawn.rounds[0], strokes: [[[0.5, 0], [9, 10]]] }] }), null);
  assert.equal(cleanResult({ template: "Z" }), null);
  assert.equal(cleanResult(null), null);
  const rounds = recall.targets.map((target, i) => ({ target, mine: target, score: 60 + i * 10 }));
  const colored = cleanResult({ template: "I", rounds, average: 3 });
  assert.equal(colored.average, averageScore(rounds));
  assert.equal(colored.average, 80);
  assert.equal(resultSummary(colored), "색 맞추기 평균 80%");
  assert.equal(cleanResult({ template: "I", rounds: [{ ...rounds[0], mine: { h: 0, s: 101, l: 0 } }, ...rounds.slice(1)] }), null);
});

// 경희대 산업디자인학과의 교과목(일부): 1학년 과목과 다른 학년 과목이 섞여 있다.
const CURRICULUM = ["3D Design 1", "UX디자인", "기초산업디자인 1", "드로잉", "평면디자인", "산업디자인리서치", "서비스디자인", "입체디자인"];
const make = (override) =>
  createDepartment("산업디자인학과", "경희대학교", CURRICULUM, "예체능", null, "4년", "서울특별시", null, null, null, true, true, ...(override === undefined ? [] : [override]));

test("학과 전용 체험: 경희대 산업디자인 1학년은 드로잉·평면디자인으로 투시 스케치와 색 맞추기를 한다", () => {
  assert.ok(studioFor("경희대학교", "산업디자인학과", 1), "1학년 전용 체험이 공개되어 있어야 한다");
  assert.equal(studioFor("경희대학교", "시각디자인학과", 1), null);
  assert.equal(studioFor("경희대학교", "산업디자인학과", 4), null);
  const d = make();
  assert.equal(d.override, true);
  assert.equal(d.lessons[0], "드로잉 · 평면디자인");
  assert.equal(d.games[0], "studio:1");
  assert.ok(isGame("studio:1"));
  assert.deepEqual(d.slotSubjects[0], ["드로잉", "평면디자인"]);
  assert.deepEqual(studioOf(d, 0), studioFor("경희대학교", "산업디자인학과", 1));
  assert.equal(studioOf(d, 1), null);
  // 전용 체험에 쓴 과목은 다른 학년에서 다시 고르지 않고, 졸업 과제 자리는 그대로다.
  for (const name of d.lessons.slice(1)) assert.ok(!["드로잉", "평면디자인"].includes(name), name);
  assert.equal(d.lessons[3], "졸업작품");
  // 학년별 과목 목록에는 두 과목이 1학년에 따로 보인다.
  const first = yearSubjects(d).years.find((item) => item.year === 1);
  assert.deepEqual(first.open, [
    { index: 0, title: "드로잉" },
    { index: 0, title: "평면디자인" },
  ]);
  assert.ok(yearSubjects(d).years.every((item) => !item.others.includes("드로잉")));
  // 다른 학교·학과는 바뀌지 않는다.
  const other = createDepartment("산업디자인학과", "다른대학교", CURRICULUM, "예체능", null, "4년");
  assert.ok(!other.games.some((game) => String(game).startsWith("studio:")));
  assert.equal(other.override, true);
  // 교과목에 과목이 빠져 있으면 쓰지 않는다.
  const missing = createDepartment("산업디자인학과", "경희대학교", CURRICULUM.filter((s) => s !== "평면디자인"), "예체능", null, "4년");
  assert.ok(!missing.games.some((game) => String(game).startsWith("studio:")));
});

test("학과 전용 체험: 체험을 모두 마쳐야 완료되고, 결과는 저장했다 불러와도 그대로다", () => {
  const d = make();
  const key = `${d.id}-0`;
  const base = { ...loadState({ getItem: () => null }), catalog: [d], current: d.id, journeys: { [d.id]: { completed: 0, paused: false } } };
  assert.equal(completeLesson(base, d.id, 0, "").journeys[d.id].completed, 0);
  const drawn = { template: "H", rounds: [{ guide: false, strokes: [[[0, 0], [10, 10]]], score: 60 }, { guide: true, strokes: [[[0, 0], [10, 90]]], score: 80 }] };
  const colored = { template: "I", rounds: recall.targets.map((target) => ({ target, mine: target, score: 100 })), average: 100 };
  const played = { ...base, results: { [key]: [drawn, colored] }, plays: { [key]: { game: "studio:1", summary: "투시 스케치 60점 → 80점 · 색 맞추기 평균 100%" } } };
  assert.equal(completeLesson(played, d.id, 0, "").journeys[d.id].completed, 1);
  const stored = JSON.parse(JSON.stringify(played));
  const loaded = loadState({ getItem: (name) => (name === STORAGE_KEY ? JSON.stringify(stored) : null) });
  assert.deepEqual(loaded.results[key], [drawn, colored]);
  assert.equal(loaded.plays[key].game, "studio:1");
  assert.equal(loaded.catalog[0].lessons[0], "드로잉 · 평면디자인");
  // 형식이 틀린 결과, 틀이 맞지 않는 결과, 전용 체험이 아닌 자리의 결과는 버린다.
  const broken = loadState({
    getItem: (name) =>
      name === STORAGE_KEY ? JSON.stringify({ ...stored, results: { [key]: [colored, { template: "H", rounds: [] }], [`${d.id}-1`]: [drawn] } }) : null,
  });
  assert.deepEqual(broken.results, {});
  const half = loadState({ getItem: (name) => (name === STORAGE_KEY ? JSON.stringify({ ...stored, results: { [key]: [drawn, null] } }) : null) });
  assert.deepEqual(half.results[key], [drawn, null]);
});

test("학과 전용 체험: 생기기 전에 입학한 학과는 입학할 때의 수업을 그대로 둔다", () => {
  const before = make(false);
  assert.equal(before.override, false);
  assert.notEqual(before.lessons[0], "드로잉 · 평면디자인");
  assert.ok(!before.games.some((game) => String(game).startsWith("studio:")));
  // override 필드가 없던 예전 기록: 입학한 학과는 예전 수업, 둘러보기만 한 학과는 새 체험.
  const { override, ...legacy } = JSON.parse(JSON.stringify(before));
  const enrolled = loadState({
    getItem: (name) => (name === STORAGE_KEY ? JSON.stringify({ catalog: [legacy], journeys: { [legacy.id]: { completed: 0, paused: false } } }) : null),
  });
  assert.equal(enrolled.catalog[0].override, false);
  assert.equal(enrolled.catalog[0].lessons[0], before.lessons[0]);
  const browsed = loadState({ getItem: (name) => (name === STORAGE_KEY ? JSON.stringify({ catalog: [legacy] }) : null) });
  assert.equal(browsed.catalog[0].override, true);
  assert.equal(browsed.catalog[0].lessons[0], "드로잉 · 평면디자인");
  // 한번 정해진 값은 그대로 불러온다.
  const kept = loadState({ getItem: (name) => (name === STORAGE_KEY ? JSON.stringify({ catalog: [JSON.parse(JSON.stringify(before))] }) : null) });
  assert.equal(kept.catalog[0].override, false);
});

test("인터뷰: 열린 질문만 인사이트를 드러내고, 컨셉은 찾은 인사이트에 근거해야 한다", () => {
  assert.ok(interview, "2학년 인터뷰 형식이 틀림");
  assert.equal(interview.template, "J");
  // 데이터 규칙: 인사이트는 열린 질문에만 있고, 모든 인사이트는 찾을 수 있으며, 턴마다 종류가 다른 보기가 있다.
  for (const turn of interview.turns) {
    for (const choice of turn.choices) if (choice.insight) assert.equal(choice.kind, "open");
    assert.ok(new Set(turn.choices.map((choice) => choice.kind)).size >= 2);
  }
  const openPicks = interview.turns.map((turn) => turn.choices.findIndex((choice) => choice.kind === "open"));
  const worstPicks = interview.turns.map((turn) => turn.choices.findIndex((choice) => choice.kind !== "open"));
  assert.deepEqual(foundInsights(interview, openPicks), interview.insights.map((item) => item.id));
  assert.deepEqual(foundInsights(interview, worstPicks), []);
  // 컨셉: 근거가 다 있으면 grounded, 근거가 없는 컨셉은 언제나 아니다.
  const all = foundInsights(interview, openPicks);
  const groundless = interview.concepts.find((concept) => !concept.needs.length);
  assert.ok(groundless, "근거 없는 컨셉 보기가 있어야 한다");
  assert.equal(conceptCheck(groundless, all).grounded, false);
  const family = interview.concepts.find((concept) => concept.needs.includes("child"));
  assert.equal(conceptCheck(family, all).grounded, true);
  assert.deepEqual(conceptCheck(family, ["tight"]).missing, ["child"]);
  assert.deepEqual(Object.keys(QUESTION_KINDS), ["open", "leading", "closed"]);
  // 형식이 틀린 데이터: 유도 질문에 인사이트, 없는 인사이트, 찾을 수 없는 인사이트, 근거 있는 컨셉이 없음.
  const turns = interview.turns.map((turn) => ({ ...turn, choices: turn.choices.map((choice) => ({ ...choice })) }));
  const leadingWithInsight = turns.map((turn, i) => (i ? turn : { ...turn, choices: turn.choices.map((c) => (c.kind === "leading" ? { ...c, insight: "tight" } : c)) }));
  assert.equal(cleanExperience({ ...interview, turns: leadingWithInsight }), null);
  assert.equal(cleanExperience({ ...interview, insights: [...interview.insights, { id: "ghost", text: "아무도 말하지 않은 것" }] }), null);
  assert.equal(cleanExperience({ ...interview, concepts: interview.concepts.map((c) => ({ ...c, needs: [] })) }), null);
  assert.equal(cleanExperience({ ...interview, concepts: [{ text: "없는 근거", needs: ["nope"] }, ...interview.concepts] }), null);
  assert.equal(cleanExperience({ ...interview, turns: turns.slice(0, 2) }), null);
  // 결과
  const result = { template: "J", insights: ["가", "나"], total: 4, concept: "컨셉", grounded: true };
  assert.deepEqual(cleanResult(result), result);
  assert.equal(resultSummary(result), '사용자 인터뷰 인사이트 2/4개 · 컨셉 "컨셉"');
  assert.equal(cleanResult({ ...result, insights: ["가", "나", "다", "라", "마"] }), null);
  assert.equal(cleanResult({ ...result, grounded: "yes" }), null);
});

test("손잡이 테스트: 반응은 치수와 손 크기 자료로 계산하고, 세 사람 모두 편한 범위가 있다", () => {
  assert.ok(handle, "2학년 손잡이 테스트 형식이 틀림");
  const people = Object.fromEntries(handle.people.map((person) => [person.id, person]));
  // 처음 값은 정답이 아니고, 모두 편한 값이 있다.
  assert.equal(evaluate(handle, startValues(handle)).ok, false);
  const solution = findSolution(handle);
  assert.ok(solution);
  assert.ok(evaluate(handle, solution).ok);
  const at = (length, thickness) => evaluate(handle, { length, thickness });
  const who = (result) => Object.fromEntries(result.people.map((person) => [person.id, person.fails.map((fail) => fail.id)]));
  // 손가락 넣기: 안쪽 길이 − (둘째 + 셋째손가락 너비) ≥ 4mm. 어르신(22.6+21.2)은 47.8mm부터, 어른(16.5+16.0)은 36.5mm부터 들어간다.
  assert.deepEqual(who(at(47, 11)), { adult: [], child: [], elder: ["fit"] });
  assert.deepEqual(who(at(48, 11)), { adult: [], child: [], elder: [] });
  assert.deepEqual(who(at(36, 11)).adult, ["fit"]);
  assert.deepEqual(who(at(37, 11)).adult, []);
  // 감싸 쥐기: 굵기 ≤ 셋째손가락 길이의 20%. 아이(63.75mm)는 12.75mm까지, 어르신(75.5mm)은 15.1mm까지.
  assert.deepEqual(who(at(48, 13)), { adult: [], child: ["wrap"], elder: [] });
  assert.deepEqual(who(at(48, 16)), { adult: ["wrap"], child: ["wrap"], elder: ["wrap"] });
  assert.deepEqual(who(at(48, 15)), { adult: [], child: ["wrap"], elder: [] });
  // 손가락 압력: 굵기 10mm 미만이면 모두 아프다.
  assert.deepEqual(who(at(50, 9)), { adult: ["thin"], child: ["thin"], elder: ["thin"] });
  // 컵에 붙이기: 안쪽 길이 + 굵기 × 2 ≤ 76mm.
  assert.equal(at(56, 10).ok, true);
  assert.deepEqual(at(57, 10).limits.map((fail) => fail.id), ["cup"]);
  assert.equal(at(57, 10).ok, false);
  // 해설이 말하는 대로, 구멍 크기는 손가락이 가장 굵은 어르신이, 굵기는 손이 가장 작은 아이가 정한다.
  const span = (person) => person.values.index + person.values.middle;
  assert.equal(Math.max(...handle.people.map(span)), span(people.elder));
  assert.equal(Math.min(...handle.people.map((person) => person.values.middlelength)), people.child.values.middlelength);
  // 사람마다 출처가 있다.
  for (const person of handle.people) assert.ok(person.source.length > 10, person.id);
  // 형식: 풀 수 없는 데이터, 처음부터 풀린 데이터, 없는 측정값을 쓰는 규칙은 거른다.
  assert.equal(cleanExperience({ ...handle, limits: [{ ...handle.limits[0], max: 40 }] }), null);
  assert.equal(cleanExperience({ ...handle, params: handle.params.map((param) => ({ ...param, start: solution[param.id] })) }), null);
  assert.equal(cleanExperience({ ...handle, checks: [{ ...handle.checks[0], terms: [{ measure: "thumb", k: 1 }] }] }), null);
  assert.equal(cleanExperience({ ...handle, people: handle.people.map((p) => ({ ...p, values: { index: 1 } })) }), null);
  // 결과
  const result = { template: "K", params: [{ label: "손잡이 안쪽 길이", value: 50, unit: "mm" }, { label: "손잡이 굵기", value: 11, unit: "mm" }], tries: 3, people: 3 };
  assert.deepEqual(cleanResult(result), result);
  assert.equal(resultSummary(result), "손잡이 테스트 손잡이 안쪽 길이 50mm · 손잡이 굵기 11mm (3명 모두 편함, 3번 만에)");
  assert.equal(cleanResult({ ...result, tries: 0 }), null);
});

test("경희대 산업디자인: 2025 편성표 학년을 쓰고, 편성표 이름과 편성표에만 있는 과목을 보여 준다", () => {
  const curriculum = curriculumOf("경희대학교", "산업디자인학과");
  const years = servedYears("경희대학교", "산업디자인학과");
  const d = createDepartment("산업디자인학과", "경희대학교", curriculum, "예체능", years, "4년", "서울특별시", null, null, null, true, true);
  assert.equal(d.yearly.curriculum_year, 2025);
  assert.equal(d.lessonsFromYears, true);
  const list = yearSubjects(d);
  assert.equal(list.estimated, false);
  const of = (year) => list.years.find((item) => item.year === year);
  const titles = (year) => [...of(year).open.map((item) => item.title), ...of(year).others];
  // 추정으로 2학년에 잘못 들어가던 "현대 미술사"는 편성표대로 1학년이다.
  assert.ok(titles(1).includes("현대 미술사"));
  assert.ok(!titles(2).includes("현대 미술사"));
  assert.ok(!d.lessons.slice(1).includes("현대 미술사"));
  // 편성표에만 있는 과목, 편성표 이름(별칭)
  assert.ok(titles(2).includes("리빙제품디자인"));
  assert.ok(titles(3).includes("디자인비즈니스"));
  assert.ok(!list.years.some((item) => item.others.includes("산업디자인비지니스")));
  // 학년마다 과목이 한 번씩만 나온다.
  for (const item of list.years) assert.equal(new Set(titles(item.year)).size, titles(item.year).length);
});

test("경희대 산업디자인 2학년: 편성표 학년 자료가 있을 때만 기초산업디자인 1·리빙제품디자인으로 인터뷰와 손잡이 테스트를 한다", () => {
  const curriculum = curriculumOf("경희대학교", "산업디자인학과");
  const years = servedYears("경희대학교", "산업디자인학과");
  const d = createDepartment("산업디자인학과", "경희대학교", curriculum, "예체능", years, "4년", "서울특별시", null, null, null, true, true);
  assert.equal(d.lessons[1], "기초산업디자인 1 · 리빙제품디자인");
  assert.equal(d.games[1], "studio:2");
  assert.deepEqual(studioOf(d, 1).parts.map((part) => part.template), ["J", "K"]);
  const second = yearSubjects(d).years.find((item) => item.year === 2);
  assert.deepEqual(second.open, [
    { index: 1, title: "기초산업디자인 1" },
    { index: 1, title: "리빙제품디자인" },
  ]);
  assert.ok(!second.others.includes("리빙제품디자인"));
  // 리빙제품디자인은 편성표에만 있는 과목이라, 편성표 학년 자료가 없으면(예전에 저장한 학과 등) 2학년 전용 체험을 쓰지 않는다. 1학년은 공시 과목이라 그대로다.
  const without = createDepartment("산업디자인학과", "경희대학교", curriculum, "예체능", null, "4년");
  assert.equal(without.games[0], "studio:1");
  assert.notEqual(without.games[1], "studio:2");
  // 결과를 저장했다 불러와도 그대로다.
  const key = `${d.id}-1`;
  const results = [
    { template: "J", insights: ["가"], total: 4, concept: "컨셉", grounded: false },
    { template: "K", params: [{ label: "손잡이 안쪽 길이", value: 50, unit: "mm" }], tries: 2, people: 3 },
  ];
  const stored = JSON.stringify({ catalog: [d], journeys: { [d.id]: { completed: 1, paused: false } }, results: { [key]: results } });
  const loaded = loadState({ getItem: (name) => (name === STORAGE_KEY ? stored : null) });
  assert.deepEqual(loaded.results[key], results);
});
