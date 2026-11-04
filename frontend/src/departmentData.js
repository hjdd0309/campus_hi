// 학과 전용 체험: 특정 학교·학과의 학년 자리를 학과군 규칙 대신 이 데이터로 채운다(model.js의 createDepartment).
// 학년 자리 하나에 체험(parts)을 1~3개 넣을 수 있고, 차례로 모두 해야 그 학년 체험을 마친다.
// subjects는 그 학년에 실제로 편성된 과목 이름이고, 출처(source)의 편성표에서 학년을 확인한 것만 쓴다.
// status: "review"(검토 대기) | "verified"(공개). AI가 쓴 데이터는 쓰지 않은 별도 에이전트가 검토한 뒤에만 verified로 바꾼다.
// 체험 데이터 형식은 experiences.js의 틀 형식과 같다(H 그리기, I 기억해서 맞추기는 studio.js).
import { cleanExperience } from "./experiences.js";

const text = (value, max) => (typeof value === "string" && value.trim() && [...value].length <= max ? value : null);

const raw = {
  "경희대학교|산업디자인학과": {
    source: {
      title: "2025학년도 예술·디자인대학 교육과정 [별표1] 산업디자인학과 교육과정 편성표",
      url: "https://dc.khu.ac.kr/dc/cmmn/file/fileDown.do?menuNo=15400056&atchFileId=264fb13d9a0a4c17ba986b274cef66be&fileSn=1&bbsId=",
      checkedAt: "2026-11-04",
    },
    years: {
      // 편성표에서 드로잉(FD101)과 평면디자인(FD103)은 둘 다 1학년 전공기초 과목이다.
      1: {
        status: "verified",
        subjects: ["드로잉", "평면디자인"],
        parts: [
          {
            template: "H",
            title: "투시 스케치",
            task: "소실점을 보며 상자를 그리고, 가이드선을 켜고 다시 그려 점수를 비교해요.",
            cards: [
              {
                title: "소실점과 눈높이선",
                body: "멀리 있는 것은 작아 보여서, 나란한 선도 멀어질수록 한 점으로 모여 보여요. 이 점이 소실점이에요. 땅과 나란한 선의 소실점은 내 눈높이의 수평선(눈높이선) 위에 생겨요.",
              },
              {
                title: "2점 투시",
                body: "고개를 들거나 숙이지 않고 상자를 모서리 쪽에서 보면 소실점이 양쪽에 하나씩 생겨요. 세로 모서리는 똑바로 세우고, 나머지 모서리는 두 소실점 중 하나를 향해요.",
              },
              {
                title: "가이드선",
                body: "디자이너는 형태를 그리기 전에 소실점에서 연한 가이드선을 먼저 긋기도 해요. 가이드 없이 한 번, 가이드를 켜고 한 번 그려 비교해 봐요.",
              },
            ],
            vanishing: [12, 308],
            horizon: 70,
            edge: { x: 150, top: 115, bottom: 195 },
            rounds: [
              { guide: false, label: "가이드 없이" },
              { guide: true, label: "가이드선 켜고" },
            ],
            minLines: 6,
            maxLines: 14,
            prompt:
              "굵은 앞 모서리에서 시작해 상자를 그려요. 가로로 뻗는 모서리는 양쪽 소실점을 향하게, 세로 모서리는 똑바로 세워요. 선을 6개 이상 그은 뒤 채점해요.",
            guideTip: "연한 선은 소실점에서 뻗어 나온 가이드선이에요. 가이드선에 겹쳐 6개 이상 그어 보세요.",
            improved: "가이드선을 켜니 선이 투시 방향에 더 잘 맞았어요.",
            notImproved: "이번엔 점수가 오르지 않았어요. 가이드선에 선을 겹쳐 다시 그어 보세요.",
            explanation:
              "2점 투시에서 같은 방향으로 뻗은 가로 모서리는 눈높이선 위의 한 점(소실점)으로 모이고, 세로 모서리는 똑바로 서요. 디자이너는 가이드선을 먼저 긋고 그 위에 형태를 올려 정확한 스케치를 그려요.",
          },
          {
            template: "I",
            title: "색 맞추기",
            task: "잠깐 본 색을 기억해 색상·명도·채도를 슬라이더로 맞춰 똑같이 만들어요.",
            cards: [
              {
                title: "색의 세 속성",
                body: "색은 색상(빨강·파랑 같은 색의 종류), 명도(밝고 어두운 정도), 채도(맑고 탁한 정도, 곧 선명한 정도) 세 가지로 나눠 말할 수 있어요.",
              },
              {
                title: "화면 색 정하기",
                body: "이 체험의 슬라이더는 화면 색을 정하는 HSL 값이라, 미술 시간에 배우는 먼셀 명도·채도와 꼭 같지는 않아요. 그래도 세 값을 따로 맞춘다는 점은 같아요.",
              },
              {
                title: "일치율",
                body: "두 색이 얼마나 다른지는 색차(ΔE)라는 값으로 재요. 이 체험은 내가 만든 색과 목표색의 색차가 작을수록 일치율을 높게 매겨요.",
              },
            ],
            targets: [
              { h: 4, s: 78, l: 56 },
              { h: 46, s: 92, l: 58 },
              { h: 162, s: 55, l: 40 },
              { h: 214, s: 70, l: 46 },
              { h: 286, s: 38, l: 62 },
            ],
            showMs: 1000,
            prompt: "목표색이 1초 동안 보였다가 사라져요. 기억한 색을 세 슬라이더로 만들고 확인을 눌러요.",
            explanation:
              "색은 색상·명도·채도로 나눠 말할 수 있어요. 디자이너는 '조금 더 밝은 파랑'처럼 느낌으로만 말하지 않고 값으로 정해 색을 정확하게 전해요.",
          },
        ],
      },
    },
  },
};

// 학년 자리 하나의 학과 전용 체험을 검사한다. 형식이 틀리면 null.
export function cleanStudio(entry) {
  if (!entry || typeof entry !== "object" || !["review", "verified"].includes(entry.status)) return null;
  const parts = Array.isArray(entry.parts) && entry.parts.length >= 1 && entry.parts.length <= 3 ? entry.parts.map(cleanExperience) : null;
  const subjects =
    Array.isArray(entry.subjects) && entry.subjects.length >= 1 && entry.subjects.length <= 3 && entry.subjects.every((s) => text(s, 40))
      ? entry.subjects
      : null;
  if (!parts || !parts.every(Boolean) || !subjects || new Set(subjects).size !== subjects.length) return null;
  return { status: entry.status, subjects, parts };
}

function cleanSource(source) {
  return source && text(source.title, 100) && /^https?:\/\//.test(source.url || "") && /^\d{4}-\d{2}-\d{2}$/.test(source.checkedAt || "")
    ? { title: source.title, url: source.url, checkedAt: source.checkedAt }
    : null;
}

// 검사한 데이터: { "학교|학과": { source, years: { 학년: studio | null } } }. 형식이 틀린 학년은 null이 되고 테스트에서 걸린다.
export const departmentData = Object.fromEntries(
  Object.entries(raw).map(([key, entry]) => [
    key,
    {
      source: cleanSource(entry.source),
      years: Object.fromEntries(Object.entries(entry.years || {}).map(([year, studio]) => [year, cleanStudio(studio)])),
    },
  ]),
);

// 그 학교·학과·학년의 공개된(verified) 학과 전용 체험. 출처가 없거나 검토 전이면 null.
export function studioFor(school, course, year) {
  const entry = departmentData[`${school}|${course}`];
  const studio = entry?.source ? entry.years[year] : null;
  return studio?.status === "verified" ? studio : null;
}
