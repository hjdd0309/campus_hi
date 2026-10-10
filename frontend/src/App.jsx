import React, { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import Mascot from "./Mascot.jsx";
import Catalog from "./Catalog.jsx";
import CampusDocument, { documentTitles } from "./CampusDocument.jsx";
import GraduationStudio, { ArtworkPreview } from "./GraduationStudio.jsx";
import LessonGame from "./Games.jsx";
import {
  STORAGE_KEY,
  departments as baseDepartments,
  LESSON_COUNT,
  lessonYear,
  createDepartment,
  initialState,
  loadState,
  recommend,
  completeLesson,
} from "./model.js";

const routes = [
  "welcome",
  "interest",
  "activities",
  "keywords",
  "result",
  "explore",
  "detail",
  "enrolled",
  "home",
  "lesson",
  "manage",
  "journeys",
  "report",
  "plan",
];
const activities = [
  ["puzzle", "bulb", "작은 틈을 찾아 해결하기", "일상의 문제를 관찰해요"],
  [
    "draw",
    "palette",
    "그림이나 영상으로 표현하기",
    "아이디어를 눈에 보이게 만들어요",
  ],
  [
    "listen",
    "chat",
    "친구의 이야기를 듣고 돕기",
    "다른 사람의 마음이 궁금해요",
  ],
  ["science", "bulb", "규칙과 원리를 알아내기", "왜 그런지 차근차근 생각해요"],
  [
    "experiment",
    "flask",
    "직접 만들고 실험하기",
    "손으로 해보는 일이 즐거워요",
  ],
];
const keywords = [
  ["예술 · 디자인", ["디자인", "영상·콘텐츠", "미술", "공연"]],
  ["사람 · 사회", ["심리", "교육", "사회", "경영"]],
  ["기술 · 자연", ["컴퓨터", "데이터", "공학", "생명과학"]],
];
const navItems = [
  ["home", "home", "홈"],
  ["explore", "cap", "학과 탐색"],
  ["journeys", "layers", "내 체험"],
  ["plan", "book", "진로 계획"],
];
const titles = {
  welcome: "나의 전공, 미리 만나기",
  interest: "관심 찾기",
  activities: "나를 알아보기 · 1 / 2",
  keywords: "관심 분야 고르기",
  result: "나의 탐색 결과",
  detail: "학과 알아보기",
  enrolled: "체험 입학",
  manage: "나의 체험 관리",
  report: "체험 완료",
  journeys: "나의 체험",
  plan: "나의 진로·전공 계획",
};

function Button({ children, secondary, className = "", ...props }) {
  return (
    <button
      className={`${secondary ? "button secondary" : "button"} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
function Tag({ children }) {
  return <span className="tag">{children}</span>;
}
function Progress({ value, label }) {
  return (
    <div className="progress-block">
      <div className="progress-label">
        <span>{label || "전체 체험 진행도"}</span>
        <strong>{value}%</strong>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label={label || "전체 체험 진행도"}
      >
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
function Heading({ children, subtitle }) {
  return (
    <div className="heading">
      <h1>{children}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
function DepartmentCard({ department, onClick, featured }) {
  return (
    <button
      className={`department-card ${featured ? "mint" : ""}`}
      onClick={onClick}
    >
      <span className={`department-icon ${department.id}`}>
        <Icon name={department.icon} size={23} />
      </span>
      <span className="department-copy">
        <strong>{department.name}</strong>
        <small>{department.description}</small>
        <span className="card-tags">
          {department.tags.join(" · ")} · 3단계 체험
        </span>
      </span>
      <Icon name="next" size={16} />
    </button>
  );
}

export default function App() {
  const [state, setState] = useState(() => loadState(window.localStorage));
  const departments = [...baseDepartments, ...state.catalog];
  const [pendingTransfer, setPendingTransfer] = useState(null);
  const readRoute = () =>
    routes.includes(location.hash.slice(1))
      ? location.hash.slice(1)
      : "welcome";
  const [route, setRoute] = useState(readRoute);
  const [interestAnswer, setInterestAnswer] = useState("yes");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("전체");
  const [detailTab, setDetailTab] = useState("배우는 내용");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState("");
  const mainRef = useRef(null);
  const storageFailed = useRef(false);
  const draftTimer = useRef(0);
  const department =
    departments.find((d) => d.id === state.current) || departments[0];
  const journey = state.journeys[department.id];
  const completed = journey?.completed || 0;
  const lessonIndex = Math.min(completed, LESSON_COUNT - 1);
  const lessonKey = `${department.id}-${lessonIndex}`;
  const lessonGame = department.games?.[lessonIndex] || null;
  const played =
    lessonGame && state.plays[lessonKey]?.game === lessonGame
      ? state.plays[lessonKey].summary
      : "";
  const year = lessonYear(completed);
  const recommendations = recommend(state.interests, state.activities);
  const best = recommendations[0];
  const bottomNav = ["home", "explore", "journeys", "plan"].includes(route);
  const toggle = (field, value) =>
    setState((s) => ({
      ...s,
      [field]: s[field].includes(value)
        ? s[field].filter((v) => v !== value)
        : [...s[field], value],
    }));
  const go = (next) => {
    location.hash = next;
    setRoute(next);
    setModal(null);
  };
  const notify = (message) => setToast(message);
  const hasSavedProgress =
    state.onboarded ||
    Object.keys(state.journeys).length > 0 ||
    state.interests.length > 0 ||
    state.activities.length > 0;

  // 입력할 때마다 전체 상태를 저장하지 않도록 잠시 모았다가 저장한다.
  function editDraft(value) {
    const key = `${department.id}-${lessonIndex}`;
    setDraft(value);
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(
      () => setState((s) => ({ ...s, drafts: { ...s.drafts, [key]: value } })),
      400,
    );
  }
  function startFresh(next = "interest") {
    clearTimeout(draftTimer.current);
    setState(structuredClone(initialState));
    setDraft("");
    setQuery("");
    setFilter("전체");
    setDetailTab("배우는 내용");
    setInterestAnswer("yes");
    setPendingTransfer(null);
    go(next);
  }

  useEffect(() => {
    const handler = () => {
      setRoute(readRoute());
      setModal(null);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      if (!storageFailed.current) {
        setToast(
          "저장 공간을 사용할 수 없어 이번 방문 동안만 기록이 유지돼요.",
        );
        storageFailed.current = true;
      }
    }
  }, [state]);
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
    document.title = `${titles[route] || (route === "lesson" ? "전공 실습" : route === "explore" ? "학과 탐색" : "나의 캠퍼스")} · 미래캠퍼스`;
  }, [route]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    const key = `${department.id}-${lessonIndex}`;
    clearTimeout(draftTimer.current);
    setDraft(state.drafts[key] ?? state.notes[key] ?? "");
  }, [department.id, lessonIndex]);
  useEffect(() => {
    if (["enrolled", "lesson", "manage", "report"].includes(route) && !journey)
      go("detail");
    else if (route === "report" && completed < LESSON_COUNT) go("home");
    else if (
      route === "result" &&
      !state.interests.length &&
      !state.activities.length
    )
      go("interest");
    else if (
      route === "lesson" &&
      (journey?.paused || completed >= LESSON_COUNT)
    )
      go(completed >= LESSON_COUNT ? "report" : "journeys");
  }, [route, journey, completed]);

  function chooseCourse(course, school, curriculum, category, years) {
    const next = createDepartment(course, school, curriculum, category, years);
    setState((s) => ({
      ...s,
      current: next.id,
      catalog: [...s.catalog.filter((d) => d.id !== next.id), next],
    }));
    setDetailTab("배우는 내용");
    go("detail");
  }
  function enroll(id = department.id) {
    const existing = state.journeys[id];
    setState((s) => ({
      ...s,
      onboarded: true,
      current: id,
      journeys: {
        ...s.journeys,
        ...(pendingTransfer &&
        s.journeys[pendingTransfer] &&
        pendingTransfer !== id
          ? {
              [pendingTransfer]: {
                ...s.journeys[pendingTransfer],
                paused: true,
              },
            }
          : {}),
        [id]: existing
          ? { ...existing, paused: false }
          : { completed: 0, paused: false },
      },
    }));
    setPendingTransfer(null);
    go(
      existing
        ? existing.completed === LESSON_COUNT
          ? "report"
          : "home"
        : "enrolled",
    );
  }
  function finishLesson() {
    if (lessonIndex === LESSON_COUNT - 1 && !state.artworks[department.id]) {
      notify("졸업작품에 스프레이로 색을 입혀주세요.");
      return;
    }
    if (lessonGame && !played) {
      notify("먼저 위의 체험을 끝까지 해보세요.");
      return;
    }
    if (!draft.trim()) {
      notify("오늘 발견한 점을 한 줄 이상 적어주세요.");
      return;
    }
    clearTimeout(draftTimer.current);
    setState((s) => completeLesson(s, department.id, lessonIndex, draft));
    go(completed === LESSON_COUNT - 1 ? "report" : "home");
    notify(
      completed === LESSON_COUNT - 1
        ? "모든 체험을 마쳤어요. 축하해요!"
        : "실습 기록을 저장했어요. 한 걸음 더 나아갔네요!",
    );
  }
  function saveReport() {
    setState((s) => ({
      ...s,
      reports: s.reports.some((r) => r.id === department.id)
        ? s.reports
        : [...s.reports, { id: department.id, date: new Date().toISOString() }],
    }));
    go("plan");
    notify("체험 리포트를 저장했어요.");
  }
  function downloadReport(id) {
    const d = departments.find((item) => item.id === id);
    const text = `${d.name} 체험 리포트\n\n3 / 3 실습 완료\n\n${d.lessons.map((lesson, i) => `${i + 1}. ${lesson}\n${state.notes[`${id}-${i}`] || "기록 없음"}`).join("\n\n")}`;
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", text], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${d.name}-체험-리포트.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function back() {
    const parents = {
      welcome: "welcome",
      interest: "welcome",
      activities: "interest",
      keywords: "activities",
      result: "keywords",
      detail: "explore",
      enrolled: "detail",
      lesson: "home",
      manage: "journeys",
      report: "journeys",
    };
    go(parents[route] || "home");
  }

  return (
    <div className="app-surround">
      <div className="app-shell">
        <header className="app-header">
          {bottomNav ? (
            <button
              className="icon-button brand-icon"
              aria-label="미래캠퍼스 시작 화면"
              onClick={() => go("welcome")}
            >
              <Icon name="cap" />
            </button>
          ) : (
            <button
              className={`icon-button ${route === "welcome" ? "invisible" : ""}`}
              aria-label="뒤로 가기"
              onClick={back}
            >
              <Icon name="back" size={18} />
            </button>
          )}
          <span>
            {route === "lesson"
              ? lessonIndex === 2
                ? "4학년 · 졸업작품"
                : `${year}학년 · ${department.lessons[lessonIndex]}`
              : titles[route] || "미래캠퍼스"}
          </span>
          <button
            className="icon-button muted"
            aria-label={bottomNav ? "알림 보기" : "더 보기"}
            onClick={() => setModal(bottomNav ? "notifications" : "menu")}
          >
            {bottomNav ? (
              <Icon name="bell" />
            ) : (
              <span className="ellipsis">···</span>
            )}
          </button>
        </header>
        <main
          ref={mainRef}
          tabIndex={-1}
          className={`page page-${route} ${bottomNav ? "with-nav" : ""}`}
        >
          {route === "welcome" && (
            <div className="welcome-content">
              <h2 className="wordmark">미래캠퍼스</h2>
              <Mascot />
              <Heading
                subtitle={
                  <>
                    궁금한 학과, 막연한 미래 대신
                    <br />
                    나에게 맞는 전공의 하루를 만나봐요.
                  </>
                }
              >
                어떤 전공이 나다울까?
                <br />
                먼저 경험해 봐요.
              </Heading>
              <div className="feature-tags">
                <span>취향 탐색</span>
                <span>학과 실습</span>
                <span>나의 발견</span>
              </div>
              <div className="page-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <div className="bottom-action">
                <Button onClick={() => startFresh()}>
                  {hasSavedProgress ? "처음부터 시작하기" : "내 전공 찾으러 가기"}
                </Button>
                <p className="footnote">
                  {hasSavedProgress
                    ? "처음부터 시작하면 이 브라우저의 이전 기록이 초기화돼요."
                    : "정답은 없어요. 나만의 속도로 시작해요."}
                </p>
                {hasSavedProgress && (
                  <button
                    className="text-button"
                    onClick={() =>
                      go(
                        Object.keys(state.journeys).length
                          ? "home"
                          : state.onboarded ? "explore" : "interest",
                      )
                    }
                  >
                    이전 기록 이어서 하기 <Icon name="next" size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          {route === "interest" && (
            <>
              <div className="centered interest-intro">
                <Mascot small />
                <Heading subtitle="지금의 관심에서 출발해도, 함께 찾아도 좋아요.">
                  마음이 가는 분야가
                  <br />
                  있나요?
                </Heading>
              </div>
              <div className="option-list">
                {[
                  [
                    "yes",
                    "heart",
                    "있어요",
                    "관심 분야를 고르고 학과를 찾아볼래요",
                  ],
                  [
                    "no",
                    "sparkle",
                    "아직 모르겠어요",
                    "좋아하는 활동부터 천천히 알아볼래요",
                  ],
                ].map(([id, icon, title, description]) => (
                  <button
                    key={id}
                    className={`choice ${interestAnswer === id ? "selected" : ""}`}
                    aria-pressed={interestAnswer === id}
                    onClick={() => setInterestAnswer(id)}
                  >
                    <Icon name={icon} />
                    <span>
                      <strong>{title}</strong>
                      <small>{description}</small>
                    </span>
                    {interestAnswer === id && (
                      <span className="check-circle">
                        <Icon name="check" size={12} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <p className="footnote">선택한 답에 맞춰 다음 탐색을 안내해요.</p>
              <div className="bottom-action">
                <Button
                  onClick={() =>
                    go(interestAnswer === "yes" ? "keywords" : "activities")
                  }
                >
                  다음으로 <Icon name="next" size={17} />
                </Button>
              </div>
            </>
          )}

          {route === "activities" && (
            <>
              <div className="step-progress">
                <span />
              </div>
              <Heading subtitle="좋아하거나 자신 있는 활동을 선택해요.">
                어떤 순간에
                <br />
                시간 가는 줄 모르나요?
              </Heading>
              <div className="option-list">
                {activities.map(([id, icon, title, description]) => (
                  <button
                    key={id}
                    className={`choice ${state.activities.includes(id) ? "selected" : ""}`}
                    aria-pressed={state.activities.includes(id)}
                    onClick={() => toggle("activities", id)}
                  >
                    <Icon name={icon} />
                    <span>
                      <strong>{title}</strong>
                      <small>{description}</small>
                    </span>
                    {state.activities.includes(id) && (
                      <span className="check-circle">
                        <Icon name="check" size={12} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <span className="selection-count">
                {state.activities.length}개 선택했어요 · 여러 개 선택 가능
              </span>
              <div className="bottom-action">
                <Button
                  disabled={!state.activities.length}
                  onClick={() => go("keywords")}
                >
                  이 활동으로 추천받기
                </Button>
                <p className="footnote">
                  잘하는 일도, 좋아하는 일도 모두 괜찮아요.
                </p>
              </div>
            </>
          )}

          {route === "keywords" && (
            <>
              <Heading subtitle="궁금한 분야를 여러 개 선택할 수 있어요.">
                조금이라도 끌리는
                <br />
                키워드를 골라봐요.
              </Heading>
              <div className="keyword-groups">
                {keywords.map(([group, items]) => (
                  <section key={group}>
                    <h2>{group}</h2>
                    <div className="chips">
                      {items.map((item) => (
                        <button
                          key={item}
                          className={`chip ${state.interests.includes(item) ? "active" : ""}`}
                          aria-pressed={state.interests.includes(item)}
                          onClick={() => toggle("interests", item)}
                        >
                          {item}
                          {state.interests.includes(item) && (
                            <Icon name="check" size={12} />
                          )}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
              <div className="callout cream">
                <strong>
                  {state.interests.length
                    ? `${state.interests.slice(0, 3).join(", ")}${state.interests.length > 3 ? " 외" : ""}, 함께 궁금하군요!`
                    : "작은 호기심 하나면 충분해요."}
                </strong>
                <p>지금의 관심이 나다운 경험을 만드는 첫걸음이 될 수 있어요.</p>
              </div>
              <div className="bottom-action">
                <Button
                  disabled={!state.interests.length && !state.activities.length}
                  onClick={() => {
                    setState((s) => ({ ...s, onboarded: true }));
                    go("result");
                  }}
                >
                  선택한 분야의 학과 보기
                </Button>
                <p className="footnote">관심은 언제든 바뀌어도 괜찮아요.</p>
              </div>
            </>
          )}

          {route === "result" && (
            <>
              <div className="centered result-intro">
                <Mascot small />
                <Heading>
                  {best.headline}
                  <br />
                  일에 마음이 가네요!
                </Heading>
              </div>
              <div className="callout mint result-card">
                <span className="eyebrow">먼저 만나볼 분야</span>
                <h2>{best.group}</h2>
                <p>
                  선택한 관심과 활동을 바탕으로 골랐어요. {best.description}
                </p>
                <div className="chips">
                  {best.tags.map((tag) => (
                    <Tag key={tag}>
                      {tag} <Icon name="check" size={12} />
                    </Tag>
                  ))}
                </div>
              </div>
              <div className="compact-cards">
                {state.interests.slice(0, 3).map((keyword) => (
                  <button
                    className="choice"
                    key={keyword}
                    onClick={() => {
                      setFilter(keyword);
                      setQuery("");
                      go("explore");
                    }}
                  >
                    <Icon name="search" />
                    <span>
                      <strong>‘{keyword}’ 관련 학과</strong>
                      <small>이름에 이 키워드가 들어간 학과를 찾아봐요</small>
                    </span>
                    <Icon name="next" size={16} />
                  </button>
                ))}
              </div>
              <div className="bottom-action">
                <Button
                  onClick={() => {
                    setFilter(best.id);
                    setQuery("");
                    go("explore");
                  }}
                >
                  {best.group} 학과 둘러보기
                </Button>
                <p className="footnote">
                  추천은 하나의 출발점이에요. 다른 학과도 자유롭게 살펴봐요.
                </p>
              </div>
            </>
          )}

          {route === "explore" && (
            <>
              <Heading>
                궁금했던 학과,
                <br />
                가볍게 만나봐요.
              </Heading>
              <label className="search-field">
                <Icon name="search" size={19} />
                <input
                  aria-label="학과 검색"
                  placeholder="궁금한 학과 이름 검색"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button aria-label="검색 지우기" onClick={() => setQuery("")}>
                    <Icon name="close" size={15} />
                  </button>
                )}
              </label>
              <div className="chips filters">
                {[
                  ...new Set([
                    "전체",
                    "인문사회",
                    "공학",
                    "자연과학",
                    "예체능",
                    "의학",
                    filter,
                  ]),
                ].map((item) => (
                  <button
                    className={`chip ${filter === item ? "active" : ""}`}
                    aria-pressed={filter === item}
                    key={item}
                    onClick={() => setFilter(item)}
                  >
                    {item}
                    {filter === item && <Icon name="check" size={11} />}
                  </button>
                ))}
              </div>
              <h2 className="section-title">관심 키워드와 연결된 학과</h2>
              <Catalog filter={filter} query={query} onChoose={chooseCourse} />
              <button
                className="text-button explore-again"
                onClick={() => go("keywords")}
              >
                관심 키워드 다시 고르기 <Icon name="next" size={14} />
              </button>
            </>
          )}

          {route === "detail" && (
            <>
              {department.school && (
                <div className="school-banner">
                  <Icon name="cap" size={25} />
                  <div>
                    <strong>{department.school}</strong>
                    <small>학교별 교육과정을 만나보세요</small>
                  </div>
                </div>
              )}
              <div className="callout mint department-hero">
                {department.id === "design" || department.name === "산업디자인학과" ? (
                  <img className="major-palette" src="/assets/major-palette.svg" alt="" />
                ) : null}
                <div className="hero-title">
                  <Icon name={department.icon} size={32} />
                  <div>
                    <span className="eyebrow">{department.group}</span>
                    <h1>{department.name}</h1>
                  </div>
                </div>
                <p>{department.description}</p>
                <small>대학 전공 이해 · 학습과 실습 중심</small>
              </div>
              <div className="tabs" role="tablist" aria-label="학과 정보">
                {["배우는 내용", "교육과정", "직접 실습"].map((tab) => (
                  <button
                    key={tab}
                    role="tab"
                    aria-selected={detailTab === tab}
                    onClick={() => setDetailTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <section className="tab-panel" role="tabpanel">
                {detailTab === "배우는 내용" && (
                  <>
                    <h2 className="section-title">이런 내용을 배워요</h2>
                    <p className="body-copy">
                      {department.tags.join(", ")}부터 차근차근 경험해요.
                    </p>
                    <div className="curriculum">
                      {department.years.map((item, i) => (
                        <div key={item}>
                          <span>{i + 1}단계</span>
                          <strong>{item}</strong>
                          <small>{department.lessons[i]}</small>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {detailTab === "교육과정" && (
                  <>
                    {department.yearly && (
                      <div className="year-terms">
                        <h2 className="section-title">학년별 수업</h2>
                        {department.yearly.terms.map((term) => (
                          <div key={`${term.year}-${term.semester}`}>
                            <h3>
                              {term.year}학년
                              {term.semester ? ` ${term.semester}학기` : ""}
                            </h3>
                            <p>{term.subjects.join(" · ")}</p>
                          </div>
                        ))}
                        <p className="footnote">
                          {department.yearly.source_url ? (
                            <a
                              href={department.yearly.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              학교 홈페이지
                            </a>
                          ) : (
                            "학교 자료"
                          )}{" "}
                          기준 · {department.yearly.checked_at} 확인. 실제
                          편성은 학교 사정에 따라 달라질 수 있어요.
                        </p>
                      </div>
                    )}
                    {department.curriculum?.length > 0 && (
                      <details className="actual-curriculum">
                        <summary>
                          학교 교과목 {department.curriculum.length}개 보기
                        </summary>
                        <ul>
                          {department.curriculum.map((subject, i) => (
                            <li key={`${subject}-${i}`}>{subject}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                    <h2 className="section-title">
                      작은 경험을 차곡차곡 쌓아요
                    </h2>
                    <div className="lesson-list">
                      {department.lessons.map((lesson, i) => (
                        <div key={lesson}>
                          <span className="number">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span>{lesson}</span>
                          {completed > i && <Icon name="check" size={16} />}
                        </div>
                      ))}
                    </div>
                    <p className="footnote">
                      진로 탐색을 위한 3개의 간단한 체험이에요.
                    </p>
                  </>
                )}
                {detailTab === "직접 실습" && (
                  <>
                    <h2 className="section-title">
                      배우고, 나만의 기록을 남겨요
                    </h2>
                    <p className="body-copy">
                      주변을 관찰하고 작은 과제를 해본 뒤, 발견한 점을 한 줄씩
                      기록해요. 세 번의 체험이 끝나면 나의 전공 체험 리포트가
                      완성돼요.
                    </p>
                    {department.jobs && (
                      <div className="callout cream">
                        <strong>이 전공과 연결되는 일</strong>
                        <p>{department.jobs.join(" · ")}</p>
                      </div>
                    )}
                  </>
                )}
              </section>
              <div className="callout cream">
                <strong>직접 해보기 · {department.lessons[1]}</strong>
                <p>궁금한 전공을 가벼운 과제 하나로 경험해봐요.</p>
              </div>
              <div className="bottom-action">
                <Button onClick={() => enroll()}>
                  {department.name}{" "}
                  {journey
                    ? completed === LESSON_COUNT
                      ? "리포트 보기"
                      : journey.paused
                        ? "복학하기"
                        : "체험 이어가기"
                    : "체험 입학"}
                </Button>
                <p className="footnote">
                  실제 대학 등록이 아닌, 전공을 미리 만나는 탐색 체험이에요.
                </p>
              </div>
            </>
          )}

          {route === "enrolled" && (
            <div className="enrollment centered">
              <Tag>
                체험 입학 완료 <Icon name="check" size={12} />
              </Tag>
              <Mascot variant="student" />
              <Heading subtitle="나에게 맞는 배움인지, 직접 경험하며 알아봐요.">
                반가워요,
                <br />
                {department.name} 새내기!
              </Heading>
              <div className="callout cream">
                <strong>1학년 · {department.years[0]}</strong>
                <p>
                  첫 수업에서는 작은 관찰로 출발하고
                  <br />
                  나만의 발견을 기록해 볼 거예요.
                </p>
              </div>
              <div className="bottom-action">
                <Button onClick={() => go("lesson")}>첫 체험 시작하기</Button>
                <button className="text-button" onClick={() => setModal({ type: "document", document: "admission" })}>
                  체험 입학증 보기
                </button>
                <p className="footnote">
                  학년은 체험 단계예요. 내 속도에 맞춰 탐색해요.
                </p>
              </div>
            </div>
          )}

          {route === "home" && (
            <>
              <Heading subtitle="오늘은 나를 위한 작은 발견을 떠나봐요.">
                한 걸음씩,
                <br />
                나의 전공을 알아가는 중
              </Heading>
              {journey ? (
                <>
                  <div className="callout mint current-card">
                    {department.school && (
                      <span className="eyebrow">{department.school}</span>
                    )}
                    <div className="current-card-top">
                      <div>
                        <h2>{department.name}</h2>
                        <p>
                          {year}학년 · {department.years[lessonIndex]}
                          <br />
                          학습·실습 {completed} / 3 완료
                        </p>
                      </div>
                      <Mascot variant="study" small />
                    </div>
                    <Progress
                      value={Math.round((completed / LESSON_COUNT) * 100)}
                    />
                    <Button
                      onClick={() =>
                        go(
                          completed === LESSON_COUNT
                            ? "report"
                            : journey.paused
                              ? "journeys"
                              : "lesson",
                        )
                      }
                    >
                      {completed === LESSON_COUNT
                        ? "완성된 체험 리포트 보기"
                        : journey.paused
                          ? "쉬고 있는 체험 확인하기"
                          : `${department.lessons[lessonIndex]} ${completed ? "이어하기" : "시작하기"}`}
                    </Button>
                  </div>
                  <h2 className="section-title">
                    {completed === LESSON_COUNT
                      ? "다음 관심을 만나볼까요?"
                      : "오늘의 다음 실습"}
                  </h2>
                  <button
                    className="choice"
                    onClick={() =>
                      completed === LESSON_COUNT
                        ? go("explore")
                        : setModal("curriculum")
                    }
                  >
                    <Icon name={completed === LESSON_COUNT ? "cap" : "chat"} />
                    <span>
                      <strong>
                        {completed === LESSON_COUNT
                          ? "새로운 학과 둘러보기"
                          : department.lessons[
                              Math.min(LESSON_COUNT - 1, lessonIndex + 1)
                            ]}
                      </strong>
                      <small>
                        {completed === LESSON_COUNT
                          ? "다른 전공에도 나다운 가능성이 있어요"
                          : `${lessonYear(lessonIndex + 1)}학년 실습 · 작은 경험을 이어가요`}
                      </small>
                    </span>
                    <Icon name="next" size={15} />
                  </button>
                </>
              ) : (
                <div className="empty-state">
                  <Mascot small />
                  <h2>첫 전공을 만나볼까요?</h2>
                  <p>관심 있는 학과를 고르면 체험이 시작돼요.</p>
                  <Button onClick={() => go("explore")}>학과 둘러보기</Button>
                </div>
              )}
              <div className="callout cream home-hint">
                <strong>작은 발견도 소중한 진로의 힌트예요.</strong>
                <p>지금의 경험은 다음 선택을 더 나답게 만들어줘요.</p>
              </div>
              {journey && (
                <button className="text-button" onClick={() => go("manage")}>
                  체험 관리 → 쉬어가기 · 전공 변경 · 학과 추가
                </button>
              )}
            </>
          )}

          {route === "lesson" && (
            <>
              <div className="learning-steps" aria-label="3단계 학습 과정">
                {department.years.map((label, i) => (
                  <span
                    key={label}
                    className={
                      i === lessonIndex
                        ? "active"
                        : i < lessonIndex
                          ? "done"
                          : ""
                    }
                    aria-current={i === lessonIndex ? "step" : undefined}
                  >
                    {i < lessonIndex ? <Icon name="check" size={12} /> : i + 1}{" "}
                    {label}
                  </span>
                ))}
              </div>
              {lessonIndex === LESSON_COUNT - 1 ? (
                <GraduationStudio
                  key={department.id}
                  value={state.artworks[department.id] || ""}
                  onChange={(image) =>
                    setState((s) => ({
                      ...s,
                      artworks: { ...s.artworks, [department.id]: image },
                    }))
                  }
                />
              ) : (
                <>
                  <Heading
                    subtitle={`${lessonYear(lessonIndex)}학년 · ${department.years[lessonIndex]} · 나의 생각을 경험으로 연결해요.`}
                  >
                    {department.lessons[lessonIndex]}
                    <br />
                    직접 경험해 볼까요?
                  </Heading>
                  {lessonGame ? (
                    <LessonGame
                      key={lessonKey}
                      game={lessonGame}
                      played={played}
                      onComplete={(summary) =>
                        setState((s) => ({
                          ...s,
                          plays: {
                            ...s.plays,
                            [lessonKey]: { game: lessonGame, summary },
                          },
                        }))
                      }
                    />
                  ) : (
                  <>
                  <div className="callout mint">
                    <strong>
                      {lessonIndex === 0
                        ? "첫 번째 경험 · 관찰하고 이해하기"
                        : "두 번째 경험 · 아이디어 적용하기"}
                    </strong>
                    <p>
                      {lessonIndex === 0
                        ? `‘${department.lessons[lessonIndex]}’에서 다루는 주제와 관련된 일상 속 장면을 하나 찾아보세요. 무엇을 관찰했고 어떤 점이 궁금했나요?`
                        : "첫 단계에서 발견한 질문을 작은 해결 방법으로 바꿔보세요. 대상과 목적을 정하고, 직접 해본 과정과 결과를 기록해요."}
                    </p>
                  </div>
                  <h2 className="section-title">오늘의 직접 적용 과제</h2>
                  <ol className="task-list">
                    <li>주변에서 주제와 연결되는 장면을 찾아요.</li>
                    <li>나의 아이디어를 간단한 스케치나 실험으로 표현해요.</li>
                    <li>새롭게 발견한 점과 다음에 바꿔볼 점을 기록해요.</li>
                  </ol>
                  </>
                  )}
                </>
              )}
              <label className="note-card">
                <span>
                  <strong>
                    {lessonIndex === 2
                      ? "졸업작품에 담은 생각"
                      : "나의 관찰 노트"}
                  </strong>
                  <Icon name="pen" size={16} />
                </span>
                <textarea
                  aria-label="나의 관찰 노트"
                  placeholder={
                    lessonIndex === 2
                      ? "어떤 생각을 색으로 표현했나요? 작품의 의미를 적어주세요."
                      : lessonGame
                        ? "직접 해보니 어땠나요? 느낀 점과 궁금해진 점을 적어주세요."
                        : "어떤 장면을 발견했나요? 나의 생각을 자유롭게 적어주세요."
                  }
                  value={draft}
                  maxLength={3000}
                  onChange={(e) => editDraft(e.target.value)}
                />
                <small>
                  {draft.length} / 3,000자 · 완료 버튼을 누르면 기록이 저장돼요.
                </small>
              </label>
              <div className="bottom-action">
                <Button
                  disabled={
                    !draft.trim() ||
                    (lessonGame && !played) ||
                    (lessonIndex === 2 && !state.artworks[department.id])
                  }
                  onClick={finishLesson}
                >
                  {lessonIndex === 2
                    ? "졸업작품 제출하고 체험 마치기"
                    : "실습 기록 저장하고 완료하기"}
                </Button>
                <p className="footnote">
                  {lessonIndex === 2
                    ? "작품에 색을 칠하고 생각을 남기면 졸업할 수 있어요."
                    : `기록하면 ${completed + 1} / 3 완료 · 다음 경험으로 이어져요.`}
                </p>
              </div>
            </>
          )}

          {route === "manage" && (
            <>
              <Heading>
                내 속도와 관심에 맞춰
                <br />
                체험을 이어가요.
              </Heading>
              <Tag>
                {department.name} · {year}학년 ·{" "}
                {Math.round((completed / LESSON_COUNT) * 100)}%{" "}
                <Icon name="check" size={12} />
              </Tag>
              <div className="management-list">
                <button
                  className="management-card cream"
                  onClick={() => {
                    setState((s) => ({
                      ...s,
                      journeys: {
                        ...s.journeys,
                        [department.id]: {
                          ...s.journeys[department.id],
                          paused: !journey.paused,
                        },
                      },
                    }));
                    go("journeys");
                    notify(
                      journey.paused
                        ? "체험을 다시 시작해요."
                        : "진행 상황을 보관했어요. 언제든 돌아오세요.",
                    );
                  }}
                >
                  <div>
                    <Icon name="pause" />
                    <h2>{journey?.paused ? "복학" : "휴학"}</h2>
                    <small>
                      {journey?.paused
                        ? "쉬었던 체험 다시 이어가기"
                        : "잠시 쉬고, 다른 학과도 둘러보기"}
                    </small>
                  </div>
                  <p>
                    지금까지의 기록과 진행 상황은 보관돼요. 언제든 같은 지점부터
                    이어가요.
                  </p>
                  <span>
                    {journey?.paused
                      ? "체험 다시 시작하기"
                      : "진행 상황 보관하기"}{" "}
                    →
                  </span>
                </button>
                <button
                  className="management-card"
                  onClick={() => setModal("transfer")}
                >
                  <div>
                    <Icon name="swap" />
                    <h2>전과</h2>
                    <small>다른 전공을 먼저 경험해 보기</small>
                  </div>
                  <p>
                    새 학과로 관심의 방향을 옮겨볼까요? 기존 학과의 기록은
                    그대로 남아 있어요.
                  </p>
                  <span>관심 학과 찾아보기 →</span>
                </button>
                <button
                  className="management-card mint"
                  onClick={() => setModal("add")}
                >
                  <div>
                    <Icon name="layers" />
                    <h2>복전</h2>
                    <small>기존 학과를 유지하고 하나 더</small>
                  </div>
                  <p>
                    두 학과를 함께 경험하며 서로 다른 배움이 만나는 지점을
                    발견해요.
                  </p>
                  <span>병행할 학과 추가하기 →</span>
                </button>
              </div>
              <div className="bottom-action">
                <Button
                  onClick={() =>
                    journey?.paused
                      ? enroll()
                      : go(completed === LESSON_COUNT ? "report" : "lesson")
                  }
                >
                  현재 학과 계속 체험하기
                </Button>
                <p className="footnote">
                  실제 학적 변경 없이 자유롭게 탐색하는 체험 기능이에요.
                </p>
              </div>
            </>
          )}

          {route === "journeys" && (
            <>
              <Heading subtitle="기존 전공도 그대로, 관심마다 나의 속도로.">
                하나의 관심에
                <br />
                가능성을 더했어요.
              </Heading>
              <div className="chips">
                <Tag>
                  병행 체험 {Object.keys(state.journeys).length}개{" "}
                  <Icon name="check" size={12} />
                </Tag>
                <span className="chip">
                  진행{" "}
                  {
                    Object.values(state.journeys).filter(
                      (j) => !j.paused && j.completed < LESSON_COUNT,
                    ).length
                  }{" "}
                  · 보관{" "}
                  {Object.values(state.journeys).filter((j) => j.paused).length}
                </span>
              </div>
              <div className="journey-list">
                {Object.entries(state.journeys).map(([id, item]) => {
                  const d = departments.find((d) => d.id === id);
                  return (
                    <div
                      key={id}
                      className={`callout ${item.paused ? "cream" : "mint"}`}
                    >
                      <span className="eyebrow">
                        {item.completed === LESSON_COUNT
                          ? "모든 체험 완료"
                          : item.paused
                            ? "휴학 중 · 기록을 보관하고 있어요"
                            : id === state.current
                              ? "기존 학과 · 진행 중"
                              : "함께 탐색하는 학과 · 진행 중"}
                      </span>
                      <h2>{d.name}</h2>
                      <p>
                        {lessonYear(item.completed)}학년 ·{" "}
                        {d.lessons[Math.min(item.completed, LESSON_COUNT - 1)]}{" "}
                        · {item.completed} / 3 완료
                      </p>
                      <Progress
                        value={Math.round(
                          (item.completed / LESSON_COUNT) * 100,
                        )}
                        label="체험 진행도"
                      />
                      {item.paused && (
                        <p>
                          기록은 그대로 보관돼요. 복학하면 같은 지점에서 실습을
                          이어가요.
                        </p>
                      )}
                      <Button
                        secondary={item.paused}
                        onClick={() => {
                          setState((s) => ({
                            ...s,
                            current: id,
                            journeys: {
                              ...s.journeys,
                              [id]: { ...item, paused: false },
                            },
                          }));
                          go(
                            item.completed === LESSON_COUNT
                              ? "report"
                              : "lesson",
                          );
                        }}
                      >
                        {item.completed === LESSON_COUNT
                          ? "체험 리포트 보기"
                          : item.paused
                            ? `${d.name} 복학하고 이어하기`
                            : `${d.lessons[item.completed]} 이어하기`}
                      </Button>
                      <button
                        className="text-button card-management"
                        onClick={() => {
                          setState((s) => ({ ...s, current: id }));
                          go("manage");
                        }}
                      >
                        이 학과 체험 관리 <Icon name="next" size={12} />
                      </button>
                    </div>
                  );
                })}
                {!Object.keys(state.journeys).length && (
                  <div className="empty-state">
                    <Mascot small />
                    <h2>아직 시작한 체험이 없어요</h2>
                    <p>마음이 가는 학과부터 가볍게 만나봐요.</p>
                    <Button onClick={() => go("explore")}>
                      첫 학과 찾아보기
                    </Button>
                  </div>
                )}
              </div>
              {Object.keys(state.journeys).length > 0 && (
                <button className="text-button" onClick={() => setModal("add")}>
                  또 다른 관심 만나보기 <Icon name="next" size={13} />
                </button>
              )}
            </>
          )}

          {route === "report" && (
            <>
              <div className="centered report-intro">
                <Mascot variant="graduate" />
                <Heading>
                  {department.name}
                  <br />
                  체험 졸업을 축하해요!
                </Heading>
              </div>
              {department.school && (
                <p className="graduation-school">{department.school}</p>
              )}
              <div className="stats mint">
                <div>
                  <strong>4학년</strong>
                  <span>체험 단계</span>
                </div>
                <div>
                  <strong>3 / 3</strong>
                  <span>학습·실습</span>
                </div>
                <div>
                  <strong>100%</strong>
                  <span>체험 완료</span>
                </div>
              </div>
              <div className="report-card">
                <h2>나의 {department.name.replace("학과", "")} 체험 리포트</h2>
                <span className="eyebrow">배운 내용</span>
                <p>{department.years.join(" → ")}</p>
                <span className="eyebrow">체험 기록</span>
                <p>
                  3개의 실습을 마치며 나의 생각을 기록했어요. 그중 마지막 발견을
                  다시 만나봐요.
                </p>
                {state.artworks[department.id] && (
                  <>
                    <ArtworkPreview src={state.artworks[department.id]} />
                    <button
                      className="text-button"
                      onClick={() => setModal("artwork")}
                    >
                      졸업작품 열기 →
                    </button>
                  </>
                )}
                <blockquote>
                  {state.notes[`${department.id}-2`] ||
                    "세 번의 경험이 나만의 전공 이야기가 되었어요."}
                </blockquote>
                {department.jobs && (
                  <>
                    <span className="eyebrow">다음 가능성</span>
                    <p>
                      {department.jobs.join(" · ")}처럼 배운 내용을 이어갈 수
                      있는 일들도 탐색해봐요.
                    </p>
                  </>
                )}
              </div>
              <div className="bottom-action">
                <Button onClick={saveReport}>
                  {state.reports.some((r) => r.id === department.id)
                    ? "저장된 리포트 확인하기"
                    : "체험 리포트 저장하기"}
                </Button>
                <Button secondary onClick={() => setModal({ type: "document", document: "transcript" })}>
                  성적표 확인하기
                </Button>
                <button className="text-button" onClick={() => setModal({ type: "document", document: "diploma" })}>
                  졸업증명서 보기
                </button>
                <p className="footnote">
                  저장한 리포트는 나의 진로·전공 계획에서 볼 수 있어요.
                </p>
              </div>
            </>
          )}

          {route === "plan" && (
            <>
              {state.reports.length > 0 && (
                <div className="success-banner">
                  <Icon name="check" size={15} /> {state.reports.length}개의
                  체험 리포트를 저장했어요.
                </div>
              )}
              <Heading subtitle="정답을 서두르지 않아도 괜찮아요.">
                경험을 모아,
                <br />
                나다운 다음 선택으로.
              </Heading>
              <div className="callout cream">
                <strong>체험으로 발견한 나</strong>
                <p>
                  {Object.keys(state.notes).length
                    ? "작은 장면을 관찰하고 나의 생각을 표현하는 과정에 함께했어요. 기록 속에서 나다운 관심을 찾아봐요."
                    : "나의 관심에서 출발해 직접 경험해 보세요. 한 줄의 기록이 다음 선택의 힌트가 돼요."}
                </p>
                <div className="chips">
                  {(state.interests.length
                    ? state.interests.slice(0, 3)
                    : ["가능성 탐색", "나의 발견"]
                  ).map((item) => (
                    <Tag key={item}>
                      {item} <Icon name="check" size={11} />
                    </Tag>
                  ))}
                </div>
              </div>
              <h2 className="section-title">
                저장한 경험 · {state.reports.length}
              </h2>
              <div className="saved-reports">
                {state.reports.map((r) => {
                  const d = departments.find((item) => item.id === r.id);
                  return (
                    <button
                      className="choice"
                      key={r.id}
                      onClick={() => setModal({ type: "saved", id: r.id })}
                    >
                      <Icon name="file" />
                      <span>
                        <strong>{d.name} 체험 리포트</strong>
                        <small>
                          4학년 · 3 / 3 완료 ·{" "}
                          {new Date(r.date).toLocaleDateString("ko-KR")}
                        </small>
                      </span>
                      <Icon name="next" size={15} />
                    </button>
                  );
                })}
                {!state.reports.length && (
                  <div className="empty-state compact">
                    <Icon name="book" size={26} />
                    <p>
                      체험을 마치고 리포트를 저장하면
                      <br />
                      나의 경험이 이곳에 모여요.
                    </p>
                    <button
                      className="text-button"
                      onClick={() => go("journeys")}
                    >
                      내 체험 보러 가기 →
                    </button>
                  </div>
                )}
              </div>
              <div className="report-card next-plan">
                <h2>나의 다음 계획</h2>
                <p>
                  관심 전공 ·{" "}
                  {state.interests.length
                    ? state.interests.join(", ")
                    : "관심 분야 찾아보기"}
                  <br />
                  다음 행동 · 새로운 학과와 경험 이어가기
                </p>
                <button className="text-button" onClick={() => go("keywords")}>
                  계속 수정하기 →
                </button>
              </div>
              <Button onClick={() => go("explore")}>
                새로운 관심 둘러보기
              </Button>
            </>
          )}
        </main>
        {bottomNav && (
          <nav className="bottom-nav" aria-label="주요 메뉴">
            {navItems.map(([id, icon, label]) => (
              <button
                key={id}
                className={route === id ? "active" : ""}
                aria-current={route === id ? "page" : undefined}
                onClick={() => go(id)}
              >
                <Icon name={icon} size={21} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        )}
        {toast && (
          <div className="toast" role="status">
            <Icon name="check" size={18} />
            {toast}
          </div>
        )}
        {modal && (
          <Modal
            onClose={() => setModal(null)}
            title={
              modal?.type === "document"
                ? documentTitles[modal.document]
                : modal === "menu"
                ? "미래캠퍼스"
                : modal === "notifications"
                  ? "나의 소식"
                  : modal === "curriculum"
                    ? "나의 체험 과정"
                    : modal === "transfer"
                      ? "새롭게 만날 전공"
                      : modal === "add"
                        ? "함께 탐색할 학과"
                        : modal === "reset"
                          ? "기록을 초기화할까요?"
                          : modal === "artwork"
                            ? "졸업작품 작업실"
                            : "저장한 체험 리포트"
            }
          >
            {modal?.type === "document" && (
              <CampusDocument
                type={modal.document}
                department={department}
                completed={completed}
                onNext={() => setModal({ type: "document", document: "diploma" })}
              />
            )}
            {modal === "artwork" && (
              <GraduationStudio
                key={department.id}
                value={state.artworks[department.id] || ""}
                onChange={(image) =>
                  setState((s) => ({
                    ...s,
                    artworks: { ...s.artworks, [department.id]: image },
                  }))
                }
              />
            )}
            {modal === "menu" && (
              <div className="modal-options">
                <button onClick={() => go("explore")}>
                  <Icon name="cap" />
                  학과 둘러보기
                  <Icon name="next" size={15} />
                </button>
                <button onClick={() => go("plan")}>
                  <Icon name="book" />내 기록 보기
                  <Icon name="next" size={15} />
                </button>
                <button onClick={() => setModal("reset")}>
                  <Icon name="swap" />
                  처음부터 다시 시작하기
                  <Icon name="next" size={15} />
                </button>
                <p className="footnote">
                  진행 기록은 현재 브라우저에 저장돼요.
                </p>
              </div>
            )}
            {modal === "reset" && (
              <>
                <p className="body-copy">
                  이 브라우저에 저장된 관심 분야, 실습 노트, 체험 리포트가 모두
                  삭제돼요. 필요한 리포트는 먼저 내려받아 주세요.
                </p>
                <Button secondary onClick={() => setModal(null)}>
                  기록 유지하기
                </Button>
                <Button
                  className="danger"
                  onClick={() => {
                    startFresh("welcome");
                    notify("새로운 탐색을 시작할 준비가 됐어요.");
                  }}
                >
                  모든 기록 초기화
                </Button>
              </>
            )}
            {modal === "notifications" && (
              <>
                <div className="callout mint">
                  <strong>
                    {Object.keys(state.journeys).length
                      ? "나만의 속도로 잘 나아가고 있어요."
                      : "미래캠퍼스에 오신 걸 환영해요."}
                  </strong>
                  <p>
                    {Object.keys(state.journeys).length}개 학과 탐색 ·{" "}
                    {Object.keys(state.notes).length}개 실습 기록 ·{" "}
                    {state.reports.length}개 리포트 저장
                  </p>
                </div>
                <p className="body-copy">
                  작은 호기심을 다음 경험으로 이어가 보세요.
                </p>
              </>
            )}
            {modal === "curriculum" && (
              <div className="lesson-list">
                {department.lessons.map((lesson, i) => (
                  <div key={lesson}>
                    <span className="number">{i + 1}</span>
                    <span>{lesson}</span>
                    <small>
                      {i < completed
                        ? "완료"
                        : i === completed
                          ? "진행 중"
                          : "예정"}
                    </small>
                  </div>
                ))}
              </div>
            )}
            {(modal === "add" || modal === "transfer") && (
              <>
                <p className="body-copy">
                  {modal === "transfer"
                    ? "새 대학·학과에 입학하면 기존 체험은 보관돼요."
                    : "대학과 학과를 골라 현재 체험과 함께 탐색해요."}
                </p>
                <Button
                  onClick={() => {
                    setPendingTransfer(
                      modal === "transfer" ? department.id : null,
                    );
                    setQuery("");
                    setFilter("전체");
                    go("explore");
                  }}
                >
                  대학·학과 찾아보기
                </Button>
              </>
            )}
            {modal?.type === "saved" && (
              <>
                {state.artworks[modal.id] && (
                  <ArtworkPreview src={state.artworks[modal.id]} />
                )}
                <div className="saved-note-list">
                  {departments
                    .find((d) => d.id === modal.id)
                    .lessons.map((lesson, i) => (
                      <section key={lesson}>
                        <span className="eyebrow">실습 {i + 1}</span>
                        <h3>{lesson}</h3>
                        <p>{state.notes[`${modal.id}-${i}`] || "기록 없음"}</p>
                      </section>
                    ))}
                </div>
                <Button onClick={() => downloadReport(modal.id)}>
                  <Icon name="download" size={18} />
                  리포트 내려받기
                </Button>
              </>
            )}
          </Modal>
        )}
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const rect = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-header">
        <h2 id="modal-title">{title}</h2>
        <button
          autoFocus
          className="icon-button"
          aria-label="닫기"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
