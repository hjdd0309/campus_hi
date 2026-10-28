import { cleanLevels, cleanPicks, isGame, pickLessons, pickPracticeSubject } from "./games.js";
import { cleanLessonGames } from "./lessonGames.js";
import { experiences } from "./experiences.js";
import { groupExperience, groupOf, PRACTICE_SUBJECTS } from "./groups.js";

export const STORAGE_KEY = "hi-campus-v4";
// 예전 저장 데이터: [저장 키, 그때의 체험 단계 수]. 0이면 학년별 구조다.
// v3는 학년별 구조지만 학과군 실습이 없던 때라, 학년 자리의 수업이 바뀐 기록은 archive로 옮긴다.
const LEGACY_KEYS = [
  ["hi-campus-v3", 0],
  ["mirae-campus-v2", 3],
  ["mirae-campus-v1", 8],
];
// 마지막 학년의 졸업 과제. 도색 작업실은 조형·디자인 학과에만 맞으므로, 나머지 학과는 계열에 맞는 과제의 계획서를 쓴다.
export const PLAN_FIELDS = ["topic", "reason", "method"];
// 체험 데이터(experiences.js)의 졸업 과제를 그대로 쓴다. artwork는 틀 A, 나머지는 틀 F의 계획서다.
export const finals = {
  artwork: { kind: "artwork", name: experiences.artwork.title, ...experiences.artwork },
  capstone: { kind: "plan", name: experiences.capstone.title, ...experiences.capstone },
  thesis: { kind: "plan", name: experiences.thesis.title, ...experiences.thesis },
  showcase: { kind: "plan", name: experiences.showcase.title, ...experiences.showcase },
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
// 학과의 졸업 과제. 학과군 데이터로 만든 학과는 졸업 과제 데이터를, 기본 학과는 finals의 이름을 갖고 있다.
export const finalOf = (department) =>
  department?.final && typeof department.final === "object" ? department.final : finals[department?.final] || finals.artwork;
// 체험 데이터를 졸업 과제로 쓴다. A는 칠해서 완성하는 작품, F는 계획서, 그 밖의 틀(G AI 가르치기 등)은
// 수업 안에서 끝까지 해보는 프로젝트다.
const asFinal = (data) => ({ kind: data.template === "A" ? "artwork" : data.template === "F" ? "plan" : "project", name: data.title, ...data });
// 마지막 학년을 완료할 준비가 됐는지: 졸업작품·프로젝트는 끝까지 해봤어야(artworks에 기록), 계획서는 세 칸이 모두 있어야 한다.
// artworks는 이름과 달리 "만들어서 마치는 졸업 과제를 마쳤는지"를 학과마다 기록한다(저장 형식을 바꾸지 않으려고 그대로 둔다).
export function finalReady(state, department) {
  return finalOf(department).kind === "plan"
    ? planReady(state.capstones?.[department.id])
    : !!state.artworks?.[department.id];
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
    blurb: "사람과 사회를 읽고 말과 글로 풀어내요",
    detail: "사람과 사회가 움직이는 방식을 읽고,\n생각을 말과 글로 풀어내는 전공을 체험해보세요",
    headline: "사람과 사회를 이해하는",
    group: "인문 · 사회",
    icon: "chat",
    keywords: ["심리", "교육", "사회", "경영"],
    description:
      "사람과 사회가 움직이는 방식을 읽고, 생각을 말과 글로 풀어내는 분야예요.",
    tags: ["자료 읽기", "토론과 글쓰기"],
  },
  {
    id: "공학",
    blurb: "원리를 이해하고 필요한 것을 직접 만들어요",
    detail: "원리를 이해하고, 필요한 것을 직접 설계하고\n만들어 문제를 해결하는 전공을 체험해보세요",
    headline: "원리를 찾고 직접 만드는",
    group: "공학",
    icon: "code",
    keywords: ["컴퓨터", "데이터", "공학"],
    description:
      "원리를 이해하고, 필요한 것을 직접 설계하고 만들어 문제를 해결하는 분야예요.",
    tags: ["문제 정의", "설계와 제작"],
  },
  {
    id: "자연과학",
    blurb: "자연과 생명의 원리를 관찰과 실험으로 밝혀요",
    detail: "자연과 생명의 원리를 관찰과 실험으로\n확인하고 설명하는 전공을 체험해보세요",
    headline: "관찰하고 실험하는",
    group: "자연과학",
    icon: "flask",
    keywords: ["생명과학"],
    description:
      "자연과 생명의 원리를 관찰과 실험으로 확인하고 설명하는 분야예요.",
    tags: ["관찰과 실험", "원리 탐구"],
  },
  {
    id: "예체능",
    blurb: "생각과 감각을 작품과 움직임으로 표현해요",
    detail: "생각과 감각을 작품과 몸의 움직임으로\n표현하는 전공을 체험해보세요",
    headline: "느낀 것을 표현하는",
    group: "예술 · 체육",
    icon: "palette",
    keywords: ["디자인", "영상 / 콘텐츠", "음악", "연기", "체육"],
    description:
      "생각과 감각을 작품과 몸의 움직임으로 표현하는 분야예요.",
    tags: ["표현하기", "작품 만들기"],
  },
  {
    id: "의학",
    blurb: "몸과 질병을 이해하고 건강을 돌봐요",
    detail: "몸과 질병을 이해하고,\n사람의 건강을 돌보는 전공을 체험해보세요",
    headline: "사람의 건강을 돌보는",
    group: "의학",
    icon: "heart",
    keywords: [],
    description: "몸과 질병을 이해하고 사람의 건강을 돌보는 분야예요.",
    tags: ["인체 이해", "건강 돌보기"],
  },
];
const fallbackField = {
  id: "",
  blurb: "교과목을 살펴보고 직접 해보며 알아가요",
  detail: "교과목을 살펴보고,\n학년별 체험으로 전공을 미리 만나보세요",
  group: "전공 탐색",
  icon: "cap",
  tags: ["교과목 살펴보기", "직접 해보기"],
};
export const fieldOf = (id) => fields.find((item) => item.id === id) || fallbackField;
// 관심 분야 탐색 질문. 보기마다 가장 가까운 계열을 하나씩 연결해 추천에 쓴다.
const question = (title, sub, options) => ({
  title,
  sub,
  options: options.map(([label, field]) => ({ label, field })),
});
export const QUESTIONS = [
  question("쉬는 시간엔 주로 무엇을 하나요?", "가장 자주 하는 일을 떠올려 보세요", [
    ["낙서하거나 무언가 그리기", "예체능"],
    ["친구와 이야기 나누기", "인문사회"],
    ["궁금한 것을 찾아보기", "자연과학"],
    ["몸을 움직이며 놀기", "예체능"],
    ["무언가 만들거나 고치기", "공학"],
  ]),
  question("어떤 순간에 시간 가는 줄 모르나요?", "좋아하거나 자신 있는 활동을 선택해요", [
    ["작은 불편을 찾아 해결하기", "공학"],
    ["그림이나 이미지로 표현하기", "예체능"],
    ["친구의 이야기를 듣고 돕기", "인문사회"],
    ["규칙과 원리를 알아내기", "자연과학"],
    ["직접 만들고 실험하기", "공학"],
  ]),
  question("어떤 과목이 가장 재미있나요?", "성적과 상관없이 즐거운 과목을 골라요", [
    ["미술", "예체능"],
    ["국어 · 사회", "인문사회"],
    ["수학 · 과학", "자연과학"],
    ["체육 · 음악", "예체능"],
    ["기술 · 가정", "공학"],
  ]),
  question("모둠 활동에서 나는 어떤 역할인가요?", "자연스럽게 맡게 되는 역할을 선택해요", [
    ["아이디어를 내는 사람", "공학"],
    ["발표 자료를 꾸미는 사람", "예체능"],
    ["의견을 정리하는 사람", "인문사회"],
    ["분위기를 이끄는 사람", "인문사회"],
    ["꼼꼼하게 마무리하는 사람", "자연과학"],
  ]),
  question("무엇을 볼 때 마음이 움직이나요?", "오래 기억에 남는 장면을 떠올려 보세요", [
    ["잘 만든 물건과 공간", "예체능"],
    ["사람들의 표정과 이야기", "인문사회"],
    ["새로운 기술과 발명", "공학"],
    ["멋진 공연과 경기", "예체능"],
    ["자연과 생명의 신비", "자연과학"],
  ]),
  question("어떤 칭찬을 들으면 가장 기쁜가요?", "듣고 싶은 칭찬을 모두 골라도 좋아요", [
    ["센스 있다", "예체능"],
    ["마음이 따뜻하다", "인문사회"],
    ["똑똑하다", "자연과학"],
    ["끈기 있다", "자연과학"],
    ["손재주가 좋다", "공학"],
  ]),
  question("앞으로 어떤 일을 해보고 싶나요?", "막연해도 괜찮아요, 끌리는 대로 골라요", [
    ["사람들이 쓰는 물건 만들기", "공학"],
    ["누군가의 고민 들어주기", "인문사회"],
    ["세상의 문제 분석하기", "인문사회"],
    ["무대나 화면 위에 서기", "예체능"],
    ["새로운 것을 연구하기", "자연과학"],
  ]),
];
export const KEYWORD_GROUPS = [
  { label: "예체능", items: ["디자인", "영상 / 콘텐츠", "음악", "연기", "체육"] },
  { label: "사회", items: ["심리", "교육", "사회", "경영"] },
  { label: "기술 / 공학", items: ["컴퓨터", "데이터", "공학", "생명과학"] },
];
export const initialState = {
  version: 4,
  interests: [],
  answers: {},
  journeys: {},
  current: "design",
  // 홈에 보여 주던(지금 체험 중인) 학과. current는 탐색에서 열어 본 학과로도 바뀌므로 따로 둔다.
  studying: null,
  notes: {},
  drafts: {},
  plays: {},
  reports: [],
  catalog: [],
  artworks: {},
  capstones: {},
  // 체험 구조가 바뀌어 학년 자리에서 빠진 예전 기록: [{ id, title, note }]. 마이페이지 리포트에 함께 담는다.
  archive: [],
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
// 학과 하나의 학년별 체험. 마지막 학년은 졸업 과제, 그 바로 앞 학년은 학과군 전공 실습, 나머지 학년은 이론 수업(과목 하나)이다.
// 학과군 데이터가 아직 공개되지 않았으면 실습 자리도 이론 수업으로, 졸업 과제는 계열에 맞는 기본 과제로 채운다.
export function createDepartment(
  course,
  school,
  curriculum,
  category = "",
  years = null,
  duration = "",
  region = "",
  games = null,
  levels = null,
  picks = null,
  partner = false,
) {
  const yearly = cleanYears(years);
  // 미리 만들어 둔 연습 문제가 있는 과목과 그 유형.
  const lessonGames = cleanLessonGames(games);
  // 과목을 보통 듣는 학년 범위. 학년마다 맞는 과목을 고르는 데 쓴다.
  const subjectLevels = cleanLevels(levels);
  // 사람이 정해 둔 학년별 과목(학년 → 후보). 있으면 규칙보다 먼저 쓴다.
  const lessonPicks = cleanPicks(picks);
  const yearNumbers = stageYears(duration);
  const field = fields.find((item) => item.id === category) || fallbackField;
  const group = groupOf(course, field.id);
  const practice = yearNumbers.length >= 2 ? groupExperience(group, "practice") : null;
  const groupFinal = groupExperience(group, "final");
  const final = groupFinal ? asFinal(groupFinal) : finals[finalFor(course, field.id)];
  const theoryYears = yearNumbers.slice(0, practice ? -2 : -1);
  const subjectsOf = (year) =>
    yearly.terms.filter((t) => t.year === year).flatMap((t) => t.subjects);
  // 검증된 학년별 편성이 이론 학년 모두에 있으면 그 학년의 과목으로, 없으면 교과목 목록에서 고른다.
  const lessonsFromYears =
    !!yearly &&
    theoryYears.length > 0 &&
    theoryYears.every((year) => subjectsOf(year).length > 0);
  const picked = lessonsFromYears
    ? theoryYears.map((year) => pickLessons(subjectsOf(year), [year], lessonGames, subjectLevels, lessonPicks)[0])
    : pickLessons(curriculum, theoryYears, lessonGames, subjectLevels, lessonPicks);
  // 학과군 실습 학년은 교과목에 실습과 이어지는 과목이 있으면 그 과목 이름으로 보여준다(하는 활동은 실습 그대로).
  const practiceSubject = practice
    ? pickPracticeSubject(curriculum, PRACTICE_SUBJECTS[group], yearNumbers[yearNumbers.length - 2], subjectLevels, new Set(picked.map((item) => item?.subject)))
    : null;
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
    region,
    category: field.id || template.category,
    source: "litton",
    description: `${school} ${course}의 교과목을 살펴보고, 학년별 체험으로 전공을 미리 경험해요.`,
    yearly,
    yearNumbers,
    studyGroup: group,
    practice,
    final,
    lessonsFromYears,
    lessonGames,
    levels: subjectLevels,
    picks: lessonPicks,
    // 제휴 대학 여부. 화면에 "제휴"를 표시하는 데만 쓴다.
    partner: partner === true,
    lessons: [
      ...theoryYears.map((year, i) => picked[i]?.subject || `${year}학년 전공 탐색`),
      ...(practice ? [practiceSubject || practice.title] : []),
      final.name,
    ],
    // 학년마다의 체험: 연습 문제의 유형, 학과군 실습(group:학과군), 없으면 null.
    games: [...theoryYears.map((_, i) => picked[i]?.game || null), ...(practice ? [`group:${group}`] : []), null],
  };
}
export function loadState(storage) {
  try {
    // stages: 저장 당시의 체험 단계 수. 0이면 지금 구조(학년별)로 저장된 데이터다.
    let value = JSON.parse(storage.getItem(STORAGE_KEY));
    let stages = 0;
    let from = STORAGE_KEY;
    for (const [key, count] of LEGACY_KEYS) {
      if (value) break;
      value = JSON.parse(storage.getItem(key));
      stages = count;
      from = key;
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
              typeof d.region === "string" ? d.region : "",
              d.lessonGames,
              d.levels,
              d.picks,
              d.partner,
            ),
          )
      : [];
    const counts = new Map(
      [...departments, ...catalog].map((d) => [d.id, d.lessons.length]),
    );
    // v3에서 옮길 때: 학년 자리의 수업 이름이 바뀌었으면(학과군 실습이 들어오는 등) 그 자리의 기록은 archive로 옮긴다.
    const lessonsOf = new Map([...departments, ...catalog].map((d) => [d.id, d.lessons]));
    const gamesOf = new Map([...departments, ...catalog].map((d) => [d.id, d.games || []]));
    const oldLessons = new Map(
      from === "hi-campus-v3" && Array.isArray(value.catalog)
        ? value.catalog
            .filter((d) => typeof d?.id === "string" && Array.isArray(d.lessons))
            .map((d) => [d.id, d.lessons])
        : [],
    );
    const archive = [];
    // 바뀐 자리면 예전 수업 이름을, 그대로면 null을 돌려준다.
    const replaced = (key) => {
      const match = key.match(/^(.*)-(\d+)$/);
      if (!match || !oldLessons.has(match[1])) return null;
      const before = oldLessons.get(match[1])[Number(match[2])];
      const now = lessonsOf.get(match[1])?.[Number(match[2])];
      // 학과군 실습 자리는 v3에 없던 활동이라, 이름이 예전 과목과 같아도(실습 학년을 과목 이름으로 보여줄 때) 바뀐 자리로 본다.
      const practiceNow = String(gamesOf.get(match[1])?.[Number(match[2])] || "").startsWith("group:");
      return typeof before === "string" && (before !== now || practiceNow) ? before : null;
    };
    const keep = (key, text) => {
      const before = replaced(key);
      if (!before) return true;
      if (text.trim()) archive.push({ id: key.replace(/-\d+$/, ""), title: before.slice(0, 60), note: text.slice(0, 3000) });
      return false;
    };
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
        if (typeof note !== "string" || !keep(key, note)) continue;
        const target = moveKey(key);
        if (!target) continue;
        notes[target] = notes[target] ? `${notes[target]}\n\n${note}` : note;
      }
    const drafts = {};
    if (value.drafts && typeof value.drafts === "object")
      for (const [key, text] of Object.entries(value.drafts)) {
        if (typeof text !== "string" || !keep(key, text)) continue;
        const target = moveKey(key);
        if (target) drafts[target] = text.slice(0, 3000);
      }
    const plays = {};
    if (value.plays && typeof value.plays === "object")
      for (const [key, play] of Object.entries(value.plays)) {
        const target = replaced(key) ? null : moveKey(key);
        if (
          target &&
          isGame(play?.game) &&
          typeof play.summary === "string"
        )
          plays[target] = { game: play.game, summary: play.summary.slice(0, 200) };
      }
    // 지난 버전에서 옮겨 둔 기록. 학과가 남아 있는 것만 둔다.
    if (Array.isArray(value.archive))
      for (const item of value.archive)
        if (validIds.has(item?.id) && typeof item.title === "string" && typeof item.note === "string" && item.note.trim())
          archive.push({ id: item.id, title: item.title.slice(0, 60), note: item.note.slice(0, 3000) });
    return {
      ...structuredClone(initialState),
      catalog,
      archive,
      journeys,
      notes,
      drafts,
      plays,
      current: validIds.has(value.current) ? value.current : "design",
      studying: Object.hasOwn(journeys, value.studying) ? value.studying : null,
      interests: Array.isArray(value.interests)
        ? value.interests.filter((v) => typeof v === "string")
        : [],
      answers: Object.fromEntries(
        QUESTIONS.map((q, i) => [
          i + 1,
          Array.isArray(value.answers?.[i + 1])
            ? value.answers[i + 1].filter((v) => q.options.some((o) => o.label === v))
            : [],
        ]).filter(([, picked]) => picked.length),
      ),
      reports: Array.isArray(value.reports)
        ? value.reports.filter(
            (r) => validIds.has(r?.id) && typeof r?.date === "string",
          )
        : [],
      artworks: Object.fromEntries(
        Object.entries(value.artworks || {}).filter(
          // 예전에는 칠한 그림을 저장했다. 지금은 졸업작품을 마쳤는지만 기록한다.
          ([id, done]) =>
            validIds.has(id) &&
            (done === true ||
              (typeof done === "string" && done.startsWith("data:image/png;base64,"))),
        ).map(([id]) => [id, true]),
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
// 관심 키워드와 탐색 질문의 답으로 먼저 살펴볼 계열 순서를 정한다.
export function recommendationScores(keywords, answers = {}) {
  const picked = QUESTIONS.flatMap((q, i) =>
    q.options.filter((o) => (answers[i + 1] || []).includes(o.label)),
  );
  return Object.fromEntries(
    fields.map((field) => [
      field.id,
      field.keywords.filter((k) => keywords.includes(k)).length * 3 +
        picked.filter((o) => o.field === field.id).length * 2,
    ]),
  );
}
export function recommend(keywords, answers) {
  const scores = recommendationScores(keywords, answers);
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
    index >= total
  )
    return state;
  // 느낀 점은 적지 않아도 완료할 수 있다(건너뛰기). 적었으면 기록으로 남긴다.
  const { [`${id}-${index}`]: finished, ...drafts } = state.drafts || {};
  return {
    ...state,
    drafts,
    notes: note.trim()
      ? { ...state.notes, [`${id}-${index}`]: note.trim() }
      : state.notes,
    journeys: { ...state.journeys, [id]: { ...journey, completed: index + 1 } },
  };
}
