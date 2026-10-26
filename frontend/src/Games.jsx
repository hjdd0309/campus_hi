import React, { useEffect, useState } from "react";
import { getLessonGame } from "./api.js";
import { lessonTypes } from "./lessonGames.js";
import { typedComponents } from "./TypedGames.jsx";
import { Experience } from "./Templates.jsx";
import { templates } from "./experiences.js";

// 수업의 "직접 해보기" 단계에 들어가는 체험: 학과군 실습(체험 틀) 또는 미리 만들어 둔 연습 문제.

function GameFrame({ title, played, note, children }) {
  return (
    <section className="lesson-game" aria-label={title}>
      <h2 className="section-title">
        {title}
        {played && (
          <span className="tag">
            완료
            <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true">
              <path d="M1.2 4.6 4 7.3 9.8 1.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </h2>
      {note && <p className="game-note">{note}</p>}
      {children}
      {played && <p className="footnote">최근 결과 · {played}</p>}
    </section>
  );
}

// 과목의 연습 문제를 받는다. status: idle(받을 문제 없음) | loading | ready | basic(문제가 없거나 쓸 수 없음) | error.
// 수업 화면이 "배우기" 단계에서 문제 제목을 보여주고 "기록" 단계에서 해설을 보여주므로, 문제는 수업 화면이 받아서 넘긴다.
export function useLessonGame(subject) {
  const [load, setLoad] = useState({ status: subject ? "loading" : "idle" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!subject) return undefined;
    const controller = new AbortController();
    setLoad({ status: "loading" });
    getLessonGame(subject, controller.signal).then(
      (game) => setLoad(typedComponents[game.type] ? { status: "ready", game } : { status: "basic" }),
      (error) => {
        if (controller.signal.aborted) return;
        // 문제가 없어졌거나(404) 형식이 맞지 않으면(422) 다시 시도해도 같으므로 기본 체험으로 넘어간다.
        if (error.status === 404 || error.status === 422) setLoad({ status: "basic" });
        else setLoad({ status: "error", message: error.message });
      },
    );
    return () => controller.abort();
  }, [subject, attempt]);

  return {
    ...load,
    retry: () => setAttempt((n) => n + 1),
    skip: () => setLoad({ status: "basic" }),
  };
}

// game: 학과군 실습의 체험 데이터(template이 있음), 또는 useLessonGame으로 받은 연습 문제(type이 있음).
// 수업 화면의 큰 제목이 체험·문제 제목이므로, 틀에는 체험의 종류를 적는다.
export default function LessonGame({ game, played, onComplete }) {
  if (game?.template && templates[game.template])
    return (
      <GameFrame title={templates[game.template].title} played={played} note="AI가 만든 체험이에요. 실제 수업 내용과 다를 수 있어요.">
        <Experience data={game} onComplete={onComplete} />
      </GameFrame>
    );
  const Component = game && typedComponents[game.type];
  if (!Component) return null;
  return (
    <GameFrame title={lessonTypes[game.type].title} played={played} note="AI가 만든 연습 문제예요. 실제 수업 내용과 다를 수 있어요.">
      <Component game={game} onComplete={onComplete} />
    </GameFrame>
  );
}
