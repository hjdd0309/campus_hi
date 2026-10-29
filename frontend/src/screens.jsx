import React, { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { icon, img } from "./assets.js";
import {
  BackButton,
  Center,
  Confetti,
  delay,
  FilledButton,
  Header,
  Mask,
  OutlineButton,
  Paper,
  PaperFold,
  ProgressBar,
  Screen,
  T,
  Dialog,
  Toast,
} from "./ui.jsx";
import { getCurriculum, getProgramList } from "./api.js";
import {
  QUESTIONS,
  KEYWORD_GROUPS,
  departments,
  fields,
  fieldOf,
  finalOf,
  planReady,
  PLAN_FIELDS,
  createDepartment,
  recommend,
  completeLesson,
  initialState,
  withChoices,
  chooseSubject,
  stageLabel,
  skipLesson,
  progressOf,
  yearSubjects,
  addCurious,
  isCurious,
  PARTNER_LABEL,
  PARTNER_EXAMPLE_NOTE,
  partnerBadge,
  cardTone,
  showsExampleNote,
} from "./model.js";
import { isLessonType, lessonTypes } from "./lessonGames.js";
import LessonGame, { useLessonGame } from "./Games.jsx";
import { PlanSummary, PlanTemplate, Rub } from "./Templates.jsx";
import { templates } from "./experiences.js";
import { gameFor } from "./games.js";
import { groupName } from "./groups.js";

/* ------------------------------------------------------------------ */
/* 공통                                                                */
/* ------------------------------------------------------------------ */

// 학기별 학과는 학기 자리마다 고른 과목을 반영해서 돌려준다.
// 좁은 자리에 쓰는 짧은 이름: 학기 자리는 "1-2", 학년 자리는 "3학년".
const shortStage = (d, i) => (d.semesters?.[i] ? `${d.yearNumbers[i]}-${d.semesters[i]}` : `${d.yearNumbers[i]}학년`);
const all = (state) => [...departments, ...state.catalog.map((d) => withChoices(d, state.choices))];

/**
 * 지금 보고 있는 학과와 그 진행 상태. 학교가 정해진 학과가 없으면 null.
 * at에 휴강한(미이수) 자리 번호를 주면 그 자리를 다시 듣는 것으로 본다(retake).
 */
function view(state, at) {
  const d = all(state).find((item) => item.id === state.current && item.school);
  if (!d) return null;
  const journey = state.journeys[d.id] || null;
  const total = d.lessons.length;
  const { completed, skipped, passed, finished } = progressOf(journey, total);
  const retake = Number.isInteger(at) && skipped.includes(at);
  const index = retake ? at : Math.min(completed, total - 1);
  return {
    d,
    journey,
    total,
    completed,
    skipped,
    passed,
    retake,
    index,
    year: d.yearNumbers[index],
    lastYear: d.yearNumbers[total - 1],
    final: finalOf(d),
    finished,
  };
}

// 잠긴 과목 카드를 눌렀을 때의 확인 창과 "궁금해요" 알림. overlay는 Screen의 overlay로 넘긴다.
const CURIOUS_SAVED = "궁금해요를 남겼어요! 제휴되면 가장 먼저 열려요";
function useLockedSubject(d, state, setState) {
  const [subject, setSubject] = useState(null);
  const [toast, setToast] = useState("");
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const item = (name) => ({ school: d?.school, course: d?.name, subject: name });
  const curious = (name) => isCurious(state, item(name));
  const left = !!subject && curious(subject);
  const leave = () => {
    setState((s) => addCurious(s, item(subject)));
    setSubject(null);
    setToast(CURIOUS_SAVED);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(""), 2600);
  };
  const overlay = (
    <>
      {subject && d && (
        <Dialog
          title="🔒 제휴 대학 전용 과목이에요"
          onClose={() => setSubject(null)}
          actions={
            <>
              <button className="button" onClick={leave} disabled={left}>
                {left ? "궁금해요 남김 ✓" : "이 과목 궁금해요 👀"}
              </button>
              <button className="button ghost" onClick={() => setSubject(null)}>
                닫기
              </button>
            </>
          }
        >
          <strong className="block font-semibold text-ink-2">{subject}</strong>
          {`${josa(d.school, "이", "가")} 캠퍼스하이와 제휴하면 이 과목도 체험할 수 있어요.`}
        </Dialog>
      )}
      <Toast>{toast}</Toast>
    </>
  );
  return { open: setSubject, curious, overlay };
}

const SHOWN_SUBJECTS = 4;
/** 학년별 과목 목록. 체험하는 과목은 열림(✅), 그 학년의 다른 교과목은 잠김(🔒)으로 보여준다. 많으면 4개까지 보이고 더 보기로 펼친다. */
function YearSubjects({ d, years, locked, title = true }) {
  const [opened, setOpened] = useState({});
  return (
    <div className="grid gap-[16px]">
      {years.map(({ year, open, locked: names }) => {
        const more = names.length > SHOWN_SUBJECTS && !opened[year];
        const shown = more ? names.slice(0, SHOWN_SUBJECTS) : names;
        return (
          <section key={year} aria-label={`${year}학년 과목`}>
            {title && (
              <span className="inline-flex h-[28px] w-[47px] items-center justify-center rounded-full border border-mint text-[13px] font-semibold text-mint">
                {year}학년
              </span>
            )}
            <ul className={`grid gap-[6px] ${title ? "mt-[8px]" : ""}`}>
              {open.map(({ index, title: name }) => (
                <li key={`open-${index}`} className="flex min-h-[44px] items-center gap-[8px] rounded-[12px] border border-mint bg-mint-soft px-[12px] py-[8px]">
                  <span aria-hidden="true">✅</span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink-2">{name}</span>
                  <span className="shrink-0 text-[11.5px] text-mint-deep">{d.semesters?.[index] ? stageLabel(d, index) : "체험해요"}</span>
                </li>
              ))}
              {shown.map((name) => {
                const left = locked.curious(name);
                return (
                  <li key={name}>
                    <button
                      onClick={() => locked.open(name)}
                      aria-label={`${name}, 잠김${left ? ", 궁금해요 남김" : ""}`}
                      className="pressable flex min-h-[44px] w-full items-center gap-[8px] rounded-[12px] border border-[#a4acb6] bg-chalk px-[12px] py-[8px] text-left"
                    >
                      <span aria-hidden="true">🔒</span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink-3">{name}</span>
                      {left && <span className="shrink-0 text-[11.5px] font-semibold text-mint-deep">궁금해요 남김 ✓</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {more && (
              <button className="text-button mt-[6px]" onClick={() => setOpened((o) => ({ ...o, [year]: true }))}>
                {`더 보기 (${names.length - SHOWN_SUBJECTS}개)`}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
const ESTIMATED_NOTE = "잠긴 과목의 학년은 보통 듣는 시기를 기준으로 했어요. 실제 편성과 다를 수 있고, 학년을 알 수 없는 과목은 넣지 않았어요.";

/** 가장 최근에 입학한 학과의 id. 입학한 학과가 없으면 null. */
function latestJourney(state) {
  return Object.keys(state.journeys).reverse().find((id) => all(state).some((item) => item.id === id && item.school)) ?? null;
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
    <Screen
      foot={724}
      footer={
        <OutlineButton top={740} onClick={() => nav.push("interest")} className="a-up" style={delay(0.8)}>
          입학하기
        </OutlineButton>
      }
    >
      <Center>
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
      </Center>
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

export function Interest({ nav, setState }) {
  const [picked, setPicked] = useState(null);
  const choose = (i) => {
    setPicked(i);
    // 탐색을 새로 시작하므로 지난번에 고른 답과 관심 키워드는 비운다(탐색 안에서 뒤로 갔다 오는 것은 그대로 둔다).
    setState((s) => ({ ...s, interests: [], answers: {} }));
    window.setTimeout(() => nav.push("explore", { start: i === 0 ? 1 : 8, direct: i === 1 }), 260);
  };
  return (
    <Screen h={420}>
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
  const bottom = step < 8 && q ? 295 + q.options.length * 62 : msg ? 672 : 520;

  return (
    <Screen h={bottom} resetOn={step} footer={<OutlineButton onClick={next}>{step < 8 ? "다음" : "결과 보기"}</OutlineButton>}>
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
      <Center>
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
      </Center>
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

// 제휴 학교 표시. 제휴 학교는 검색 결과 맨 위에 오므로, 왜 위에 있는지 보이도록 이름 옆에 늘 붙인다.
// 글은 하나만 둔다(보이는 글과 읽어 주는 글을 따로 두면 글을 읽어 가는 곳에서 두 번 나온다).
// 예시 제휴라는 것은 배지가 아니라 목록·화면의 안내 문구(PARTNER_EXAMPLE_NOTE)로 알린다.
function PartnerBadge() {
  return (
    <span className="flex h-[18px] shrink-0 items-center whitespace-nowrap rounded-full border border-mint bg-mint-soft px-[6px] text-[10px] font-semibold leading-none text-mint-deep">
      {PARTNER_LABEL}
    </span>
  );
}

// 이름이 길면 이름만 말줄임하고 제휴 표시는 늘 보이게 둔다. 예시 여부를 아직 모르는 옛 기록(null)은 표시하지 않는다.
function NameWithBadge({ partner, example, children }) {
  return (
    <>
      <span className="min-w-0 truncate">{children}</span>
      {partnerBadge(partner, example) && <PartnerBadge />}
    </>
  );
}

// 노란 카드. tone이 white면 흰 카드(검색 결과에서 제휴가 아닌 학교)다.
const TONES = {
  cream: "border-cream-line bg-cream active:bg-cream-2",
  white: "border-line bg-white active:bg-chalk",
};
function YellowCard({ top, title, partner = false, example = false, tone = "cream", sub, onClick, className = "", style }) {
  return (
    <button
      onClick={onClick}
      className={`pressable absolute left-[20px] h-[80px] w-[362px] rounded-[16px] border text-left ${TONES[tone]} ${className}`}
      style={{ top, ...style }}
    >
      <T y={20} size={16} left={15.5} className="flex items-center gap-[6px] font-semibold text-slate" style={{ maxWidth: 330 }}>
        <NameWithBadge partner={partner} example={example}>{title}</NameWithBadge>
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
    <Screen
      h={737}
      footer={
        <OutlineButton onClick={() => open(best.id)} className="a-up" style={delay(0.7)}>
          다음
        </OutlineButton>
      }
    >
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
  // 학교와 학과를 따로 검색한다. 입력은 바로 보여주고, 검색은 입력이 멈춘 뒤에 한다.
  const [query, setQuery] = useState({ school: "", course: "" });
  const [search, setSearch] = useState({ school: "", course: "" });
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  // 찾는 학과가 없을 때 서버가 보내주는 비슷한 학과(학교·학과 조합)와 비슷한 학과명.
  const [similar, setSimilar] = useState({ programs: [], courses: [] });
  const [status, setStatus] = useState("loading");
  const [retry, setRetry] = useState(0);
  const [opening, setOpening] = useState(null);
  const [failed, setFailed] = useState(null);
  const loadingMore = useRef(false);
  const request = useRef(0);
  const filters = FILTERS.includes(filter) ? FILTERS : [FILTERS[0], filter, ...FILTERS.slice(1)];

  useEffect(() => {
    const next = { school: query.school.trim(), course: query.course.trim() };
    const timer = window.setTimeout(
      () => setSearch((current) => (current.school === next.school && current.course === next.course ? current : next)),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setList([]);
    setTotal(0);
    setSimilar({ programs: [], courses: [] });
    loadingMore.current = false;
    request.current += 1;
    getProgramList(filter, search, 0, controller.signal)
      .then((result) => {
        setList(result.programs);
        setTotal(result.total);
        setSimilar({ programs: result.similarPrograms, courses: result.similarCourses });
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
        const dept = createDepartment(p.course, p.school, result.curriculum, result.category, result.years, result.duration, result.region, result.games, result.levels, result.picks, result.partner, result.terms, result.partnerExample);
        // 이미 입학한 학과는 입학할 때 정한 학년별 수업을 그대로 둔다. 새로 받은 데이터로 바꾸면 진행 중인 학년의 수업이 바뀐다.
        // 제휴 여부는 수업과 상관없으니 새로 받은 값으로 바꾼다.
        setState((s) => ({
          ...s,
          current: dept.id,
          catalog: s.journeys[dept.id] && s.catalog.some((item) => item.id === dept.id)
            ? s.catalog.map((item) => (item.id === dept.id ? { ...item, partner: dept.partner, partnerExample: dept.partnerExample } : item))
            : [...s.catalog.filter((item) => item.id !== dept.id), dept],
        }));
        nav.push("detail");
      })
      .catch(() => {
        setFailed(key);
        window.setTimeout(() => setFailed((k) => (k === key ? null : k)), 2200);
      })
      .finally(() => setOpening(null));
  };

  const card = (p, top, i) => {
    const key = keyOf(p);
    return (
      <YellowCard
        key={key}
        top={top}
        title={`${p.school} ${p.course}`}
        partner={p.partner}
        example={p.partnerExample}
        tone={cardTone(p.partner)}
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
  };
  // 비슷한 학과 카드는 목록 맨 위에 두고, 다른 학교 검색 결과가 있으면 그 아래에 이어 붙인다.
  const suggested = similar.programs.length > 0;
  const suggestedSchool = similar.programs.every((p) => p.school === similar.programs[0]?.school) ? similar.programs[0]?.school : "";
  const lead = suggested ? 52 + similar.programs.length * 91 + (list.length ? 32 : 0) : 0;
  // "다음"은 맨 위에 보이는 카드를 연다.
  const top = similar.programs[0] || list[0];
  // 비슷한 학과명을 누르면 그 이름으로 바로 다시 찾는다. 분야 필터와 상관없이 고른 것이므로 필터도 푼다.
  const pickCourse = (name) => {
    const next = { school: query.school.trim(), course: name };
    setQuery((q) => ({ ...q, course: name }));
    setSearch(next);
    setFilter("전체");
  };

  return (
    <Screen footer={<OutlineButton onClick={() => (top ? open(top) : undefined)}>다음</OutlineButton>}>
      <BackButton onClick={nav.back} />
      <T y={126} size={20} lh={25} left={29.5} className="a-up font-semibold text-mint">
        {"궁금했던 학과와 학교\n저와 함께 체험해볼까요?"}
      </T>
      <div className="a-up absolute left-[20px] top-[208px] flex w-[362px] gap-[8px]" style={delay(0.08)}>
        {[
          { field: "school", label: "학교 검색", placeholder: "학교 (예: 서울대)", width: 150 },
          { field: "course", label: "학과 검색", placeholder: "학과 (예: 전자, 디자인)", width: 204 },
        ].map(({ field, label, placeholder, width }) => (
          <label
            key={field}
            className="flex h-[40px] shrink-0 items-center rounded-[12px] border border-faint bg-white transition-colors focus-within:border-mint"
            style={{ width }}
          >
            <Mask src={icon.search} w={20} h={21} color="#d1d5da" className="ml-[10px] shrink-0" />
            <input
              value={query[field]}
              maxLength={100}
              onChange={(e) => {
                const value = e.target.value;
                setQuery((q) => ({ ...q, [field]: value }));
              }}
              placeholder={placeholder}
              aria-label={label}
              className="ml-[8px] mr-[10px] h-full min-w-0 flex-1 bg-transparent text-[11px] tracking-[0.05em] text-slate outline-none placeholder:text-faint"
            />
          </label>
        ))}
      </div>
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
      {status === "ready" && showsExampleNote([...similar.programs, ...list]) && (
        <T y={371} size={10.5} left={30} className="a-fade text-gray" style={delay(0.24)}>
          {PARTNER_EXAMPLE_NOTE}
        </T>
      )}
      <div
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight > el.scrollHeight - 300) more();
        }}
        className="no-scrollbar absolute left-0 top-[380px] w-full overflow-y-auto"
        style={{
          bottom: "calc(124px - var(--bt) * 1px)",
          WebkitMaskImage: "linear-gradient(180deg, #000 0%, #000 50%, rgba(0,0,0,0.55) 72%, rgba(0,0,0,0.12) 96%, transparent 100%)",
          maskImage: "linear-gradient(180deg, #000 0%, #000 50%, rgba(0,0,0,0.55) 72%, rgba(0,0,0,0.12) 96%, transparent 100%)",
        }}
      >
        <div key={`${filter}|${search.school}|${search.course}|${retry}`} className="relative" style={{ height: Math.max(similar.courses.length ? 300 : 110, lead + 5 + list.length * 91 + 90) }}>
          {suggested && (
            <>
              <T y={4} size={14} lh={20} left={29} clip={344} className="a-fade text-mute">
                {`${suggestedSchool ? `${suggestedSchool}에는` : "찾는 학교에"} ‘${search.course}’ 학과가 없어요\n이 학과를 찾으시나요?`}
              </T>
              {similar.programs.map((p, i) => card(p, 52 + i * 91, i))}
              {list.length > 0 && (
                <T y={lead - 26} size={14} left={29} className="a-fade text-mute">
                  다른 학교 검색 결과
                </T>
              )}
            </>
          )}
          {list.map((p, i) => card(p, lead + 5 + i * 91, i))}
          {status === "loading" && (
            <T y={40} size={14} center className="a-fade text-mute">
              학교와 학과를 찾고 있어요…
            </T>
          )}
          {status === "ready" && list.length === 0 && (
            <>
              {!suggested && (
                <T y={40} size={14} center className="a-fade text-mute">
                  검색 결과가 없어요
                </T>
              )}
              {filter !== "전체" && (
                <button
                  onClick={() => setFilter("전체")}
                  className="a-fade absolute left-0 right-0 text-center text-[14px] leading-[22px] text-mint underline"
                  style={{ top: suggested ? lead + 10 : 70 }}
                >
                  전체 분야에서 찾아보기
                </button>
              )}
              {similar.courses.length > 0 && (
                <div className="a-fade absolute left-[20px] w-[362px]" style={{ top: filter !== "전체" ? 108 : 78 }}>
                  <p className="text-center text-[14px] leading-[22px] text-mute">이 학과를 찾으시나요?</p>
                  <div className="mt-[10px] flex flex-wrap justify-center gap-[8px]">
                    {similar.courses.map((name) => (
                      <button
                        key={name}
                        onClick={() => pickCourse(name)}
                        className="pressable h-[32px] max-w-full truncate rounded-full border border-mint bg-white px-[14px] text-[13px] text-mint"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
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
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 08 · 학과 상세                                                      */
/* ------------------------------------------------------------------ */

// 교표 이미지는 출처를 확인한 경희대학교 것만 있다. 다른 학교는 이름 첫 글자로 그린다(다른 학교 로고는 넣지 않는다).
const isKhu = (school) => school.startsWith("경희대학교");
// 이모지 등 두 칸짜리 문자도 반쪽이 나지 않게 문자 단위로 자른다.
const initialOf = (school) => (Array.from(school.trim())[0] || "").toUpperCase();

function SchoolLogo({ name }) {
  if (isKhu(name)) return <img src={img.khuLogo} alt="경희대학교 로고" className="h-full w-full" />;
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex h-[64px] w-[64px] items-center justify-center rounded-full border-2 border-mint/60 text-[26px] font-bold text-mint">
        {initialOf(name)}
      </div>
    </div>
  );
}

/** 입학증·성적표·졸업증명서의 도장. 위치와 크기는 세 화면이 같고, 등장 모션은 화면마다 넘겨받는다. */
function SchoolSeal({ school, className, style }) {
  const box = `${className} absolute left-[112px] top-[308px] h-[40px] w-[53px]`;
  if (isKhu(school)) return <img src={img.seal} alt="" className={box} style={style} />;
  return (
    <div aria-hidden="true" className={`${box} flex items-center justify-center`} style={style}>
      <div className="flex h-[40px] w-[40px] items-center justify-center rounded-full border-2 border-mint/70 text-[18px] font-bold leading-none text-mint">
        {initialOf(school)}
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
  // 예시 여부를 저장하기 전에 입학한 제휴 학과는 서버에서 제휴 정보를 다시 받아 채운다(수업은 그대로 둔다).
  // 화면을 다시 그릴 때마다 학과 객체가 새로 만들어지므로 학과 id로만 다시 받을지 정한다.
  const stale = useRef(null);
  stale.current = v?.d.partner && v.d.partnerExample === null ? v.d : null;
  const staleId = stale.current?.id;
  useEffect(() => {
    if (!active || !staleId) return;
    const { school, name } = stale.current;
    const controller = new AbortController();
    getCurriculum(school, name, controller.signal)
      .then((result) =>
        setState((s) => ({
          ...s,
          catalog: s.catalog.map((item) => (item.id === staleId ? { ...item, partner: result.partner, partnerExample: result.partnerExample } : item)),
        })),
      )
      // 받지 못하면 제휴 표시만 빼 둔 채로 두고, 다음에 학과 상세를 열 때 다시 받는다.
      .catch(() => {});
    return () => controller.abort();
  }, [active, staleId, setState]);
  const locked = useLockedSubject(v?.d, state, setState);
  // 학년별 과목 목록은 길이가 정해져 있지 않아(더 보기, 긴 이름) 그려진 높이를 재서 화면 높이를 정한다.
  const list = useRef(null);
  const [listH, setListH] = useState(0);
  const subjects = v ? yearSubjects(v.d) : null;
  useLayoutEffect(() => {
    if (!list.current) return;
    const update = () => setListH(list.current?.offsetHeight || 0);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(list.current);
    return () => observer.disconnect();
  }, [!!subjects]);
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
    <Screen
      h={subjects ? Math.max(600, 528 + listH + 24) : Math.min(740, 580 + (total - 1) * step)}
      overlay={locked.overlay}
      footer={
        <OutlineButton onClick={enroll} className="a-up" style={delay(0.5)}>
          {finished ? "졸업 리포트 보기" : journey ? "이어서 체험하기" : `${d.name} 입학하기`}
        </OutlineButton>
      }
    >
      <BackButton onClick={nav.back} />
      <div className="a-up absolute left-[20px] top-[116px] h-[112px] w-[362px] rounded-[16px] border border-cream-line bg-cream">
        <div className="absolute left-[11px] top-[21px] h-[72px] w-[108px]">
          <SchoolLogo name={d.school} />
        </div>
        <T y={27} size={d.school.length > 9 ? 16 : 21} left={135.5} className="flex items-center gap-[6px] font-semibold text-slate" style={{ maxWidth: 215 }}>
          <NameWithBadge partner={d.partner} example={d.partnerExample}>{d.school}</NameWithBadge>
        </T>
        <T y={57} size={11} lh={17} left={135} clip={215} className="text-gray">
          {`${d.region ? `${d.region}에 있는 학교예요` : "대학 정보 공시 자료 기준이에요"}\n수업연한 ${d.duration || "4년"} 과정`}
        </T>
      </div>
      {showsExampleNote([d]) && (
        <T y={231} size={10.5} left={24} className="a-fade text-gray" style={delay(0.1)}>
          {PARTNER_EXAMPLE_NOTE}
        </T>
      )}
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
          d.options ? "학교 홈페이지의 학기별 편성에서 과목을 골라요" : d.lessonsFromYears ? "학교 홈페이지의 학년별 편성을 따랐어요" : "학년 배치는 실제 편성과 다를 수 있어요"
        }`}
      </T>
      {subjects && (
        <div ref={list} className="a-up absolute left-[20px] right-[20px] top-[528px]" style={delay(0.28)}>
          <YearSubjects d={d} years={subjects.years} locked={locked} />
          {subjects.estimated && <p className="footnote">{ESTIMATED_NOTE}</p>}
        </div>
      )}
      {/* 등장 모션을 거는 감싸개는 크기가 있어야 한다. 크기 0인 감싸개에 opacity·transform을 걸면 모바일 사파리 등에서
          애니메이션이 끝난 뒤 안의 절대 위치 요소를 다시 그리지 않아 일부가 안 보인다. */}
      {!subjects && d.lessons.map((lesson, i) => (
        <div key={i} className="a-up pointer-events-none absolute inset-0" style={delay(0.28 + i * 0.08)}>
          <span
            className={`absolute left-[33px] flex h-[28px] items-center justify-center rounded-full border border-mint font-semibold text-mint ${d.semesters ? "w-[80px] text-[12px]" : "w-[47px] text-[13px]"}`}
            style={{ top: 536 + i * step }}
          >
            {stageLabel(d, i)}
          </span>
          <T y={544.5 + i * step} size={12} left={d.semesters ? 131 : 98} clip={d.semesters ? 247 : 280} className="text-slate/90">
            {d.options?.[i] && !d.chosen?.[i] ? `${lesson} · 편성 과목 ${d.options[i].length}개 중 하나` : lesson}
          </T>
        </div>
      ))}
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
    <div className="a-fade pointer-events-none absolute inset-0" style={delay(d)}>
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
      <Center>
        <Paper className="a-paper z-10 shadow-[0_18px_40px_rgba(0,80,76,0.18)]" style={delay(0.05)}>
          <PaperFold src={img.paperFold} />
          {children}
        </Paper>
      </Center>
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
      <SchoolSeal school={d.school} className="a-pop" style={delay(1.1)} />
    </CertificateShell>
  );
}

function BottomSign({ d: department, wait }) {
  return (
    <div className="a-fade pointer-events-none absolute inset-0" style={delay(wait)}>
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
  const { d, skipped } = v;
  // 휴강한 과목이 있으면 A+ 도장 대신 학년마다 이수·미이수를 적는다.
  const missed = skipped.length > 0;
  return (
    <CertificateShell onBack={() => nav.reset(["home"])} onNext={next}>
      <div className="absolute inset-0 overflow-hidden rounded-[8px]">
        <T y={56} size={25} center className="a-up pl-[8px] font-bold text-mint" style={delay(0.45)}>
          성적표
        </T>
        <Statement y={104} d={0.6}>
          {missed
            ? `위 사람은 ${d.school} ${d.name}의\n체험 과정을 마쳤음을 증명합니다 (미이수 ${skipped.length}과목)`
            : `위 사람은 ${d.school} ${d.name}의\n체험 과정을 모두 마쳤음을 증명합니다`}
        </Statement>
        {missed && (
          <ul className="a-fade absolute left-[26px] top-[164px] w-[222px]" style={delay(0.7)} aria-label="과목별 이수 결과">
            {d.lessons.map((lesson, i) => (
              <li key={i} className="flex gap-[6px] text-[10px] leading-[16px] text-gray">
                <span className="shrink-0 tabular-nums text-mint-deep">{shortStage(d, i)}</span>
                <span className="min-w-0 flex-1 truncate">{lesson}</span>
                <span className={`shrink-0 font-semibold ${skipped.includes(i) ? "text-ink-2" : "text-mint-deep"}`}>{skipped.includes(i) ? "미이수" : "이수"}</span>
              </li>
            ))}
          </ul>
        )}
        {/* 학기별 학과는 학기마다 고른 과목을 적는다. */}
        {!missed && d.options && (
          <ul className="a-fade absolute left-[170px] top-[152px] w-[92px]" style={delay(0.7)} aria-label="학기별 이수 과목">
            {d.options.map((items, i) =>
              items ? (
                <li key={i} className="flex gap-[5px] text-[9.5px] leading-[16px] text-gray">
                  <span className="shrink-0 tabular-nums text-mint-deep">{shortStage(d, i)}</span>
                  <span className="min-w-0 truncate">{d.lessons[i]}</span>
                </li>
              ) : null,
            )}
          </ul>
        )}
        <BottomSign d={d} wait={0.7} />
        <SchoolSeal school={d.school} className="a-fade" style={delay(0.8)} />
        {!missed && (
          <img
            src={img.gradeAplus}
            alt="A+"
            className="absolute left-[-4px] top-[141px] h-[191px] w-[166px]"
            style={{ animation: "stamp 0.55s cubic-bezier(0.22,1,0.36,1) 1.05s both" }}
          />
        )}
        {(!missed || d.lessons.length <= 5) && (
          <img
            src={img.gradeSign}
            alt=""
            className="absolute left-[131px] top-[256px] h-[72px] w-[130px]"
            style={{ animation: "wipe 0.75s cubic-bezier(0.65,0,0.35,1) 1.75s both" }}
          />
        )}
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
  const { d, skipped } = v;
  return (
    <CertificateShell onBack={() => nav.reset(["home"])} onNext={next}>
      <T y={56} size={25} center className="a-up pl-[8px] font-bold text-mint" style={delay(0.45)}>
        졸업증명서
      </T>
      <PaperRow y={117} left="체험생" right={`${d.school} ${d.name}`} d={0.6} />
      <Statement y={168} d={0.8}>
        {`위 사람은 ${d.school} ${d.name}\n체험 과정을 졸업하였음을 증명합니다`}
        {skipped.length > 0 && (
          <span className="mt-[2px] block truncate text-[10px] leading-[16px] text-ink-3">
            {`미이수 ${skipped.length}과목 · ${skipped.map((i) => d.lessons[i]).join(", ")}`}
          </span>
        )}
      </Statement>
      <BottomSign d={d} wait={0.95} />
      <SchoolSeal school={d.school} className="a-pop" style={delay(1.15)} />
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
    <Screen
      h={725}
      foot={725}
      footer={
        <>
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
        </>
      }
    >
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
          {`${stageLabel(d, 0)} · ${d.lessons[0]}`}
        </T>
        <T y={62.5} size={13.5} lh={20} center className="text-ink-3">
          {d.options ? "학기마다 편성 과목을 골라 체험하고\n마지막 학년에는 졸업 과제에 도전해요." : "학년마다 수업을 하나씩 체험하고\n마지막 학년에는 졸업 과제에 도전해요."}
        </T>
      </div>
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
  if (d.options?.[index] && !d.chosen?.[index]) return `편성 과목 ${d.options[index].length}개 중 하나를 골라요`;
  const id = d.games?.[index];
  if (typeof id === "string" && id.startsWith("group:") && d.practice) return `전공 실습(${templates[d.practice.template].title})`;
  return lessonTypes[id]?.title || "직접 해보고 느낀 점 기록하기";
}

/** 아직 열리지 않은 과제. 누르면 언제 열리는지 잠깐 알려준다. */
function TaskCard({ top, title, sub, hint, onClick, d }) {
  return (
    <button
      onClick={onClick}
      aria-label={`${title}, ${sub}, 잠김`}
      className="pressable a-up absolute left-[21px] h-[69px] w-[365px] rounded-[10px] border border-[#a4acb6] bg-chalk text-left"
      style={{ top, animationDelay: `${d}s` }}
    >
      <Mask src={icon.eye} w={19} h={19} color="#827d76" className="absolute left-[14px] top-[25px]" />
      <T y={19} size={14} left={45} clip={280} className="font-semibold text-ink-2">
        {title}
      </T>
      <T key={hint || "sub"} y={41.5} size={10.5} left={45.5} clip={280} className={hint ? "a-shake text-mint-deep" : "text-ink-3"}>
        {hint || sub}
      </T>
      <svg className="absolute right-[16px] top-[25px]" width="15" height="19" viewBox="0 0 15 19" fill="none" aria-hidden="true">
        <rect x="1" y="8" width="13" height="10" rx="2.5" stroke="#a4acb6" strokeWidth="1.6" />
        <path d="M4 8V5.5a3.5 3.5 0 0 1 7 0V8" stroke="#a4acb6" strokeWidth="1.6" />
      </svg>
    </button>
  );
}

export function Home({ active, nav, state, setState }) {
  const v = view(state);
  // 탐색에서 다른 학과를 열어 보면 current가 그 학과로 바뀐다. 그 학과에 입학하지 않은 채 홈으로 돌아오면
  // 처음 화면으로 보내지 않고, 홈에 보여 주던 학과(없으면 가장 최근에 입학한 학과)를 다시 보여준다.
  // 홈이 뒤에 깔려 있는 동안(탐색·학과 상세를 보는 중)에는 건드리지 않는다. 건드리면 열어 본 학과가 진행 중인 학과로 바뀐다.
  const fallback = v?.journey ? null : state.journeys[state.studying] ? state.studying : latestJourney(state);
  const shown = v?.journey ? v.d.id : null;
  useEffect(() => {
    if (!active) return;
    if (fallback) setState((s) => ({ ...s, current: fallback }));
    else if (shown && state.studying !== shown) setState((s) => ({ ...s, studying: shown }));
  }, [active, fallback, shown, state.studying, setState]);
  const percent = v?.journey ? Math.round((v.completed / v.total) * 100) : 0;
  const pct = useCountUp(percent);
  // 잠긴 과제를 눌렀을 때 그 카드에 보여줄 안내.
  const [hint, setHint] = useState(null);
  const hintTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(hintTimer.current), []);
  useGuard(!!v?.journey || !!fallback, nav, active);
  if (!v?.journey) return null;
  const { d, total, completed, index, year, finished, skipped, passed } = v;
  const tellLocked = (i) => {
    const before = stageLabel(d, i - 1);
    setHint({ i, text: i - 1 === index ? `지금 하는 ${before} 수업을 마치면 열려요` : `${before} 수업을 마치면 열려요` });
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(null), 2400);
  };
  // 학기 자리에서 아직 과목을 고르지 않았으면 과목 고르기부터 한다.
  const choosing = !finished && !!d.options?.[index] && !d.chosen?.[index];
  const open = () => (finished ? nav.push("graduation") : nav.push(choosing ? "choose" : "lesson"));
  const label = stageLabel(d, index);
  // 지금 과제 다음에 남은 과제(최대 2개).
  const upcoming = finished ? [] : d.lessons.map((lesson, i) => ({ lesson, i })).slice(index + 1, index + 3);
  // 남은 과제 아래에 휴강한(미이수) 과목을 다시 들을 수 있게 둔다.
  const listEnd = upcoming.length ? 565 + upcoming.length * 84 : 615;
  return (
    <Screen
      h={skipped.length ? listEnd + 52 + skipped.length * 84 : listEnd}
      foot={739}
      veil={false}
      footer={<TabBar active="home" nav={nav} />}
    >
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
        {finished ? "모든 과정을 마쳤어요. 졸업을 축하해요!" : `오늘은 ${label} 수업을 만나봐요.`}
      </T>
      <T y={263.5} size={d.name.length > 8 ? 15 : 19.5} left={20} clip={190} className="a-up font-bold text-ink-2" style={delay(0.14)}>
        {d.name}
      </T>
      <T y={294.5} size={12.5} lh={16} left={20.5} clip={170} className="a-up text-mint-deep" style={delay(0.18)}>
        {`${label} · ${d.lessons[index]}\n${skipped.length ? `${passed} / ${total} 이수 · 미이수 ${skipped.length}` : `학습·실습 ${completed} / ${total} 완료`}`}
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
          {finished ? "졸업 리포트 보기" : choosing ? `${label} 과목 고르기` : `${d.lessons[index]} ${completed ? "이어하기" : "시작하기"}`}
        </span>
      </button>
      <T y={535.5} size={15} left={21} className="a-up font-bold text-ink-2" style={delay(0.36)}>
        졸업까지 남은 과제
      </T>
      {upcoming.map(({ lesson, i }, n) => (
        <TaskCard key={i} top={565 + n * 84} d={0.42 + n * 0.06} title={lesson} sub={`${stageLabel(d, i)} · ${taskKind(d, i)}`} hint={hint?.i === i ? hint.text : ""} onClick={() => tellLocked(i)} />
      ))}
      <p className="sr-only" role="status">
        {hint?.text}
      </p>
      {upcoming.length === 0 && (
        <T y={585} size={13} left={21} className="a-up text-ink-3" style={delay(0.42)}>
          {finished ? "모든 과제를 마쳤어요." : "지금 하는 과제가 마지막이에요."}
        </T>
      )}
      {skipped.length > 0 && (
        <T y={listEnd + 12} size={15} left={21} className="a-up font-bold text-ink-2" style={delay(0.5)}>
          휴강한 과목 다시 듣기
        </T>
      )}
      {skipped.map((i, n) => (
        <button
          key={`skipped-${i}`}
          onClick={() => nav.push("lesson", { retake: i })}
          aria-label={`${stageLabel(d, i)} ${d.lessons[i]}, 미이수, 다시 듣기`}
          className="pressable a-up absolute left-[21px] h-[69px] w-[365px] rounded-[10px] border border-mint bg-white text-left"
          style={{ top: listEnd + 42 + n * 84, animationDelay: `${0.56 + n * 0.06}s` }}
        >
          <T y={19} size={14} left={16} clip={250} className="font-semibold text-ink-2">
            {d.lessons[i]}
          </T>
          <T y={41.5} size={10.5} left={16.5} clip={250} className="text-ink-3">
            {`${stageLabel(d, i)} · 미이수 · 다시 들으면 이수로 바뀌어요`}
          </T>
          <span className="absolute right-[14px] top-[22px] flex h-[24px] items-center rounded-full bg-mint-soft px-[10px] text-[12px] font-semibold text-mint-deep">
            다시 듣기
          </span>
        </button>
      ))}
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 12 · 학년별 수업                                                    */
/* ------------------------------------------------------------------ */

const STEPS = ["배우기", "직접 해보기", "기록"];

/** 수업 단계 칩. 지나온 단계는 ✓를 붙이고 눌러서 다시 볼 수 있다. */
function StepChips({ step, reached, onGo }) {
  return (
    <ol className="absolute left-[20px] top-[100px] flex gap-[8px]" aria-label="수업 단계">
      {STEPS.map((label, i) => {
        const done = i < reached || (i === reached && i < step);
        const current = i === step;
        return (
          <li key={label}>
            <button
              onClick={() => onGo(i)}
              disabled={current || i > reached}
              aria-current={current ? "step" : undefined}
              className={`pressable flex h-[34px] items-center gap-[4px] rounded-full border px-[13px] text-[13.5px] font-semibold transition-colors ${
                current
                  ? "border-mint bg-mint text-white"
                  : done
                    ? "border-mint bg-mint-soft text-mint-deep"
                    : "border-line bg-white text-mute"
              }`}
            >
              {label}
              {done && !current && (
                <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-label="완료">
                  <path d="M1.2 4.6 4 7.3 9.8 1.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** 연한 민트 카드(릿톤 시안의 "배운 내용" 카드). */
function MintCard({ title, children, className = "" }) {
  return (
    <section className={`rounded-[20px] bg-mint-soft px-[18px] py-[16px] ${className}`}>
      <h2 className="text-[15px] font-bold leading-[22px] text-ink-2">{title}</h2>
      <div className="mt-[6px] text-[13.5px] leading-[22px] text-ink-3">{children}</div>
    </section>
  );
}

/** 연습 문제 유형별로 "이 수업에서 해볼 것". */
function quizTask(game) {
  const n = game.items.length;
  if (game.type === "blank") return `문장 ${n}개의 빈칸에 알맞은 말을 골라요.`;
  if (game.type === "ox") return `문장 ${n}개가 맞는지 O, X로 골라요.`;
  if (game.type === "order") return `${n}단계를 올바른 순서로 놓아요.`;
  if (game.type === "match") return `서로 관련된 ${n}쌍의 짝을 맞춰요.`;
  return `${n}개를 알맞은 칸으로 나눠요.`;
}
// 연습 문제가 없는 과목의 관찰 과제. 첫 학년은 관찰, 그다음 학년은 앞에서 찾은 질문을 적용해 본다.
function basicTasks(subject, first, before = "앞 학년") {
  return first
    ? [`‘${subject}’에서 다루는 주제와 관련된 일상 속 장면을 하나 찾아요.`, "무엇을 관찰했는지 적어요.", "관찰하며 궁금해진 점을 적어요."]
    : [`${before}에서 발견한 질문을 하나 골라요.`, "대상과 목적을 정해 작은 해결 방법으로 바꿔봐요.", "직접 해본 과정과 결과를 기록해요."];
}

export function Lesson({ active, nav, route, state, setState }) {
  // 이 화면은 들어올 때의 수업 하나를 끝까지 다룬다. retake가 있으면 휴강했던(미이수) 그 자리를 다시 듣는다.
  const [v] = useState(() => view(state, route?.params?.retake));
  const ok = !!v?.journey && (!v.finished || v.retake);
  const key = ok ? `${v.d.id}-${v.index}` : "";
  const subject = ok ? v.d.lessons[v.index] : "";
  const isFinal = ok && v.index === v.total - 1;
  // 학기 자리에서 과목을 아직 고르지 않았으면(새로고침 등) 과목 고르기로 보낸다.
  const unchosen = ok && !!v.d.options?.[v.index] && !v.d.chosen?.[v.index];
  const game = ok && !isFinal ? v.d.games?.[v.index] || null : null;
  // 학과군 전공 실습이면 그 체험 데이터. 아니면 연습 문제 유형(이론 수업)이거나 null(기본 체험).
  const practice = typeof game === "string" && game.startsWith("group:") ? v.d.practice : null;
  const typed = !practice && isLessonType(game);
  const quiz = useLessonGame(typed ? subject : null);
  const [draft, setDraft] = useState(() => (ok ? state.drafts[key] ?? state.notes[key] ?? "" : ""));
  // 체험이나 기록을 이미 시작한 수업은 기록 단계부터 이어간다.
  const [step, setStep] = useState(() => (ok && ((game && state.plays[key]) || state.drafts[key]) ? 2 : 0));
  const [reached, setReached] = useState(step);
  const [notice, setNotice] = useState("");
  const [shake, setShake] = useState(0);
  // 휴강 확인 창을 띄웠는지.
  const [skipping, setSkipping] = useState(false);
  const locked = useLockedSubject(ok ? v.d : null, state, setState);
  const timer = useRef(0);
  const scroller = useRef(null);
  const heading = useRef(null);
  const moved = useRef(false);
  useGuard(ok, nav, active);
  useEffect(() => {
    if (active && unchosen) nav.replace("choose");
  }, [active, unchosen, nav]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // 연습 문제를 받을 수 없으면 기본 체험으로 진행하고, 체험을 마친 것으로 기록해 수업을 끝낼 수 있게 한다.
  useEffect(() => {
    if (typed && quiz.status === "basic")
      setState((s) => (s.plays[key]?.game === game ? s : { ...s, plays: { ...s.plays, [key]: { game, summary: "" } } }));
  }, [typed, quiz.status, key, game, setState]);
  // 단계를 옮기면 맨 위로 올리고 제목에 초점을 둔다(스크린 리더가 새 단계를 읽게).
  useEffect(() => {
    if (!moved.current) return;
    if (scroller.current) scroller.current.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, [step]);
  if (!ok || unchosen) return null;

  const { d, index, total, year, final, retake } = v;
  const label = stageLabel(d, index);
  const before = d.semesters ? "앞 학기" : "앞 학년";
  const header = <Header title={`${label} · ${subject}`} count={`${index + 1}/${total}`} onBack={nav.back} />;
  // 휴강: 미이수로 기록하고 다음 자리로 넘어간다. 쓰던 기록은 다시 들을 때 이어서 쓰도록 남긴다.
  const skip = () => {
    window.clearTimeout(timer.current);
    setSkipping(false);
    setState((s) => skipLesson(draft ? { ...s, drafts: { ...s.drafts, [key]: draft } } : s, d.id, index));
    if (isFinal) nav.replace("grades", undefined, "fade");
    else nav.reset(["home"]);
  };
  const skipDialog = skipping && (
    <Dialog
      title="이 과제를 건너뛸까요?"
      onClose={() => setSkipping(false)}
      actions={
        <>
          <button className="button" onClick={() => setSkipping(false)}>
            계속 풀기
          </button>
          <button className="button ghost" onClick={skip}>
            휴강하기
          </button>
        </>
      }
    >
      건너뛴 과제는 성적표에 ‘미이수’로 남아요. 나중에 다시 들을 수 있어요.
    </Dialog>
  );
  const skipButton = (className, style) =>
    retake ? null : (
      <button onClick={() => setSkipping(true)} className={`pressable text-[13px] text-gray underline underline-offset-[3px] ${className}`} style={style}>
        이번엔 자체 휴강할게요
      </button>
    );

  if (isFinal && final.kind === "artwork")
    return (
      <Screen overlay={skipDialog}>
        <Header title={d.name} count={`${index + 1}/${total}`} onBack={nav.back} />
        {skipButton("absolute right-[20px] top-[84px] z-20 h-[28px]")}
        <Rub
          data={final}
          year={year}
          onQuit={nav.back}
          onDone={() => {
            setState((s) => completeLesson({ ...s, artworks: { ...s.artworks, [d.id]: true } }, d.id, index, ""));
            nav.replace("grades", undefined, "fade");
          }}
        />
      </Screen>
    );

  // 수업의 종류: 졸업 계획서, 졸업 프로젝트(AI 가르치기 등), 학과군 전공 실습, 연습 문제(불러오는 중·오류 포함), 기본 체험.
  const mode = isFinal ? (final.kind === "project" ? "project" : "plan") : practice ? "practice" : typed && quiz.status !== "basic" ? quiz.status === "ready" ? "quiz" : quiz.status : "basic";
  const play = game && state.plays[key]?.game === game ? state.plays[key] : null;
  const played = play?.summary || "";
  const plan = state.capstones[d.id];
  const projectDone = !!state.artworks[d.id];
  const tried =
    mode === "plan" ? planReady(plan) : mode === "project" ? projectDone : mode === "practice" || mode === "quiz" ? !!played : mode === "basic";

  const headline = mode === "plan" || mode === "project" ? final.name : mode === "practice" ? practice.title : mode === "quiz" ? quiz.game.title : subject;
  const warn = (message) => {
    setNotice(message);
    setShake((n) => n + 1);
  };
  const go = (next) => {
    moved.current = true;
    setNotice("");
    setStep(next);
    setReached((r) => Math.max(r, next));
  };
  // 입력할 때마다 전체 상태를 저장하지 않도록 잠시 모았다가 저장한다.
  const edit = (text) => {
    setDraft(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState((s) => ({ ...s, drafts: { ...s.drafts, [key]: text } })), 400);
  };
  const finish = () => {
    if (!tried) return warn(mode === "plan" ? "계획서의 세 칸을 모두 채워주세요." : "먼저 직접 해보기를 끝까지 해보세요.");
    // 느낀 점은 적지 않아도 된다. 비어 있으면 기록 없이 완료한다(건너뛰기).
    window.clearTimeout(timer.current);
    setState((s) => completeLesson(s, d.id, index, draft));
    if (isFinal) nav.replace("grades", undefined, "fade");
    else nav.reset(["home"]);
  };
  const next = d.lessons[index + 1];
  const written = !!draft.trim();
  // 배우기 단계 아래에 보여줄 이 학년의 과목(체험하는 과목은 열림, 다른 교과목은 잠김).
  const subjects = yearSubjects(d);
  const found = subjects?.years.find((item) => item.year === year);
  const yearList = found && { ...found, open: found.open.filter((item) => item.index === index) };

  let body;
  let action;
  if (step === 0) {
    const task =
      mode === "plan" ? final.intro
      : mode === "project" ? final.task
      : mode === "practice" ? practice.task
      : mode === "quiz" ? quizTask(quiz.game)
      : mode === "basic"
        ? index === 0
          ? "일상에서 이 과목의 주제를 찾아 관찰하고, 느낀 점을 한 줄로 남겨요."
          : `${before}에서 찾은 질문을 작은 해결 방법으로 바꿔보고, 느낀 점을 한 줄로 남겨요.`
      : null;
    body = (
      <>
        {mode === "loading" && (
          <p className="a-up mt-[22px] text-[13.5px] text-ink-3" role="status">
            연습 문제를 불러오는 중이에요…
          </p>
        )}
        {mode === "error" && (
          <div className="a-up mt-[22px]" role="alert">
            <p className="body-copy">{quiz.message}</p>
            <button className="button" onClick={quiz.retry}>
              다시 시도
            </button>
            <button className="text-button ml-[14px]" onClick={quiz.skip}>
              연습 문제 없이 진행하기 →
            </button>
          </div>
        )}
        {(mode === "practice" || mode === "project") && (mode === "practice" ? practice : final).learn && (
          <MintCard title="알아두기" className="a-up mt-[22px]">
            <p style={delay(0.1)}>{(mode === "practice" ? practice : final).learn}</p>
          </MintCard>
        )}
        {task && (
          <MintCard
            title="이 수업에서 해볼 것"
            className={`a-up ${(mode === "practice" || mode === "project") && (mode === "practice" ? practice : final).learn ? "mt-[12px]" : "mt-[22px]"}`}
          >
            <p style={delay(0.12)}>{task}</p>
          </MintCard>
        )}
        {d.options?.[index] && !state.plays[key] && !retake && (
          <button className="text-button a-up mt-[14px]" onClick={() => nav.replace("choose")} style={delay(0.16)}>
            다른 과목 고르기 →
          </button>
        )}
        {yearList?.locked.length > 0 && (
          <section className="a-up mt-[26px]" style={delay(0.18)}>
            <h2 className="text-[15px] font-bold leading-[22px] text-ink-2">{`${year}학년의 다른 과목`}</h2>
            <div className="mt-[8px]">
              <YearSubjects d={d} years={[yearList]} locked={locked} title={false} />
            </div>
            {subjects.estimated && <p className="footnote">{ESTIMATED_NOTE}</p>}
          </section>
        )}
      </>
    );
    action = (
      <FilledButton onClick={() => go(1)} disabled={mode === "loading" || mode === "error"}>
        직접 해보기
      </FilledButton>
    );
  } else if (step === 1) {
    body = (
      <div className="a-up mt-[22px]">
        {mode === "plan" && (
          <PlanTemplate
            data={final}
            value={plan}
            onChange={(value) => {
              if (planReady(value)) setNotice("");
              setState((s) => ({ ...s, capstones: { ...s.capstones, [d.id]: value } }));
            }}
          />
        )}
        {mode === "project" && (
          <LessonGame
            game={final}
            played={projectDone ? "졸업 과제를 끝까지 해봤어요" : ""}
            onComplete={() => {
              setNotice("");
              setState((s) => ({ ...s, artworks: { ...s.artworks, [d.id]: true } }));
            }}
          />
        )}
        {(mode === "practice" || mode === "quiz") && (
          <LessonGame
            game={mode === "practice" ? practice : quiz.game}
            played={played}
            onComplete={(summary) => {
              setNotice("");
              setState((s) => ({ ...s, plays: { ...s.plays, [key]: { game, summary } } }));
            }}
          />
        )}
        {mode === "basic" && (
          <section>
            <h2 className="text-[16px] font-bold leading-[24px] text-ink-2">오늘의 직접 적용 과제</h2>
            <ol className="mt-[8px] grid gap-[4px] text-[13.5px] leading-[22px] text-ink-3">
              {basicTasks(subject, index === 0, before).map((item, i) => (
                <li key={i}>
                  {"①②③"[i]} {item}
                </li>
              ))}
            </ol>
            <p className="footnote">과제를 해본 뒤 다음 단계에서 한 줄로 기록해요.</p>
          </section>
        )}
      </div>
    );
    action = (
      <FilledButton onClick={() => (tried ? go(2) : warn(mode === "plan" ? "계획서의 세 칸을 모두 채워주세요." : "먼저 끝까지 해보세요."))}>
        기록하러 가기
      </FilledButton>
    );
  } else {
    body = (
      <>
        {(mode === "quiz" || mode === "project" || (mode === "practice" && practice.learn)) && (
          <MintCard title="배운 내용" className="a-up mt-[22px]">
            <p>{mode === "quiz" ? quiz.game.explanation : mode === "project" ? final.explanation : practice.learn}</p>
          </MintCard>
        )}
        {mode === "plan" && planReady(plan) && (
          <MintCard title={`나의 ${final.name} 계획서`} className="a-up mt-[22px]">
            <PlanSummary final={final} plan={plan} />
          </MintCard>
        )}
        {played && (
          <p className="a-up mt-[14px] text-[13px] leading-[20px] text-mint-deep" style={delay(0.06)}>
            오늘 해본 것 · {played}
          </p>
        )}
        <label className="note-card a-up mt-[16px] block" style={delay(0.12)}>
          <strong>{isFinal ? "체험을 마치며 남기는 생각" : "한 줄 기록"}</strong>
          <textarea
            className="compact"
            rows={2}
            placeholder={
              isFinal
                ? "이 전공을 체험하며 알게 된 점이나 달라진 생각을 남겨요."
                : mode === "basic"
                  ? "어떤 장면을 발견했나요? 한 줄로 남겨요."
                  : "직접 해보니 어땠나요? 느낀 점을 한 줄로 남겨요."
            }
            value={draft}
            maxLength={3000}
            onChange={(e) => edit(e.target.value)}
          />
          <small>{draft.length.toLocaleString()} / 3,000자</small>
        </label>
      </>
    );
    // 적은 내용이 있으면 저장, 없으면 건너뛰기로 버튼이 바뀐다.
    const label = isFinal
      ? written ? `${final.name} 제출하고 ${retake ? "이수하기" : "졸업하기"}` : `생각은 건너뛰고 ${final.name} 제출하기`
      : written ? "기록 저장하고 완료하기" : "기록 건너뛰고 완료하기";
    action = <FilledButton onClick={finish}>{label}</FilledButton>;
  }

  // 아래 안내: 경고가 있으면 경고를, 기록 단계에서는 저장하면 어떻게 되는지를 보여준다.
  const verb = written ? "저장하면" : "건너뛰면";
  const guide =
    notice ||
    (step === 2
      ? retake
        ? `${verb} 미이수가 이수로 바뀌어요`
        : isFinal
          ? `${verb} 졸업이에요`
          : `${verb} ${index + 1} / ${total} 완료 · 다음은 ${stageLabel(d, index + 1)} ${next}`
      : "");
  return (
    <Screen
      foot={700}
      overlay={
        <>
          {skipDialog}
          {locked.overlay}
        </>
      }
      footer={
        <>
          {/* 이전 단계(첫 단계에서는 없음)와 휴강. 주 버튼과 구분되게 글씨 버튼으로 둔다. */}
          <div className="absolute inset-x-[20px] top-[708px] flex h-[36px] items-center justify-between">
            {step > 0 ? (
              <button onClick={() => go(step - 1)} className="pressable h-[36px] rounded-full border border-line bg-white px-[14px] text-[13px] font-semibold text-slate">
                ← 이전 단계
              </button>
            ) : (
              <span />
            )}
            {skipButton("h-[36px]")}
          </div>
          {action}
          <p
            key={shake}
            role="status"
            className={`absolute inset-x-[20px] top-[818px] overflow-hidden text-ellipsis whitespace-nowrap text-center text-[12.5px] leading-[20px] ${notice ? "a-shake text-mint-deep" : "text-gray"}`}
          >
            {guide}
          </p>
        </>
      }
    >
      {header}
      <StepChips step={step} reached={reached} onGo={go} />
      <div
        ref={scroller}
        className="flow no-scrollbar absolute left-0 top-[146px] w-full overflow-y-auto px-[20px] pb-[20px] pt-[18px]"
        style={{ bottom: "calc(174px - var(--bt) * 1px)" }}
      >
        <div key={step}>
          <h1 ref={heading} tabIndex={-1} className="a-up text-[26px] font-bold leading-[36px] text-navy outline-none">
            {headline}
          </h1>
          <p className="a-up mt-[6px] text-[14px] leading-[22px] text-gray" style={delay(0.06)}>
            {isFinal ? `${year}학년 · 마지막 과제예요` : practice ? `${year}학년 전공 실습 · ${groupName(d.studyGroup)}` : `${label} 수업 · ${subject}`}
            {retake ? " · 다시 듣기" : ""}
          </p>
          {body}
        </div>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 12-1 · 학기 과목 고르기 (제휴 대학의 학기별 편성이 있는 학과)         */
/* ------------------------------------------------------------------ */

export function Choose({ active, nav, state, setState }) {
  const v = view(state);
  const options = v?.journey && !v.finished && !v.journey.paused ? v.d.options?.[v.index] : null;
  useGuard(!!options, nav, active);
  if (!options) return null;
  const { d, index, total } = v;
  const label = stageLabel(d, index);
  const current = state.choices[`${d.id}-${index}`] || null;
  // 다른 학기에 이미 고른 과목은 다시 고를 수 없다.
  const taken = new Set(d.options.map((items, i) => (items && i !== index ? state.choices[`${d.id}-${i}`] : null)).filter(Boolean));
  // 연습 문제가 있는 과목을 먼저, 고를 수 없는 과목을 맨 뒤에 둔다. 그 안에서는 편성표 순서다.
  const items = options
    .map((subject) => ({ subject, type: gameFor(subject, d.lessonGames), taken: taken.has(subject) }))
    .sort((a, b) => a.taken - b.taken || !a.type - !b.type);
  const quizzes = items.filter((item) => item.type && !item.taken).length;
  // 예시 제휴 대학이면 첫 학기 과목 고르기에서 한 번만 예시라고 알린다.
  const exampleNote = d.partnerExample && d.options.findIndex(Boolean) === index;
  const pick = (subject) => {
    setState((s) => chooseSubject(s, d.id, index, subject));
    nav.replace("lesson");
  };
  return (
    <Screen>
      <Header title={`${label} · 과목 고르기`} count={`${index + 1}/${total}`} onBack={nav.back} />
      <div className="flow no-scrollbar absolute bottom-0 left-0 top-[100px] w-full overflow-y-auto px-[20px] pb-[32px] pt-[12px]">
        <h1 className="a-up whitespace-pre-line text-[24px] font-bold leading-[34px] text-navy">{`${label}에 들을 과목을\n하나 골라요`}</h1>
        <p className="a-up mt-[8px] text-[13.5px] leading-[21px] text-gray" style={delay(0.06)}>
          {`${d.school} 편성표의 ${label} 과목 ${options.length}개예요. `}
          {quizzes
            ? `‘연습 문제’ 표시가 있는 ${quizzes}개 과목은 문제를 풀어 보고, 나머지는 관찰 과제로 체험해요.`
            : "이 학기 과목은 모두 관찰 과제로 체험해요."}
        </p>
        {exampleNote && (
          <p className="a-up mt-[12px] rounded-[12px] border border-mint bg-mint-soft px-[14px] py-[10px] text-[12.5px] leading-[19px] text-mint-deep" style={delay(0.08)}>
            제휴 학교는 이렇게 학기별로 과목을 골라 체험할 수 있어요 (서비스 예시)
          </p>
        )}
        <ul className="mt-[18px] grid gap-[10px]">
          {items.map(({ subject, type, taken: used }, i) => (
            <li key={subject} className="a-up" style={delay(0.1 + Math.min(i, 8) * 0.03)}>
              <button
                onClick={() => pick(subject)}
                disabled={used}
                aria-pressed={current === subject}
                className={`pressable flex min-h-[62px] w-full items-center gap-[10px] rounded-[14px] border px-[16px] py-[10px] text-left ${
                  used ? "border-faint bg-chalk opacity-60" : current === subject ? "border-mint bg-mint-soft" : "border-cream-line bg-cream active:bg-cream-2"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold leading-[22px] text-ink-2">{subject}</span>
                  <span className="block text-[12px] leading-[18px] text-gray">
                    {used ? "다른 학기에 고른 과목이에요" : type ? `${lessonTypes[type].title}로 연습해요` : "관찰 과제로 체험해요"}
                    {current === subject ? " · 지금 고른 과목" : ""}
                  </span>
                </span>
                {type && !used && (
                  <span className="flex h-[22px] shrink-0 items-center rounded-full border border-mint bg-white px-[8px] text-[11px] font-semibold text-mint-deep">
                    연습 문제
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
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
  // 휴강한 과목은 이수에 넣지 않는다.
  const done = useCountUp(ok ? v.passed : 0, 900, 800);
  const pct = useCountUp(ok ? Math.round((v.passed / v.total) * 100) : 0, 1200, 900);
  useGuard(ok, nav, active);
  if (!ok) return null;
  const { d, total, skipped } = v;
  const title = `${d.school} ${d.name}`;
  return (
    <Screen
      h={754}
      foot={754}
      veil="#feeaa0"
      footer={
        <>
          <OutlineButton onClick={() => nav.reset(["home"], "fade")} className="a-up" style={delay(0.95)}>
            홈으로 가기
          </OutlineButton>
          <button
            onClick={() => nav.reset(["home", "schools"], "fade")}
            className="pressable a-fade absolute left-[100px] top-[830px] h-[32px] w-[202px] text-[13px] text-mint-deep underline"
            style={delay(1.05)}
          >
            다른 학과도 체험하러 가기
          </button>
        </>
      }
    >
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
          { v: `${pct}%`, l: skipped.length ? "이수율" : "체험 완료", cx: 327.5, y: 22.5, size: 20, ly: 46.5 },
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
      <div className="absolute bottom-0 left-0 top-[507px] w-full bg-butter">
        <div className="a-up pointer-events-none absolute inset-0" style={delay(0.65)}>
          <T y={53.5} size={21} left={21} clip={360} className="font-bold text-ink-2">
            {`나의 ${d.name} 체험 리포트`}
          </T>
        </div>
        <div className="a-up pointer-events-none absolute inset-0" style={delay(0.75)}>
          <T y={105} size={13} left={20.5} className="font-bold text-mint-deep">
            배운 내용
          </T>
          <div className="report-text absolute left-[20.5px] top-[124px] w-[360px] text-[12px] leading-[18px] text-ink-2" style={{ WebkitLineClamp: 2 }}>
            {d.lessons
              .map((lesson, i) => `${d.options ? `${shortStage(d, i)} ` : ""}${lesson}${skipped.includes(i) ? "(미이수)" : ""}`)
              .join(d.options ? " · " : " → ")}
          </div>
        </div>
        <div className="a-up pointer-events-none absolute inset-0" style={delay(0.85)}>
          <T y={173} size={13} left={20.5} className="font-bold text-mint-deep">
            느낀 점
          </T>
          <div className="report-text absolute left-[20.5px] top-[192px] w-[360px] text-[12px] leading-[18px] text-ink-2" style={{ WebkitLineClamp: 3 }}>
            {lastNote(state, d) || "남긴 기록이 없어요."}
          </div>
        </div>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 마이페이지                                                          */
/* ------------------------------------------------------------------ */

function reportText(state, d) {
  const { completed, skipped, passed } = progressOf(state.journeys[d.id], d.lessons.length);
  const notes = d.lessons
    .map((lesson, i) => `${stageLabel(d, i)}. ${lesson}${skipped.includes(i) ? " [미이수]" : ""}\n${state.notes[`${d.id}-${i}`] || "기록 없음"}`)
    .join("\n\n");
  const plan = state.capstones[d.id];
  const final = finalOf(d);
  const planText =
    final?.kind === "plan" && planReady(plan)
      ? `\n\n${final.name} 계획\n${final.prompts.map((prompt, i) => `- ${prompt.label}: ${plan[PLAN_FIELDS[i]]}`).join("\n")}`
      : "";
  // 체험 구조가 바뀌기 전에 남긴 기록(학년 자리의 수업이 바뀌어 옮겨 둔 것).
  const archived = (state.archive || []).filter((item) => item.id === d.id);
  const archiveText = archived.length
    ? `\n\n이전 체험 기록 (체험 구조가 바뀌기 전에 남긴 기록이에요)\n${archived.map((item) => `- ${item.title}\n${item.note}`).join("\n\n")}`
    : "";
  const status = skipped.length
    ? `${completed} / ${d.lessons.length} 진행 · 이수 ${passed} · 미이수 ${skipped.length}`
    : `${completed} / ${d.lessons.length} 완료`;
  return `${d.school} ${d.name} 체험 리포트\n\n${status}\n\n${notes}${planText}${archiveText}`;
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
    <Screen foot={739} veil={false} footer={<TabBar active="my" nav={nav} />}>
      <Header title="마이페이지" onBack={nav.back} />
      <div
        className="flow no-scrollbar absolute left-0 top-[104px] w-full overflow-y-auto px-[20px] pb-[24px] pt-[20px]"
        style={{ bottom: "calc(135px - var(--bt) * 1px)" }}
      >
        <h1 className="a-up text-[20px] font-semibold leading-[28px] text-mint">나의 체험 기록</h1>
        <p className="a-up mt-[4px] text-[14px] leading-[22px] text-gray" style={delay(0.06)}>
          기록은 이 브라우저에만 저장돼요.
        </p>
        {journeys.length === 0 && <p className="a-fade mt-[40px] text-center text-[14px] text-mute">아직 체험한 학과가 없어요.</p>}
        {journeys.map(({ d, journey }, i) => {
          const total = d.lessons.length;
          const { completed, skipped, passed, finished } = progressOf(journey, total);
          const missed = skipped.length ? ` · 미이수 ${skipped.length}` : "";
          const archived = (state.archive || []).filter((item) => item.id === d.id).length;
          return (
            <div key={d.id} className="a-up mt-[14px] rounded-[16px] border border-cream-line bg-cream p-[16px]" style={delay(0.12 + Math.min(i, 6) * 0.06)}>
              <strong className="block overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-semibold text-slate">
                {d.school} {d.name}
              </strong>
              <p className="mt-[4px] text-[12px] leading-[18px] text-gray">
                {finished
                  ? skipped.length
                    ? `졸업 · ${passed} / ${total} 이수${missed}`
                    : `졸업 · 학습과 실습 ${total}개 완료`
                  : `${stageLabel(d, Math.min(completed, total - 1))} · ${completed} / ${total} 완료${missed}`}
              </p>
              {archived > 0 && (
                <p className="mt-[4px] text-[12px] leading-[18px] text-mint-deep">
                  체험 구조가 바뀌기 전에 남긴 기록 {archived}개를 리포트에 함께 담았어요.
                </p>
              )}
              <div className="mt-[12px] flex gap-[8px]">
                <button className="button" onClick={() => choose(d, finished ? "graduation" : "home")}>
                  {finished ? "졸업 리포트 보기" : "이어서 체험하기"}
                </button>
                {(finished || archived > 0) && (
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
  choose: Choose,
  grades: Grades,
  diploma: Diploma,
  graduation: Graduation,
  my: My,
};
