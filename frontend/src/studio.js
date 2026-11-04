// 체험 틀 H(그리기)·I(기억해서 맞추기)·J(대화로 알아내기)·K(조절해서 시험하기)의 데이터 형식 검사, 채점, 결과 기록 검사. 화면은 StudioTemplates.jsx에 있다.
// 틀은 학과 내용을 모른다. 투시 스케치·색 맞추기 같은 내용은 데이터(departmentData.js 등)로 넣는다.
//   H 그리기: 소실점이 찍힌 화면에 선을 그으면 선마다 투시 방향과 얼마나 맞는지 채점한다. 라운드마다 가이드선을 켤 수 있다.
//   I 기억해서 맞추기: 목표 값을 잠깐 보여 주고 숨긴 뒤, 슬라이더로 기억해서 맞춘다. 지금은 색(색상·채도·명도)을 맞춘다.
//   J 대화로 알아내기: 등장인물과 대화하며 턴마다 질문을 고른다. 열린 질문을 고르면 인사이트가 드러나고, 마지막에 컨셉을 고른다.
//   K 조절해서 시험하기: 슬라이더로 치수를 바꾸고, 사람마다의 측정값과 규칙으로 편한지 계산한다. 모두 편한 값을 찾으면 끝난다.
//   L 재어서 법칙 찾기: 너비와 거리가 다른 두 막대를 번갈아 누르는 시간을 재고, 내 기록으로 피츠의 법칙 직선을 구한다.
//   M 모이는 점 찾기: 장면의 모서리가 모이는 점(소실점)에 핀을 끌어다 놓고 거리로 별을 받는다. 그림 여러 장 중 틀린 것을 고르는 라운드를 섞을 수 있다.
//     H(투시 스케치)는 지금 데이터에서 쓰지 않지만, 예전에 저장된 결과를 읽어 리포트에 옮기려고 남겨 둔다(model.js의 loadState).
// 학과 전용 체험에는 기존 틀 C(분류하기)도 쓸 수 있다. 결과는 요약 한 줄로 저장한다(cleanSummaryResult).

const text = (value, max) => (typeof value === "string" && value.trim() && [...value].length <= max ? value : null);
const list = (value, min, max) => (Array.isArray(value) && value.length >= min && value.length <= max ? value : null);
const all = (items) => (items && items.every(Boolean) ? items : null);
const num = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const int = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/* ---------------------------------------------------------------- */
/* H 그리기                                                          */
/* ---------------------------------------------------------------- */

// 그림판 크기(데이터와 기록의 좌표 단위). 화면은 이 크기를 폭에 맞춰 늘린다.
export const SKETCH = { width: 320, height: 240 };
// 이보다 짧은 선은 선으로 치지 않는다(점을 찍거나 손이 미끄러진 것).
export const MIN_LINE = 16;
// 기록에 남기는 획 하나의 점 수 상한.
const STROKE_POINTS = 12;

function cleanSketch(raw) {
  const { width, height } = SKETCH;
  const vanishing = all(list(raw.vanishing, 1, 2)?.map((x) => (num(x, 0, width) ? x : null)));
  const edge = raw.edge;
  const edgeOk =
    edge && num(edge.x, 0, width) && num(edge.top, 0, height) && num(edge.bottom, 0, height) && edge.bottom - edge.top >= 30;
  const rounds = all(
    list(raw.rounds, 1, 3)?.map((round) =>
      round && typeof round.guide === "boolean" && text(round.label, 14) ? { guide: round.guide, label: round.label } : null,
    ),
  );
  const minLines = raw.minLines;
  const maxLines = raw.maxLines;
  return vanishing &&
    num(raw.horizon, 0, height) &&
    edgeOk &&
    rounds &&
    int(minLines, 3, 10) &&
    int(maxLines, minLines, 16) &&
    text(raw.prompt, 120) &&
    text(raw.guideTip, 80) &&
    text(raw.improved, 80) &&
    text(raw.notImproved, 80) &&
    text(raw.explanation, 160)
    ? {
        vanishing,
        horizon: raw.horizon,
        edge: { x: edge.x, top: edge.top, bottom: edge.bottom },
        rounds,
        minLines,
        maxLines,
        prompt: raw.prompt,
        guideTip: raw.guideTip,
        improved: raw.improved,
        notImproved: raw.notImproved,
        explanation: raw.explanation,
      }
    : null;
}

const angleOf = (a, b) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
// 두 방향(선이라 앞뒤가 없다)의 차이, 0~90도.
function lineAngleGap(first, second) {
  const gap = Math.abs(first - second) % 180;
  return Math.min(gap, 180 - gap);
}

// 획(점 목록)을 곧은 선 하나로 본다: 처음과 끝 점을 잇고, 점들이 그 선에서 가장 멀리 벗어난 거리를 길이로 나눈 값(wobble)을 잰다.
export function fitStroke(points) {
  const a = points[0];
  const b = points[points.length - 1];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (!length) return { a, b, length: 0, wobble: 0 };
  let far = 0;
  for (const [x, y] of points) {
    const distance = Math.abs((b[0] - a[0]) * (a[1] - y) - (a[0] - x) * (b[1] - a[1])) / length;
    far = Math.max(far, distance);
  }
  return { a, b, length, wobble: far / length };
}

// 투시도에서 선이 가질 수 있는 방향: 수직선, 그리고 소실점마다 그 점으로 모이는 선.
// 소실점이 하나(1점 투시)면 수평선도 맞는 방향이다. 2점 투시에서는 수평 방향의 모서리가 모두 두 소실점으로 모인다.
// 선의 가운데에서 소실점을 향하는 방향과 선의 방향이 얼마나 다른지 재고, 가장 가까운 방향을 그 선이 뜻한 방향으로 본다.
export function lineError(line, data) {
  const direction = angleOf(line.a, line.b);
  const middle = [(line.a[0] + line.b[0]) / 2, (line.a[1] + line.b[1]) / 2];
  const options = [{ kind: "vertical", angle: lineAngleGap(direction, 90) }];
  if (data.vanishing.length === 1) options.push({ kind: "horizontal", angle: lineAngleGap(direction, 0) });
  data.vanishing.forEach((x, i) => {
    const toward = angleOf(middle, [x, data.horizon]);
    options.push({ kind: `vp${i}`, angle: lineAngleGap(direction, toward) });
  });
  return options.reduce((best, option) => (option.angle < best.angle ? option : best));
}

// 선 하나의 점수(0~100): 방향이 1도 어긋날 때마다 6점, 휘어진 정도(wobble) 0.01마다 2점을 뺀다.
// 예: 3도 어긋나고 거의 곧으면 80점 남짓, 10도 어긋나면 40점 아래다.
export function lineScore(error, wobble) {
  return Math.round(clamp(100 - error * 6 - wobble * 200, 0, 100));
}

// 한 라운드의 채점. strokes: [[x, y], ...]의 목록. 짧은 획은 빼고, 선이 minLines보다 적으면 score가 null이다.
export function scoreSketch(strokes, data) {
  const lines = strokes
    .map((points) => fitStroke(points))
    .filter((line) => line.length >= MIN_LINE)
    .map((line) => {
      const error = lineError(line, data);
      return { a: line.a, b: line.b, kind: error.kind, angle: error.angle, score: lineScore(error.angle, line.wobble) };
    });
  const score = lines.length >= data.minLines ? Math.round(lines.reduce((sum, line) => sum + line.score, 0) / lines.length) : null;
  return { lines, score, good: lines.filter((line) => line.score >= GOOD_LINE).length };
}
// 이 점수 이상인 선을 "잘 맞은 선"으로 보여 준다.
export const GOOD_LINE = 70;

// 기록에 남길 수 있게 획을 줄인다: 거의 일직선인 점을 빼고(더글러스-포이커), 정수 좌표로 반올림한다.
export function simplifyStroke(points, tolerance = 1.5) {
  if (points.length <= 2) return points.map(roundPoint);
  const keep = new Set([0, points.length - 1]);
  const visit = (from, to) => {
    const line = fitStroke([points[from], points[to]]);
    let far = -1;
    let at = -1;
    for (let i = from + 1; i < to; i++) {
      const [x, y] = points[i];
      const distance = line.length
        ? Math.abs((line.b[0] - line.a[0]) * (line.a[1] - y) - (line.a[0] - x) * (line.b[1] - line.a[1])) / line.length
        : Math.hypot(x - line.a[0], y - line.a[1]);
      if (distance > far) {
        far = distance;
        at = i;
      }
    }
    if (far > tolerance) {
      keep.add(at);
      visit(from, at);
      visit(at, to);
    }
  };
  visit(0, points.length - 1);
  let kept = [...keep].sort((a, b) => a - b).map((i) => points[i]);
  // 그래도 많으면 고르게 솎아 낸다(처음과 끝은 남긴다).
  if (kept.length > STROKE_POINTS) {
    const step = (kept.length - 1) / (STROKE_POINTS - 1);
    kept = Array.from({ length: STROKE_POINTS }, (_, i) => kept[Math.round(i * step)]);
  }
  return kept.map(roundPoint);
}
const roundPoint = ([x, y]) => [Math.round(clamp(x, 0, SKETCH.width)), Math.round(clamp(y, 0, SKETCH.height))];

// 저장된 그리기 결과: { template: "H", rounds: [{ guide, strokes, score }] }.
function cleanSketchResult(raw) {
  const point = (p) => Array.isArray(p) && p.length === 2 && int(p[0], 0, SKETCH.width) && int(p[1], 0, SKETCH.height);
  const rounds = all(
    list(raw?.rounds, 1, 3)?.map((round) => {
      const strokes = all(list(round?.strokes, 1, 16)?.map((stroke) => (list(stroke, 2, STROKE_POINTS) && stroke.every(point) ? stroke : null)));
      return strokes && typeof round.guide === "boolean" && int(round.score, 0, 100)
        ? { guide: round.guide, strokes: strokes.map((stroke) => stroke.map(([x, y]) => [x, y])), score: round.score }
        : null;
    }),
  );
  return rounds && { template: "H", rounds };
}

export function sketchSummary(result) {
  const scores = result.rounds.map((round) => `${round.score}점`).join(" → ");
  return `투시 스케치 ${scores}`;
}

/* ---------------------------------------------------------------- */
/* I 기억해서 맞추기 (색)                                             */
/* ---------------------------------------------------------------- */

const color = (value) =>
  value && int(value.h, 0, 359) && int(value.s, 0, 100) && int(value.l, 0, 100) ? { h: value.h, s: value.s, l: value.l } : null;

function cleanRecall(raw) {
  const targets = all(list(raw.targets, 3, 8)?.map(color));
  return targets &&
    int(raw.showMs, 500, 3000) &&
    text(raw.prompt, 120) &&
    text(raw.explanation, 160)
    ? { targets, showMs: raw.showMs, prompt: raw.prompt, explanation: raw.explanation }
    : null;
}

// HSL(색상 0~359, 채도·명도 0~100) → sRGB(0~255).
export function hslToRgb({ h, s, l }) {
  const sat = s / 100;
  const light = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}
export const cssColor = (value) => `hsl(${value.h} ${value.s}% ${value.l}%)`;

// sRGB → CIELAB(D65 백색점). 사람이 느끼는 색 차이에 가깝게 비교하려고 Lab에서 거리를 잰다.
export function rgbToLab([r, g, b]) {
  const linear = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [linear(r), linear(g), linear(b)];
  const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

// 두 색의 색차(CIE76 ΔE*ab): Lab 공간에서의 거리. 2~3 정도면 나란히 놓아도 구별하기 어렵다.
export function deltaE(first, second) {
  const [a, b] = [rgbToLab(hslToRgb(first)), rgbToLab(hslToRgb(second))];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
// 일치율(0~100%): 색차 1마다 1.5%를 뺀다. 색차 10이면 85%, 40이면 40%다.
export const matchPercent = (target, mine) => Math.round(clamp(100 - deltaE(target, mine) * 1.5, 0, 100));

// 라운드마다 슬라이더의 시작 값. 색상은 무작위로, 채도·명도는 가운데에서 시작한다.
export const startColor = (random = Math.random) => ({ h: Math.floor(random() * 360) % 360, s: 50, l: 50 });

// 저장된 색 맞추기 결과: { template: "I", rounds: [{ target, mine, score }], average }.
function cleanRecallResult(raw) {
  const rounds = all(
    list(raw?.rounds, 3, 8)?.map((round) => {
      const target = color(round?.target);
      const mine = color(round?.mine);
      return target && mine && int(round.score, 0, 100) ? { target, mine, score: round.score } : null;
    }),
  );
  return rounds && { template: "I", rounds, average: averageScore(rounds) };
}
export const averageScore = (rounds) => Math.round(rounds.reduce((sum, round) => sum + round.score, 0) / rounds.length);

export function recallSummary(result) {
  return `색 맞추기 평균 ${result.average}%`;
}

/* ---------------------------------------------------------------- */
/* J 대화로 알아내기 (사용자 인터뷰)                                    */
/* ---------------------------------------------------------------- */

// 질문의 종류. 열린 질문만 숨은 불편함(인사이트)을 드러낸다(데이터 형식 검사에서 강제한다).
export const QUESTION_KINDS = { open: "열린 질문", leading: "유도 질문", closed: "닫힌 질문" };
const id = (value) => (typeof value === "string" && /^[a-z][a-z0-9-]{0,19}$/.test(value) ? value : null);
const distinctIds = (items) => new Set(items.map((item) => item.id)).size === items.length;

function cleanInterview(raw) {
  const insights = all(list(raw.insights, 2, 6)?.map((item) => (id(item?.id) && text(item.text, 60) ? { id: item.id, text: item.text } : null)));
  if (!insights || !distinctIds(insights)) return null;
  const known = new Set(insights.map((item) => item.id));
  const turns = all(
    list(raw.turns, 3, 6)?.map((turn) => {
      const choices = all(
        list(turn?.choices, 2, 3)?.map((choice) => {
          if (!choice || !Object.hasOwn(QUESTION_KINDS, choice.kind) || !text(choice.ask, 60) || !text(choice.reply, 120)) return null;
          // 인사이트는 열린 질문에만 붙는다.
          if (choice.insight !== undefined && (choice.kind !== "open" || !known.has(choice.insight))) return null;
          return { ask: choice.ask, kind: choice.kind, reply: choice.reply, ...(choice.insight ? { insight: choice.insight } : {}) };
        }),
      );
      return choices && (turn.lead === undefined || text(turn.lead, 80)) ? { lead: turn.lead || "", choices } : null;
    }),
  );
  const reachable = new Set(turns?.flatMap((turn) => turn.choices.map((choice) => choice.insight).filter(Boolean)) || []);
  const concepts = all(
    list(raw.concepts, 2, 4)?.map((concept) =>
      text(concept?.text, 50) && Array.isArray(concept.needs) && concept.needs.length <= 4 && concept.needs.every((need) => known.has(need))
        ? { text: concept.text, needs: [...new Set(concept.needs)] }
        : null,
    ),
  );
  const persona = raw.persona;
  return turns &&
    insights.every((item) => reachable.has(item.id)) &&
    concepts &&
    concepts.some((concept) => concept.needs.length) &&
    persona &&
    text(persona.label, 20) &&
    text(persona.note, 40) &&
    text(raw.opening, 120) &&
    text(raw.prompt, 120) &&
    text(raw.conceptPrompt, 60) &&
    text(raw.explanation, 160)
    ? {
        persona: { label: persona.label, note: persona.note },
        opening: raw.opening,
        turns,
        insights,
        concepts,
        prompt: raw.prompt,
        conceptPrompt: raw.conceptPrompt,
        explanation: raw.explanation,
      }
    : null;
}

// 턴마다 고른 보기 번호(picks)로 찾은 인사이트 id를 찾은 순서대로 돌려준다.
export function foundInsights(data, picks) {
  const found = [];
  picks.forEach((pick, turn) => {
    const insight = data.turns[turn]?.choices[pick]?.insight;
    if (insight && !found.includes(insight)) found.push(insight);
  });
  return found;
}
// 컨셉이 인터뷰에서 찾은 인사이트에 근거하는지: 필요한 인사이트 중 못 찾은 것(missing). 근거가 하나도 없는 컨셉은 grounded가 false다.
export function conceptCheck(concept, found) {
  const missing = concept.needs.filter((need) => !found.includes(need));
  return { grounded: concept.needs.length > 0 && missing.length === 0, missing };
}

function cleanInterviewResult(raw) {
  const insights = all(list(raw?.insights, 0, 6)?.map((item) => text(item, 60)));
  return insights && int(raw.total, 1, 6) && insights.length <= raw.total && text(raw.concept, 50) && typeof raw.grounded === "boolean"
    ? { template: "J", insights: [...insights], total: raw.total, concept: raw.concept, grounded: raw.grounded }
    : null;
}
export const interviewSummary = (result) => `사용자 인터뷰 인사이트 ${result.insights.length}/${result.total}개 · 컨셉 "${result.concept}"`;

/* ---------------------------------------------------------------- */
/* K 조절해서 시험하기 (손잡이 테스트)                                   */
/* ---------------------------------------------------------------- */

// 값 = Σ k × (슬라이더 값 또는 사람의 측정값). 검사(checks)는 사람마다, 제한(limits)은 사람과 상관없이 한 번 본다.
// 결과를 미리 정해 두지 않고, 슬라이더 값과 사람의 측정값으로 매번 계산한다.
function cleanTerm(term, params, measures) {
  if (!term || typeof term !== "object" || !num(term.k, -100, 100) || term.k === 0) return null;
  if (typeof term.param === "string" && params.has(term.param) && term.measure === undefined) return { param: term.param, k: term.k };
  if (typeof term.measure === "string" && measures?.has(term.measure) && term.param === undefined) return { measure: term.measure, k: term.k };
  return null;
}
function cleanRule(rule, params, measures) {
  const terms = all(list(rule?.terms, 1, 4)?.map((term) => cleanTerm(term, params, measures)));
  const hasMin = rule?.min !== undefined;
  const hasMax = rule?.max !== undefined;
  if (!terms || !id(rule.id) || !text(rule.label, 20) || (!hasMin && !hasMax)) return null;
  if ((hasMin && (!num(rule.min, -1000, 1000) || !text(rule.low, 40))) || (hasMax && (!num(rule.max, -1000, 1000) || !text(rule.high, 40)))) return null;
  if (hasMin && hasMax && rule.min > rule.max) return null;
  return { id: rule.id, label: rule.label, terms, ...(hasMin ? { min: rule.min, low: rule.low } : {}), ...(hasMax ? { max: rule.max, high: rule.high } : {}) };
}

function cleanSim(raw) {
  const params = all(
    list(raw.params, 1, 3)?.map((param) =>
      param &&
      id(param.id) &&
      text(param.label, 16) &&
      text(param.unit, 4) &&
      num(param.min, -1000, 1000) &&
      num(param.max, param.min, 1000) &&
      num(param.step, 0.001, 1000) &&
      num(param.start, param.min, param.max) &&
      (param.max - param.min) / param.step <= 400
        ? { id: param.id, label: param.label, unit: param.unit, min: param.min, max: param.max, step: param.step, start: param.start }
        : null,
    ),
  );
  const measures = all(list(raw.measures, 1, 6)?.map((m) => (m && id(m.id) && text(m.label, 16) && text(m.unit, 4) ? { id: m.id, label: m.label, unit: m.unit } : null)));
  if (!params || !distinctIds(params) || !measures || !distinctIds(measures)) return null;
  const paramIds = new Set(params.map((param) => param.id));
  const measureIds = new Set(measures.map((m) => m.id));
  const people = all(
    list(raw.people, 1, 4)?.map((person) =>
      person &&
      id(person.id) &&
      text(person.label, 8) &&
      text(person.note, 30) &&
      text(person.source, 120) &&
      person.values &&
      measures.every((m) => num(person.values[m.id], 0, 1000))
        ? { id: person.id, label: person.label, note: person.note, source: person.source, values: Object.fromEntries(measures.map((m) => [m.id, person.values[m.id]])) }
        : null,
    ),
  );
  const checks = all(list(raw.checks, 1, 6)?.map((rule) => cleanRule(rule, paramIds, measureIds)));
  const limits = raw.limits === undefined ? [] : all(list(raw.limits, 0, 3)?.map((rule) => cleanRule(rule, paramIds, null)));
  if (!people || !distinctIds(people) || !checks || !distinctIds(checks) || !limits) return null;
  const data = {
    params,
    measures,
    people,
    checks,
    limits,
    prompt: text(raw.prompt, 120),
    good: text(raw.good, 30),
    done: text(raw.done, 60),
    footnote: raw.footnote === undefined ? "" : text(raw.footnote, 120),
    explanation: text(raw.explanation, 160),
  };
  if (!data.prompt || !data.good || !data.done || data.footnote === null || !data.explanation) return null;
  // 모두 만족하는 값이 하나도 없으면 끝낼 수 없는 체험이다. 처음 값이 이미 정답이면 해볼 것이 없다.
  return findSolution(data) && !evaluate(data, startValues(data)).ok ? data : null;
}

export const startValues = (data) => Object.fromEntries(data.params.map((param) => [param.id, param.start]));
const valueOf = (rule, values, person) => rule.terms.reduce((sum, term) => sum + term.k * (term.param ? values[term.param] : person.values[term.measure]), 0);
// 아주 작은 부동소수 오차로 경계에서 판정이 뒤집히지 않게 한다.
const EPSILON = 1e-9;
function judge(rule, values, person) {
  const value = valueOf(rule, values, person);
  if (rule.min !== undefined && value < rule.min - EPSILON) return { id: rule.id, label: rule.label, side: "low", message: rule.low, value };
  if (rule.max !== undefined && value > rule.max + EPSILON) return { id: rule.id, label: rule.label, side: "high", message: rule.high, value };
  return null;
}
// 지금 값으로 사람마다(people), 그리고 사람과 상관없는 제한(limits)을 판정한다.
export function evaluate(data, values) {
  const people = data.people.map((person) => {
    const fails = data.checks.map((rule) => judge(rule, values, person)).filter(Boolean);
    return { id: person.id, ok: fails.length === 0, fails };
  });
  const limits = data.limits.map((rule) => judge(rule, values, null)).filter(Boolean);
  return { people, limits, ok: limits.length === 0 && people.every((person) => person.ok) };
}
// 슬라이더 눈금을 모두 훑어 모두 만족하는 첫 값을 찾는다(없으면 null). 눈금 수는 형식 검사에서 제한한다.
export function findSolution(data) {
  const grids = data.params.map((param) => {
    const count = Math.floor((param.max - param.min) / param.step + EPSILON);
    return Array.from({ length: count + 1 }, (_, i) => Math.round((param.min + i * param.step) * 1000) / 1000);
  });
  const visit = (index, values) => {
    if (index === grids.length) return evaluate(data, values).ok ? { ...values } : null;
    for (const value of grids[index]) {
      const found = visit(index + 1, { ...values, [data.params[index].id]: value });
      if (found) return found;
    }
    return null;
  };
  return visit(0, {});
}

function cleanSimResult(raw) {
  const params = all(
    list(raw?.params, 1, 3)?.map((param) =>
      param && text(param.label, 16) && text(param.unit, 4) && num(param.value, -1000, 1000) ? { label: param.label, value: param.value, unit: param.unit } : null,
    ),
  );
  return params && int(raw.tries, 1, 9999) && int(raw.people, 1, 4) ? { template: "K", params, tries: raw.tries, people: raw.people } : null;
}
export const simSummary = (result) =>
  `손잡이 테스트 ${result.params.map((param) => `${param.label} ${param.value}${param.unit}`).join(" · ")} (${result.people}명 모두 편함, ${result.tries}번 만에)`;

/* ---------------------------------------------------------------- */
/* L 재어서 법칙 찾기 (피츠의 법칙)                                     */
/* ---------------------------------------------------------------- */

// 누르기판 크기(데이터와 기록의 좌표 단위). 화면은 폭에 맞춰 늘리지만, 법칙은 거리와 너비의 비만 쓰므로 단위가 상관없다.
export const TAP = { width: 320, height: 150 };
// 양옆 여백. 두 막대가 이 안에 들어가야 한다.
const TAP_MARGIN = 8;

// 어려움 지수(ID, 비트): 피츠의 법칙의 섀넌 형식(MacKenzie, 1992) log2(거리/너비 + 1).
export const difficulty = ({ distance, width }) => Math.log2(distance / width + 1);

function cleanTap(raw) {
  const targets = all(
    list(raw.targets, 3, 5)?.map((target) =>
      target && num(target.width, 10, 120) && num(target.distance, target.width, TAP.width) && target.distance + target.width <= TAP.width - TAP_MARGIN * 2
        ? { width: target.width, distance: target.distance }
        : null,
    ),
  );
  // 어려움 지수가 서로 달라야 기울기를 구할 수 있다(0.5비트 이상 차이).
  const ids = targets?.map(difficulty).sort((a, b) => a - b);
  if (!targets || ids.some((value, i) => i > 0 && value - ids[i - 1] < 0.5)) return null;
  const apply = raw.apply;
  const applyOk =
    apply &&
    text(apply.label, 16) &&
    text(apply.prompt, 120) &&
    num(apply.distance, 10, TAP.width) &&
    num(apply.min, 10, 120) &&
    num(apply.max, apply.min + 10, 120) &&
    num(apply.start, apply.min, apply.max) &&
    apply.distance + apply.max <= TAP.width - TAP_MARGIN * 2;
  return applyOk &&
    int(raw.taps, 5, 15) &&
    text(raw.prompt, 120) &&
    text(raw.effect, 160) &&
    text(raw.noEffect, 160) &&
    text(raw.footnote, 120) &&
    text(raw.explanation, 160)
    ? {
        targets,
        taps: raw.taps,
        apply: { label: apply.label, prompt: apply.prompt, distance: apply.distance, min: apply.min, max: apply.max, start: apply.start },
        prompt: raw.prompt,
        effect: raw.effect,
        noEffect: raw.noEffect,
        footnote: raw.footnote,
        explanation: raw.explanation,
      }
    : null;
}

// 두 막대의 가운데 x 좌표. 판 가운데를 기준으로 거리만큼 벌린다.
export const barCenters = ({ distance }) => [TAP.width / 2 - distance / 2, TAP.width / 2 + distance / 2];
// x(판 좌표)가 막대 안인지. 막대는 위아래로 판을 채우므로 가로만 본다(1차원 왕복 누르기).
export const hitBar = (x, center, width) => Math.abs(x - center) <= width / 2;

// 가운데값. 한 번 멈칫한 시간이 평균을 크게 끌어올리지 않게 한다.
export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// 최소제곱 직선 ms = a + b × ID. points: [{ id, ms }]. ID가 모두 같으면 null.
export function fitLine(points) {
  const n = points.length;
  const mx = points.reduce((sum, p) => sum + p.id, 0) / n;
  const my = points.reduce((sum, p) => sum + p.ms, 0) / n;
  const sxx = points.reduce((sum, p) => sum + (p.id - mx) ** 2, 0);
  if (!sxx) return null;
  const b = points.reduce((sum, p) => sum + (p.id - mx) * (p.ms - my), 0) / sxx;
  return { a: my - b * mx, b };
}
// 기록(rounds)으로 법칙을 구한다. 기울기가 0보다 커야(어려울수록 오래 걸려야) 법칙이 드러난 것으로 본다.
export function tapLaw(rounds) {
  const points = rounds.map((round) => ({ id: difficulty(round), ms: round.ms })).sort((x, y) => x.id - y.id);
  const line = fitLine(points);
  return { points, line, effect: !!line && line.b > 0 };
}
// 내 법칙으로 예상한 시간(ms, 정수). 0보다 작게 나오지 않게 한다.
export const predictTap = (line, target) => Math.max(0, Math.round(line.a + line.b * difficulty(target)));

// 저장된 결과: { template: "L", rounds: [{ width, distance, ms, misses }] }. 조건 순서는 데이터 순서다.
function cleanTapResult(raw) {
  const rounds = all(
    list(raw?.rounds, 3, 5)?.map((round) =>
      round && num(round.width, 10, 120) && num(round.distance, round.width, TAP.width) && int(round.ms, 1, 60000) && int(round.misses, 0, 999)
        ? { width: round.width, distance: round.distance, ms: round.ms, misses: round.misses }
        : null,
    ),
  );
  return rounds && { template: "L", rounds };
}
const seconds = (ms) => `${(ms / 1000).toFixed(2)}초`;
export function tapSummary(result) {
  const { points } = tapLaw(result.rounds);
  return `버튼 크기 실험 크고 가까운 막대 ${seconds(points[0].ms)} → 작고 먼 막대 ${seconds(points[points.length - 1].ms)}`;
}

/* ---------------------------------------------------------------- */
/* M 모이는 점 찾기 (소실점 탐정)                                        */
/* ---------------------------------------------------------------- */

// 장면(데이터와 기록의 좌표 단위)과 고르기 라운드의 작은 스케치 크기. 화면은 폭에 맞춰 늘린다.
export const VANISH = { width: 360, height: 400 };
export const THUMB = 120;
// 핀과 정답의 거리(장면 좌표)에 따른 별: 12 미만 3개, 30 미만 2개, 그 밖은 1개.
export const STAR_STEPS = [12, 30];
// 데이터 검사: 모서리를 늘린 선이 정답 소실점에서 이만큼 안쪽으로 지나야 한다(좌표를 반올림한 오차 정도).
const EDGE_TOLERANCE = 2;

const pointIn = (p, width, height) => Array.isArray(p) && p.length === 2 && num(p[0], 0, width) && num(p[1], 0, height);
const segmentIn = (s, width, height) => Array.isArray(s) && s.length === 4 && pointIn([s[0], s[1]], width, height) && pointIn([s[2], s[3]], width, height);
export const pointDistance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// 점 p에서 a, b를 지나는 직선까지의 거리.
export function lineDistance(p, a, b) {
  const length = pointDistance(a, b);
  return length ? Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / length : pointDistance(p, a);
}

function cleanPinRound(raw) {
  const { width, height } = VANISH;
  const scene = all(list(raw.scene, 1, 30)?.map((s) => (segmentIn(s, width, height) ? [...s] : null)));
  const answer = all(list(raw.answer, 1, 2)?.map((p) => (pointIn(p, width, height) ? [...p] : null)));
  const pinStart = answer && all(list(raw.pinStart, answer.length, answer.length)?.map((p) => (pointIn(p, width, height) ? [...p] : null)));
  const edges =
    answer &&
    all(
      list(raw.edges, 1, 8)?.map((edge) =>
        edge && pointIn(edge.from, width, height) && pointIn(edge.to, width, height) && int(edge.vp, 0, answer.length - 1) && pointDistance(edge.from, edge.to) >= 10
          ? { from: [...edge.from], to: [...edge.to], vp: edge.vp }
          : null,
      ),
    );
  if (!scene || !answer || !pinStart || !edges || !text(raw.hint, 60)) return null;
  // 모서리는 늘리면 제 소실점을 지나야 하고(데이터가 그림과 맞는지), 소실점마다 모서리가 둘 이상 있어야 한다.
  if (!edges.every((edge) => lineDistance(answer[edge.vp], edge.from, edge.to) <= EDGE_TOLERANCE)) return null;
  if (!answer.every((_, i) => edges.filter((edge) => edge.vp === i).length >= 2)) return null;
  // 핀이 처음부터 정답 가까이 있으면 해볼 것이 없다.
  if (matchPins(pinStart, answer).average < STAR_STEPS[1]) return null;
  return { hint: raw.hint, scene, edges, answer, pinStart };
}

function cleanPickRound(raw) {
  const options = all(
    list(raw.options, 2, 4)?.map((option) => {
      const lines = all(list(option?.lines, 1, 20)?.map((s) => (segmentIn(s, THUMB, THUMB) ? [...s] : null)));
      return lines && typeof option.id === "string" && /^[a-z]$/.test(option.id) ? { id: option.id, lines } : null;
    }),
  );
  return options && distinctIds(options) && options.some((option) => option.id === raw.answer) ? { options, answer: raw.answer } : null;
}

function cleanVanish(raw) {
  const rounds = all(
    list(raw.rounds, 2, 5)?.map((round) => {
      if (!round || !id(round.id) || !text(round.title, 24) || !text(round.explain, 120)) return null;
      const body = round.type === "pin" ? cleanPinRound(round) : round.type === "pick" ? cleanPickRound(round) : null;
      return body && { id: round.id, type: round.type, title: round.title, explain: round.explain, ...body };
    }),
  );
  return rounds &&
    distinctIds(rounds) &&
    rounds.some((round) => round.type === "pin") &&
    text(raw.subject, 20) &&
    text(raw.done, 60) &&
    text(raw.explanation, 160)
    ? { subject: raw.subject, rounds, done: raw.done, explanation: raw.explanation }
    : null;
}

// 핀과 정답 소실점을 짝짓는다. 핀의 순서는 상관없이, 거리의 합이 가장 작은 짝을 고른다(같으면 앞의 짝).
// 돌려주는 pinOf[i]는 정답 i와 짝인 핀의 번호, distances[i]는 그 거리, average는 평균 거리다.
export function matchPins(pins, answers) {
  const permutations = (items) =>
    items.length <= 1 ? [items] : items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]));
  let best = null;
  for (const pinOf of permutations(answers.map((_, i) => i))) {
    const distances = answers.map((answer, i) => pointDistance(pins[pinOf[i]], answer));
    const total = distances.reduce((sum, value) => sum + value, 0);
    if (!best || total < best.total) best = { pinOf, distances, total };
  }
  return { pinOf: best.pinOf, distances: best.distances, average: best.total / answers.length };
}

// 평균 거리로 별(1~3개)을 매긴다.
export const starsFor = (distance) => (distance < STAR_STEPS[0] ? 3 : distance < STAR_STEPS[1] ? 2 : 1);

// 핀 라운드 판정: 짝지은 평균 거리(소수 첫째 자리)와 별.
export function judgePins(pins, answers) {
  const match = matchPins(pins, answers);
  return { ...match, distance: Math.round(match.average * 10) / 10, stars: starsFor(match.average) };
}

// 저장된 결과: { template: "M", title, subject, rounds: [{ type: "pin", stars, distance } | { type: "pick", correct }] }.
function cleanVanishResult(raw) {
  const rounds = all(
    list(raw?.rounds, 2, 5)?.map((round) => {
      if (round?.type === "pin") return int(round.stars, 1, 3) && num(round.distance, 0, 1000) ? { type: "pin", stars: round.stars, distance: round.distance } : null;
      if (round?.type === "pick") return typeof round.correct === "boolean" ? { type: "pick", correct: round.correct } : null;
      return null;
    }),
  );
  return rounds && rounds.some((round) => round.type === "pin") && text(raw.title, 20) && text(raw.subject, 20)
    ? { template: "M", title: raw.title, subject: raw.subject, rounds }
    : null;
}
// 별 합계와 최대 별 수(핀 라운드마다 3개).
export function vanishStars(result) {
  const pins = result.rounds.filter((round) => round.type === "pin");
  return { stars: pins.reduce((sum, round) => sum + round.stars, 0), max: pins.length * 3 };
}
export function vanishSummary(result) {
  const picks = result.rounds.filter((round) => round.type === "pick");
  const picked = picks.length ? ` · 틀린 투시 ${picks.filter((round) => round.correct).length}/${picks.length} 맞힘` : "";
  return `${result.subject} · ${result.title} — 별 ${vanishStars(result).stars}개${picked}`;
}

/* ---------------------------------------------------------------- */
/* 학과 전용 체험에서 쓰는 기존 틀(C 분류하기)의 결과                      */
/* ---------------------------------------------------------------- */

// 기존 틀은 끝나면 요약 한 줄을 돌려준다. 학과 전용 체험에서는 { template, summary }로 저장한다.
const SUMMARY_TEMPLATES = ["C"];
function cleanSummaryResult(raw) {
  return raw && SUMMARY_TEMPLATES.includes(raw.template) && text(raw.summary, 100) ? { template: raw.template, summary: raw.summary } : null;
}

/* ---------------------------------------------------------------- */

// experiences.js의 templates에 더하는 틀. clean은 체험 데이터, cleanResult는 저장된 결과를 검사한다.
export const studioTemplates = {
  H: { title: "그리기", clean: cleanSketch, cleanResult: cleanSketchResult, summary: sketchSummary },
  I: { title: "기억해서 맞추기", clean: cleanRecall, cleanResult: cleanRecallResult, summary: recallSummary },
  J: { title: "대화로 알아내기", clean: cleanInterview, cleanResult: cleanInterviewResult, summary: interviewSummary },
  K: { title: "조절해서 시험하기", clean: cleanSim, cleanResult: cleanSimResult, summary: simSummary },
  L: { title: "재어서 법칙 찾기", clean: cleanTap, cleanResult: cleanTapResult, summary: tapSummary },
  M: { title: "모이는 점 찾기", clean: cleanVanish, cleanResult: cleanVanishResult, summary: vanishSummary },
};

// 저장된 결과 하나를 검사한다. 틀을 모르거나 형식이 틀리면 null.
export function cleanResult(raw) {
  if (raw && SUMMARY_TEMPLATES.includes(raw.template)) return cleanSummaryResult(raw);
  const template = raw && typeof raw === "object" && Object.hasOwn(studioTemplates, raw.template) ? studioTemplates[raw.template] : null;
  return template ? template.cleanResult(raw) : null;
}
export const resultSummary = (result) => (SUMMARY_TEMPLATES.includes(result.template) ? result.summary : studioTemplates[result.template].summary(result));
