import { games, pickLessons } from "./games.js";

export const STORAGE_KEY = "mirae-campus-v2";
export const LESSON_COUNT = 3;
export const lessonYear = (index) => [1, 2, 4][Math.min(2, Math.max(0, index))];
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
    years: ["기초 탐색", "적용 실습", "졸업작품"],
    lessons: [
      "일상 속 디자인 찾기",
      "사용자를 위한 제품 설계",
      "4학년 졸업작품",
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
    years: ["기초 탐색", "적용 실습", "졸업작품"],
    lessons: ["마음과 행동 관찰", "일상 속 심리 탐구", "4학년 졸업작품"],
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
  version: 2,
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
) {
  const picked = pickLessons(curriculum);
  const field = fields.find((item) => item.id === category) || fallbackField;
  const template = departments.find((d) => d.name === course) || {
    category: field.id,
    group: field.group,
    icon: field.icon,
    tags: field.tags,
    years: ["기초 탐색", "적용 실습", "졸업작품"],
  };
  return {
    ...template,
    id: `api:${school}:${course}`,
    name: course,
    school,
    curriculum,
    category: field.id || template.category,
    source: "litton",
    description: `${school} ${course}의 교과목을 살펴보고, 세 단계의 탐색 활동으로 전공을 미리 경험해요.`,
    yearly: cleanYears(years),
    lessons: [
      picked[0]?.subject || "전공 기초 탐색",
      picked[1]?.subject || "전공 적용 실습",
      "4학년 졸업작품",
    ],
    games: [picked[0]?.game || null, picked[1]?.game || null, null],
  };
}
export function loadState(storage) {
  try {
    const saved = storage.getItem(STORAGE_KEY);
    const value = JSON.parse(saved || storage.getItem("mirae-campus-v1"));
    if (!value || typeof value !== "object")
      return structuredClone(initialState);
    const legacy = !saved;
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
            ),
          )
      : [];
    const validIds = new Set([...departments, ...catalog].map((d) => d.id));
    const journeys = Object.fromEntries(
      Object.entries(value.journeys || {})
        .filter(([id]) => validIds.has(id))
        .map(([id, item]) => [
          id,
          {
            completed: Math.min(
              LESSON_COUNT,
              Math.max(
                0,
                Math.floor(
                  (Number(item?.completed) || 0) *
                    (legacy ? LESSON_COUNT / 8 : 1),
                ),
              ),
            ),
            paused: !!item?.paused,
          },
        ]),
    );
    const notes = {};
    if (value.notes && typeof value.notes === "object")
      for (const [key, note] of Object.entries(value.notes)) {
        if (typeof note !== "string") continue;
        const match = key.match(/^(.*)-(\d+)$/);
        if (!match || !validIds.has(match[1])) continue;
        const target = legacy
          ? `${match[1]}-${Math.min(2, Math.floor((Number(match[2]) * 3) / 8))}`
          : key;
        notes[target] = notes[target] ? `${notes[target]}\n\n${note}` : note;
      }
    const drafts = {};
    if (value.drafts && typeof value.drafts === "object")
      for (const [key, text] of Object.entries(value.drafts)) {
        const match = key.match(/^(.*)-(\d+)$/);
        if (typeof text === "string" && match && validIds.has(match[1]))
          drafts[key] = text.slice(0, 3000);
      }
    const plays = {};
    if (value.plays && typeof value.plays === "object")
      for (const [key, play] of Object.entries(value.plays)) {
        const match = key.match(/^(.*)-(\d+)$/);
        if (
          match &&
          validIds.has(match[1]) &&
          games.some((game) => game.id === play?.game) &&
          typeof play.summary === "string"
        )
          plays[key] = { game: play.game, summary: play.summary.slice(0, 200) };
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
  if (index === LESSON_COUNT - 1 && !state.artworks[id]) return state;
  // 미니게임이 있는 수업은 게임을 해본 뒤에만 완료할 수 있다.
  const game = state.catalog?.find((d) => d.id === id)?.games?.[index];
  if (game && state.plays?.[`${id}-${index}`]?.game !== game) return state;
  if (
    !journey ||
    journey.paused ||
    journey.completed !== index ||
    index >= LESSON_COUNT ||
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
