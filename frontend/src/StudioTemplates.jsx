import React, { useEffect, useRef, useState } from "react";
import {
  GOOD_LINE,
  MIN_LINE,
  SKETCH,
  averageScore,
  cssColor,
  fitStroke,
  matchPercent,
  scoreSketch,
  simplifyStroke,
  startColor,
  studioTemplates,
} from "./studio.js";

// 학과 전용 체험의 화면: 배우기 카드, 체험 여러 개를 차례로 하는 틀, 틀 H(그리기)·I(기억해서 맞추기), 결과 요약.
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
          {studioTemplates[part.template].title}
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

const games = { H: Sketch, I: Recall };
