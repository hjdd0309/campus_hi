// 학과 → 학과군 분류와 학과군별 체험(3학년 실습, 졸업 과제). 데이터는 groupData.js에 있다.
// 학과명이 어느 학과군 규칙에 맞는지 위에서부터 보고, 처음 맞는 학과군을 쓴다. 순서가 곧 우선순위다.
// 예: 체육교육과는 교육(교사 양성 과정), 패션디자인학과는 조리·뷰티·패션(패턴·봉제 중심), 산업경영공학과는 공학 설계.
import { cleanExperience, experiences } from "./experiences.js";
import { groupData } from "./groupData.js";

export const GROUPS = [
  { id: "education", name: "교육", match: /교육|보육|교직/ },
  {
    id: "health",
    name: "의약·보건",
    match: /의예|의학|한의|치의|약학|수의|의과|간호|물리치료|작업치료|치위생|응급구조|임상병리|방사선|안경광학|치기공|언어치료|언어재활|재활|보건|의료|요양|의공/,
  },
  {
    id: "craft",
    name: "조리·뷰티·패션",
    match: /조리|제과|제빵|베이커리|외식|뷰티|미용|헤어|메이크업|네일|패션|의류|의상|바리스타|소믈리에|스타일리스트/,
  },
  {
    id: "design",
    name: "디자인·미술",
    match: /디자인|미술|조형|공예|회화|조소|도예|서양화|동양화|한국화|애니메이션|웹툰|만화|카툰|일러스트|섬유예술|서예|사진|FineArts/,
  },
  { id: "music", name: "음악", match: /음악|작곡|성악|피아노|관현악|국악|기악|건반|보컬|K-POP|뮤직|음향/ },
  {
    id: "stage",
    name: "공연·영상·미디어",
    match: /연기|연극|뮤지컬|무용|댄스|공연|영화|영상|방송|연예|엔터테인먼트|모델|미디어|언론|광고|홍보|커뮤니케이션|신문|저널|콘텐츠|크리에이터/,
  },
  {
    id: "sports",
    name: "체육",
    match: /체육|스포츠|태권도|품새|축구|야구|골프|레저|레포츠|무도|경호|시큐리티|운동|헬스|피트니스|필라테스|요가|주짓수|경기지도/,
  },
  {
    id: "computing",
    name: "컴퓨터·AI",
    match: /컴퓨터|소프트웨어|인공지능|AI|A\.I\.|데이터|(?<!문헌)정보|IT|게임|보안|사이버|SW|클라우드|ICT|IoT|컴퓨팅/,
  },
  {
    id: "machine",
    name: "기계·전기·전자",
    match: /기계|자동차|모빌리티|항공(?!서비스)|헬리콥터|우주|조선|로봇|메카트로닉스|드론|철도|선박|해양공학|기관|전기|전자|반도체|통신|제어|디스플레이|에너지|전력|이차전지|배터리|자동화|스마트팩토리|제조|설비|원자력|냉동|공조|산업공학|산업경영공학|산업시스템|공학계열/,
  },
  {
    id: "building",
    name: "건축·토목",
    match: /건축|토목|건설|도시|조경|소방|방재|인테리어|실내|공간|측량|지적|부동산|교통|인프라|안전|플랜트|항만/,
  },
  {
    id: "chemeng",
    name: "화학·소재·환경공학",
    match: /화학공학|화공|신소재|소재|재료|금속|고분자|섬유|환경|생명공학|바이오|제약|식품공학|화장품|제철/,
  },
  {
    id: "science",
    name: "자연과학",
    match: /수학|수리|물리|(?<!문)화학|생명|생물|통계|지구|천문|해양|대기|지질|식품|영양|농|원예|산림|동물|축산|수산|반려|펫|식물|팜|자연과학|기초과학|기후|말산업|승마|목재|식량/,
  },
  {
    id: "business",
    name: "경영·경제",
    match: /경영|경제|회계|세무|무역|통상|금융|관광|호텔|마케팅|물류|유통|창업|스타트업|비서|항공서비스|비즈|보험|재무|상경|소비자/,
  },
  { id: "welfare", name: "심리·복지", match: /심리|상담|복지|아동|가족|청소년|노인|치료|케어/ },
  {
    id: "society",
    name: "법·행정·사회",
    match: /법|행정|경찰|범죄|탐정|정치|외교|사회|군사|국방|밀리터리|부사관|국제|공공|안보|지역|북한|교정|지리|지식재산/,
  },
  {
    id: "humanities",
    name: "어문·인문",
    match: /(?<!케)어|문학|국문|영문|사학|역사|철학|신학|문헌|언어|문화|고고|종교|기독|불교|한문|글로벌|통번역|문예|고전|스토리텔링|일본|중국|한국학|러시아|독일|프랑스|스페인|아랍|베트남|인도|동양|영미|인문/,
  },
];

// 어느 규칙에도 맞지 않으면 계열(대학자체계열명)로 정한다. "공학계열", "인문대학"처럼 단과대 단위로 뽑는 곳이 여기로 온다.
export const FALLBACK = {
  인문사회: "society",
  공학: "machine",
  자연과학: "science",
  예체능: "stage",
  의학: "health",
};

// 학과군 실습과 이어지는 실제 과목(이 이름으로 시작하는 과목). 학과 교과목에 있으면 실습 학년을 이 과목 이름으로 보여주고,
// 하는 활동은 학과군 실습 그대로다. 실습 내용과 맞는 과목만 둔다(학과군 안에 성격이 다른 학과가 섞인 곳은 좁게).
export const PRACTICE_SUBJECTS = {
  computing: [/^알고리즘/, /^컴퓨터알고리즘/, /^자료구조/, /^데이터구조/],
  business: [/^재무회계/, /^중급회계/, /^회계원리/, /^회계학원론/, /^기초회계/, /^회계학$/],
  welfare: [/^사회보장론/, /^사회복지정책론?$/],
  sports: [/^운동학습/, /^스포츠심리학$/, /^운동행동/],
  education: [/^교육방법\s*및\s*교육공학/, /^교육공학/, /^교수설계/, /^교수학습이론/, /수업설계/],
  building: [/^건축시공/, /^건설시공/],
  machine: [/^창의적?공학설계/, /^공학설계입문/, /^공학입문설계/, /^기계설계$/],
  design: [/^디자인씽킹/, /^디자인방법론/, /^디자인프로세스/, /^서비스디자인/, /^(UI\/?)?UX\s*(\/UI)?\s*디자인/, /^사용자경험디자인/, /^디자인리서치/],
  music: [/^악기론/, /^관현악법/],
  stage: [/^영상제작/, /^영화제작/, /^방송(영상)?제작/],
  chemeng: [/^상하수도공학/, /^상수도공학/, /^수처리/, /^용수처리/, /^수질관리/],
  society: [/^법학개론/, /^법학입문/, /^법과사회/, /^생활(과)?법/],
  humanities: [/^역사학입문/, /^역사학개론/, /^사학개론/, /^역사학의이해/],
  science: [/^과학탐구/, /^일반화학(및)?실험/, /^일반물리학(및)?실험/, /^일반생물학(및)?실험/],
  health: [/^응급(및재난)?간호/, /^재난간호/, /^재난관리/, /^응급구조학개론/, /^응급환자평가/, /^전문응급처치학/],
  craft: [/^(기초|한국|서양)?의복구성/, /^어패럴메이킹/, /^패턴메이킹/, /^기초봉제/],
};

export function groupOf(course, category) {
  const name = typeof course === "string" ? course : "";
  return GROUPS.find((group) => group.match.test(name))?.id || FALLBACK[category] || "society";
}

export const groupName = (id) => GROUPS.find((group) => group.id === id)?.name || "";

// 학과군 데이터를 완성된 체험 데이터로 만든다. base가 있으면 experiences.js의 체험을 바탕으로 쓰고,
// options(계획서 칸별 보기)와 그 밖의 필드를 덮어쓴다.
export function buildGroupExperience(entry) {
  const { status, base, options, ...rest } = entry;
  const from = base ? experiences[base] : {};
  const data = { ...from, ...rest };
  if (options) data.prompts = (from.prompts || []).map((prompt, i) => ({ ...prompt, options: options[i] }));
  return data;
}

// 학과군의 체험(kind: "practice" | "final"). 별도 검토를 통과한(verified) 것만 쓰고, 없거나 형식이 틀리면 null이다.
export function groupExperience(id, kind) {
  const entry = groupData[id]?.[kind];
  if (!entry || entry.status !== "verified") return null;
  return cleanExperience(buildGroupExperience(entry));
}
