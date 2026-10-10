import React, { Fragment, useEffect, useRef, useState } from "react";
import { icon, img } from "./assets.js";
import {
  BackButton,
  Confetti,
  delay,
  Header,
  Mask,
  OutlineButton,
  Paper,
  PaperFold,
  ProgressBar,
  Screen,
  T,
} from "./ui.jsx";
import { getCurriculum, getProgramList } from "./api.js";
import {
  QUESTIONS,
  KEYWORD_GROUPS,
  departments,
  fields,
  fieldOf,
  finals,
  finalReady,
  planReady,
  PLAN_FIELDS,
  createDepartment,
  recommend,
  completeLesson,
  initialState,
} from "./model.js";
import { games } from "./games.js";
import LessonGame from "./Games.jsx";
import GraduationPlan from "./GraduationPlan.jsx";

/* ------------------------------------------------------------------ */
/* 공통                                                                */
/* ------------------------------------------------------------------ */

const all = (state) => [...departments, ...state.catalog];

/** 지금 보고 있는 학과와 그 진행 상태. 학교가 정해진 학과가 없으면 null. */
function view(state) {
  const d = all(state).find((item) => item.id === state.current && item.school);
  if (!d) return null;
  const journey = state.journeys[d.id] || null;
  const total = d.lessons.length;
  const completed = Math.min(journey?.completed || 0, total);
  const index = Math.min(completed, total - 1);
  return {
    d,
    journey,
    total,
    completed,
    index,
    year: d.yearNumbers[index],
    lastYear: d.yearNumbers[total - 1],
    final: finals[d.final] || finals.artwork,
    finished: !!journey && completed === total,
  };
}

/**
 * 화면에 필요한 학과나 진행 기록이 없으면 처음 화면으로 돌려보낸다.
 * 뒤에 깔려 있는 화면은 다른 학과를 보는 중일 수 있으므로, 맨 위 화면일 때만 확인한다.
 */
function useGuard(ok, nav, active) {
  useEffect(() => {
    if (active && !ok) nav.reset(["splash"]);
  }, [ok, nav, active]);
}

const hasBatchim = (word) => {
  const code = word.charCodeAt(word.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
};
const josa = (word, withBatchim, without) => word + (hasBatchim(word) ? withBatchim : without);

const DAYS = "일월화수목금토";
const stamp = (date) =>
  `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${DAYS[date.getDay()]}) ${
    date.getHours() < 12 ? "오전" : "오후"
  } ${date.getHours() % 12 || 12}시`;

/* ------------------------------------------------------------------ */
/* 01 · 스플래시                                                       */
/* ------------------------------------------------------------------ */

export function Splash({ nav }) {
  return (
    <Screen>
      <div className="a-drop absolute left-[110px] top-[281px] h-[170px] w-[162px]" style={delay(0.1)}>
        <img
          src={img.mascotSplash}
          alt="캠퍼스하이 마스코트"
          className="loop h-full w-full"
          style={{ animation: "float 3.2s ease-in-out 1.1s infinite" }}
        />
      </div>
      <img
        src={img.wordmark}
        alt="캠퍼스하이"
        className="a-up absolute left-[127px] top-[474px] h-[33px] w-[148px]"
        style={delay(0.55)}
      />
      <OutlineButton top={740} onClick={() => nav.push("interest")} className="a-up" style={delay(0.8)}>
        입학하기
      </OutlineButton>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · 관심 분야가 있는지                                             */
/* ------------------------------------------------------------------ */

function OptionButton({ label, selected, top, onClick, index }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`pressable a-up absolute left-[20px] flex h-[46px] w-[362px] items-center justify-center rounded-[10px] border text-[16px] ${
        selected ? "border-mint bg-mint font-semibold text-white" : "border-faint bg-chalk text-mute"
      }`}
      style={{ top, animationDelay: `${0.18 + index * 0.06}s` }}
    >
      {label}
    </button>
  );
}

function QuestionTitle({ title, sub }) {
  return (
    <>
      <T y={184} size={20} left={36} className="a-up font-semibold text-mint">
        {title}
      </T>
      <T y={220} size={16} left={36} className="a-up text-gray" style={delay(0.06)}>
        {sub}
      </T>
    </>
  );
}

export function Interest({ nav }) {
  const [picked, setPicked] = useState(null);
  const choose = (i) => {
    setPicked(i);
    window.setTimeout(() => nav.push("explore", { start: i === 0 ? 1 : 8, direct: i === 1 }), 260);
  };
  return (
    <Screen>
      <QuestionTitle title="관심이 있는 분야가 있나요?" sub="지금의 관심에서 출발해도, 저와 함께 찾아도 괜찮아요" />
      <OptionButton index={0} top={295} label="관심 분야가 없어요" selected={picked === 0} onClick={() => choose(0)} />
      <OptionButton index={1} top={357} label="관심 분야가 있어요" selected={picked !== 0} onClick={() => choose(1)} />
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 03–04 · 탐색 (질문 1–7, 키워드 8)                                   */
/* ------------------------------------------------------------------ */

const progressFor = (step) => Math.max(0.04, Math.min(1, (step - 1.44) / 6.56));

function Chip({ label, on, onClick, delaySec }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`pressable a-up h-[33px] shrink-0 rounded-full border px-[15px] text-[12px] ${
        on ? "border-mint bg-mint font-semibold text-white" : "border-faint bg-chalk text-mute"
      }`}
      style={{ animationDelay: `${delaySec}s` }}
    >
      {label}
    </button>
  );
}

function keywordMessage(keys) {
  if (keys.length === 0) return null;
  const has = (k) => keys.includes(k);
  if (has("디자인") && has("심리"))
    return { title: "디자인과 심리, 함께 궁금하시군요!", sub: "사람을 이해하고 더 나은 경험을 만드는 학과부터 살펴 볼까요?" };
  if (keys.length === 1)
    return { title: `${keys[0]}에 관심이 있으시군요!`, sub: `${josa(keys[0], "과", "와")} 가까운 학과부터 살펴 볼까요?` };
  return {
    title: `${josa(keys[0], "과", "와")} ${keys[1]}, 함께 궁금하시군요!`,
    sub: "두 관심사가 만나는 학과부터 살펴 볼까요?",
  };
}

export function Explore({ nav, route, state, setState }) {
  const direct = Boolean(route.params?.direct);
  const [step, setStep] = useState(route.params?.start ?? 1);
  const [shake, setShake] = useState(0);

  const back = () => {
    if (step === 1 || (direct && step === 8)) nav.back();
    else setStep((s) => s - 1);
  };

  const q = QUESTIONS[step - 1];
  const answers = state.answers[step] ?? [];
  const toggleAnswer = (opt) =>
    setState((s) => {
      const cur = s.answers[step] ?? [];
      return { ...s, answers: { ...s.answers, [step]: cur.includes(opt) ? cur.filter((o) => o !== opt) : [...cur, opt] } };
    });
  const toggleKeyword = (k) =>
    setState((s) => ({ ...s, interests: s.interests.includes(k) ? s.interests.filter((o) => o !== k) : [...s.interests, k] }));

  const next = () => {
    if (step < 8) {
      if (answers.length === 0) return setShake((n) => n + 1);
      setStep(step + 1);
    } else {
      if (state.interests.length === 0) return setShake((n) => n + 1);
      nav.push("loading", undefined, "fade");
    }
  };

  const msg = keywordMessage(state.interests);

  return (
    <Screen>
      <Header title="관심 분야 탐색하기" count={`${step}/8`} onBack={back} />
      <ProgressBar value={progressFor(step)} />

      <Fragment key={step}>
        {step < 8 && q ? (
          <>
            <QuestionTitle title={q.title} sub={q.sub} />
            <div key={`s${shake}`} className={shake ? "a-shake" : ""}>
              <div>
                {q.options.map((opt, i) => (
                  <OptionButton
                    key={opt.label}
                    index={i}
                    top={295 + i * 62}
                    label={opt.label}
                    selected={answers.includes(opt.label)}
                    onClick={() => toggleAnswer(opt.label)}
                  />
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <QuestionTitle title="끌리는 키워드를 골라보세요" sub="궁금한 분야를 여러 개 선택할 수 있어요" />
            <div key={`k${shake}`} className={shake ? "a-shake" : ""}>
              {KEYWORD_GROUPS.map((g, gi) => (
                <div key={g.label}>
                  <T y={277 + gi * 84} size={16} left={36} className="a-up text-gray" style={delay(0.1 + gi * 0.08)}>
                    {g.label}
                  </T>
                  <div className="absolute left-[28px] flex gap-[8px]" style={{ top: 307 + gi * 84 }}>
                    {g.items.map((k, ki) => (
                      <Chip
                        key={k}
                        label={k}
                        on={state.interests.includes(k)}
                        onClick={() => toggleKeyword(k)}
                        delaySec={0.14 + gi * 0.08 + ki * 0.035}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {msg && (
              <div
                key={msg.title}
                className="a-up absolute left-[20px] top-[563px] h-[95px] w-[362px] rounded-[16px] border border-cream-line bg-cream"
              >
                <T y={27.5} size={17} left={16.5} clip={330} className="font-semibold text-slate">
                  {msg.title}
                </T>
                <T y={56.5} size={11} left={16.5} className="text-gray">
                  {msg.sub}
                </T>
              </div>
            )}
          </>
        )}
      </Fragment>

      <OutlineButton onClick={next}>{step < 8 ? "다음" : "결과 보기"}</OutlineButton>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 05 · 탐색 중                                                        */
/* ------------------------------------------------------------------ */

export function Loading({ nav }) {
  useEffect(() => {
    const t = window.setTimeout(() => nav.replace("result", undefined, "fade"), 2700);
    return () => window.clearTimeout(t);
  }, [nav]);
  return (
    <Screen>
      <Header title="관심 분야 탐색하기" onBack={nav.back} />
      <T y={308} size={20} center className="a-fade font-bold text-navy">
        탐색 중{" "}
        {[0, 1, 2].map((i) => (
          <span key={i} className="loop" style={{ animation: `dot 1.2s ease-in-out ${i * 0.2}s infinite alternate` }}>
            .
          </span>
        ))}
      </T>
      <div className="a-pop absolute left-[96px] top-[349px] h-[175px] w-[196px]" style={delay(0.1)}>
        <img src={img.mascotLoading} alt="" className="loop h-full w-full" style={{ animation: "scurry 0.9s ease-in-out infinite" }} />
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · 결과                                                           */
/* ------------------------------------------------------------------ */

function TagPill({ children }) {
  return (
    <span className="flex h-[20px] items-center justify-center whitespace-nowrap rounded-full border border-mint bg-white/40 px-[9px] text-[9px] font-medium text-mint">
      {children}
    </span>
  );
}

function YellowCard({ top, title, sub, onClick, className = "", style }) {
  return (
    <button
      onClick={onClick}
      className={`pressable absolute left-[20px] h-[80px] w-[362px] rounded-[16px] border border-cream-line bg-cream text-left active:bg-cream-2 ${className}`}
      style={{ top, ...style }}
    >
      <T y={20} size={16} left={15.5} clip={330} className="font-semibold text-slate">
        {title}
      </T>
      <T y={48} size={11} left={16} clip={330} className="text-gray">
        {sub}
      </T>
    </button>
  );
}

export function Result({ nav, state }) {
  // 고른 키워드와 질문의 답으로 정한 추천 순서.
  const [best, second] = recommend(state.interests, state.answers);
  const keyword = state.interests[0];
  const answered = Object.keys(state.answers).length;
  const basis = state.interests.length
    ? `${state.interests.slice(0, 2).map((k) => `‘${k}’`).join(", ")}에 끌린다고 했어요.`
    : `질문 ${answered}개의 답을 바탕으로 골랐어요.`;
  const open = (field) => nav.push("schools", { field });
  return (
    <Screen>
      <Header title="관심 분야 탐색하기" onBack={nav.back} />
      <div className="a-pop absolute left-[117px] top-[149px] h-[124px] w-[140px]" style={delay(0.05)}>
        <img
          src={img.mascotResult}
          alt=""
          className="loop h-full w-full"
          style={{ animation: "sway 2.8s ease-in-out 0.8s infinite", transformOrigin: "50% 90%" }}
        />
      </div>
      <Confetti originX={187} originY={212} />
      <T y={310} size={20} left={37.5} className="a-up font-semibold text-mint" style={delay(0.35)}>
        {best.headline} 일에 끌리시네요!
      </T>
      <button
        onClick={() => open(best.id)}
        className="pressable a-up absolute left-[20px] top-[355px] h-[180px] w-[362px] rounded-[16px] border border-mint text-left"
        style={{ background: "linear-gradient(180deg, #f0fcfb 0%, #d6f8f6 100%)", animationDelay: "0.45s" }}
      >
        <T y={22.5} size={12} left={17.5} className="font-medium text-mint">
          먼저 만나볼 분야
        </T>
        <T y={54} size={20} left={17} className="font-semibold text-slate">
          {best.group}
        </T>
        <T y={84.5} size={11} lh={17} left={17.5} clip={330} className="text-gray">
          {`${basis}\n${best.blurb}`}
        </T>
        <div className="absolute left-[17px] top-[129px] flex gap-[8px]">
          {best.tags.map((tag) => (
            <TagPill key={tag}>{tag}</TagPill>
          ))}
          {keyword && <TagPill>{keyword}</TagPill>}
        </div>
      </button>
      {keyword ? (
        <YellowCard
          top={550}
          title={`‘${keyword}’ 관련 학과`}
          sub="이름에 이 키워드가 들어간 학과를 모아봤어요"
          onClick={() => open(keyword)}
          className="a-up"
          style={delay(0.55)}
        />
      ) : (
        <YellowCard top={550} title={`${best.group} 분야 학과`} sub={best.blurb} onClick={() => open(best.id)} className="a-up" style={delay(0.55)} />
      )}
      <YellowCard
        top={645}
        title={`${second.group} 분야도 궁금하다면?`}
        sub={second.blurb}
        onClick={() => open(second.id)}
        className="a-up"
        style={delay(0.62)}
      />
      <OutlineButton onClick={() => open(best.id)} className="a-up" style={delay(0.7)}>
        다음
      </OutlineButton>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 07 · 학교·학과 찾기                                                 */
/* ------------------------------------------------------------------ */

const FILTERS = ["전체", ...fields.map((field) => field.id)];
const keyOf = (p) => `${p.school}|${p.course}`;

export function Schools({ nav, route, setState }) {
  const [filter, setFilter] = useState(route.params?.field ?? "전체");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("loading");
  const [retry, setRetry] = useState(0);
  const [opening, setOpening] = useState(null);
  const [failed, setFailed] = useState(null);
  const loadingMore = useRef(false);
  const request = useRef(0);
  const filters = FILTERS.includes(filter) ? FILTERS : [FILTERS[0], filter, ...FILTERS.slice(1)];

  // 입력이 멈춘 뒤에 검색한다.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setList([]);
    setTotal(0);
    loadingMore.current = false;
    request.current += 1;
    getProgramList(filter, search, 0, controller.signal)
      .then((result) => {
        setList(result.programs);
        setTotal(result.total);
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, [filter, search, retry]);

  const more = () => {
    if (loadingMore.current || status !== "ready" || list.length >= total) return;
    loadingMore.current = true;
    const started = request.current;
    getProgramList(filter, search, list.length)
      .then((result) => {
        // 받는 사이에 검색 조건이 바뀌었으면 버린다.
        if (started !== request.current) return;
        setList((items) => {
          const seen = new Set(items.map(keyOf));
          return [...items, ...result.programs.filter((p) => !seen.has(keyOf(p)))];
        });
        setTotal(result.total);
      })
      .catch(() => {})
      .finally(() => {
        if (started === request.current) loadingMore.current = false;
      });
  };

  const open = (p) => {
    if (opening) return;
    const key = keyOf(p);
    setOpening(key);
    setFailed(null);
    getCurriculum(p.school, p.course)
      .then((result) => {
        const dept = createDepartment(p.course, p.school, result.curriculum, result.category, result.years, result.duration, result.region);
        setState((s) => ({
          ...s,
          current: dept.id,
          catalog: [...s.catalog.filter((item) => item.id !== dept.id), dept],
        }));
        nav.push("detail");
      })
      .catch(() => {
        setFailed(key);
        window.setTimeout(() => setFailed((k) => (k === key ? null : k)), 2200);
      })
      .finally(() => setOpening(null));
  };

  return (
    <Screen>
      <BackButton onClick={nav.back} />
      <T y={126} size={20} lh={25} left={29.5} className="a-up font-semibold text-mint">
        {"궁금했던 학과와 학교\n저와 함께 체험해볼까요?"}
      </T>
      <label
        className="a-up absolute left-[20px] top-[208px] flex h-[40px] w-[362px] items-center rounded-[12px] border border-faint bg-white transition-colors focus-within:border-mint"
        style={delay(0.08)}
      >
        <Mask src={icon.search} w={24} h={25} color="#d1d5da" className="ml-[11px]" />
        <input
          value={query}
          maxLength={100}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="학교나 학과 이름을 검색해보세요"
          aria-label="학교나 학과 검색"
          className="ml-[18px] h-full min-w-0 flex-1 bg-transparent text-[11px] tracking-[0.1em] text-slate outline-none placeholder:text-faint"
        />
      </label>
      <div className="no-scrollbar a-up absolute left-0 top-[264px] flex w-full gap-[8px] overflow-x-auto px-[22px]" style={delay(0.14)}>
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`pressable h-[28px] shrink-0 rounded-full border px-[13px] text-[12px] ${
              filter === f ? "border-mint bg-mint font-semibold text-white" : "border-faint bg-chalk text-mute"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <T y={349} size={16} left={29} className="a-up font-medium text-slate" style={delay(0.2)}>
        {status === "ready" ? `학교·학과 ${total.toLocaleString()}곳을 찾았어요` : "관심 분야를 통해 관련 학교를 추천해드려요"}
      </T>
      <div
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight > el.scrollHeight - 300) more();
        }}
        className="no-scrollbar absolute left-0 top-[380px] h-[370px] w-full overflow-y-auto"
        style={{
          WebkitMaskImage: "linear-gradient(180deg, #000 0%, #000 50%, rgba(0,0,0,0.55) 72%, rgba(0,0,0,0.12) 96%, transparent 100%)",
          maskImage: "linear-gradient(180deg, #000 0%, #000 50%, rgba(0,0,0,0.55) 72%, rgba(0,0,0,0.12) 96%, transparent 100%)",
        }}
      >
        <div key={filter + search + retry} className="relative" style={{ height: Math.max(370, 5 + list.length * 91 + 90) }}>
          {list.map((p, i) => {
            const key = keyOf(p);
            return (
              <YellowCard
                key={key}
                top={5 + i * 91}
                title={`${p.school} ${p.course}`}
                sub={
                  opening === key
                    ? "불러오는 중이에요…"
                    : failed === key
                      ? "불러오지 못했어요. 다시 눌러주세요"
                      : [p.category, p.duration, p.region].filter(Boolean).join(" · ")
                }
                onClick={() => open(p)}
                className={`a-up ${failed === key ? "a-shake" : ""}`}
                style={delay(i < 30 ? 0.24 + Math.min(i, 6) * 0.06 : 0)}
              />
            );
          })}
          {status === "loading" && (
            <T y={40} size={14} center className="a-fade text-mute">
              학교와 학과를 찾고 있어요…
            </T>
          )}
          {status === "ready" && list.length === 0 && (
            <>
              <T y={40} size={14} center className="a-fade text-mute">
                검색 결과가 없어요
              </T>
              {filter !== "전체" && (
                <button
                  onClick={() => setFilter("전체")}
                  className="a-fade absolute left-0 right-0 top-[70px] text-center text-[14px] leading-[22px] text-mint underline"
                >
                  전체 분야에서 찾아보기
                </button>
              )}
            </>
          )}
          {status === "error" && (
            <button onClick={() => setRetry((n) => n + 1)} className="a-fade absolute left-0 right-0 top-[28px] text-center text-[14px] leading-[22px] text-mute">
              {"목록을 불러오지 못했어요.\n"}
              <span className="text-mint underline">다시 불러오기</span>
            </button>
          )}
        </div>
      </div>
      <OutlineButton onClick={() => (list[0] ? open(list[0]) : undefined)}>다음</OutlineButton>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 08 · 학과 상세                                                      */
/* ------------------------------------------------------------------ */

function SchoolLogo({ name }) {
  if (name.startsWith("경희대학교")) return <img src={img.khuLogo} alt="경희대학교 로고" className="h-full w-full" />;
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex h-[64px] w-[64px] items-center justify-center rounded-full border-2 border-mint/60 text-[26px] font-bold text-mint">
        {name.slice(0, 1)}
      </div>
    </div>
  );
}

function Palette() {
  return (
    <svg viewBox="0 0 140 140" className="loop h-full w-full" style={{ animation: "blob 6s ease-in-out infinite", filter: "blur(3.5px)" }}>
      <path
        d="M70 10C36 10 10 36 10 68c0 34 28 62 60 62 10 0 14-6 14-12 0-8-8-10-8-18 0-6 5-10 12-10h12c19 0 30-14 30-32C130 32 104 10 70 10Z"
        fill="none"
        stroke="#7fe6de"
        strokeWidth="11"
        strokeLinejoin="round"
      />
      <circle cx="44" cy="52" r="8.5" fill="#86e7e0" />
      <circle cx="70" cy="36" r="7" fill="#86e7e0" />
      <circle cx="98" cy="50" r="9" fill="#86e7e0" />
      <circle cx="36" cy="82" r="9" fill="#86e7e0" />
    </svg>
  );
}

export function Detail({ active, nav, state, setState }) {
  const v = view(state);
  useGuard(!!v, nav, active);
  if (!v) return null;
  const { d, journey, total, finished } = v;
  const field = fieldOf(d.category);
  const step = total <= 5 ? 39 : Math.floor(198 / total);
  const enroll = () => {
    if (finished) return nav.push("graduation");
    if (journey) return nav.reset(["home"]);
    setState((s) => ({ ...s, journeys: { ...s.journeys, [d.id]: { completed: 0, paused: false } } }));
    nav.push("enrolled", undefined, "rise");
  };
  return (
    <Screen>
      <BackButton onClick={nav.back} />
      <div className="a-up absolute left-[20px] top-[116px] h-[112px] w-[362px] rounded-[16px] border border-cream-line bg-cream">
        <div className="absolute left-[11px] top-[21px] h-[72px] w-[108px]">
          <SchoolLogo name={d.school} />
        </div>
        <T y={27} size={d.school.length > 9 ? 16 : 21} left={135.5} clip={215} className="font-semibold text-slate">
          {d.school}
        </T>
        <T y={57} size={11} lh={17} left={135} clip={215} className="text-gray">
          {`${d.region ? `${d.region}에 있는 학교예요` : "대학 정보 공시 자료 기준이에요"}\n수업연한 ${d.duration || "4년"} 과정`}
        </T>
      </div>
      <div
        className="a-up absolute left-[20px] top-[247px] h-[168px] w-[362px] overflow-hidden rounded-[16px] border border-mint"
        style={{ background: "linear-gradient(180deg, #f6fdfd 0%, #d6f8f6 100%)", animationDelay: "0.08s" }}
      >
        <div className="absolute left-[218px] top-[14px] h-[140px] w-[140px] opacity-90">
          <Palette />
        </div>
        <T y={22.5} size={12} left={17.5} className="font-medium text-mint">
          {field.group} 분야
        </T>
        <T y={54} size={d.name.length > 11 ? 17 : 21} left={17.5} clip={330} className="font-semibold text-slate">
          {d.name}
        </T>
        <T y={85} size={11.5} lh={17} left={17} className="text-gray">
          {field.detail}
        </T>
        <div className="absolute left-[17px] top-[129px] flex gap-[8px]">
          <TagPill>{d.duration ? `${d.duration} 과정` : "대학 과정"}</TagPill>
          <TagPill>학습과 실습 {total}개</TagPill>
        </div>
      </div>
      <T y={441} size={16} left={33} className="a-up font-semibold text-slate" style={delay(0.16)}>
        이 학과는 이런 내용을 배워요
      </T>
      <T y={472.5} size={14} lh={20} left={33} clip={340} className="a-up text-slate/90" style={delay(0.2)}>
        {`${d.curriculum.slice(0, 3).join(", ")} 등 교과목 ${d.curriculum.length}개\n${
          d.lessonsFromYears ? "학교 홈페이지의 학년별 편성을 따랐어요" : "학년 배치는 실제 편성과 다를 수 있어요"
        }`}
      </T>
      {d.lessons.map((lesson, i) => (
        <div key={i} className="a-up" style={delay(0.28 + i * 0.08)}>
          <span
            className="absolute left-[33px] flex h-[28px] w-[47px] items-center justify-center rounded-full border border-mint text-[13px] font-semibold text-mint"
            style={{ top: 536 + i * step }}
          >
            {d.yearNumbers[i]}학년
          </span>
          <T y={544.5 + i * step} size={12} left={98} clip={280} className="text-slate/90">
            {lesson}
          </T>
        </div>
      ))}
      <OutlineButton onClick={enroll} className="a-up" style={delay(0.5)}>
        {finished ? "졸업 리포트 보기" : journey ? "이어서 체험하기" : `${d.name} 입학하기`}
      </OutlineButton>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 09 / 14 / 16 · 입학증 · 성적표 · 졸업증명서                         */
/* ------------------------------------------------------------------ */

function useAutoAdvance(fn, ms) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const t = window.setTimeout(() => ref.current(), ms);
    return () => window.clearTimeout(t);
  }, [ms]);
}

function PaperRow({ y, left, right, lineFrom = 24, lineTo = 255, d = 0 }) {
  return (
    <div className="a-fade" style={delay(d)}>
      <T y={y} size={11.5} left={26.5} className="text-gray">
        {left}
      </T>
      <T y={y} size={11.5} right={273 - 255.5} clip={185} className="text-gray">
        {right}
      </T>
      <span
        className="absolute h-px origin-left bg-[#c8c8c8]"
        style={{ top: y + 17.5, left: lineFrom, width: lineTo - lineFrom, animation: `line-grow 0.6s cubic-bezier(0.22,1,0.36,1) ${d + 0.05}s both` }}
      />
    </div>
  );
}

function CertificateShell({ onBack, onNext, children }) {
  return (
    <Screen bg="#27d8cd">
      <BackButton onClick={onBack} color="#fff" />
      <button aria-label="다음으로" onClick={onNext} className="absolute inset-0 top-[100px] z-0 cursor-pointer" />
      <Paper className="a-paper pointer-events-none z-10 shadow-[0_18px_40px_rgba(0,80,76,0.18)]" style={delay(0.05)}>
        <PaperFold src={img.paperFold} />
        {children}
      </Paper>
    </Screen>
  );
}

/** 종이에 적는 증명 문구. 학교·학과 이름이 길어도 종이 안에서 줄바꿈된다. */
function Statement({ y, d, children }) {
  return (
    <div
      className="a-fade absolute left-[22px] right-[22px] whitespace-pre-line text-center text-[11px] leading-[21px] text-gray"
      style={{ top: y, wordBreak: "keep-all", ...delay(d) }}
    >
      {children}
    </div>
  );
}

export function Enrolled({ active, nav, state }) {
  const v = view(state);
  const [now] = useState(() => new Date());
  const next = () => nav.replace("welcome", undefined, "fade");
  useGuard(!!v, nav, active);
  useAutoAdvance(next, 4200);
  if (!v) return null;
  const { d } = v;
  return (
    <CertificateShell onBack={nav.back} onNext={next}>
      <T y={56} size={25} center className="a-up pl-[8px] font-bold text-mint" style={delay(0.45)}>
        입학을 축하합니다!
      </T>
      <PaperRow y={117} left="체험생" right={`${d.school} ${d.name}`} d={0.6} />
      <PaperRow y={165} left="일시" right={stamp(now)} d={0.72} />
      <Statement y={210} d={0.9}>
        {`위 사람은 ${d.school} ${d.name}의\n진로 체험을 시작할 수 있음을 증명합니다`}
      </Statement>
      <img src={img.seal} alt="" className="a-pop absolute left-[112px] top-[308px] h-[40px] w-[53px]" style={delay(1.1)} />
    </CertificateShell>
  );
}

function BottomSign({ d: department, wait }) {
  return (
    <div className="a-fade" style={delay(wait)}>
      <T y={288.5} size={10} left={48} className="text-gray">
        체험생
      </T>
      <T y={288.5} size={10} right={40} clip={150} className="text-gray">
        {department.school} {department.name}
      </T>
      <span
        className="absolute left-[42px] top-[309.5px] h-px w-[190.5px] origin-left bg-[#c8c8c8]"
        style={{ animation: `line-grow 0.6s cubic-bezier(0.22,1,0.36,1) ${wait}s both` }}
      />
    </div>
  );
}

export function Grades({ active, nav, state }) {
  const v = view(state);
  const next = () => nav.replace("diploma", undefined, "fade");
  useGuard(!!v?.finished, nav, active);
  useAutoAdvance(next, 4600);
  if (!v?.finished) return null;
  const { d } = v;
  return (
    <CertificateShell onBack={() => nav.reset(["home"])} onNext={next}>
      <div className="absolute inset-0 overflow-hidden rounded-[8px]">
        <T y={56} size={25} center className="a-up pl-[8px] font-bold text-mint" style={delay(0.45)}>
          성적표
        </T>
        <Statement y={104} d={0.6}>
          {`위 사람은 ${d.school} ${d.name}의\n체험 과정을 모두 마쳤음을 증명합니다`}
        </Statement>
        <BottomSign d={d} wait={0.7} />
        <img src={img.seal} alt="" className="a-fade absolute left-[112px] top-[308px] h-[40px] w-[53px]" style={delay(0.8)} />
        <img
          src={img.gradeAplus}
          alt="A+"
          className="absolute left-[-4px] top-[141px] h-[191px] w-[166px]"
          style={{ animation: "stamp 0.55s cubic-bezier(0.22,1,0.36,1) 1.05s both" }}
        />
        <img
          src={img.gradeSign}
          alt=""
          className="absolute left-[131px] top-[256px] h-[72px] w-[130px]"
          style={{ animation: "wipe 0.75s cubic-bezier(0.65,0,0.35,1) 1.75s both" }}
        />
      </div>
    </CertificateShell>
  );
}

export function Diploma({ active, nav, state }) {
  const v = view(state);
  const next = () => nav.replace("graduation", undefined, "fade");
  useGuard(!!v?.finished, nav, active);
  useAutoAdvance(next, 4200);
  if (!v?.finished) return null;
  const { d } = v;
  return (
    <CertificateShell onBack={() => nav.reset(["home"])} onNext={next}>
      <T y={56} size={25} center className="a-up pl-[8px] font-bold text-mint" style={delay(0.45)}>
        졸업증명서
      </T>
      <PaperRow y={117} left="체험생" right={`${d.school} ${d.name}`} d={0.6} />
      <Statement y={168} d={0.8}>
        {`위 사람은 ${d.school} ${d.name}\n체험 과정을 졸업하였음을 증명합니다`}
      </Statement>
      <BottomSign d={d} wait={0.95} />
      <img src={img.seal} alt="" className="a-pop absolute left-[112px] top-[308px] h-[40px] w-[53px]" style={delay(1.15)} />
    </CertificateShell>
  );
}

/* ------------------------------------------------------------------ */
/* 10 · 환영                                                           */
/* ------------------------------------------------------------------ */

export function Welcome({ active, nav, state }) {
  const v = view(state);
  useGuard(!!v?.journey, nav, active);
  if (!v?.journey) return null;
  const { d } = v;
  return (
    <Screen>
      <button aria-label="뒤로" onClick={nav.back} className="pressable absolute left-[17px] top-[48px] z-20 flex h-[40px] w-[36px] items-center justify-center">
        <Mask src={icon.back} w={10} h={15} color="#2c1502" />
      </button>
      <T y={61} size={14.5} center className="font-bold text-ink">
        체험 입학
      </T>
      <div
        className="a-pop absolute left-[141px] top-[121px] flex h-[36px] w-[120px] items-center justify-center gap-[4px] rounded-full border border-mint bg-mint-soft text-[14px] font-bold text-mint-deep"
        style={delay(0.15)}
      >
        체험 입학 완료
        <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden>
          <path d="M1.2 4.6 4 7.3 9.8 1.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="a-drop absolute left-[70px] top-[171px] h-[252px] w-[244px]" style={delay(0.3)}>
        <img
          src={img.mascotWelcome}
          alt=""
          className="loop h-full w-full"
          style={{ animation: "hop 2.4s ease-in-out 1.3s infinite", transformOrigin: "50% 100%" }}
        />
      </div>
      <T y={458} size={d.name.length > 9 ? 21 : 28.5} lh={42} center clip={380} className="a-up font-bold text-ink" style={delay(0.6)}>
        {`반가워요,\n${d.name} 새내기!`}
      </T>
      <T y={549.5} size={14.5} center className="a-up text-ink-3" style={delay(0.7)}>
        나에게 맞는 전공인지, 직접 경험하며 알아봐요.
      </T>
      <div className="a-up absolute left-0 top-[603px] h-[115px] w-[402px] rounded-[28px] bg-cream-2" style={delay(0.8)}>
        <T y={27} size={16.5} center clip={360} className="font-bold text-ink-2">
          {`${d.yearNumbers[0]}학년 · ${d.lessons[0]}`}
        </T>
        <T y={62.5} size={13.5} lh={20} center className="text-ink-3">
          {"학년마다 수업을 하나씩 체험하고\n마지막 학년에는 졸업 과제에 도전해요."}
        </T>
      </div>
      <button
        onClick={() => nav.reset(["home"], "fade")}
        className="pressable a-up absolute left-[20px] top-[737px] flex h-[67px] w-[362px] items-center justify-center rounded-[14px] bg-mint text-[18px] font-semibold text-white active:brightness-95"
        style={delay(0.9)}
      >
        첫 과제 시작하기
      </button>
      <T y={820} size={11.5} center className="a-fade text-ink-3" style={delay(1)}>
        학년은 체험 단계예요. 내 속도에 맞춰 진행해요.
      </T>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 11 · 홈                                                             */
/* ------------------------------------------------------------------ */

function useCountUp(target, ms = 1100, startDelay = 400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now() + startDelay;
    const tick = (now) => {
      const p = Math.min(1, Math.max(0, (now - t0) / ms));
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, startDelay]);
  return value;
}

const TABS = [
  { id: "home", label: "홈", icon: icon.home, w: 38, h: 38, x: 33, y: 762, cx: 52 },
  { id: "explore", label: "탐색", icon: icon.explore, w: 40, h: 39, x: 125, y: 761, cx: 145 },
  { id: "major", label: "전공", icon: icon.major, w: 37, h: 39, x: 224, y: 761, cx: 242.5 },
  { id: "my", label: "마이페이지", icon: icon.my, w: 40, h: 39, x: 316, y: 761, cx: 336 },
];

function TabBar({ active, nav }) {
  const go = (id) => {
    if (id === active) return;
    if (id === "home") nav.reset(["home"]);
    if (id === "explore") nav.push("schools", { field: "전체" });
    if (id === "major") nav.push("detail");
    if (id === "my") nav.push("my");
  };
  return (
    <div className="absolute left-0 top-[739px] h-[135px] w-full border-t border-mint bg-white">
      {TABS.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => go(t.id)}
            aria-current={on ? "page" : undefined}
            className="pressable absolute"
            style={{ left: t.cx - 44, top: 16, width: 88, height: 70 }}
          >
            <Mask
              src={t.icon}
              w={t.w}
              h={t.h}
              color={on ? "#27d8cd" : "#c4c4c4"}
              className="absolute"
              style={{ left: t.x - (t.cx - 44), top: t.y - 739 - 16 }}
            />
            <T y={807 - 739 - 16} size={12.5} center className={on ? "font-medium text-mint" : "font-medium text-[#c4c4c4]"}>
              {t.label}
            </T>
          </button>
        );
      })}
    </div>
  );
}

/** 과제 하나가 어떤 활동인지 한 줄로. */
function taskKind(d, index) {
  if (index === d.lessons.length - 1) return "졸업 과제";
  const game = games.find((item) => item.id === d.games?.[index]);
  return game ? game.title : "직접 해보고 느낀 점 기록하기";
}

function TaskCard({ top, title, sub, d }) {
  return (
    <div
      className="a-up absolute left-[21px] h-[69px] w-[365px] rounded-[10px] border border-[#a4acb6] bg-chalk text-left"
      style={{ top, animationDelay: `${d}s` }}
    >
      <Mask src={icon.eye} w={19} h={19} color="#827d76" className="absolute left-[14px] top-[25px]" />
      <T y={19} size={14} left={45} clip={305} className="font-semibold text-ink-2">
        {title}
      </T>
      <T y={41.5} size={10.5} left={45.5} clip={305} className="text-ink-3">
        {sub}
      </T>
    </div>
  );
}

export function Home({ active, nav, state }) {
  const v = view(state);
  const percent = v?.journey ? Math.round((v.completed / v.total) * 100) : 0;
  const pct = useCountUp(percent);
  useGuard(!!v?.journey, nav, active);
  if (!v?.journey) return null;
  const { d, total, completed, index, year, finished } = v;
  const open = () => (finished ? nav.push("graduation") : nav.push("lesson"));
  // 지금 과제 다음에 남은 과제(최대 2개).
  const upcoming = finished ? [] : d.lessons.map((lesson, i) => ({ lesson, i })).slice(index + 1, index + 3);
  return (
    <Screen>
      <Mask src={icon.cap} w={24} h={18} color="#087f77" className="absolute left-[23px] top-[59px]" />
      <T y={61} size={16} center clip={270} className="font-semibold text-mint">
        {d.school}
      </T>
      <Mask
        src={icon.bell}
        w={22}
        h={24}
        color="#949494"
        className="loop absolute left-[356px] top-[56px] origin-top"
        style={{ animation: "sway 1.2s ease-in-out 1.2s 2" }}
      />
      <T y={122.5} size={28.5} lh={36} left={20} className="a-up font-bold text-navy">
        {"한 걸음씩,\n나의 전공을 알아가는 중"}
      </T>
      <T y={201.5} size={14.5} left={20.5} className="a-up text-gray" style={delay(0.08)}>
        {finished ? "모든 과정을 마쳤어요. 졸업을 축하해요!" : `오늘은 ${year}학년 수업을 만나봐요.`}
      </T>
      <T y={263.5} size={d.name.length > 8 ? 15 : 19.5} left={20} clip={190} className="a-up font-bold text-ink-2" style={delay(0.14)}>
        {d.name}
      </T>
      <T y={294.5} size={12.5} lh={16} left={20.5} clip={170} className="a-up text-mint-deep" style={delay(0.18)}>
        {`${year}학년 · ${d.lessons[index]}\n학습·실습 ${completed} / ${total} 완료`}
      </T>
      <div className="a-pop absolute left-[174px] top-[261px] h-[154px] w-[208px]" style={delay(0.2)}>
        <img src={img.mascotHome} alt="" className="loop h-full w-full" style={{ animation: "float 2.6s ease-in-out 0.9s infinite" }} />
      </div>
      <T y={400.5} size={12.5} left={20} className="text-gray">
        졸업까지
      </T>
      <T y={401.5} size={14} left={70.5} className="font-bold text-mint-deep">
        {pct}%
      </T>
      <div
        className="absolute left-[20px] top-[423px] h-[8.5px] w-[362px] overflow-hidden rounded-full bg-track"
        role="progressbar"
        aria-label="졸업까지 진행도"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-mint" style={{ width: `${pct}%`, transition: "width 0.1s linear" }} />
      </div>
      <button
        onClick={open}
        className="pressable a-up absolute left-[20px] top-[443px] flex h-[56.5px] w-[362px] items-center justify-center rounded-[14px] bg-mint px-[16px] text-[17.5px] font-semibold text-white active:brightness-95"
        style={{ animationDelay: "0.3s" }}
      >
        <span className="loop pointer-events-none absolute inset-0 rounded-[14px]" style={{ animation: "glow 2.4s ease-in-out 1.6s infinite" }} />
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">
          {finished ? "졸업 리포트 보기" : `${d.lessons[index]} ${completed ? "이어하기" : "시작하기"}`}
        </span>
      </button>
      <T y={535.5} size={15} left={21} className="a-up font-bold text-ink-2" style={delay(0.36)}>
        졸업까지 남은 과제
      </T>
      {upcoming.map(({ lesson, i }, n) => (
        <TaskCard key={i} top={565 + n * 84} d={0.42 + n * 0.06} title={lesson} sub={`${d.yearNumbers[i]}학년 실습 · ${taskKind(d, i)}`} />
      ))}
      {upcoming.length === 0 && (
        <T y={585} size={13} left={21} className="a-up text-ink-3" style={delay(0.42)}>
          {finished ? "모든 과제를 마쳤어요." : "지금 하는 과제가 마지막이에요."}
        </T>
      )}
      <TabBar active="home" nav={nav} />
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 12 · 학년별 수업                                                    */
/* ------------------------------------------------------------------ */

const GOAL = 26;

/** 졸업작품: 사포질 → 도색. 문지르면 가루와 물감이 튄다. */
function Studio({ year, onDone, onQuit }) {
  const [phase, setPhase] = useState("sand");
  const progress = useRef(0);
  const phaseRef = useRef("sand");
  const [particles, setParticles] = useState([]);
  const [rubbing, setRubbing] = useState(false);
  const [touched, setTouched] = useState(false);
  const last = useRef(null);
  const idRef = useRef(0);
  const area = useRef(null);
  const done = useRef(false);

  const emit = (x, y, n) => {
    const items = Array.from({ length: n }, () => {
      const a = Math.random() * Math.PI * 2;
      const r = 18 + Math.random() * 46;
      const paint = phase === "paint";
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
      if (phaseRef.current === "sand") {
        phaseRef.current = "paint";
        setPhase("paint");
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
  const down = (e) => {
    e.target.setPointerCapture?.(e.pointerId);
    const p = point(e);
    last.current = p;
    setRubbing(true);
    setTouched(true);
    emit(p.x, p.y, phase === "paint" ? 6 : 8);
    advance(2);
  };
  const move = (e) => {
    if (!last.current) return;
    const p = point(e);
    if (Math.hypot(p.x - last.current.x, p.y - last.current.y) > 16) {
      last.current = p;
      emit(p.x, p.y, phase === "paint" ? 3 : 4);
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
    emit(201, 330, phase === "paint" ? 6 : 8);
    advance(2);
  };

  return (
    <div
      ref={area}
      tabIndex={0}
      role="application"
      aria-label={`${year}학년 졸업작품 ${phase === "sand" ? "사포질하기" : "도색하기"}. 작품을 문지르거나 스페이스를 눌러요.`}
      className="absolute left-0 top-[112px] h-[762px] w-[402px] touch-none select-none overflow-hidden outline-none"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
    >
      {/* 장면 그림 아래쪽에 함께 그려진 기기 장식이 보이지 않도록 조금 키워서 잘라낸다. */}
      <div className="absolute left-[-7px] top-0 h-[789px] w-[416px]" style={{ animation: rubbing ? "rub 0.14s linear infinite" : undefined }}>
        <img src={img.sceneSand} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
        <img
          src={img.scenePaint}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full transition-opacity duration-700"
          style={{ opacity: phase === "paint" ? 1 : 0 }}
        />
      </div>
      <div className="pointer-events-none absolute left-[26px] top-[42px] h-[108px] w-[349px] rounded-[21px] bg-white">
        <T y={31} size={18} center className="font-bold text-ink">
          {year}학년 졸업작품
        </T>
        <T y={66} size={15} center className="text-gray">
          {phase === "sand" ? "사포질하기" : "도색하기"}
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
  );
}

export function Lesson({ active, nav, state, setState }) {
  // 이 화면은 들어올 때의 수업 하나를 끝까지 다룬다.
  const [v] = useState(() => view(state));
  const ok = !!v?.journey && !v.finished;
  const key = ok ? `${v.d.id}-${v.index}` : "";
  const [draft, setDraft] = useState(() => (ok ? state.drafts[key] ?? state.notes[key] ?? "" : ""));
  const [notice, setNotice] = useState("");
  const [shake, setShake] = useState(0);
  const timer = useRef(0);
  useGuard(ok, nav, active);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  if (!ok) return null;

  const { d, index, total, year, final } = v;
  const isFinal = index === total - 1;
  const game = d.games?.[index] || null;
  const played = game && state.plays[key]?.game === game ? state.plays[key].summary : "";
  const plan = state.capstones[d.id];

  // 입력할 때마다 전체 상태를 저장하지 않도록 잠시 모았다가 저장한다.
  const edit = (text) => {
    setDraft(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState((s) => ({ ...s, drafts: { ...s.drafts, [key]: text } })), 400);
  };
  const warn = (message) => {
    setNotice(message);
    setShake((n) => n + 1);
  };

  if (isFinal && final.kind === "artwork")
    return (
      <Screen>
        <Header title={d.name} count={`${index + 1}/${total}`} onBack={nav.back} />
        <Studio
          year={year}
          onQuit={nav.back}
          onDone={() => {
            setState((s) => completeLesson({ ...s, artworks: { ...s.artworks, [d.id]: true } }, d.id, index, ""));
            nav.replace("grades", undefined, "fade");
          }}
        />
      </Screen>
    );

  const finish = () => {
    if (game && !played) return warn("먼저 위의 체험을 끝까지 해보세요.");
    if (isFinal && !finalReady(state, d)) return warn("계획서의 세 칸을 모두 채워주세요.");
    if (!draft.trim()) return warn("느낀 점을 한 줄 이상 적어주세요.");
    window.clearTimeout(timer.current);
    setState((s) => completeLesson(s, d.id, index, draft));
    if (isFinal) nav.replace("grades", undefined, "fade");
    else nav.reset(["home"]);
  };

  return (
    <Screen>
      <Header title={d.name} count={`${index + 1}/${total}`} onBack={nav.back} />
      <ProgressBar value={Math.max(0.04, index / total)} />
      <div className="flow no-scrollbar absolute left-0 top-[124px] h-[620px] w-full overflow-y-auto px-[20px] pb-[20px] pt-[24px]">
        <h1 className="a-up text-[20px] font-semibold leading-[28px] text-mint">{d.lessons[index]}</h1>
        <p className="a-up mt-[4px] text-[14px] leading-[22px] text-gray" style={delay(0.06)}>
          {isFinal ? `${year}학년 · 마지막 과제예요` : `${year}학년 수업 · 직접 해보고 느낀 점을 남겨요`}
        </p>
        <div className="a-up mt-[18px]" style={delay(0.14)}>
          {isFinal ? (
            <GraduationPlan
              final={final}
              value={plan}
              onChange={(next) => setState((s) => ({ ...s, capstones: { ...s.capstones, [d.id]: next } }))}
            />
          ) : game ? (
            <LessonGame
              game={game}
              played={played}
              onComplete={(summary) => setState((s) => ({ ...s, plays: { ...s.plays, [key]: { game, summary } } }))}
            />
          ) : (
            <div className="rounded-[16px] border border-cream-line bg-cream p-[16px]">
              <strong className="text-[14px] font-semibold text-slate">
                {index === 0 ? "관찰하고 이해하기" : "아이디어 적용하기"}
              </strong>
              <p className="mt-[6px] text-[13px] leading-[21px] text-ink-3">
                {index === 0
                  ? `‘${d.lessons[index]}’에서 다루는 주제와 관련된 일상 속 장면을 하나 찾아보세요. 무엇을 관찰했고 어떤 점이 궁금했나요?`
                  : "앞 학년에서 발견한 질문을 작은 해결 방법으로 바꿔보세요. 대상과 목적을 정하고, 직접 해본 과정과 결과를 기록해요."}
              </p>
            </div>
          )}
        </div>
        <label className="note-card a-up mt-[14px]" style={delay(0.22)}>
          <span>
            <strong>{isFinal ? "체험을 마치며 남기는 생각" : "나의 관찰 노트"}</strong>
          </span>
          <textarea
            placeholder={
              isFinal
                ? "이 전공을 체험하며 알게 된 점과 달라진 생각을 적어주세요."
                : game
                  ? "직접 해보니 어땠나요? 느낀 점과 궁금해진 점을 적어주세요."
                  : "어떤 장면을 발견했나요? 나의 생각을 자유롭게 적어주세요."
            }
            value={draft}
            maxLength={3000}
            onChange={(e) => edit(e.target.value)}
          />
          <small>{draft.length.toLocaleString()} / 3,000자</small>
        </label>
        <p key={shake} role="status" className={`mt-[10px] min-h-[20px] text-center text-[13px] leading-[20px] text-mint-deep ${notice ? "a-shake" : ""}`}>
          {notice}
        </p>
      </div>
      <OutlineButton onClick={finish}>{isFinal ? `${final.name} 제출하고 졸업하기` : "기록하고 마치기"}</OutlineButton>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 15 · 졸업                                                           */
/* ------------------------------------------------------------------ */

function lastNote(state, d) {
  for (let i = d.lessons.length - 1; i >= 0; i--) if (state.notes[`${d.id}-${i}`]) return state.notes[`${d.id}-${i}`];
  return "";
}

export function Graduation({ active, nav, state }) {
  const v = view(state);
  const ok = !!v?.finished;
  const grade = useCountUp(ok ? v.lastYear : 0, 700, 700);
  const done = useCountUp(ok ? v.total : 0, 900, 800);
  const pct = useCountUp(ok ? 100 : 0, 1200, 900);
  useGuard(ok, nav, active);
  if (!ok) return null;
  const { d, total } = v;
  const title = `${d.school} ${d.name}`;
  return (
    <Screen>
      <Header title="졸업을 축하합니다" onBack={() => nav.reset(["home"], "fade")} />
      <div className="a-pop absolute left-[100px] top-[128px] h-[158px] w-[190px]" style={delay(0.05)}>
        <img
          src={img.mascotGrad}
          alt=""
          className="loop h-full w-full"
          style={{ animation: "hop 2.2s ease-in-out 1s infinite", transformOrigin: "50% 100%" }}
        />
      </div>
      <Confetti originX={195} originY={215} />
      <T y={311.5} size={title.length > 13 ? 19 : 27.5} lh={40} center clip={386} className="a-up font-bold text-mint" style={delay(0.35)}>
        {`${title}\n졸업을 축하해요!`}
      </T>
      <div className="a-fade absolute left-0 top-[428px] h-[79px] w-full border-y-2 border-mint-line bg-mint-soft" style={delay(0.5)}>
        {[
          { v: `${grade}학년`, l: "체험 단계", cx: 71.5, y: 21, size: 20, ly: 46.5 },
          { v: `${done} / ${total}`, l: "학습 · 실습", cx: 198, y: 25.5, size: 19, ly: 51.5 },
          { v: `${pct}%`, l: "체험 완료", cx: 327.5, y: 22.5, size: 20, ly: 46.5 },
        ].map((st) => (
          <div key={st.l} className="absolute top-0 w-[120px] text-center" style={{ left: st.cx - 60 }}>
            <T y={st.y} size={st.size} center className="font-bold text-mint-deep">
              {st.v}
            </T>
            <T y={st.ly} size={11.5} center className="text-gray">
              {st.l}
            </T>
          </div>
        ))}
      </div>
      <div className="absolute left-0 top-[507px] h-[367px] w-full bg-butter">
        <div className="a-up" style={delay(0.65)}>
          <T y={53.5} size={21} left={21} clip={360} className="font-bold text-ink-2">
            {`나의 ${d.name} 체험 리포트`}
          </T>
        </div>
        <div className="a-up" style={delay(0.75)}>
          <T y={105} size={13} left={20.5} className="font-bold text-mint-deep">
            배운 내용
          </T>
          <div className="report-text absolute left-[20.5px] top-[124px] w-[360px] text-[12px] leading-[18px] text-ink-2" style={{ WebkitLineClamp: 2 }}>
            {d.lessons.join(" → ")}
          </div>
        </div>
        <div className="a-up" style={delay(0.85)}>
          <T y={173} size={13} left={20.5} className="font-bold text-mint-deep">
            느낀 점
          </T>
          <div className="report-text absolute left-[20.5px] top-[192px] w-[360px] text-[12px] leading-[18px] text-ink-2" style={{ WebkitLineClamp: 3 }}>
            {lastNote(state, d) || "남긴 기록이 없어요."}
          </div>
        </div>
      </div>
      <OutlineButton onClick={() => nav.reset(["home", "schools"], "fade")} className="a-up" style={delay(0.95)}>
        다른 학과도 체험하러가기
      </OutlineButton>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 마이페이지                                                          */
/* ------------------------------------------------------------------ */

function reportText(state, d) {
  const notes = d.lessons.map((lesson, i) => `${d.yearNumbers[i]}학년. ${lesson}\n${state.notes[`${d.id}-${i}`] || "기록 없음"}`).join("\n\n");
  const plan = state.capstones[d.id];
  const final = finals[d.final];
  const planText =
    final?.kind === "plan" && planReady(plan)
      ? `\n\n${final.name} 계획\n${final.prompts.map((prompt, i) => `- ${prompt.label}: ${plan[PLAN_FIELDS[i]]}`).join("\n")}`
      : "";
  return `${d.school} ${d.name} 체험 리포트\n\n${d.lessons.length} / ${d.lessons.length} 실습 완료\n\n${notes}${planText}`;
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob(["﻿", text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function My({ nav, state, setState }) {
  const [confirming, setConfirming] = useState(false);
  const journeys = Object.entries(state.journeys)
    .map(([id, journey]) => ({ d: all(state).find((item) => item.id === id && item.school), journey }))
    .filter((item) => item.d);
  const choose = (d, to) => {
    setState((s) => ({ ...s, current: d.id }));
    if (to === "home") nav.reset(["home"]);
    else nav.push(to);
  };
  return (
    <Screen>
      <Header title="마이페이지" onBack={nav.back} />
      <div className="flow no-scrollbar absolute left-0 top-[104px] h-[635px] w-full overflow-y-auto px-[20px] pb-[24px] pt-[20px]">
        <h1 className="a-up text-[20px] font-semibold leading-[28px] text-mint">나의 체험 기록</h1>
        <p className="a-up mt-[4px] text-[14px] leading-[22px] text-gray" style={delay(0.06)}>
          기록은 이 브라우저에만 저장돼요.
        </p>
        {journeys.length === 0 && <p className="a-fade mt-[40px] text-center text-[14px] text-mute">아직 체험한 학과가 없어요.</p>}
        {journeys.map(({ d, journey }, i) => {
          const total = d.lessons.length;
          const completed = Math.min(journey.completed, total);
          const finished = completed === total;
          return (
            <div key={d.id} className="a-up mt-[14px] rounded-[16px] border border-cream-line bg-cream p-[16px]" style={delay(0.12 + Math.min(i, 6) * 0.06)}>
              <strong className="block overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-semibold text-slate">
                {d.school} {d.name}
              </strong>
              <p className="mt-[4px] text-[12px] leading-[18px] text-gray">
                {finished ? `졸업 · 학습과 실습 ${total}개 완료` : `${d.yearNumbers[Math.min(completed, total - 1)]}학년 · ${completed} / ${total} 완료`}
              </p>
              <div className="mt-[12px] flex gap-[8px]">
                <button className="button" onClick={() => choose(d, finished ? "graduation" : "home")}>
                  {finished ? "졸업 리포트 보기" : "이어서 체험하기"}
                </button>
                {finished && (
                  <button className="button ghost" onClick={() => download(`${d.school}-${d.name}-체험-리포트.txt`, reportText(state, d))}>
                    리포트 내려받기
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div className="mt-[28px] text-center">
          {confirming ? (
            <div role="alert">
              <p className="text-[13px] leading-[20px] text-ink-3">
                관심 분야, 체험 기록, 리포트가 모두 지워져요.
                <br />
                필요한 리포트는 먼저 내려받아 주세요.
              </p>
              <div className="mt-[10px] flex justify-center gap-[8px]">
                <button className="button ghost" onClick={() => setConfirming(false)}>
                  그대로 두기
                </button>
                <button
                  className="button danger"
                  onClick={() => {
                    setState(structuredClone(initialState));
                    nav.reset(["splash"]);
                  }}
                >
                  모두 지우기
                </button>
              </div>
            </div>
          ) : (
            <button className="text-button" onClick={() => setConfirming(true)}>
              처음부터 다시 시작하기
            </button>
          )}
        </div>
      </div>
      <TabBar active="my" nav={nav} />
    </Screen>
  );
}

export const SCREENS = {
  splash: Splash,
  interest: Interest,
  explore: Explore,
  loading: Loading,
  result: Result,
  schools: Schools,
  detail: Detail,
  enrolled: Enrolled,
  welcome: Welcome,
  home: Home,
  lesson: Lesson,
  grades: Grades,
  diploma: Diploma,
  graduation: Graduation,
  my: My,
};
