import React, { useRef, useState } from "react";
import {
  games,
  stroopColors,
  makeStroopTrials,
  summarizeStroop,
  inversions,
  isSorted,
  swapAdjacent,
  makeDeck,
  accounts,
  transactions,
  checkEntry,
} from "./games.js";

const colorOf = (id) => stroopColors.find((color) => color.id === id);

function Stroop({ onComplete }) {
  const [trials, setTrials] = useState(null);
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState([]);
  const shownAt = useRef(0);
  const summary = trials && index >= trials.length && summarizeStroop(responses);

  function start() {
    setTrials(makeStroopTrials());
    setIndex(0);
    setResponses([]);
    shownAt.current = performance.now();
  }
  function answer(colorId) {
    const trial = trials[index];
    const next = [
      ...responses,
      {
        congruent: trial.word === trial.ink,
        correct: colorId === trial.ink,
        ms: performance.now() - shownAt.current,
      },
    ];
    setResponses(next);
    setIndex(index + 1);
    shownAt.current = performance.now();
    if (index + 1 === trials.length) {
      const result = summarizeStroop(next);
      onComplete(
        result.interferenceMs === null
          ? `${result.total}문제 중 ${result.correct}개 정답`
          : `${result.total}문제 중 ${result.correct}개 정답 · 색과 글자가 다를 때 ${result.interferenceMs >= 0 ? `${result.interferenceMs}ms 더 느림` : `${-result.interferenceMs}ms 더 빠름`}`,
      );
    }
  }

  if (!trials)
    return (
      <>
        <p className="body-copy">
          글자가 <strong>무슨 색으로 쓰여 있는지</strong> 최대한 빨리 골라요.
          글자의 뜻은 무시하세요. 예를 들어 파란색으로 쓰인 ‘빨강’의 답은
          파랑이에요. 모두 16문제예요.
        </p>
        <button className="button" onClick={start}>
          실험 시작하기
        </button>
        <p className="footnote">
          색을 구분하기 어려우면 정확한 결과가 나오지 않을 수 있어요.
        </p>
      </>
    );
  if (!summary) {
    const trial = trials[index];
    return (
      <>
        <p className="game-progress" role="status">
          {index + 1} / {trials.length}
        </p>
        <div className="stroop-word" style={{ color: colorOf(trial.ink).hex }}>
          {colorOf(trial.word).name}
        </div>
        <div className="game-choices" role="group" aria-label="글자의 색 고르기">
          {stroopColors.map((color) => (
            <button key={color.id} onClick={() => answer(color.id)}>
              {color.name}
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
        <div>
          <dt>색과 글자가 같을 때</dt>
          <dd>{summary.congruentMs === null ? "–" : `${summary.congruentMs}ms`}</dd>
        </div>
        <div>
          <dt>색과 글자가 다를 때</dt>
          <dd>
            {summary.incongruentMs === null ? "–" : `${summary.incongruentMs}ms`}
          </dd>
        </div>
      </dl>
      <p className="body-copy">
        {summary.interferenceMs === null
          ? "맞힌 문제가 부족해 반응 시간을 비교할 수 없어요. 다시 해보세요."
          : summary.interferenceMs > 0
            ? `색과 글자가 다를 때 평균 ${summary.interferenceMs}ms 더 걸렸어요. 글자를 읽는 일이 자동으로 일어나 색을 말하는 일을 방해하기 때문이에요. 이것을 스트룹 효과라고 해요.`
            : "이번에는 색과 글자가 다를 때 더 느려지지 않았어요. 보통은 글자를 읽는 일이 자동으로 일어나 색을 말하는 일을 방해해서 더 느려지는데, 이것을 스트룹 효과라고 해요. 문제 수가 적으면 결과가 달라질 수 있어요."}
      </p>
      <p className="footnote">
        1935년 J. R. 스트룹이 발표한 실험으로, 주의와 자동 처리를 연구할 때
        지금도 쓰여요.
      </p>
      <button className="text-button" onClick={start}>
        다시 해보기 →
      </button>
    </div>
  );
}

function Sorting({ onComplete }) {
  const [deck, setDeck] = useState(makeDeck);
  const [minimum, setMinimum] = useState(() => inversions(deck));
  const [swaps, setSwaps] = useState(0);
  const done = isSorted(deck);

  function swap(index) {
    const next = swapAdjacent(deck, index);
    setDeck(next);
    setSwaps(swaps + 1);
    if (isSorted(next))
      onComplete(`교환 ${swaps + 1}번으로 정렬 · 최소 ${minimum}번`);
  }
  function restart() {
    const next = makeDeck();
    setDeck(next);
    setMinimum(inversions(next));
    setSwaps(0);
  }
  return (
    <>
      <p className="body-copy">
        카드를 작은 수부터 차례로 놓아요. 단, <strong>이웃한 두 카드만</strong>{" "}
        서로 바꿀 수 있어요. 카드 사이의 ⇄ 버튼을 눌러 바꿔요.
      </p>
      <div className="sort-row">
        {deck.map((card, i) => (
          <React.Fragment key={card}>
            <span className="sort-card">{card}</span>
            {i < deck.length - 1 && (
              <button
                className="sort-swap"
                disabled={done}
                aria-label={`${card}와 ${deck[i + 1]} 바꾸기`}
                onClick={() => swap(i)}
              >
                ⇄
              </button>
            )}
          </React.Fragment>
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
            이웃끼리만 바꿀 수 있을 때 필요한 최소 횟수는 순서가 뒤집힌 쌍의
            개수와 같아요. 버블 정렬이 바로 이 방식이라, 카드가 많아질수록 교환
            횟수가 빠르게 늘어요. 그래서 더 빠른 정렬 방법을 배우게 돼요.
          </p>
          <button className="text-button" onClick={restart}>
            새 카드로 다시 하기 →
          </button>
        </>
      )}
    </>
  );
}

function Journal({ onComplete }) {
  const [index, setIndex] = useState(0);
  const [debit, setDebit] = useState("");
  const [credit, setCredit] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [tried, setTried] = useState(false);
  const [firstTry, setFirstTry] = useState(0);
  const finished = index >= transactions.length;
  const transaction = transactions[index];

  function check() {
    const correct = checkEntry(transaction, debit, credit);
    if (correct && !tried) setFirstTry(firstTry + 1);
    setTried(true);
    setFeedback(correct);
    if (correct && index === transactions.length - 1)
      onComplete(
        `거래 ${transactions.length}건 분개 · 한 번에 맞힌 것 ${firstTry + (tried ? 0 : 1)}건`,
      );
  }
  function next() {
    setIndex(index + 1);
    setDebit("");
    setCredit("");
    setFeedback(null);
    setTried(false);
  }
  function restart() {
    setFirstTry(0);
    setIndex(0);
    setDebit("");
    setCredit("");
    setFeedback(null);
    setTried(false);
  }
  if (finished)
    return (
      <div role="status">
        <p className="body-copy">
          거래 {transactions.length}건을 모두 분개했어요. 한 번에 맞힌 것은{" "}
          {firstTry}건이에요. 회계는 모든 거래를 이렇게 차변과 대변에 같은
          금액으로 나누어 적는 데서 시작해요.
        </p>
        <button className="text-button" onClick={restart}>
          처음부터 다시 하기 →
        </button>
      </div>
    );
  const select = (label, value, onChange) => (
    <label className="journal-side">
      {label}
      <select
        value={value}
        disabled={feedback === true}
        onChange={(e) => {
          onChange(e.target.value);
          setFeedback(null);
        }}
      >
        <option value="">계정 선택</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name} ({account.kind})
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <>
      <p className="body-copy">
        거래를 보고 차변과 대변에 올 계정을 골라요. 자산이 늘거나 비용이 생기면
        차변, 부채·자본이 늘거나 자산이 줄면 대변이에요. 부채가 줄면 차변이에요.
      </p>
      <p className="game-progress">
        {index + 1} / {transactions.length}
      </p>
      <p className="journal-text">{transaction.text}</p>
      <div className="journal-entry">
        {select("차변 (왼쪽)", debit, setDebit)}
        {select("대변 (오른쪽)", credit, setCredit)}
      </div>
      <p className="game-feedback" role="status">
        {feedback === true && `맞아요. ${transaction.why}`}
        {feedback === false &&
          "아직 아니에요. 무엇이 늘고 무엇이 줄었는지 다시 생각해 보세요."}
      </p>
      {feedback === true ? (
        <button className="button" onClick={next}>
          {index === transactions.length - 1 ? "결과 보기" : "다음 거래"}
        </button>
      ) : (
        <button className="button" disabled={!debit || !credit} onClick={check}>
          확인하기
        </button>
      )}
    </>
  );
}

const components = { stroop: Stroop, sorting: Sorting, journal: Journal };

export default function LessonGame({ game, played, onComplete }) {
  const Component = components[game];
  const info = games.find((item) => item.id === game);
  if (!Component || !info) return null;
  return (
    <section className="lesson-game" aria-label={info.title}>
      <h2 className="section-title">
        {info.title}
        {played && (
          <span className="tag">
            완료
            <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true">
              <path d="M1.2 4.6 4 7.3 9.8 1.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </h2>
      <Component onComplete={onComplete} />
      {played && <p className="footnote">최근 결과 · {played}</p>}
    </section>
  );
}
