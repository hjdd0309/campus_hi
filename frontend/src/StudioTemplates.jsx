import React, { Fragment, useEffect, useRef, useState } from "react";
import {
  GOOD_LINE,
  MIN_LINE,
  QUESTION_KINDS,
  SKETCH,
  averageScore,
  conceptCheck,
  cssColor,
  evaluate,
  fitStroke,
  foundInsights,
  matchPercent,
  scoreSketch,
  simplifyStroke,
  startColor,
  startValues,
  TAP,
  barCenters,
  difficulty,
  hitBar,
  median,
  predictTap,
  tapLaw,
  VANISH,
  THUMB,
  judgePins,
  matchPins,
  vanishStars,
} from "./studio.js";
import { templates } from "./experiences.js";
import { shuffle } from "./lessonGames.js";
import { Experience } from "./Templates.jsx";

// 학과 전용 체험의 화면: 배우기 카드, 체험 여러 개를 차례로 하는 틀, 틀 H(그리기)·I(기억해서 맞추기)·J(대화로 알아내기)·K(조절해서 시험하기)·L(재어서 법칙 찾기)·M(모이는 점 찾기), 결과 요약.
// 형식 검사와 채점은 studio.js에 있다. 틀은 onComplete(결과)를 부르고, 결과는 수업 화면이 저장한다.

const { width: W, height: H } = SKETCH;
const lineColor = (score) => (score >= GOOD_LINE ? "#087f77" : score >= 40 ? "#e8930c" : "#e5484d");

/* ---- 배우기 카드: 체험마다 원리를 2~3장으로. 한 장씩 넘겨 본다. ---- */
export function LearnDeck({ parts }) {
  const cards = parts.flatMap((part, p) => (part.cards || []).map((card) => ({ ...card, part: part.title, p })));
  const [at, setAt] = useState(0);
  if (!cards.length) return null;
  const card = cards[Math.min(at, cards.length - 1)];
  return (
    <section className="studio-deck a-up mt-[22px]" aria-roledescription="배우기 카드" aria-label={`배우기 카드 ${at + 1} / ${cards.length}`}>
      <p className="studio-deck-part">{parts.length > 1 ? `체험 ${card.p + 1} · ${card.part}` : card.part}</p>
      <h2 key={`t${at}`} className="a-fade">
        {card.title}
      </h2>
      <p key={`b${at}`} className="a-fade">
        {card.body}
      </p>
      <div className="studio-deck-nav">
        <button className="text-button" onClick={() => setAt(at - 1)} disabled={at === 0} aria-label="이전 카드">
          ‹ 이전
        </button>
        <span aria-hidden="true">
          {cards.map((_, i) => (
            <i key={i} className={i === at ? "is-on" : ""} />
          ))}
        </span>
        <button className="text-button" onClick={() => setAt(at + 1)} disabled={at === cards.length - 1} aria-label="다음 카드">
          다음 ›
        </button>
      </div>
    </section>
  );
}

/* ---- 체험 여러 개를 차례로: 앞 체험을 마쳐야 다음 체험이 열린다. 마친 체험은 결과를 보여 주고 다시 할 수 있다. ---- */
export function StudioLesson({ studio, results = [], onResult }) {
  const firstOpen = studio.parts.findIndex((_, i) => !results[i]);
  const [at, setAt] = useState(firstOpen < 0 ? 0 : firstOpen);
  // 이번에 직접 하고 있는 체험인지. 마친 직후에도 체험 화면(점수 비교 등)을 그대로 두고 아래에 다음 버튼을 붙인다.
  const [playing, setPlaying] = useState(false);
  // 다시 해보기를 누를 때마다 늘려 체험을 처음부터 다시 띄운다.
  const [attempt, setAttempt] = useState(0);
  const part = studio.parts[at];
  const result = results[at];
  const Game = games[part.template];
  const open = (i) => i === 0 || !!results[i - 1];
  const go = (i) => {
    setAt(i);
    setPlaying(false);
  };
  const nextButton = result && at < studio.parts.length - 1 && (
    <button className="button" onClick={() => go(at + 1)}>
      다음 체험: {studio.parts[at + 1].title} →
    </button>
  );
  return (
    <>
      {studio.parts.length > 1 && (
        <div className="studio-tabs" role="tablist" aria-label="체험 순서">
          {studio.parts.map((item, i) => (
            <button key={i} role="tab" aria-selected={i === at} disabled={!open(i)} onClick={() => go(i)}>
              <b>{i + 1}</b>
              {item.title}
              {results[i] && <span aria-label="완료">✓</span>}
            </button>
          ))}
        </div>
      )}
      <section className="lesson-game" aria-label={part.title}>
        <h2 className="section-title">
          {templates[part.template].title}
          {result && <span className="tag">완료</span>}
        </h2>
        <p className="body-copy">{part.task}</p>
        {result && !playing ? (
          <>
            <ResultView data={part} result={result} />
            <div className="mt-[12px] grid gap-[8px]">
              {nextButton}
              <button
                className="button ghost"
                onClick={() => {
                  setPlaying(true);
                  setAttempt((n) => n + 1);
                }}
              >
                다시 해보기
              </button>
            </div>
          </>
        ) : (
          <>
            <Game key={`${at}-${attempt}`} data={part} onComplete={(value) => (setPlaying(true), onResult(at, value))} />
            {nextButton && <div className="mt-[12px] grid">{nextButton}</div>}
          </>
        )}
      </section>
    </>
  );
}

/* ---- 결과 요약(수업의 기록 단계, 다시 볼 때) ---- */
export function ResultView({ data, result }) {
  if (result.template === "H")
    return (
      <div>
        <div className="studio-sketch-pair">
          {result.rounds.map((round, i) => (
            <figure key={i}>
              <SketchBoard data={data} guide={round.guide} strokes={round.strokes} small />
              <figcaption>
                {data.rounds[i]?.label || `${i + 1}번째`} · <b>{round.score}점</b>
              </figcaption>
            </figure>
          ))}
        </div>
        <button className="text-button mt-[8px]" onClick={() => saveSketchImage(data, result)}>
          스케치 이미지 저장하기
        </button>
      </div>
    );
  if (result.template === "J")
    return (
      <div>
        <p className="studio-big" role="status">
          찾은 인사이트 <b>{result.insights.length}</b> / {result.total}개
        </p>
        {result.insights.length > 0 && (
          <ul className="studio-insights">
            {result.insights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        <p className="body-copy">
          고른 컨셉: <strong>{result.concept}</strong>
          {result.grounded ? " (인터뷰에 근거함)" : " (인터뷰 근거가 모자람)"}
        </p>
      </div>
    );
  if (result.template === "L") return <TapLaw data={data} rounds={result.rounds} small />;
  if (result.template === "M") return <VanishResult data={data} result={result} />;
  if (result.summary !== undefined) return <p className="body-copy">{result.summary}</p>;
  if (result.template === "K") {
    const values = Object.fromEntries(data.params.map((param, i) => [param.id, result.params[i]?.value]));
    return (
      <div>
        <CupView data={data} values={values} small />
        <p className="body-copy mt-[8px]">
          {result.params.map((param) => `${param.label} ${param.value}${param.unit}`).join(" · ")}
          <br />
          {result.people}명 모두 편하게 잡았어요 · {result.tries}번 만에
        </p>
      </div>
    );
  }
  return (
    <div>
      <p className="studio-big" role="status">
        평균 일치율 <b>{result.average}%</b>
      </p>
      <Palette rounds={result.rounds} />
    </div>
  );
}

function Palette({ rounds }) {
  return (
    <ul className="studio-palette" aria-label="내가 만든 색 팔레트">
      {rounds.map((round, i) => (
        <li key={i} aria-label={`${i + 1}라운드 일치율 ${round.score}%`}>
          <span className="studio-chip-target" style={{ background: cssColor(round.target) }} title="목표색" />
          <span className="studio-chip-mine" style={{ background: cssColor(round.mine) }} title="내가 만든 색" />
          <small>{round.score}%</small>
        </li>
      ))}
    </ul>
  );
}

/* ---- H 그리기 ---- */

// 가이드선: 소실점마다 앞 모서리의 위·아래 끝을 지나는 선을 그림판 끝까지 늘린다.
function guideLines(data) {
  const ends = [data.edge.top, data.edge.bottom, (data.edge.top + data.edge.bottom) / 2];
  return data.vanishing.flatMap((vx) =>
    ends.map((y) => {
      const toX = vx < data.edge.x ? W : 0;
      const t = (toX - vx) / (data.edge.x - vx || 1);
      return [vx, data.horizon, toX, data.horizon + (y - data.horizon) * t];
    }),
  );
}

function SketchBoard({ data, guide, strokes = [], drawing = null, graded = null, small = false, cursor = null, anchor = null, ...props }) {
  const path = (points) => points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`studio-board ${small ? "is-small" : ""}`} {...props}>
      <rect width={W} height={H} fill="#fff" />
      {guide &&
        guideLines(data).map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#27d8cd" strokeOpacity="0.45" strokeWidth="1" />)}
      <line x1="0" y1={data.horizon} x2={W} y2={data.horizon} stroke="#b3b9c2" strokeDasharray="5 4" strokeWidth="1" />
      {!small && (
        <text x={W / 2} y={data.horizon - 6} textAnchor="middle" fontSize="9" fill="#949494">
          눈높이선
        </text>
      )}
      {data.vanishing.map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={data.horizon} r="4" fill="#202b3c" />
          {!small && (
            <text x={x} y={data.horizon + 16} textAnchor="middle" fontSize="9" fill="#637083">
              소실점
            </text>
          )}
        </g>
      ))}
      <line x1={data.edge.x} y1={data.edge.top} x2={data.edge.x} y2={data.edge.bottom} stroke="#202b3c" strokeWidth="3.5" strokeLinecap="round" />
      {strokes.map((points, i) => (
        <path
          key={i}
          d={path(points)}
          fill="none"
          stroke={graded ? "#b3b9c2" : "#302b27"}
          strokeOpacity={graded ? 0.6 : 1}
          strokeWidth={small ? 2.4 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {graded?.lines.map((line, i) => (
        <line key={i} x1={line.a[0]} y1={line.a[1]} x2={line.b[0]} y2={line.b[1]} stroke={lineColor(line.score)} strokeWidth="2.6" strokeLinecap="round" />
      ))}
      {drawing && <path d={path(drawing)} fill="none" stroke="#087f77" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      {anchor && cursor && <line x1={anchor[0]} y1={anchor[1]} x2={cursor[0]} y2={cursor[1]} stroke="#087f77" strokeWidth="2" strokeDasharray="4 3" />}
      {cursor && (
        <g stroke="#087f77" strokeWidth="1.5">
          <line x1={cursor[0] - 7} y1={cursor[1]} x2={cursor[0] + 7} y2={cursor[1]} />
          <line x1={cursor[0]} y1={cursor[1] - 7} x2={cursor[0]} y2={cursor[1] + 7} />
        </g>
      )}
    </svg>
  );
}

export function Sketch({ data, onComplete }) {
  const [round, setRound] = useState(0);
  const [strokes, setStrokes] = useState([]);
  const [drawing, setDrawing] = useState(null);
  const [graded, setGraded] = useState(null);
  const [done, setDone] = useState([]);
  const [notice, setNotice] = useState("");
  const [cursor, setCursor] = useState(null);
  const [anchor, setAnchor] = useState(null);
  const board = useRef(null);
  const config = data.rounds[round];
  const finished = done.length === data.rounds.length;

  const local = (e) => {
    const r = board.current.getBoundingClientRect();
    return [Math.min(W, Math.max(0, ((e.clientX - r.left) / r.width) * W)), Math.min(H, Math.max(0, ((e.clientY - r.top) / r.height) * H))];
  };
  const add = (points) => {
    if (fitStroke(points).length < MIN_LINE) return setNotice("선이 너무 짧아요. 조금 더 길게 그어 주세요.");
    if (strokes.length >= data.maxLines) return setNotice(`선은 ${data.maxLines}개까지 그을 수 있어요. 한 획 지우기로 고쳐 보세요.`);
    setNotice("");
    setStrokes((list) => [...list, points]);
  };
  const down = (e) => {
    if (graded || e.button > 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrawing([local(e)]);
  };
  const move = (e) => {
    if (!drawing) return;
    const p = local(e);
    const last = drawing[drawing.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 2) setDrawing([...drawing, p]);
  };
  const up = () => {
    if (!drawing) return;
    add(drawing);
    setDrawing(null);
  };
  // 키보드로 그리기: 방향키로 십자 표시를 옮기고, Enter나 스페이스로 선의 시작점과 끝점을 찍는다.
  const key = (e) => {
    if (graded) return;
    const step = e.shiftKey ? 16 : 4;
    const at = cursor || [data.edge.x, data.edge.top];
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      setCursor([Math.min(W, Math.max(0, at[0] + moves[e.key][0])), Math.min(H, Math.max(0, at[1] + moves[e.key][1]))]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!anchor) setAnchor(at);
      else {
        add([anchor, at]);
        setAnchor(null);
      }
      setCursor(at);
    } else if (e.key === "Escape") setAnchor(null);
  };

  function grade() {
    const result = scoreSketch(strokes, data);
    if (result.score === null) return setNotice(`선을 ${data.minLines}개 이상 그어야 채점할 수 있어요. (지금 ${result.lines.length}개)`);
    setNotice("");
    setGraded(result);
    const next = [...done, { guide: config.guide, strokes: strokes.map((points) => simplifyStroke(points)), score: result.score }];
    setDone(next);
    if (next.length === data.rounds.length) onComplete({ template: "H", rounds: next });
  }
  function nextRound() {
    setRound(round + 1);
    setStrokes([]);
    setGraded(null);
    setNotice("");
  }
  function restart() {
    setRound(0);
    setStrokes([]);
    setGraded(null);
    setDone([]);
    setNotice("");
  }

  const delta = finished && done.length > 1 ? done[done.length - 1].score - done[0].score : null;
  return (
    <div>
      <p className="game-progress" role="status">
        {round + 1} / {data.rounds.length} · {config.label}
      </p>
      <p className="body-copy">{config.guide ? data.guideTip : data.prompt}</p>
      <SketchBoard
        ref={board}
        data={data}
        guide={config.guide}
        strokes={strokes}
        drawing={drawing}
        graded={graded}
        cursor={cursor}
        anchor={anchor}
        tabIndex={0}
        role="application"
        aria-label={`투시 스케치 그림판. 지금 선 ${strokes.length}개. 방향키로 십자 표시를 옮기고 Enter로 선의 시작점과 끝점을 찍어요.`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => setDrawing(null)}
        onKeyDown={key}
        onFocus={() => setCursor((c) => c || [data.edge.x, data.edge.top])}
        onBlur={() => {
          setCursor(null);
          setAnchor(null);
        }}
      />
      <p className="game-feedback" role="status">
        {notice ||
          (graded
            ? `${graded.score}점 · 잘 맞은 선 ${graded.good} / ${graded.lines.length}개`
            : `선 ${strokes.length}개 · ${data.minLines}개 이상 그으면 채점할 수 있어요`)}
      </p>
      {graded && (
        <p className="studio-legend" aria-hidden="true">
          <i style={{ background: lineColor(100) }} /> 잘 맞음 <i style={{ background: lineColor(50) }} /> 조금 어긋남 <i style={{ background: lineColor(0) }} /> 많이 어긋남
        </p>
      )}
      {!graded && (
        <div className="studio-row">
          <button className="button ghost" onClick={() => setStrokes((list) => list.slice(0, -1))} disabled={!strokes.length}>
            한 획 지우기
          </button>
          <button className="button" onClick={grade}>
            채점하기
          </button>
        </div>
      )}
      {graded && !finished && (
        <button className="button" onClick={nextRound}>
          {data.rounds[round + 1].label} 다시 그리기 →
        </button>
      )}
      {finished && (
        <div role="status">
          {delta !== null && (
            <p className="studio-big">
              {done.map((item) => `${item.score}점`).join(" → ")}
              <b>{delta > 0 ? ` (+${delta})` : ""}</b>
            </p>
          )}
          {delta !== null && <p className="body-copy">{delta > 0 ? data.improved : data.notImproved}</p>}
          <div className="studio-row">
            <button className="button ghost" onClick={() => saveSketchImage(data, { rounds: done })}>
              이미지 저장
            </button>
            <button className="button ghost" onClick={restart}>
              처음부터 다시
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 스케치를 PNG 파일로 내려받는다. 라운드마다 그림을 나란히 그리고 점수를 적는다.
export function saveSketchImage(data, result) {
  const scale = 2;
  const gap = 16;
  const top = 34;
  const canvas = document.createElement("canvas");
  canvas.width = (W * result.rounds.length + gap * (result.rounds.length + 1)) * scale;
  canvas.height = (H + top + gap) * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#e8faf7";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  result.rounds.forEach((round, i) => {
    const left = gap + i * (W + gap);
    ctx.save();
    ctx.translate(left, top);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    ctx.lineCap = "round";
    if (round.guide) {
      ctx.strokeStyle = "rgba(39,216,205,0.45)";
      ctx.lineWidth = 1;
      for (const [x1, y1, x2, y2] of guideLines(data)) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = "#b3b9c2";
    ctx.beginPath();
    ctx.moveTo(0, data.horizon);
    ctx.lineTo(W, data.horizon);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#202b3c";
    for (const x of data.vanishing) {
      ctx.beginPath();
      ctx.arc(x, data.horizon, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#202b3c";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(data.edge.x, data.edge.top);
    ctx.lineTo(data.edge.x, data.edge.bottom);
    ctx.stroke();
    ctx.strokeStyle = "#302b27";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    for (const stroke of round.strokes) {
      ctx.beginPath();
      stroke.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = "#302b27";
    ctx.font = "600 14px Pretendard, sans-serif";
    ctx.fillText(`${data.rounds[i]?.label || `${i + 1}번째`} · ${round.score}점`, left, 22);
  });
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${data.title}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, "image/png");
}

/* ---- I 기억해서 맞추기 (색) ---- */

// 어느 속성이 가장 많이 달랐는지 한 줄로 알려 준다. 채도가 낮은 색은 색상 차이가 잘 보이지 않으므로 색상 차이를 그만큼 줄여 본다.
function colorHint(target, mine) {
  const hue = Math.min(Math.abs(target.h - mine.h), 360 - Math.abs(target.h - mine.h));
  const gaps = [
    { gap: (hue / 180) * (Math.min(target.s, mine.s) / 100), text: "색상이 가장 많이 달랐어요." },
    { gap: Math.abs(target.s - mine.s) / 100, text: mine.s > target.s ? "내 색이 더 선명했어요(채도)." : "내 색이 더 탁했어요(채도)." },
    { gap: Math.abs(target.l - mine.l) / 100, text: mine.l > target.l ? "내 색이 더 밝았어요(명도)." : "내 색이 더 어두웠어요(명도)." },
  ];
  const most = gaps.reduce((a, b) => (b.gap > a.gap ? b : a));
  return most.gap < 0.05 ? "거의 똑같아요!" : most.text;
}

const SLIDERS = [
  { id: "h", label: "색상", max: 359, unit: "°", track: (c) => `linear-gradient(90deg, ${[0, 60, 120, 180, 240, 300, 360].map((h) => `hsl(${h} ${c.s}% ${c.l}%)`).join(", ")})` },
  { id: "l", label: "명도", max: 100, unit: "%", track: (c) => `linear-gradient(90deg, #000, hsl(${c.h} ${c.s}% 50%), #fff)` },
  { id: "s", label: "채도", max: 100, unit: "%", track: (c) => `linear-gradient(90deg, hsl(${c.h} 0% ${c.l}%), hsl(${c.h} 100% ${c.l}%))` },
];

export function Recall({ data, onComplete }) {
  const [round, setRound] = useState(0);
  const [stage, setStage] = useState("ready");
  const [mine, setMine] = useState(() => startColor());
  const [rounds, setRounds] = useState([]);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const target = data.targets[round];
  const last = rounds[rounds.length - 1];

  function show() {
    setStage("show");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStage("pick"), data.showMs);
  }
  function confirm() {
    setRounds([...rounds, { target, mine, score: matchPercent(target, mine) }]);
    setStage("reveal");
  }
  function next() {
    if (round + 1 === data.targets.length) {
      setStage("done");
      onComplete({ template: "I", rounds, average: averageScore(rounds) });
      return;
    }
    setRound(round + 1);
    setMine(startColor());
    setStage("ready");
  }
  function restart() {
    setRound(0);
    setRounds([]);
    setMine(startColor());
    setStage("ready");
  }

  if (stage === "done")
    return (
      <div role="status">
        <p className="studio-big">
          평균 일치율 <b>{averageScore(rounds)}%</b>
        </p>
        <Palette rounds={rounds} />
        <p className="footnote">위 칸은 목표색, 아래 칸은 내가 만든 색이에요.</p>
        <button className="text-button mt-[8px]" onClick={restart}>
          다시 해보기 →
        </button>
      </div>
    );
  return (
    <div>
      <p className="game-progress" role="status">
        {round + 1} / {data.targets.length} 라운드
      </p>
      {stage === "ready" && (
        <>
          <p className="body-copy">{data.prompt}</p>
          <div className="studio-swatch is-empty" aria-hidden="true">
            ?
          </div>
          <button className="button mt-[12px]" onClick={show}>
            목표색 보기
          </button>
        </>
      )}
      {stage === "show" && (
        <>
          <p className="body-copy">잘 기억해 두세요!</p>
          <div className="studio-swatch" style={{ background: cssColor(target) }} role="img" aria-label="목표색" />
          <div className="studio-timer" aria-hidden="true">
            <i style={{ animationDuration: `${data.showMs}ms` }} />
          </div>
        </>
      )}
      {stage === "pick" && (
        <>
          <p className="body-copy">기억한 색을 만들어 보세요.</p>
          <div className="studio-swatch" style={{ background: cssColor(mine) }} role="img" aria-label="내가 만든 색" />
          <div className="mt-[12px] grid gap-[10px]">
            {SLIDERS.map((slider) => (
              <label key={slider.id} className="studio-slider">
                <span>
                  {slider.label}
                  <output>
                    {mine[slider.id]}
                    {slider.unit}
                  </output>
                </span>
                <input
                  type="range"
                  min="0"
                  max={slider.max}
                  step="1"
                  value={mine[slider.id]}
                  style={{ background: slider.track(mine) }}
                  onChange={(e) => setMine({ ...mine, [slider.id]: Number(e.target.value) })}
                />
              </label>
            ))}
          </div>
          <button className="button mt-[12px]" onClick={confirm}>
            확인
          </button>
        </>
      )}
      {stage === "reveal" && last && (
        <div role="status">
          <div className="studio-compare">
            <figure>
              <div style={{ background: cssColor(last.target) }} />
              <figcaption>목표색</figcaption>
            </figure>
            <figure>
              <div style={{ background: cssColor(last.mine) }} />
              <figcaption>내가 만든 색</figcaption>
            </figure>
          </div>
          <p className="studio-big">
            일치율 <b>{last.score}%</b>
          </p>
          <p className="body-copy text-center">{colorHint(last.target, last.mine)}</p>
          <button className="button" onClick={next}>
            {round + 1 === data.targets.length ? "결과 보기" : "다음 라운드 →"}
          </button>
        </div>
      )}
    </div>
  );
}


/* ---- J 대화로 알아내기 (사용자 인터뷰) ---- */

export function Interview({ data, onComplete }) {
  const [picks, setPicks] = useState([]);
  const [concept, setConcept] = useState(null);
  const turn = picks.length;
  const finished = turn === data.turns.length;
  const found = foundInsights(data, picks);
  const textOf = (insightId) => data.insights.find((item) => item.id === insightId)?.text || "";

  function choose(concept) {
    setConcept(concept);
    const picked = data.concepts[concept];
    onComplete({ template: "J", insights: found.map(textOf), total: data.insights.length, concept: picked.text, grounded: conceptCheck(picked, found).grounded });
  }
  function restart() {
    setPicks([]);
    setConcept(null);
  }

  return (
    <div>
      <p className="body-copy">{data.prompt}</p>
      <ol className="studio-chat" aria-label="인터뷰 대화" aria-live="polite">
        <li className="is-them">
          <span className="studio-chat-who">
            {data.persona.label} <small>{data.persona.note}</small>
          </span>
          <p>{data.opening}</p>
        </li>
        {picks.map((pick, i) => {
          const choice = data.turns[i].choices[pick];
          return (
            <Fragment key={i}>
              <li className="is-me">
                <p>{choice.ask}</p>
                <small className={`studio-kind is-${choice.kind}`}>{QUESTION_KINDS[choice.kind]}</small>
              </li>
              <li className="is-them">
                <p>{choice.reply}</p>
              </li>
              <li className={`studio-chat-note ${choice.insight ? "is-found" : ""}`}>
                {choice.insight
                  ? `인사이트 발견: ${textOf(choice.insight)}`
                  : choice.kind === "leading"
                    ? "원하는 답을 넣어 물어서 맞장구만 들었어요."
                    : "짧은 답으로 끝나 이유는 듣지 못했어요."}
              </li>
            </Fragment>
          );
        })}
      </ol>
      {!finished && (
        <>
          <p className="game-progress" role="status">
            {turn + 1} / {data.turns.length}번째 질문
          </p>
          {data.turns[turn].lead && <p className="body-copy">{data.turns[turn].lead}</p>}
          <div className="game-choices stack" role="group" aria-label="할 질문 고르기">
            {data.turns[turn].choices.map((choice, i) => (
              <button key={i} onClick={() => setPicks([...picks, i])}>
                {choice.ask}
              </button>
            ))}
          </div>
        </>
      )}
      {finished && (
        <div role="status">
          <p className="studio-big">
            찾은 인사이트 <b>{found.length}</b> / {data.insights.length}개
          </p>
          {found.length > 0 && (
            <ul className="studio-insights">
              {found.map((insightId) => (
                <li key={insightId}>{textOf(insightId)}</li>
              ))}
            </ul>
          )}
          <p className="body-copy">{data.conceptPrompt}</p>
          <div className="game-choices stack" role="group" aria-label="컨셉 고르기">
            {data.concepts.map((item, i) => {
              const check = conceptCheck(item, found);
              const state = concept === null ? "" : i === concept ? (check.grounded ? "is-right" : "is-wrong") : "is-rest";
              return (
                <button key={i} className={state} aria-pressed={i === concept} onClick={() => choose(i)}>
                  {item.text}
                </button>
              );
            })}
          </div>
          {concept !== null && (
            <p className="game-feedback">
              {(() => {
                const check = conceptCheck(data.concepts[concept], found);
                if (check.grounded) return "인터뷰에서 찾은 불편함에 근거한 컨셉이에요.";
                if (!data.concepts[concept].needs.length) return "이 컨셉은 인터뷰에서 들은 이야기와 이어지지 않아요. 근거가 있는 컨셉을 골라 보세요.";
                return `좋은 방향이지만 근거가 모자라요. 아직 못 찾은 인사이트: ${check.missing.map(textOf).join(", ")}`;
              })()}
            </p>
          )}
          <button className="text-button" onClick={restart}>
            다시 인터뷰하기 →
          </button>
        </div>
      )}
    </div>
  );
}

/* ---- K 조절해서 시험하기 (손잡이 테스트) ---- */

// 컵 단면 그림. 1mm를 SCALE만큼 그린다. 손잡이 안쪽 깊이(컵 벽에서 손잡이까지)는 그림용으로 고정했다.
const SCALE = 1.7;
const CUP = { left: 64, right: 164, top: 26, height: 90, depth: 24 };
function CupView({ data, values, person, failed, small = false }) {
  const length = values.length ?? 0;
  const thickness = values.thickness ?? 0;
  const cy = CUP.top + (CUP.height * SCALE) / 2;
  const half = (length * SCALE) / 2;
  const bar = thickness * SCALE;
  const gap = CUP.depth * SCALE;
  const x0 = CUP.right;
  const x1 = x0 + gap;
  const limit = data.limits.find((rule) => rule.id === "cup");
  const reach = limit ? (limit.max * SCALE) / 2 : null;
  const over = failed?.some((fail) => fail.id === "cup");
  const fingers = person ? [person.values.index, person.values.middle] : [];
  let y = cy - half;
  return (
    <svg viewBox="0 0 320 210" className={`studio-board ${small ? "is-small" : ""}`} role="img" aria-label={`손잡이 안쪽 길이 ${length}mm, 굵기 ${thickness}mm`}>
      <rect width="320" height="210" fill="#fff" />
      <rect x={CUP.left} y={CUP.top} width={CUP.right - CUP.left} height={CUP.height * SCALE} rx="10" fill="#e8faf7" stroke="#202b3c" strokeWidth="2" />
      {reach && (
        <g stroke="#b3b9c2" strokeDasharray="4 3">
          <line x1={x0 - 14} y1={cy - reach} x2={x0 + 6} y2={cy - reach} />
          <line x1={x0 - 14} y1={cy + reach} x2={x0 + 6} y2={cy + reach} />
        </g>
      )}
      <path
        d={`M${x0} ${cy - half - bar} H${x1 + bar - 8} Q${x1 + bar} ${cy - half - bar} ${x1 + bar} ${cy - half - bar + 8} V${cy + half + bar - 8} Q${x1 + bar} ${cy + half + bar} ${x1 + bar - 8} ${cy + half + bar} H${x0} V${cy + half} H${x1} V${cy - half} H${x0} Z`}
        fill={over ? "#fde2e3" : "#fffaea"}
        stroke={over ? "#e5484d" : "#202b3c"}
        strokeWidth="2"
      />
      {fingers.map((breadth, i) => {
        const r = (breadth * SCALE) / 2;
        const cyFinger = y + r;
        y += breadth * SCALE;
        const tight = y > cy + half + 0.01;
        return <circle key={i} cx={x0 + gap / 2} cy={cyFinger} r={r} fill={tight ? "rgba(229,72,77,0.35)" : "rgba(255,211,47,0.55)"} stroke={tight ? "#e5484d" : "#e8930c"} strokeWidth="1.5" />;
      })}
      {!small && (
        <>
          <text x={(CUP.left + CUP.right) / 2} y={CUP.top + CUP.height * SCALE + 16} textAnchor="middle" fontSize="10" fill="#637083">
            컵
          </text>
          {reach && (
            <text x={x0 - 16} y={cy - reach - 4} textAnchor="end" fontSize="9" fill="#949494">
              붙일 수 있는 높이
            </text>
          )}
        </>
      )}
    </svg>
  );
}

const SIM_STEP_MS = 650;
export function Simulation({ data, onComplete }) {
  const [values, setValues] = useState(() => startValues(data));
  const [tries, setTries] = useState(0);
  // 잡아 보는 중이면 지금 차례인 사람의 번호, 끝났으면 사람 수. 값을 바꾸면 다시 null(아직 안 잡아 봄)이 된다.
  const [shown, setShown] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const testing = shown !== null && outcome && shown < data.people.length && outcome.limits.length === 0;
  const active = testing ? data.people[shown] : null;

  function change(id, value) {
    window.clearTimeout(timer.current);
    setValues({ ...values, [id]: value });
    setShown(null);
    setOutcome(null);
  }
  function test() {
    // 잡아 보는 동안에는 다시 누르지 않는다(버튼을 끄면 키보드 초점이 사라지므로 끄지 않고 무시한다).
    if (testing) return;
    const result = evaluate(data, values);
    const attempt = tries + 1;
    setTries(attempt);
    setOutcome(result);
    window.clearTimeout(timer.current);
    if (result.limits.length) return setShown(data.people.length);
    setShown(0);
    const step = (i) => {
      timer.current = window.setTimeout(() => {
        setShown(i + 1);
        if (i + 1 < data.people.length) step(i + 1);
        else if (result.ok)
          onComplete({
            template: "K",
            params: data.params.map((param) => ({ label: param.label, value: values[param.id], unit: param.unit })),
            tries: attempt,
            people: data.people.length,
          });
      }, SIM_STEP_MS);
    };
    step(0);
  }

  const doneAll = outcome && shown === data.people.length;
  return (
    <div>
      <p className="body-copy">{data.prompt}</p>
      <CupView data={data} values={values} person={active} failed={doneAll ? outcome.limits : null} />
      <div className="mt-[12px] grid gap-[10px]">
        {data.params.map((param) => (
          <label key={param.id} className="studio-slider">
            <span>
              {param.label}
              <output>
                {values[param.id]}
                {param.unit}
              </output>
            </span>
            <input
              type="range"
              className="is-plain"
              min={param.min}
              max={param.max}
              step={param.step}
              value={values[param.id]}
              disabled={!!testing}
              onChange={(e) => change(param.id, Number(e.target.value))}
            />
          </label>
        ))}
      </div>
      <ul className="studio-people" aria-label="잡아 보는 사람들">
        {data.people.map((person, i) => {
          const judged = outcome && shown !== null && i < shown && outcome.limits.length === 0 ? outcome.people[i] : null;
          const state = judged ? (judged.ok ? "is-ok" : "is-bad") : active?.id === person.id ? "is-active" : "";
          return (
            <li key={person.id} className={state}>
              <Face mood={judged ? (judged.ok ? "good" : "bad") : "wait"} />
              <b>{person.label}</b>
              <small>{person.note}</small>
              <small>
                손가락 너비 {person.values.index}·{person.values.middle}mm
              </small>
              <p role="status">{judged ? (judged.ok ? data.good : judged.fails[0].message) : active?.id === person.id ? "잡아 보는 중…" : "대기"}</p>
            </li>
          );
        })}
      </ul>
      {doneAll && outcome.limits.length > 0 && (
        <p className="game-feedback" role="alert">
          {outcome.limits[0].message}
        </p>
      )}
      {doneAll && outcome.ok && (
        <p className="studio-big" role="status">
          {data.done}
          <br />
          <small>{tries}번 만에 찾았어요</small>
        </p>
      )}
      <button className="button mt-[10px]" onClick={test} aria-disabled={!!testing}>
        {tries ? "다시 잡아 보기" : "잡아 보기"}
      </button>
      {data.footnote && <p className="footnote">{data.footnote}</p>}
      <details className="studio-sources">
        <summary>손 크기 자료 출처</summary>
        <ul>
          {data.people.map((person) => (
            <li key={person.id}>
              {person.label}({person.note}): {person.source}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function Face({ mood }) {
  const mouth = mood === "good" ? "M9 15 Q14 20 19 15" : mood === "bad" ? "M9 18 Q14 13 19 18" : "M10 16 H18";
  return (
    <svg viewBox="0 0 28 28" width="34" height="34" aria-hidden="true">
      <circle cx="14" cy="14" r="12.5" fill={mood === "good" ? "#e8faf7" : mood === "bad" ? "#fde2e3" : "#fffaea"} stroke="#202b3c" strokeWidth="1.5" />
      <circle cx="10" cy="11" r="1.4" fill="#202b3c" />
      <circle cx="18" cy="11" r="1.4" fill="#202b3c" />
      <path d={mouth} fill="none" stroke="#202b3c" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* ---- L 재어서 법칙 찾기 (버튼 크기 실험) ---- */

const TAP_BAR = { top: 12, height: TAP.height - 24 };
// 판 좌표로 바꾼 포인터 x. 화면이 통째로 확대·축소돼도 그림 크기 기준으로 잰다.
const boardX = (event) => {
  const rect = event.currentTarget.getBoundingClientRect();
  return ((event.clientX - rect.left) / rect.width) * TAP.width;
};

export function Tap({ data, onComplete }) {
  // 진행 상태는 빠르게 연달아 누를 때도 어긋나지 않게 ref에 두고, 그릴 때만 tick을 올린다.
  const run = useRef(null);
  const [, setTick] = useState(0);
  const [rounds, setRounds] = useState(null);
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef(0);
  const bars = useRef([]);
  const viaKeyboard = useRef(false);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);
  const state = run.current;
  const target = state ? data.targets[state.order[state.at]] : null;

  // 키보드로 누르고 있으면 다음 막대로 초점을 옮긴다.
  useEffect(() => {
    if (state && viaKeyboard.current) bars.current[state.side]?.focus();
  });

  function start() {
    run.current = { order: shuffle(data.targets.map((_, i) => i)), at: 0, side: 0, last: null, times: [], misses: 0, done: [] };
    setRounds(null);
    setTick((n) => n + 1);
  }
  function hit() {
    const s = run.current;
    const now = performance.now();
    if (s.last !== null) s.times.push(now - s.last);
    s.last = now;
    s.side = 1 - s.side;
    if (s.times.length === data.taps) {
      const index = s.order[s.at];
      const { width, distance } = data.targets[index];
      s.done[index] = { width, distance, ms: Math.max(1, Math.round(median(s.times))), misses: s.misses };
      if (s.at + 1 === s.order.length) {
        run.current = null;
        const result = { template: "L", rounds: s.done };
        setRounds(s.done);
        onComplete(result);
      } else Object.assign(s, { at: s.at + 1, side: 0, last: null, times: [], misses: 0 });
    }
    setTick((n) => n + 1);
  }
  function miss() {
    const s = run.current;
    // 시계가 돌기 시작한 뒤(첫 막대를 누른 뒤)의 헛누름만 센다.
    if (s.last !== null) s.misses += 1;
    setFlash(true);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(false), 160);
    setTick((n) => n + 1);
  }
  function pointer(event) {
    if (!run.current || event.button > 0) return;
    event.preventDefault();
    viaKeyboard.current = false;
    const now = data.targets[run.current.order[run.current.at]];
    if (hitBar(boardX(event), barCenters(now)[run.current.side], now.width)) hit();
    else miss();
  }
  function key(event, side) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (event.repeat || !run.current || side !== run.current.side) return;
    viaKeyboard.current = true;
    hit();
  }

  if (rounds)
    return (
      <div>
        <TapLaw data={data} rounds={rounds} />
        <button className="text-button mt-[8px]" onClick={start}>
          실험 다시 하기 →
        </button>
      </div>
    );
  if (!state)
    return (
      <div>
        <p className="body-copy">{data.prompt}</p>
        <button className="button mt-[10px]" onClick={start}>
          실험 시작하기
        </button>
        <p className="footnote">{data.footnote}</p>
      </div>
    );
  const centers = barCenters(target);
  return (
    <div>
      <p className="game-progress" role="status">
        {state.at + 1} / {state.order.length}번째 막대 · {state.last === null ? "왼쪽 막대를 누르면 시작해요" : `${state.times.length} / ${data.taps}번`}
      </p>
      <svg
        viewBox={`0 0 ${TAP.width} ${TAP.height}`}
        className="studio-board"
        style={{ cursor: "pointer" }}
        onPointerDown={pointer}
        role="group"
        aria-label="번갈아 누르기 판"
      >
        <rect width={TAP.width} height={TAP.height} fill={flash ? "#fde2e3" : "#fff"} />
        {centers.map((center, side) => {
          const on = side === state.side;
          return (
            <rect
              key={`${state.at}-${side}`}
              ref={(node) => (bars.current[side] = node)}
              x={center - target.width / 2}
              y={TAP_BAR.top}
              width={target.width}
              height={TAP_BAR.height}
              rx="4"
              fill={on ? "#087f77" : "#e8faf7"}
              stroke={on ? "#087f77" : "#b3b9c2"}
              strokeWidth="1.5"
              tabIndex={on ? 0 : -1}
              role="button"
              aria-label={on ? `지금 누를 막대(${side ? "오른쪽" : "왼쪽"})` : `다음에 누를 막대(${side ? "오른쪽" : "왼쪽"})`}
              onKeyDown={(event) => key(event, side)}
            />
          );
        })}
      </svg>
      <p className="footnote">
        색이 진한 막대를 빠르고 정확하게 눌러요. 헛누름 {state.misses}번
      </p>
    </div>
  );
}

// 내 기록 그래프(어려움 지수 → 걸린 시간)와 법칙 직선, 그리고 그 법칙으로 버튼 크기 정해 보기.
function TapLaw({ data, rounds, small = false }) {
  const law = tapLaw(rounds);
  const top = Math.max(...law.points.map((p) => p.ms), law.line ? predictTap(law.line, { width: data.apply.min, distance: data.apply.distance }) : 0) * 1.15;
  const box = { left: 40, right: 308, top: 12, bottom: 136 };
  const maxId = Math.ceil(Math.max(...law.points.map((p) => p.id), difficulty({ width: data.apply.min, distance: data.apply.distance })));
  const sx = (id) => box.left + (id / maxId) * (box.right - box.left);
  const sy = (ms) => box.bottom - (ms / top) * (box.bottom - box.top);
  const first = law.points[0];
  const last = law.points[law.points.length - 1];
  return (
    <div>
      <svg viewBox="0 0 320 160" className={`studio-board is-small ${small ? "" : "mt-[4px]"}`} role="img" aria-label={`내 기록: ${law.points.map((p) => `어려움 ${p.id.toFixed(1)}비트 ${p.ms}ms`).join(", ")}`}>
        <rect width="320" height="160" fill="#fff" />
        <line x1={box.left} y1={box.bottom} x2={box.right} y2={box.bottom} stroke="#b3b9c2" />
        <line x1={box.left} y1={box.top} x2={box.left} y2={box.bottom} stroke="#b3b9c2" />
        {Array.from({ length: maxId + 1 }, (_, i) => (
          <text key={i} x={sx(i)} y={box.bottom + 12} textAnchor="middle" fontSize="9" fill="#637083">
            {i}
          </text>
        ))}
        <text x={(box.left + box.right) / 2} y="158" textAnchor="middle" fontSize="9" fill="#637083">
          누르기 어려움(비트) · 오른쪽일수록 작고 먼 막대
        </text>
        <text x={box.left - 4} y={box.top + 4} textAnchor="end" fontSize="9" fill="#637083">
          {seconds(top)}
        </text>
        <text x={box.left - 4} y={box.bottom} textAnchor="end" fontSize="9" fill="#637083">
          0
        </text>
        {law.line && (
          <line x1={sx(0)} y1={sy(Math.max(0, law.line.a))} x2={sx(maxId)} y2={sy(Math.max(0, law.line.a + law.line.b * maxId))} stroke={law.effect ? "#087f77" : "#b3b9c2"} strokeWidth="2" strokeDasharray={law.effect ? "" : "4 3"} />
        )}
        {law.points.map((p, i) => (
          <circle key={i} cx={sx(p.id)} cy={sy(p.ms)} r="4.5" fill="#ffd32f" stroke="#202b3c" strokeWidth="1.2" />
        ))}
      </svg>
      <p className="body-copy mt-[8px]" role="status">
        크고 가까운 막대 <b>{seconds(first.ms)}</b> → 작고 먼 막대 <b>{seconds(last.ms)}</b>
        <br />
        {law.effect ? `어려움이 1비트 늘 때마다 ${Math.round(law.line.b)}ms씩 더 걸렸어요. ${data.effect}` : data.noEffect}
      </p>
      <p className="footnote">
        헛누름 {rounds.reduce((sum, round) => sum + round.misses, 0)}번 · 막대마다 {data.taps}번 잰 시간의 가운데값이에요.
      </p>
      {law.effect && !small && <TapApply data={data} line={law.line} />}
    </div>
  );
}

function TapApply({ data, line }) {
  const { apply } = data;
  const [width, setWidth] = useState(apply.start);
  const target = { width, distance: apply.distance };
  const start = TAP.width / 2 - apply.distance / 2;
  const percent = Math.round((width / TAP.width) * 100);
  return (
    <section className="mt-[14px]" aria-label="내 법칙으로 버튼 크기 정하기">
      <p className="body-copy">{apply.prompt}</p>
      <svg viewBox={`0 0 ${TAP.width} 70`} className="studio-board is-small" role="img" aria-label={`${apply.label} 화면 폭의 ${percent}%`}>
        <rect width={TAP.width} height="70" fill="#fff" />
        <circle cx={start} cy="35" r="6" fill="#ffd32f" stroke="#202b3c" strokeWidth="1.2" />
        <line x1={start + 8} y1="35" x2={start + apply.distance - width / 2 - 4} y2="35" stroke="#b3b9c2" strokeDasharray="4 3" />
        <rect x={start + apply.distance - width / 2} y="17" width={width} height="36" rx="6" fill="#087f77" />
      </svg>
      <label className="studio-slider mt-[10px]">
        <span>
          {apply.label}
          <output>화면 폭의 {percent}%</output>
        </span>
        <input type="range" className="is-plain" min={apply.min} max={apply.max} step="1" value={width} aria-valuetext={`화면 폭의 ${percent}%`} onChange={(e) => setWidth(Number(e.target.value))} />
      </label>
      <p className="studio-big" role="status">
        예상 시간 <b>{seconds(predictTap(line, target))}</b>
        <br />
        <small>어려움 {difficulty(target).toFixed(1)}비트 · 내 기록으로 구한 법칙으로 계산했어요</small>
      </p>
    </section>
  );
}
const seconds = (ms) => `${(ms / 1000).toFixed(2)}초`;

/* ---- M 모이는 점 찾기 (소실점 탐정) ---- */

const { width: VW, height: VH } = VANISH;
const SCENE_INK = "#5b3a24";
const PIN_MINT = "#14b8ad";
const ANSWER_FILL = "#ffd23f";
const ANSWER_LINE = "#f0b400";
const ANSWER_INK = "#7a5200";
const PIN_STEP = { small: 4, big: 16 };
const STAR_WORDS = { 3: "정확해요! 소실점을 딱 찾았어요.", 2: "거의 맞았어요. 노란 점과 비교해 보세요.", 1: "조금 멀어요. 노란 선이 어디서 만나는지 보세요." };
const clampScene = ([x, y]) => [Math.min(VW, Math.max(0, x)), Math.min(VH, Math.max(0, y))];

// 화면 좌표(포인터)를 장면 좌표로 바꾼다. 앱 전체를 CSS로 확대·축소해도 getScreenCTM이 그만큼을 함께 계산한다.
function scenePoint(svg, e) {
  const ctm = svg?.getScreenCTM();
  if (!ctm) return null;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  return clampScene([p.x, p.y]);
}

function Stars({ n, max = 3 }) {
  return (
    <span className="vanish-stars" role="img" aria-label={`별 ${max}개 중 ${n}개`}>
      {"★".repeat(n)}
      <span className="is-off">{"★".repeat(max - n)}</span>
    </span>
  );
}

function PinRound({ round, onJudge, onReset }) {
  const [pins, setPins] = useState(() => round.pinStart.map((p) => [...p]));
  const [judged, setJudged] = useState(null);
  const drag = useRef(null);
  const board = useRef(null);
  // 모서리마다 점선을 그을 핀: 판정과 같은 방법(가까운 쪽끼리)으로 짝짓는다.
  const { pinOf } = matchPins(pins, round.answer);
  const place = (i, p) => setPins((list) => list.map((q, j) => (j === i ? clampScene(p) : q)));

  const down = (e) => {
    if (judged || e.button > 0) return;
    const p = scenePoint(board.current, e);
    if (!p) return;
    e.preventDefault();
    const grabbed = e.target.closest?.("[data-pin]");
    // 핀을 잡으면 잡은 자리를 유지하고, 빈 곳을 누르면 가장 가까운 핀이 그 자리로 온다.
    const gap = (q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
    const i = grabbed ? Number(grabbed.dataset.pin) : pins.reduce((best, q, j) => (gap(q) < gap(pins[best]) ? j : best), 0);
    const offset = grabbed ? [pins[i][0] - p[0], pins[i][1] - p[1]] : [0, 0];
    board.current.setPointerCapture?.(e.pointerId);
    drag.current = { i, id: e.pointerId, offset };
    if (!grabbed) place(i, p);
  };
  const move = (e) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    const p = scenePoint(board.current, e);
    if (!p) return;
    e.preventDefault();
    const { i, offset } = drag.current;
    place(i, [p[0] + offset[0], p[1] + offset[1]]);
  };
  const up = () => {
    drag.current = null;
  };
  // 키보드: 핀에 초점을 두고 방향키로 옮긴다(Shift를 누르면 크게).
  const key = (i) => (e) => {
    if (judged) return;
    const step = e.shiftKey ? PIN_STEP.big : PIN_STEP.small;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!moves[e.key]) return;
    e.preventDefault();
    place(i, [pins[i][0] + moves[e.key][0], pins[i][1] + moves[e.key][1]]);
  };
  function judge() {
    const result = judgePins(pins, round.answer);
    setJudged(result);
    onJudge({ type: "pin", stars: result.stars, distance: result.distance });
  }
  function retry() {
    setPins(round.pinStart.map((p) => [...p]));
    setJudged(null);
    onReset();
  }

  const many = pins.length > 1;
  return (
    <div>
      <p className="body-copy">
        {round.hint} {many ? "핀 두 개를" : "핀을"} 끌어서 선이 모이는 곳에 놓고 확인을 눌러요.
      </p>
      <svg
        ref={board}
        viewBox={`0 0 ${VW} ${VH}`}
        className={`studio-board vanish-board ${judged ? "is-judged" : ""}`}
        role="group"
        aria-label={`${round.title} 장면`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onLostPointerCapture={up}
      >
        <rect width={VW} height={VH} fill="#fff" />
        {judged &&
          round.edges.map((edge, i) => {
            const [x, y] = round.answer[edge.vp];
            return <line key={`a${i}`} x1={edge.from[0]} y1={edge.from[1]} x2={x} y2={y} stroke={ANSWER_LINE} strokeWidth="2.4" strokeLinecap="round" />;
          })}
        {round.scene.map(([x1, y1, x2, y2], i) => (
          <line key={`s${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={SCENE_INK} strokeWidth="3" strokeLinecap="round" />
        ))}
        {round.edges.map((edge, i) => {
          const [x, y] = pins[pinOf[edge.vp]];
          return <line key={`d${i}`} x1={edge.from[0]} y1={edge.from[1]} x2={x} y2={y} stroke={PIN_MINT} strokeWidth="2" strokeDasharray="7 6" strokeLinecap="round" />;
        })}
        {pins.map(([x, y], i) => (
          <g
            key={`p${i}`}
            data-pin={i}
            className="vanish-pin"
            tabIndex={judged ? -1 : 0}
            role="button"
            aria-roledescription="끌 수 있는 핀"
            aria-label={`${many ? `핀 ${i + 1}` : "핀"}, 가로 ${Math.round(x)}, 세로 ${Math.round(y)}. 방향키로 옮겨요.`}
            onKeyDown={key(i)}
          >
            <circle cx={x} cy={y} r="24" fill="transparent" />
            <circle className="vanish-pin-ring" cx={x} cy={y} r="13" fill={PIN_MINT} stroke="#fff" strokeWidth="3" />
            {many && (
              <text x={x} y={y + 4.5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff" pointerEvents="none">
                {i + 1}
              </text>
            )}
          </g>
        ))}
        {judged &&
          round.answer.map(([x, y], i) => (
            <g key={`v${i}`} pointerEvents="none">
              <circle cx={x} cy={y} r="8" fill={ANSWER_FILL} stroke={ANSWER_INK} strokeWidth="2" />
              <text x={Math.min(VW - 22, Math.max(22, x))} y={y < 40 ? y + 26 : y - 14} textAnchor="middle" fontSize="12" fontWeight="700" fill={ANSWER_INK}>
                소실점
              </text>
            </g>
          ))}
      </svg>
      {!judged ? (
        <button className="button mt-[12px]" onClick={judge}>
          확인
        </button>
      ) : (
        <div role="status" className="mt-[10px]">
          <p className="studio-big">
            <Stars n={judged.stars} />
          </p>
          <p className="body-copy text-center">{STAR_WORDS[judged.stars]}</p>
          <p className="studio-legend justify-center" aria-hidden="true">
            <i style={{ background: SCENE_INK }} /> 장면 <i style={{ background: PIN_MINT }} /> 내 핀까지 <i style={{ background: ANSWER_LINE }} /> 정답 소실점까지
          </p>
          <p className="body-copy">{round.explain}</p>
          <button className="text-button" onClick={retry}>
            이 라운드 다시 하기
          </button>
        </div>
      )}
    </div>
  );
}

function Thumb({ lines }) {
  return (
    <svg viewBox={`0 0 ${THUMB} ${THUMB}`} aria-hidden="true">
      {lines.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={SCENE_INK} strokeWidth="2" strokeLinecap="round" />
      ))}
    </svg>
  );
}

function PickRound({ round, onJudge, onReset }) {
  const [picked, setPicked] = useState(null);
  const letter = (id) => id.toUpperCase();
  function pick(id) {
    setPicked(id);
    onJudge({ type: "pick", correct: id === round.answer });
  }
  return (
    <div>
      <p className="body-copy">스케치 {round.options.length}장 중 투시가 틀린 것 하나를 골라요.</p>
      <div className="vanish-picks" role="group" aria-label="스케치 고르기">
        {round.options.map((option) => {
          const mark = picked === null ? "" : option.id === round.answer ? "is-answer" : option.id === picked ? "is-wrong" : "";
          return (
            <button
              key={option.id}
              className={`vanish-pick ${mark}`}
              onClick={() => pick(option.id)}
              disabled={picked !== null}
              aria-label={`스케치 ${letter(option.id)}${mark === "is-answer" ? " (정답)" : mark === "is-wrong" ? " (내가 고른 오답)" : ""}`}
            >
              <Thumb lines={option.lines} />
              <span>{letter(option.id)}</span>
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div role="status" className="mt-[10px]">
          <p className="studio-big">{picked === round.answer ? "정답이에요!" : `아쉬워요. 정답은 ${letter(round.answer)}예요.`}</p>
          <p className="body-copy">{round.explain}</p>
          <button
            className="text-button"
            onClick={() => {
              setPicked(null);
              onReset();
            }}
          >
            다시 고르기
          </button>
        </div>
      )}
    </div>
  );
}

function VanishResult({ data, result }) {
  const { stars, max } = vanishStars(result);
  return (
    <div>
      <ul className="vanish-score">
        {result.rounds.map((round, i) => (
          <li key={i}>
            <span>
              {i + 1}. {data.rounds?.[i]?.title || `${i + 1}라운드`}
            </span>
            {round.type === "pin" ? <Stars n={round.stars} /> : <b className={round.correct ? "is-right" : "is-wrong"}>{round.correct ? "정답" : "오답"}</b>}
          </li>
        ))}
      </ul>
      <p className="studio-big">
        총 별 <b>{stars}</b> / {max}개
      </p>
      {data.done && <p className="body-copy text-center">{data.done}</p>}
    </div>
  );
}

export function Vanish({ data, onComplete }) {
  const [at, setAt] = useState(0);
  const [records, setRecords] = useState([]);
  const [result, setResult] = useState(null);
  const round = data.rounds[at];
  const last = at === data.rounds.length - 1;
  const record = (value) => setRecords((list) => Object.assign([...list], { [at]: value }));

  function next() {
    if (!last) return setAt(at + 1);
    const value = { template: "M", title: data.title, subject: data.subject, rounds: data.rounds.map((_, i) => records[i]) };
    setResult(value);
    onComplete(value);
  }
  function restart() {
    setAt(0);
    setRecords([]);
    setResult(null);
  }

  if (result)
    return (
      <div role="status">
        <VanishResult data={data} result={result} />
        <button className="text-button mt-[8px]" onClick={restart}>
          처음부터 다시 →
        </button>
      </div>
    );
  const Round = round.type === "pin" ? PinRound : PickRound;
  return (
    <div>
      <p className="game-progress" role="status">
        {at + 1} / {data.rounds.length} 라운드 · {round.title}
      </p>
      <Round key={at} round={round} onJudge={record} onReset={() => record(undefined)} />
      {records[at] && (
        <button className="button mt-[12px]" onClick={next}>
          {last ? "결과 보기" : "다음 라운드 →"}
        </button>
      )}
    </div>
  );
}

/* ---- 기존 틀(C 분류하기)을 학과 전용 체험에서 쓸 때: 요약 한 줄을 결과로 저장한다. ---- */
function SummaryGame({ data, onComplete }) {
  return <Experience data={data} onComplete={(summary) => onComplete({ template: data.template, summary })} />;
}

const games = { H: Sketch, I: Recall, J: Interview, K: Simulation, L: Tap, M: Vanish, C: SummaryGame };
