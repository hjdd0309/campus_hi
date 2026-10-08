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
export const initialState = {
  version: 2,
  interests: [],
  activities: [],
  journeys: {},
  current: "design",
  notes: {},
  reports: [],
  catalog: [],
  artworks: {},
  onboarded: false,
};
export function createDepartment(course, school, curriculum) {
  const template = departments.find((d) => d.name === course);
  if (!template) throw new Error("지원하지 않는 학과입니다.");
  return {
    ...template,
    id: `api:${school}:${course}`,
    name: course,
    school,
    curriculum,
    source: "litton",
    description: `${school} ${course}의 교과목을 살펴보고, 세 단계의 탐색 활동으로 전공을 미리 경험해요.`,
    lessons: [
      curriculum[0] || "전공 기초 탐색",
      curriculum[Math.min(1, curriculum.length - 1)] || "전공 적용 실습",
      "4학년 졸업작품",
    ],
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
              departments.some((item) => item.name === d?.name) &&
              typeof d?.school === "string" &&
              Array.isArray(d?.curriculum),
          )
          .map((d) =>
            createDepartment(
              d.name,
              d.school,
              d.curriculum.filter((s) => typeof s === "string"),
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
    return {
      ...structuredClone(initialState),
      catalog,
      journeys,
      notes,
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
export function recommend(interests, activities) {
  const scores = { design: 0, psychology: 0 };
  departments.forEach((d) => {
    scores[d.id] += d.keywords.filter((k) => interests.includes(k)).length * 3;
  });
  const activityMap = {
    puzzle: ["design"],
    draw: ["design"],
    listen: ["psychology"],
    science: ["psychology"],
    experiment: ["design"],
  };
  activities.forEach((a) =>
    activityMap[a]?.forEach((id) => {
      scores[id] += 2;
    }),
  );
  return [...departments].sort((a, b) => scores[b.id] - scores[a.id]);
}
export function completeLesson(state, id, index, note) {
  const journey = state.journeys[id];
  if (index === LESSON_COUNT - 1 && !state.artworks[id]) return state;
  if (
    !journey ||
    journey.paused ||
    journey.completed !== index ||
    index >= LESSON_COUNT ||
    !note.trim()
  )
    return state;
  return {
    ...state,
    notes: { ...state.notes, [`${id}-${index}`]: note.trim() },
    journeys: { ...state.journeys, [id]: { ...journey, completed: index + 1 } },
  };
}
