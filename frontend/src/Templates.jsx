import React, { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { img } from "./assets.js";
import { T } from "./ui.jsx";
import { PLAN_FIELDS } from "./model.js";
import { moveStep, rightPlaces } from "./lessonGames.js";
import {
  checkPicks,
  inversions,
  isSorted,
  makeTrials,
  predict,
  startOrder,
  summarizeReaction,
  swapAdjacent,
  trainStump,
} from "./experiences.js";

// 체험 틀의 화면. 데이터 형식과 채점은 experiences.js에 있다.
// 틀마다 data(검사를 통과한 체험 데이터)를 받고, 체험을 끝내면 onComplete(요약 한 줄)를 부른다.

const sceneImages = { sand: img.sceneSand, paint: img.scenePaint };
const hasBatchim = (word) => {
  const code = word.charCodeAt(word.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
};

function Restart({ children, onClick }) {
  return (
    <button className="text-button" onClick={onClick}>
      {children}
    </button>
  );
}

/* ---- A 문지르기·칠하기: 장면을 문질러 단계를 넘긴다. 문지르면 가루나 물감이 튄다. ---- */
const GOAL = 26;
export function Rub({ data, year, onDone, onQuit }) {
  const [phase, setPhase] = useState(0);
  const progress = useRef(0);
  const phaseRef = useRef(0);
  const [particles, setParticles] = useState([]);
  const [rubbing, setRubbing] = useState(false);
  const [touched, setTouched] = useState(false);
  const last = useRef(null);
  const idRef = useRef(0);
  const area = useRef(null);
  const done = useRef(false);
  const current = data.phases[phase];

  const emit = (x, y, n) => {
    const paint = current.particles === "paint";
    const items = Array.from({ length: n }, () => {
      const a = Math.random() * Math.PI * 2;
      const r = 18 + Math.random() * 46;
      return {
        id: idRef.current++,
        x,
        y,
        dx: Math.cos(a) * r,
        dy: Math.sin(a) * r - (paint ? 0 : 18),
        size: paint ? 10 + Math.random() * 16 : 3 + Math.random() * 5,
        color: paint ? (Math.random() > 0.3 ? "#27d8cd" : "#1aa69e") : Math.random() > 0.5 ? "#f3f1ec" : "#cfcac1",
        kind: paint ? "paint" : "dust",
      };
    });
    setParticles((p) => [...p.slice(-60), ...items]);
    window.setTimeout(() => setParticles((p) => p.filter((q) => !items.includes(q))), 900);
  };

  const advance = (amount) => {
    if (done.current) return;
    progress.current += amount;
    if (progress.current < GOAL) return;
    done.current = true;
    window.setTimeout(() => {
      if (phaseRef.current < data.phases.length - 1) {
        phaseRef.current += 1;
        setPhase(phaseRef.current);
        progress.current = 0;
        done.current = false;
      } else {
        onDone();
      }
    }, 380);
  };

  const point = (e) => {
    const r = area.current.getBoundingClientRect();
    const scale = r.width / 402;
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };
  const big = current.particles === "paint";
  const down = (e) => {
    e.target.setPointerCapture?.(e.pointerId);
    const p = point(e);
    last.current = p;
    setRubbing(true);
    setTouched(true);
    emit(p.x, p.y, big ? 6 : 8);
    advance(2);
  };
  const move = (e) => {
    if (!last.current) return;
    const p = point(e);
    if (Math.hypot(p.x - last.current.x, p.y - last.current.y) > 16) {
      last.current = p;
      emit(p.x, p.y, big ? 3 : 4);
      advance(1);
    }
  };
  const up = () => {
    last.current = null;
    setRubbing(false);
  };
  // 키보드로도 할 수 있게: 스페이스나 엔터를 누를 때마다 한 번 문지른다.
  const key = (e) => {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    setTouched(true);
    emit(201, 330, big ? 6 : 8);
    advance(2);
  };

  // 화면이 낮으면 '그만하기'까지 다 보이도록 장면을 줄이고, 양옆에 남는 자리는 같은 그림을 흐리게 깔아 채운다.
  return (
    <div className="absolute inset-x-0 bottom-0 top-[112px] overflow-hidden bg-[#b3a28e]">
      <img
        src={sceneImages[current.scene]}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full scale-125 object-cover blur-[12px]"
      />
      <div
        ref={area}
        tabIndex={0}
        role="application"
        aria-label={`${year}학년 ${data.title} ${current.label}. 장면을 문지르거나 스페이스를 눌러요.`}
        className="absolute left-0 top-0 h-[762px] w-[402px] origin-top touch-none select-none overflow-hidden outline-none"
        style={{ scale: "min(1, (var(--vh) + var(--tt) - 112) / 734)" }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={key}
      >
        {/* 장면 그림 아래쪽에 함께 그려진 기기 장식이 보이지 않도록 조금 키워서 잘라낸다. */}
        <div className="absolute left-[-7px] top-0 h-[789px] w-[416px]" style={{ animation: rubbing ? "rub 0.14s linear infinite" : undefined }}>
          {data.phases.map((item, i) => (
            <img
              key={item.scene + i}
              src={sceneImages[item.scene]}
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full transition-opacity duration-700"
              style={{ opacity: i <= phase ? 1 : 0 }}
            />
          ))}
        </div>
        <div className="pointer-events-none absolute left-[26px] top-[42px] h-[108px] w-[349px] rounded-[21px] bg-white">
          <T y={31} size={18} center className="font-bold text-ink">
            {year}학년 {data.title}
          </T>
          <T y={66} size={15} center className="text-gray">
            {current.label}
          </T>
        </div>
        {!touched && (
          <span
            className="loop pointer-events-none absolute left-[161px] top-[290px] h-[80px] w-[80px] rounded-full border-2 border-white/90"
            style={{ animation: "ripple 1.6s ease-out infinite" }}
          />
        )}
        {particles.map((p) => (
          <span
            key={p.id}
            className="pointer-events-none absolute rounded-full"
            style={{
              left: p.x - p.size / 2,
              top: p.y - p.size / 2,
              width: p.size,
              height: p.size,
              background: p.color,
              boxShadow: p.kind === "dust" ? "0 0 2px rgba(0,0,0,0.15)" : undefined,
              animation: p.kind === "paint" ? "splat 0.8s ease-out both" : "particle 0.85s cubic-bezier(0.22,1,0.36,1) both",
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
            }}
          />
        ))}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={onQuit}
          aria-label="그만하기"
          className="absolute left-[14px] top-[676px] h-[46px] w-[375px] rounded-[12px] transition-colors active:bg-black/5"
        />
      </div>
    </div>
  );
}

/* ---- B 순서 맞추기 ---- */
// 이웃 교환(adjacent): 카드 사이의 ⇄로 이웃끼리 바꾼다. 최소 교환 횟수(역순 쌍의 수)와 비교해 보여준다.
function AdjacentOrder({ data, onComplete }) {
  const size = data.items.length;
  const [order, setOrder] = useState(() => startOrder(size, "adjacent"));
  const [minimum, setMinimum] = useState(() => inversions(order));
  const [swaps, setSwaps] = useState(0);
  const done = isSorted(order);

  function swap(index) {
    const next = swapAdjacent(order, index);
    setOrder(next);
    setSwaps(swaps + 1);
    if (isSorted(next)) onComplete(`교환 ${swaps + 1}번으로 정렬 · 최소 ${minimum}번`);
  }
  function restart() {
    const next = startOrder(size, "adjacent");
    setOrder(next);
    setMinimum(inversions(next));
    setSwaps(0);
  }
  return (
    <>
      <p className="body-copy">{data.prompt}</p>
      <div className="sort-row">
        {order.map((step, i) => (
          <Fragment key={step}>
            <span className="sort-card">{data.items[step]}</span>
            {i < size - 1 && (
              <button
                className="sort-swap"
                disabled={done}
                aria-label={`${data.items[step]}와 ${data.items[order[i + 1]]} 바꾸기`}
                onClick={() => swap(i)}
              >
                ⇄
              </button>
            )}
          </Fragment>
        ))}
      </div>
      <p className="game-progress" role="status">
        교환 {swaps}번{done ? " · 정렬 완료!" : ""}
      </p>
      {done && (
        <>
          <p className="body-copy">
            {swaps === minimum
              ? `가장 적은 횟수인 ${minimum}번 만에 정렬했어요.`
              : `${swaps}번 만에 정렬했어요. 이 배치는 최소 ${minimum}번이면 돼요.`}{" "}
            {data.explanation}
          </p>
          <Restart onClick={restart}>새로 섞어서 다시 하기 →</Restart>
        </>
      )}
    </>
  );
}

// 자리 옮기기(move): 화살표로 단계를 위아래로 옮기고 확인한다. 세 번 틀리면 정답을 볼 수 있다.
function MoveOrder({ data, onComplete }) {
  const size = data.items.length;
  const [order, setOrder] = useState(() => startOrder(size, "move"));
  const [tries, setTries] = useState(0);
  // null: 확인 전, 숫자: 제자리에 있는 단계 수, "shown": 정답을 보고 끝냄
  const [result, setResult] = useState(null);
  const list = useRef(null);
  const focus = useRef(null);
  const done = result === size || result === "shown";

  // 단계를 옮긴 뒤에도 키보드 초점이 그 단계를 따라가게 한다.
  useLayoutEffect(() => {
    if (!focus.current) return;
    const [row, delta] = focus.current;
    focus.current = null;
    const buttons = list.current?.querySelectorAll(`[data-row="${row}"]:not(:disabled)`) || [];
    ([...buttons].find((button) => Number(button.dataset.delta) === delta) || buttons[0])?.focus();
  }, [order]);

  function move(index, delta) {
    focus.current = [index + delta, delta];
    setOrder(moveStep(order, index, delta));
    setResult(null);
  }
  function check() {
    const right = rightPlaces(order);
    setTries(tries + 1);
    setResult(right);
    if (right === size) onComplete(`${size}단계 순서 맞추기 · ${tries + 1}번 만에 완성`);
  }
  function reveal() {
    setOrder(order.map((_, i) => i));
    setResult("shown");
    onComplete(`${size}단계 순서 맞추기 · 정답을 보고 확인`);
  }
  function restart() {
    setOrder(startOrder(size, "move"));
    setTries(0);
    setResult(null);
  }

  return (
    <>
      <p className="body-copy">
        {data.prompt}
        {!done && " 화살표 버튼으로 자리를 옮겨요."}
      </p>
      <ol className="order-list" ref={list}>
        {order.map((step, index) => (
          <li key={step}>
            <span className="order-number">{index + 1}</span>
            <span className="order-text">{data.items[step]}</span>
            {!done && (
              <>
                <button
                  data-row={index}
                  data-delta={-1}
                  disabled={index === 0}
                  aria-label={`‘${data.items[step]}’ 위로 옮기기`}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  data-row={index}
                  data-delta={1}
                  disabled={index === size - 1}
                  aria-label={`‘${data.items[step]}’ 아래로 옮기기`}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
              </>
            )}
          </li>
        ))}
      </ol>
      {done ? (
        <div role="status">
          <p className="body-copy">
            <strong>{result === "shown" ? "올바른 순서예요." : `${tries}번 만에 순서를 맞혔어요.`}</strong> {data.explanation}
          </p>
          <Restart onClick={restart}>다시 해보기 →</Restart>
        </div>
      ) : (
        <>
          <p className="game-feedback" role="status">
            {result !== null && `아직 순서가 달라요. ${size}개 중 ${result}개가 제자리에 있어요.`}
          </p>
          <button className="button" onClick={check}>
            순서 확인하기
          </button>
          {tries >= 3 && (
            <button className="text-button" onClick={reveal}>
              정답 보기 →
            </button>
          )}
        </>
      )}
    </>
  );
}

export function OrderTemplate({ data, onComplete }) {
  return data.swap === "adjacent" ? <AdjacentOrder data={data} onComplete={onComplete} /> : <MoveOrder data={data} onComplete={onComplete} />;
}

/* ---- C 분류하기: 카드마다 칸별로 보기를 고르고 확인한다. 틀리면 맞힐 때까지 다시 고른다. ---- */
function Classify({ data, onComplete }) {
  const empty = () => data.slots.map(() => "");
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState(empty);
  const [feedback, setFeedback] = useState(null);
  const [tried, setTried] = useState(false);
  const [firstTry, setFirstTry] = useState(0);
  const total = data.items.length;
  const item = data.items[index];
  const unit = (n) => `${n}${data.unit}`;

  function check() {
    const correct = checkPicks(item, picks);
    const first = firstTry + (correct && !tried ? 1 : 0);
    setFirstTry(first);
    setTried(true);
    setFeedback(correct);
    if (correct && index === total - 1) onComplete(`${data.noun} ${unit(total)} · 한 번에 맞힌 것 ${unit(first)}`);
  }
  function goTo(number) {
    setIndex(number);
    setPicks(empty());
    setFeedback(null);
    setTried(false);
  }
  const next = () => goTo(index + 1);
  function restart() {
    setFirstTry(0);
    goTo(0);
  }
  if (index >= total)
    return (
      <div role="status">
        <p className="body-copy">
          {data.noun} {unit(total)}
          {hasBatchim(data.unit) ? "을" : "를"} 모두 마쳤어요. 한 번에 맞힌 것은 {unit(firstTry)}
          {hasBatchim(data.unit) ? "이에요" : "예요"}. {data.explanation}
        </p>
        <Restart onClick={restart}>처음부터 다시 하기 →</Restart>
      </div>
    );
  const pick = (slot, value) => {
    setPicks(picks.map((current, i) => (i === slot ? value : current)));
    setFeedback(null);
  };
  return (
    <>
      <p className="body-copy">{data.prompt}</p>
      <p className="game-progress">
        {index + 1} / {total}
      </p>
      <p className="journal-text">{item.text}</p>
      <div className={`journal-entry ${data.slots.length === 1 ? "single" : ""}`}>
        {data.slots.map((slot, i) =>
          // 보기가 적으면 버튼으로, 많으면 목록에서 고른다.
          slot.options.length <= 4 ? (
            <div key={slot.label} className="journal-side" role="group" aria-label={slot.label}>
              {slot.label}
              <div className="game-choices stack">
                {slot.options.map((option) => (
                  <button
                    key={option.id}
                    aria-pressed={picks[i] === option.id}
                    aria-disabled={feedback === true}
                    onClick={() => feedback !== true && pick(i, option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <label key={slot.label} className="journal-side">
              {slot.label}
              <select value={picks[i]} disabled={feedback === true} onChange={(e) => pick(i, e.target.value)}>
                <option value="">고르기</option>
                {slot.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ),
        )}
      </div>
      <p className="game-feedback" role="status">
        {feedback === true && `맞아요. ${item.why}`}
        {feedback === false && data.retry}
      </p>
      {feedback === true ? (
        <button className="button" onClick={next}>
          {index === total - 1 ? "결과 보기" : "다음"}
        </button>
      ) : (
        <button className="button" disabled={picks.some((value) => !value)} onClick={check}>
          확인하기
        </button>
      )}
    </>
  );
}

/* ---- D 반응 실험: 자극마다 알맞은 보기를 빨리 고르고, 두 조건의 평균 반응 시간을 비교한다. ---- */
function Reaction({ data, onComplete }) {
  const [trials, setTrials] = useState(null);
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState([]);
  const shownAt = useRef(0);
  const summary = trials && index >= trials.length && summarizeReaction(responses);
  const [, second] = data.conditions;
  const differenceText = (ms) => (ms >= 0 ? `${ms}ms 더 느림` : `${-ms}ms 더 빠름`);

  function start() {
    setTrials(makeTrials(data));
    setIndex(0);
    setResponses([]);
    shownAt.current = performance.now();
  }
  function answer(id) {
    const trial = trials[index];
    const next = [...responses, { condition: trial.condition, correct: id === trial.answer, ms: performance.now() - shownAt.current }];
    setResponses(next);
    setIndex(index + 1);
    shownAt.current = performance.now();
    if (index + 1 === trials.length) {
      const result = summarizeReaction(next);
      onComplete(
        `${result.total}문제 중 ${result.correct}개 정답` +
          (result.difference === null ? "" : ` · ${second} ${differenceText(result.difference)}`),
      );
    }
  }

  if (!trials)
    return (
      <>
        <p className="body-copy">{data.prompt}</p>
        <button className="button" onClick={start}>
          실험 시작하기
        </button>
        <p className="footnote">{data.notice}</p>
      </>
    );
  if (!summary) {
    const trial = trials[index];
    return (
      <>
        <p className="game-progress" role="status">
          {index + 1} / {trials.length}
        </p>
        <div className="stroop-word" style={{ color: trial.color }}>
          {trial.text}
        </div>
        <div className="game-choices" role="group" aria-label="알맞은 보기 고르기">
          {data.choices.map((choice) => (
            <button key={choice.id} onClick={() => answer(choice.id)}>
              {choice.label}
            </button>
          ))}
        </div>
      </>
    );
  }
  return (
    <div role="status">
      <dl className="game-result">
        <div>
          <dt>정답</dt>
          <dd>
            {summary.correct} / {summary.total}
          </dd>
        </div>
        {data.conditions.map((label, i) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{summary.means[i] === null ? "–" : `${summary.means[i]}ms`}</dd>
          </div>
        ))}
      </dl>
      <p className="body-copy">
        {summary.difference === null
          ? data.tooFew
          : summary.difference > 0
            ? `${second} 평균 ${summary.difference}ms 더 걸렸어요. ${data.effect}`
            : `이번에는 ${second} 더 느려지지 않았어요. ${data.noEffect}`}
      </p>
      <p className="footnote">{data.footnote}</p>
      <Restart onClick={start}>다시 해보기 →</Restart>
    </div>
  );
}

/* ---- F 계획 조립: 계획서 세 칸마다 보기 카드를 고르면 칸이 채워지고, 고른 뒤 직접 고쳐 쓸 수 있다. ---- */
export function PlanTemplate({ data, value, onChange }) {
  const [plan, setPlan] = useState(() => Object.fromEntries(PLAN_FIELDS.map((field) => [field, value?.[field] || ""])));
  const latest = useRef(plan);
  const callback = useRef(onChange);
  const timer = useRef(0);
  callback.current = onChange;

  // 입력할 때마다 전체 상태를 저장하지 않도록 잠시 모았다가 저장하고, 칸을 벗어나거나 화면을 떠날 때는 바로 저장한다.
  function flush() {
    clearTimeout(timer.current);
    callback.current(latest.current);
  }
  function edit(field, text, now = false) {
    const next = { ...latest.current, [field]: text };
    latest.current = next;
    setPlan(next);
    clearTimeout(timer.current);
    if (now) flush();
    else timer.current = setTimeout(flush, 300);
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <section className="graduation-plan" aria-label={`${data.title} 계획서`}>
      {PLAN_FIELDS.map((field, i) => {
        const prompt = data.prompts[i];
        return (
          <div className="note-card plan-field" key={field}>
            <strong id={`plan-${field}`}>
              {i + 1}. {prompt.label}
            </strong>
            <div className="plan-options" role="group" aria-label={`${prompt.label} 보기`}>
              {prompt.options.map((option) => (
                <button key={option} aria-pressed={plan[field] === option} onClick={() => edit(field, option, true)}>
                  {option}
                </button>
              ))}
            </div>
            <textarea
              aria-labelledby={`plan-${field}`}
              placeholder={`${prompt.placeholder} 위의 보기를 골라도 돼요.`}
              value={plan[field]}
              maxLength={500}
              onChange={(e) => edit(field, e.target.value)}
              onBlur={flush}
            />
          </div>
        );
      })}
    </section>
  );
}

export function PlanSummary({ final, plan }) {
  return (
    <dl className="plan-summary">
      {PLAN_FIELDS.map((field, i) => (
        <div key={field}>
          <dt>{final.prompts[i].label}</dt>
          <dd>{plan[field]}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---- G AI 가르치기: 그림 카드로 AI를 학습시키고, 시험하고, 출시한다. ---- */
const FUR = {
  light: { fill: "#f2c38b", line: "#8a5a2b", muzzle: "#fbe6cc" },
  dark: { fill: "#7a5238", line: "#3f2a1c", muzzle: "#b08a6e" },
};
// 반려동물 그림. 특징값(귀 모양·주둥이·털 색)대로 그린다. headband면 진짜 귀는 늘어졌지만 고양이 귀 머리띠를 썼다.
export function PetPicture({ picture, size = 132, label }) {
  const fur = FUR[picture.fur] || FUR.light;
  const floppy = picture.ears === "floppy" || picture.headband;
  return (
    <svg viewBox="0 0 120 110" width={size} height={(size * 110) / 120} role="img" aria-label={label}>
      {floppy && (
        <>
          <ellipse cx="27" cy="58" rx="11" ry="24" transform="rotate(18 27 58)" fill={fur.line} opacity="0.85" />
          <ellipse cx="93" cy="58" rx="11" ry="24" transform="rotate(-18 93 58)" fill={fur.line} opacity="0.85" />
        </>
      )}
      {!floppy && (
        <>
          <polygon points="30,46 36,12 54,36" fill={fur.fill} stroke={fur.line} strokeWidth="2.5" strokeLinejoin="round" />
          <polygon points="90,46 84,12 66,36" fill={fur.fill} stroke={fur.line} strokeWidth="2.5" strokeLinejoin="round" />
        </>
      )}
      <ellipse cx="60" cy="62" rx="34" ry="31" fill={fur.fill} stroke={fur.line} strokeWidth="2.5" />
      {picture.headband && (
        <>
          <path d="M28 44 Q60 18 92 44" fill="none" stroke="#f28db2" strokeWidth="5" strokeLinecap="round" />
          <polygon points="34,36 38,8 54,28" fill="#f28db2" stroke="#c45c86" strokeWidth="2" strokeLinejoin="round" />
          <polygon points="86,36 82,8 66,28" fill="#f28db2" stroke="#c45c86" strokeWidth="2" strokeLinejoin="round" />
        </>
      )}
      {picture.look === "spot" && <ellipse cx="78" cy="48" rx="10" ry="8" fill={fur.line} opacity="0.35" />}
      {picture.look === "collar" && (
        <>
          <path d="M34 86 Q60 102 86 86" fill="none" stroke="#e5484d" strokeWidth="6" strokeLinecap="round" />
          <circle cx="60" cy="97" r="4.5" fill="#ffd34d" stroke="#b8860b" strokeWidth="1.5" />
        </>
      )}
      <circle cx="47" cy="58" r="4" fill="#2c1502" />
      <circle cx="73" cy="58" r="4" fill="#2c1502" />
      {picture.nose === "long" ? (
        <>
          <ellipse cx="60" cy="79" rx="17" ry="12" fill={fur.muzzle} stroke={fur.line} strokeWidth="2" />
          <ellipse cx="60" cy="72" rx="6" ry="4.5" fill="#2c1502" />
          <path d="M60 77 L60 83 M53 86 Q60 90 67 86" fill="none" stroke="#2c1502" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M56 69 L64 69 L60 74 Z" fill="#c45c86" />
          <path d="M60 74 L60 77 M55 79 Q60 82 65 79" fill="none" stroke="#2c1502" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

const describe = (data, picture) =>
  data.features.map((feature) => feature.values.find((value) => value.id === picture[feature.id])?.label).join(", ");

function TrainTemplate({ data, onComplete }) {
  const [stage, setStage] = useState("train");
  const [labels, setLabels] = useState([]);
  const [model, setModel] = useState(null);
  const [attempts, setAttempts] = useState(1);
  const [drag, setDrag] = useState(0);
  const start = useRef(null);
  const nameOf = (id) => data.labels.find((label) => label.id === id)?.label || "";
  const results = model ? data.test.map((card) => ({ ...card, ...predict(model, card.picture) })) : [];
  const right = results.filter((result) => result.label === result.answer).length;
  const passed = right === data.test.length;
  const surprise = model ? predict(model, data.surprise.picture) : null;
  const fooled = surprise && surprise.label !== data.surprise.answer;
  const feature = model ? data.features.find((item) => item.id === model.feature) : null;

  function choose(id) {
    const next = [...labels, id];
    setLabels(next);
    setDrag(0);
    if (next.length === data.train.length) {
      setModel(trainStump(data, data.train.map((card, i) => ({ picture: card.picture, label: next[i] }))));
      setStage("test");
    }
  }
  function retrain() {
    setLabels([]);
    setModel(null);
    setAttempts((n) => n + 1);
    setStage("train");
  }

  if (stage === "train") {
    const card = data.train[labels.length];
    // 카드를 왼쪽으로 밀면 첫 번째 이름표, 오른쪽으로 밀면 두 번째 이름표다.
    const release = () => {
      if (start.current === null) return;
      start.current = null;
      if (drag < -70) choose(data.labels[0].id);
      else if (drag > 70) choose(data.labels[1].id);
      else setDrag(0);
    };
    return (
      <>
        <p className="body-copy">{data.trainPrompt}</p>
        <p className="game-progress">
          AI 가르치기 · {labels.length + 1} / {data.train.length}
        </p>
        <div
          key={labels.length}
          className="pet-card a-pop"
          style={{ transform: `translateX(${drag}px) rotate(${drag / 18}deg)`, transition: start.current === null ? "transform 0.2s" : "none" }}
          onPointerDown={(e) => {
            start.current = e.clientX;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => start.current !== null && setDrag(e.clientX - start.current)}
          onPointerUp={release}
          onPointerCancel={() => {
            start.current = null;
            setDrag(0);
          }}
        >
          <PetPicture picture={card.picture} label={`사진 ${labels.length + 1}: ${describe(data, card.picture)}`} />
        </div>
        <div className="game-choices">
          <button onClick={() => choose(data.labels[0].id)}>← {data.labels[0].label}</button>
          <button onClick={() => choose(data.labels[1].id)}>{data.labels[1].label} →</button>
        </div>
      </>
    );
  }

  if (stage === "test")
    return (
      <>
        <p className="body-copy">{data.testPrompt}</p>
        <ul className="pet-results">
          {results.map((result, i) => (
            <li key={i} className={result.label === result.answer ? "is-right" : "is-wrong"}>
              <PetPicture picture={result.picture} size={64} label={`시험 사진 ${i + 1}: ${describe(data, result.picture)}`} />
              <span>
                AI 판단 <b>{nameOf(result.label)}</b>
                <small>{result.label === result.answer ? "정답" : `오답 · 정답은 ${nameOf(result.answer)}`}</small>
              </span>
            </li>
          ))}
        </ul>
        <p className="game-feedback" role="status">
          정확도 {right} / {data.test.length}. {passed ? data.pass : data.fail}
        </p>
        {passed ? (
          <button
            className="button"
            onClick={() => {
              setStage("launch");
              onComplete(`학습 사진 ${data.train.length}장 · 시험 ${right}/${data.test.length} · 가르친 횟수 ${attempts}번`);
            }}
          >
            출시하기
          </button>
        ) : (
          <button className="button" onClick={retrain}>
            다시 가르치기
          </button>
        )}
      </>
    );

  const review = fooled ? data.reviews.wrong : data.reviews.right;
  return (
    <div role="status">
      <p className="body-copy">{data.launch}</p>
      <div className="pet-card">
        <PetPicture picture={data.surprise.picture} label={data.surprise.caption} />
      </div>
      <p className="pet-caption">{data.surprise.caption}</p>
      <p className="pet-verdict">
        AI 판단: {nameOf(surprise.label)} {surprise.confidence}%
      </p>
      <p className={`pet-review ${fooled ? "is-wrong" : "is-right"}`}>
        <span aria-label={`별점 ${review.stars}점`}>{"★".repeat(review.stars) + "☆".repeat(5 - review.stars)}</span> {review.text}
      </p>
      <p className="game-feedback">
        {fooled ? `AI가 '${feature.label}'만 보고 판단했어요.` : `AI가 '${feature.label}'을 보고 맞혔어요.`}
      </p>
      <Restart onClick={retrain}>처음부터 다시 가르치기 →</Restart>
    </div>
  );
}

// 수업 안에 들어가는 틀(B·C·D·G). A는 화면 전체를 쓰고, F는 계획서 저장이 따로 있어서 수업 화면이 직접 그린다.
const embedded = { B: OrderTemplate, C: Classify, D: Reaction, G: TrainTemplate };
export function Experience({ data, onComplete }) {
  const Component = embedded[data?.template];
  return Component ? <Component data={data} onComplete={onComplete} /> : null;
}
