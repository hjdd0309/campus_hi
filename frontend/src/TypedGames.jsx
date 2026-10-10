import React, { useLayoutEffect, useRef, useState } from "react";
import {
  BLANK,
  answerOf,
  countCorrect,
  isAnswer,
  moveStep,
  questionsOf,
  rightPlaces,
  scramble,
  shuffle,
} from "./lessonGames.js";

// 미리 만들어 둔 연습 문제의 유형별 화면. 문제(game)는 Games.jsx가 받아서 넘겨준다.

function Closing({ children, explanation, onRestart }) {
  return (
    <div role="status">
      <p className="body-copy">
        <strong>{children}</strong> {explanation}
      </p>
      <button className="text-button" onClick={onRestart}>
        다시 해보기 →
      </button>
    </div>
  );
}

// 빈칸 채우기, OX, 분류하기: 한 문항씩 보기 하나를 고르고 바로 정답과 해설을 본다.
function Questions({ game, onComplete, intro, unit, stack, renderText }) {
  const [questions, setQuestions] = useState(() => questionsOf(game));
  const [picks, setPicks] = useState([]);
  const [index, setIndex] = useState(0);
  const question = questions[index];
  const pick = picks[index];
  const answered = pick !== undefined;

  function choose(number) {
    if (answered) return;
    const next = [...picks, number];
    setPicks(next);
    if (next.length === questions.length)
      onComplete(`${questions.length}${unit} 중 ${countCorrect(questions, next)}개 정답`);
  }
  function restart() {
    setQuestions(questionsOf(game));
    setPicks([]);
    setIndex(0);
  }

  if (!question)
    return (
      <Closing explanation={game.explanation} onRestart={restart}>
        {questions.length}
        {unit} 중 {countCorrect(questions, picks)}개를 맞혔어요.
      </Closing>
    );
  return (
    <>
      <p className="body-copy">{intro}</p>
      <p className="game-progress">
        {index + 1} / {questions.length}
      </p>
      <p className="quiz-text">{renderText(question, answered)}</p>
      <div className={`game-choices ${stack ? "stack" : ""}`} role="group" aria-label="보기">
        {question.options.map((option, number) => (
          <button
            key={option.label}
            aria-disabled={answered}
            aria-pressed={pick === number}
            className={
              !answered ? "" : option.correct ? "is-right" : pick === number ? "is-wrong" : "is-rest"
            }
            onClick={() => choose(number)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="game-feedback" role="status">
        {answered &&
          `${question.options[pick].correct ? "맞아요." : `아쉬워요. 정답은 ${isAnswer(answerOf(question))}.`} ${question.explanation}`}
      </p>
      {answered && (
        <button className="button" onClick={() => setIndex(index + 1)}>
          {index === questions.length - 1 ? "결과 보기" : "다음 문제"}
        </button>
      )}
    </>
  );
}

function Blank(props) {
  return (
    <Questions
      {...props}
      unit="문제"
      stack
      intro="빈칸에 들어갈 말을 골라요."
      renderText={(question, answered) => {
        const [before, after] = question.text.split(BLANK);
        return (
          <>
            {before}
            <span className={`quiz-blank ${answered ? "filled" : ""}`}>
              {answered ? answerOf(question) : <span className="sr-only">빈칸</span>}
            </span>
            {after}
          </>
        );
      }}
    />
  );
}

function Ox(props) {
  return (
    <Questions
      {...props}
      unit="문제"
      intro="문장이 맞으면 O, 틀리면 X를 골라요."
      renderText={(question) => question.text}
    />
  );
}

function Sort(props) {
  return (
    <Questions
      {...props}
      unit="개"
      stack
      intro={props.game.prompt}
      renderText={(question) => question.text}
    />
  );
}

function Order({ game, onComplete }) {
  const size = game.items.length;
  const [order, setOrder] = useState(() => scramble(size));
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
    setOrder(scramble(size));
    setTries(0);
    setResult(null);
  }

  return (
    <>
      <p className="body-copy">
        {game.prompt}
        {!done && " 화살표 버튼으로 자리를 옮겨요."}
      </p>
      <ol className="order-list" ref={list}>
        {order.map((step, index) => (
          <li key={index}>
            <span className="order-number">{index + 1}</span>
            <span className="order-text">{game.items[step].text}</span>
            {!done && (
              <>
                <button
                  data-row={index}
                  data-delta={-1}
                  disabled={index === 0}
                  aria-label={`‘${game.items[step].text}’ 위로 옮기기`}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  data-row={index}
                  data-delta={1}
                  disabled={index === size - 1}
                  aria-label={`‘${game.items[step].text}’ 아래로 옮기기`}
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
        <Closing explanation={game.explanation} onRestart={restart}>
          {result === "shown" ? "올바른 순서예요." : `${tries}번 만에 순서를 맞혔어요.`}
        </Closing>
      ) : (
        <>
          <p className="game-feedback" role="status">
            {result !== null &&
              `아직 순서가 달라요. ${size}개 중 ${result}개가 제자리에 있어요.`}
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

function Match({ game, onComplete }) {
  const size = game.items.length;
  const [rights, setRights] = useState(() => shuffle(game.items.map((_, i) => i)));
  const [selected, setSelected] = useState(null); // { side: "left" | "right", item }
  const [matched, setMatched] = useState([]);
  const [misses, setMisses] = useState(0);
  const [feedback, setFeedback] = useState("");
  const done = matched.length === size;

  function tap(side, item) {
    if (matched.includes(item)) return;
    if (!selected || selected.side === side) {
      setSelected(selected?.side === side && selected.item === item ? null : { side, item });
      setFeedback("");
      return;
    }
    setSelected(null);
    if (selected.item !== item) {
      setMisses(misses + 1);
      setFeedback("짝이 아니에요. 다시 골라보세요.");
      return;
    }
    const next = [...matched, item];
    setMatched(next);
    setFeedback(`맞아요. ${game.items[item].left} — ${game.items[item].right}`);
    if (next.length === size) onComplete(`${size}쌍 짝 맞추기 · 틀린 시도 ${misses}번`);
  }
  function restart() {
    setRights(shuffle(game.items.map((_, i) => i)));
    setSelected(null);
    setMatched([]);
    setMisses(0);
    setFeedback("");
  }
  const card = (side, item) => (
    <button
      key={item}
      aria-pressed={selected?.side === side && selected.item === item}
      aria-disabled={matched.includes(item)}
      className={matched.includes(item) ? "is-right" : ""}
      onClick={() => tap(side, item)}
    >
      {game.items[item][side]}
    </button>
  );

  if (done)
    return (
      <>
        <dl className="match-pairs">
          {game.items.map((item) => (
            <div key={item.left}>
              <dt>{item.left}</dt>
              <dd>{item.right}</dd>
            </div>
          ))}
        </dl>
        <Closing explanation={game.explanation} onRestart={restart}>
          {size}쌍을 모두 맞췄어요. 틀린 시도는 {misses}번이에요.
        </Closing>
      </>
    );
  return (
    <>
      <p className="body-copy">{game.prompt} 왼쪽과 오른쪽에서 하나씩 골라요.</p>
      <div className="match-board">
        <div role="group" aria-label="왼쪽 항목">
          {game.items.map((_, item) => card("left", item))}
        </div>
        <div role="group" aria-label="오른쪽 항목">
          {rights.map((item) => card("right", item))}
        </div>
      </div>
      <p className="game-feedback" role="status">
        {feedback}
      </p>
      <p className="game-progress">
        {matched.length} / {size}쌍
      </p>
    </>
  );
}

// 유형을 추가하려면 lessonGames.js의 lessonTypes와 같은 이름으로 여기에 화면을 등록한다.
export const typedComponents = { blank: Blank, ox: Ox, order: Order, match: Match, sort: Sort };
