// 학교 로고 규칙. 화면 부품은 ui.jsx의 SchoolLogo다.
// 공식 로고 이미지는 출처를 확인해 저장소에 넣은 제휴 학교 것만 쓴다(외부에서 받아 오거나 새로 지어 넣지 않는다).
// 값은 assets.js의 img 이름이다: logo는 학교 카드의 로고, seal은 증명서 도장.
export const SCHOOL_LOGOS = {
  경희대학교: { logo: "khuLogo", seal: "seal" },
};

// 로고 이미지를 쓸 수 있는 학교면 그 이미지 이름, 아니면 null(텍스트 아바타). 제휴 학교이고 이미지가 있어야 한다.
export function logoImage(school, partner, kind = "logo") {
  if (partner !== true || typeof school !== "string" || !Object.hasOwn(SCHOOL_LOGOS, school)) return null;
  return SCHOOL_LOGOS[school][kind] || null;
}

// 텍스트 아바타의 글자: 실제 학교 이름의 앞 두 글자. 국립·사립·(주)·학교법인 같은 앞말과 괄호 안 글(캠퍼스 등), 띄어쓰기는 뺀다.
// 이모지 등 두 칸짜리 문자도 반쪽이 나지 않게 문자 단위로 자른다.
export function schoolInitials(school) {
  const raw = typeof school === "string" ? school.trim() : "";
  const name = raw
    .replace(/\(주\)|㈜/g, "")
    .replace(/^(국립|사립|공립|학교법인)\s*/, "")
    .replace(/\([^)]*\)|（[^）]*）/g, "")
    .replace(/\s+/g, "");
  return Array.from(name || raw.replace(/\s+/g, "")).slice(0, 2).join("").toUpperCase();
}

// 텍스트 아바타의 바탕색. index.css의 디자인 토큰 중 연한 색 6개이고, 글자는 모두 ink-2(#302b27)라 대비가 충분하다.
export const AVATAR_COLORS = ["#e8faf7", "#fffaea", "#feeaa0", "#ecede9", "#fee99a", "#e2e5e8"];
// 같은 학교는 늘 같은 색: 이름의 문자 코드로 만든 해시로 고른다.
export function avatarColor(school) {
  let hash = 0;
  for (const char of String(school ?? "")) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
