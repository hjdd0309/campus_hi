// 체험 틀 H(그리기)·I(기억해서 맞추기)의 데이터 형식 검사, 채점, 결과 기록 검사. 화면은 StudioTemplates.jsx에 있다.
// 틀은 학과 내용을 모른다. 투시 스케치·색 맞추기 같은 내용은 데이터(departmentData.js 등)로 넣는다.
//   H 그리기: 소실점이 찍힌 화면에 선을 그으면 선마다 투시 방향과 얼마나 맞는지 채점한다. 라운드마다 가이드선을 켤 수 있다.
//   I 기억해서 맞추기: 목표 값을 잠깐 보여 주고 숨긴 뒤, 슬라이더로 기억해서 맞춘다. 지금은 색(색상·채도·명도)을 맞춘다.

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

// experiences.js의 templates에 더하는 틀. clean은 체험 데이터, cleanResult는 저장된 결과를 검사한다.
export const studioTemplates = {
  H: { title: "그리기", clean: cleanSketch, cleanResult: cleanSketchResult, summary: sketchSummary },
  I: { title: "기억해서 맞추기", clean: cleanRecall, cleanResult: cleanRecallResult, summary: recallSummary },
};

// 저장된 결과 하나를 검사한다. 틀을 모르거나 형식이 틀리면 null.
export function cleanResult(raw) {
  const template = raw && typeof raw === "object" && Object.hasOwn(studioTemplates, raw.template) ? studioTemplates[raw.template] : null;
  return template ? template.cleanResult(raw) : null;
}
export const resultSummary = (result) => studioTemplates[result.template].summary(result);
