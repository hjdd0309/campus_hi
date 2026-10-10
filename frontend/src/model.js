import { games, pickLessons } from "./games.js";

export const STORAGE_KEY = "hi-campus-v3";
// 예전 저장 데이터: [저장 키, 그때의 체험 단계 수]
const LEGACY_KEYS = [
  ["mirae-campus-v2", 3],
  ["mirae-campus-v1", 8],
];
// 마지막 학년의 졸업 과제. 도색 작업실은 조형·디자인 학과에만 맞으므로, 나머지 학과는 계열에 맞는 과제의 계획서를 쓴다.
export const PLAN_FIELDS = ["topic", "reason", "method"];
export const finals = {
  artwork: { kind: "artwork", name: "졸업작품" },
  capstone: {
    kind: "plan",
    name: "캡스톤 디자인",
    intro:
      "공학 계열은 마지막 학년에 팀을 이뤄 실제 문제를 해결하는 결과물을 만드는 캡스톤 디자인을 하는 경우가 많아요. 나만의 계획서를 써봐요.",
    prompts: [
      { label: "해결하고 싶은 문제", placeholder: "주변에서 불편하다고 느낀 문제를 하나 골라 적어주세요." },
      { label: "누구에게, 왜 필요한가요?", placeholder: "이 문제가 해결되면 누가 어떤 점에서 좋아질까요?" },
      { label: "어떻게 만들어 볼 건가요?", placeholder: "무엇을 만들지, 앞 학년에서 체험한 내용을 어떻게 쓸지 적어주세요." },
    ],
  },
  thesis: {
    kind: "plan",
    name: "졸업 연구",
    intro:
      "많은 학과가 마지막 학년에 스스로 정한 질문을 탐구하는 졸업 논문이나 졸업 연구로 배움을 마무리해요. 나만의 연구 계획서를 써봐요.",
    prompts: [
      { label: "탐구하고 싶은 질문", placeholder: "이 전공을 체험하며 가장 궁금해진 점을 질문으로 적어주세요." },
      { label: "왜 궁금한가요?", placeholder: "이 질문이 나에게, 또는 다른 사람에게 왜 중요한가요?" },
      { label: "어떻게 알아볼 건가요?", placeholder: "자료 조사, 관찰, 실험, 인터뷰 중 어떤 방법으로 답을 찾을지 적어주세요." },
    ],
  },
  showcase: {
    kind: "plan",
    name: "졸업 발표",
    intro:
      "예술·체육 계열은 졸업 공연, 연주회, 발표회처럼 사람들 앞에서 배움을 보여주며 마무리하는 경우가 많아요. 나만의 발표 계획서를 써봐요.",
    prompts: [
      { label: "무대에 올리고 싶은 것", placeholder: "어떤 공연, 연주, 경기, 작품을 보여주고 싶은지 적어주세요." },
      { label: "무엇을 전하고 싶나요?", placeholder: "보는 사람이 무엇을 느끼거나 알게 되면 좋을까요?" },
      { label: "어떻게 준비할 건가요?", placeholder: "무엇을 연습하고 누구와 함께 준비할지 적어주세요." },
    ],
  },
};
const ARTWORK_COURSE = /디자인|미술|조형|공예|회화|조소|도예/;
export function finalFor(course, category) {
  if (ARTWORK_COURSE.test(course)) return "artwork";
  if (category === "공학") return "capstone";
  if (category === "예체능") return "showcase";
  return "thesis";
}
export const planReady = (plan) =>
  !!plan && PLAN_FIELDS.every((field) => typeof plan[field] === "string" && plan[field].trim());
// 마지막 학년을 완료할 준비가 됐는지: 졸업작품은 칠한 작품이, 계획서는 세 칸이 모두 있어야 한다.
export function finalReady(state, department) {
  return (finals[department.final] || finals.artwork).kind === "artwork"
    ? !!state.artworks?.[department.id]
    : planReady(state.capstones?.[department.id]);
}
// 수업연한("4년", "2.5년", "1년(전공심화)")을 체험할 학년 목록으로 바꾼다. 학년마다 체험이 하나씩 있다.
export function stageYears(duration) {
  const length = Math.ceil(parseFloat(duration));
  if (!Number.isFinite(length)) return [1, 2, 3, 4];
  const count = Math.min(6, Math.max(1, length));
  // 전공심화 과정은 전문학사 뒤에 이어지는 과정이라 4학년에서 끝난다.
  const first = String(duration).includes("전공심화") ? Math.max(1, 5 - count) : 1;
  return Array.from({ length: count }, (_, i) => first + i);
}
export const departments = [
  {
    id: "design",
    name: "산업디자인학과",
    category: "디자인",
    group: "예술 · 디자인",
    icon: "palette",
    keywords: ["디자인", "영상·콘텐츠", "미술"],
    description:
      "사람의 일상을 관찰하고, 생각을 시각적인 해결책으로 바꾸는 과정을 체험해요.",
    tags: ["사용자 관찰", "화면 설계"],
    yearNumbers: [1, 2, 3, 4],
    final: "artwork",
    lessons: [
      "일상 속 디자인 찾기",
      "사용자를 위한 제품 설계",
      "서비스와 브랜드 디자인",
      finals.artwork.name,
    ],
    jobs: ["UX/UI 디자이너", "브랜드 디자이너", "콘텐츠 디자이너"],
  },
  {
    id: "psychology",
    name: "심리학과",
    category: "심리",
    group: "사람 · 사회",
    icon: "brain",
    keywords: ["심리", "교육", "사회"],
    description:
      "사람의 마음과 행동이 궁금하다면, 일상 속 질문을 통해 심리학을 만나보세요.",
    tags: ["감정 기록", "행동 관찰"],
    yearNumbers: [1, 2, 3, 4],
    final: "thesis",
    lessons: [
      "마음과 행동 관찰",
      "일상 속 심리 탐구",
      "심리 연구 설계",
      finals.thesis.name,
    ],
    jobs: ["심리 연구원", "상담 분야 전문가", "사용자 경험 연구원"],
  },
];
// 데이터의 계열(대학자체계열명)별 기본 구성. 학과별 전용 구성이 없을 때 쓴다.
export const fields = [
  {
    id: "인문사회",
    headline: "사람과 사회를 이해하는",
    group: "인문 · 사회",
    icon: "chat",
    keywords: ["심리", "교육", "사회", "경영"],
    activities: ["listen"],
    description:
      "사람과 사회가 움직이는 방식을 읽고, 생각을 말과 글로 풀어내는 분야예요.",
    tags: ["자료 읽기", "토론과 글쓰기"],
  },
  {
    id: "공학",
    headline: "원리를 찾고 직접 만드는",
    group: "공학",
    icon: "code",
    keywords: ["컴퓨터", "데이터", "공학"],
    activities: ["puzzle", "experiment"],
    description:
      "원리를 이해하고, 필요한 것을 직접 설계하고 만들어 문제를 해결하는 분야예요.",
    tags: ["문제 정의", "설계와 제작"],
  },
  {
    id: "자연과학",
    headline: "관찰하고 실험하는",
    group: "자연과학",
    icon: "flask",
    keywords: ["생명과학"],
    activities: ["science"],
    description:
      "자연과 생명의 원리를 관찰과 실험으로 확인하고 설명하는 분야예요.",
    tags: ["관찰과 실험", "원리 탐구"],
  },
  {
    id: "예체능",
    headline: "느낀 것을 표현하는",
    group: "예술 · 체육",
    icon: "palette",
    keywords: ["디자인", "영상·콘텐츠", "미술", "공연"],
    activities: ["draw"],
    description:
      "생각과 감각을 작품과 몸의 움직임으로 표현하는 분야예요.",
    tags: ["표현하기", "작품 만들기"],
  },
  {
    id: "의학",
    headline: "사람의 건강을 돌보는",
    group: "의학",
    icon: "heart",
    keywords: [],
    activities: [],
    description: "몸과 질병을 이해하고 사람의 건강을 돌보는 분야예요.",
    tags: ["인체 이해", "건강 돌보기"],
  },
];
const fallbackField = {
  id: "",
  group: "전공 탐색",
  icon: "cap",
  tags: ["교과목 살펴보기", "직접 해보기"],
};
export const initialState = {
  version: 3,
  interests: [],
  activities: [],
  journeys: {},
  current: "design",
  notes: {},
  drafts: {},
  plays: {},
  reports: [],
  catalog: [],
  artworks: {},
  capstones: {},
  onboarded: false,
};
// 수집 파이프라인이 검증한 학년별 편성. 형식이 맞지 않으면 없는 것으로 본다.
export function cleanYears(years) {
  if (!years || !Array.isArray(years.terms)) return null;
  const terms = years.terms
    .filter(
      (term) =>
        Number.isInteger(term?.year) &&
        term.year >= 1 &&
        term.year <= 6 &&
        [0, 1, 2].includes(term.semester) &&
        Array.isArray(term.subjects),
    )
    .map((term) => ({
      year: term.year,
      semester: term.semester,
      subjects: term.subjects.filter((s) => typeof s === "string" && s),
    }))
    .filter((term) => term.subjects.length);
  if (!terms.length) return null;
  const url = typeof years.source_url === "string" ? years.source_url : "";
  return {
    terms,
    source_url: /^https?:\/\//.test(url) ? url : "",
    checked_at: typeof years.checked_at === "string" ? years.checked_at : "",
  };
}
export function createDepartment(
  course,
  school,
  curriculum,
  category = "",
  years = null,
  duration = "",
) {
  const yearly = cleanYears(years);
  const yearNumbers = stageYears(duration);
  // 마지막 학년은 졸업 과제, 그 앞 학년은 과목 하나씩을 체험한다.
  const subjectYears = yearNumbers.slice(0, -1);
  const subjectsOf = (year) =>
    yearly.terms.filter((t) => t.year === year).flatMap((t) => t.subjects);
  // 검증된 학년별 편성이 모든 학년에 있으면 그 학년의 과목으로, 없으면 교과목 목록에서 고른다.
  const lessonsFromYears =
    !!yearly &&
    subjectYears.length > 0 &&
    subjectYears.every((year) => subjectsOf(year).length > 0);
  const picked = lessonsFromYears
    ? subjectYears.map((year) => pickLessons(subjectsOf(year), 1)[0])
    : pickLessons(curriculum, subjectYears.length);
  const field = fields.find((item) => item.id === category) || fallbackField;
  const final = finalFor(course, field.id);
  const template = departments.find((d) => d.name === course) || {
    category: field.id,
    group: field.group,
    icon: field.icon,
    tags: field.tags,
  };
  return {
    ...template,
    id: `api:${school}:${course}`,
    name: course,
    school,
    curriculum,
    duration,
    category: field.id || template.category,
    source: "litton",
    description: `${school} ${course}의 교과목을 살펴보고, 학년별 체험으로 전공을 미리 경험해요.`,
    yearly,
    yearNumbers,
    final,
    lessonsFromYears,
    lessons: [
      ...subjectYears.map(
        (year, i) => picked[i]?.subject || `${year}학년 전공 탐색`,
      ),
      finals[final].name,
    ],
    games: [...subjectYears.map((_, i) => picked[i]?.game || null), null],
  };
}
export function loadState(storage) {
  try {
    // stages: 저장 당시의 체험 단계 수. 0이면 지금 구조(학년별)로 저장된 데이터다.
    let value = JSON.parse(storage.getItem(STORAGE_KEY));
    let stages = 0;
    for (const [key, count] of LEGACY_KEYS) {
      if (value) break;
      value = JSON.parse(storage.getItem(key));
      stages = count;
    }
    if (!value || typeof value !== "object")
      return structuredClone(initialState);
    const catalog = Array.isArray(value.catalog)
      ? value.catalog
          .filter(
            (d) =>
              typeof d?.name === "string" &&
              d.name &&
              typeof d?.school === "string" &&
              d.school &&
              Array.isArray(d?.curriculum),
          )
          .map((d) =>
            createDepartment(
              d.name,
              d.school,
              d.curriculum.filter((s) => typeof s === "string"),
              fields.some((item) => item.id === d.category) ? d.category : "",
              d.yearly,
              typeof d.duration === "string" ? d.duration : "",
            ),
          )
      : [];
    const counts = new Map(
      [...departments, ...catalog].map((d) => [d.id, d.lessons.length]),
    );
    const validIds = new Set(counts.keys());
    // 예전 단계 번호를 지금의 학년 단계 번호로 옮긴다. 마지막 단계(졸업작품)는 마지막 학년으로 간다.
    const moveIndex = (id, index) => {
      const last = counts.get(id) - 1;
      if (stages === 3 && index >= 2) return last;
      if (stages === 8) return Math.min(last, Math.floor((index * (last + 1)) / 8));
      return Math.min(last, index);
    };
    const moveKey = (key) => {
      const match = key.match(/^(.*)-(\d+)$/);
      return match && validIds.has(match[1])
        ? `${match[1]}-${moveIndex(match[1], Number(match[2]))}`
        : null;
    };
    const moveCompleted = (id, completed) => {
      const total = counts.get(id);
      const done = Math.max(0, Math.floor(Number(completed) || 0));
      if (stages === 3) return done >= 3 ? total : Math.min(done, total - 1);
      if (stages === 8) return Math.min(total, Math.floor((done * total) / 8));
      return Math.min(total, done);
    };
    const journeys = Object.fromEntries(
      Object.entries(value.journeys || {})
        .filter(([id]) => validIds.has(id))
        .map(([id, item]) => [
          id,
          {
            completed: moveCompleted(id, item?.completed),
            paused: !!item?.paused,
          },
        ]),
    );
    const notes = {};
    if (value.notes && typeof value.notes === "object")
      for (const [key, note] of Object.entries(value.notes)) {
        if (typeof note !== "string") continue;
        const target = moveKey(key);
        if (!target) continue;
        notes[target] = notes[target] ? `${notes[target]}\n\n${note}` : note;
      }
    const drafts = {};
    if (value.drafts && typeof value.drafts === "object")
      for (const [key, text] of Object.entries(value.drafts)) {
        const target = moveKey(key);
        if (typeof text === "string" && target)
          drafts[target] = text.slice(0, 3000);
      }
    const plays = {};
    if (value.plays && typeof value.plays === "object")
      for (const [key, play] of Object.entries(value.plays)) {
        const target = moveKey(key);
        if (
          target &&
          games.some((game) => game.id === play?.game) &&
          typeof play.summary === "string"
        )
          plays[target] = { game: play.game, summary: play.summary.slice(0, 200) };
      }
    return {
      ...structuredClone(initialState),
      catalog,
      journeys,
      notes,
      drafts,
      plays,
      current: validIds.has(value.current) ? value.current : "design",
      interests: Array.isArray(value.interests)
        ? value.interests.filter((v) => typeof v === "string")
        : [],
      activities: Array.isArray(value.activities)
        ? value.activities.filter((v) => typeof v === "string")
        : [],
      reports: Array.isArray(value.reports)
        ? value.reports.filter(
            (r) => validIds.has(r?.id) && typeof r?.date === "string",
          )
        : [],
      artworks: Object.fromEntries(
        Object.entries(value.artworks || {}).filter(
          ([id, image]) =>
            validIds.has(id) &&
            typeof image === "string" &&
            image.startsWith("data:image/png;base64,") &&
            image.length < 1500000,
        ),
      ),
      capstones: Object.fromEntries(
        Object.entries(value.capstones || {})
          .filter(([id, plan]) => validIds.has(id) && plan && typeof plan === "object")
          .map(([id, plan]) => [
            id,
            Object.fromEntries(
              PLAN_FIELDS.map((field) => [
                field,
                typeof plan[field] === "string" ? plan[field].slice(0, 500) : "",
              ]),
            ),
          ]),
      ),
      onboarded: !!value.onboarded,
    };
  } catch {
    return structuredClone(initialState);
  }
}
// 관심 키워드와 활동으로 먼저 살펴볼 계열 순서를 정한다.
export function recommendationScores(interests, activities) {
  return Object.fromEntries(
    fields.map((field) => [
      field.id,
      field.keywords.filter((k) => interests.includes(k)).length * 3 +
        field.activities.filter((a) => activities.includes(a)).length * 2,
    ]),
  );
}
export function recommend(interests, activities) {
  const scores = recommendationScores(interests, activities);
  return [...fields].sort((a, b) => scores[b.id] - scores[a.id]);
}
export function completeLesson(state, id, index, note) {
  const journey = state.journeys[id];
  const department = [...departments, ...(state.catalog || [])].find(
    (d) => d.id === id,
  );
  const total = department?.lessons.length || 0;
  // 마지막 학년은 졸업 과제(작품 또는 계획서)를 마쳐야 완료된다.
  if (department && index === total - 1 && !finalReady(state, department))
    return state;
  // 미니게임이 있는 수업은 게임을 해본 뒤에만 완료할 수 있다.
  const game = state.catalog?.find((d) => d.id === id)?.games?.[index];
  if (game && state.plays?.[`${id}-${index}`]?.game !== game) return state;
  if (
    !journey ||
    journey.paused ||
    journey.completed !== index ||
    index >= total ||
    !note.trim()
  )
    return state;
  const { [`${id}-${index}`]: finished, ...drafts } = state.drafts || {};
  return {
    ...state,
    drafts,
    notes: { ...state.notes, [`${id}-${index}`]: note.trim() },
    journeys: { ...state.journeys, [id]: { ...journey, completed: index + 1 } },
  };
}
