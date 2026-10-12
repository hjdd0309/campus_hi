import React, { useState } from "react";
import { OrderTemplate } from "./Templates.jsx";
import {
  BLANK,
  answerOf,
  countCorrect,
  isAnswer,
  questionsOf,
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

// 순서 맞추기는 체험 틀 B(자리 옮기기)를 그대로 쓴다.
function Order({ game, onComplete }) {
  return (
    <OrderTemplate
      data={{ swap: "move", prompt: game.prompt, items: game.items.map((item) => item.text), explanation: game.explanation }}
      onComplete={onComplete}
    />
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
