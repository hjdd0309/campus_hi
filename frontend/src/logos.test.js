import test from "node:test";
import assert from "node:assert/strict";
import { AVATAR_COLORS, SCHOOL_LOGOS, avatarColor, logoImage, schoolInitials } from "./logos.js";

test("로고 이미지는 제휴 학교이고 이미지가 있을 때만 쓴다", () => {
  assert.equal(logoImage("경희대학교", true), "khuLogo");
  assert.equal(logoImage("경희대학교", true, "seal"), "seal");
  // 제휴가 아니면(예시 여부를 모르는 옛 기록 포함) 이미지가 있어도 텍스트 아바타다.
  assert.equal(logoImage("경희대학교", false), null);
  assert.equal(logoImage("경희대학교", undefined), null);
  // 이름이 비슷한 다른 학교, 이미지가 없는 제휴 학교도 텍스트 아바타다.
  assert.equal(logoImage("경희사이버대학교", true), null);
  assert.equal(logoImage("가나대학교", true), null);
  assert.equal(logoImage("경희대학교", true, "banner"), null);
  assert.equal(logoImage(null, true), null);
  assert.deepEqual(Object.keys(SCHOOL_LOGOS), ["경희대학교"]);
});

test("텍스트 아바타는 앞말과 괄호를 뺀 실제 학교 이름의 앞 두 글자다", () => {
  assert.equal(schoolInitials("경기대학교"), "경기");
  assert.equal(schoolInitials("서울대학교"), "서울");
  assert.equal(schoolInitials("국립강릉원주대학교"), "강릉");
  assert.equal(schoolInitials("사립 가나대학교"), "가나");
  assert.equal(schoolInitials("(주)다라대학교"), "다라");
  assert.equal(schoolInitials("고려대학교(세종)"), "고려");
  assert.equal(schoolInitials("한양대학교(ERICA)"), "한양");
  assert.equal(schoolInitials("한국폴리텍 I 대학 서울강서캠퍼스"), "한국");
  assert.equal(schoolInitials("kaist"), "KA");
  assert.equal(schoolInitials("  경  "), "경");
  // 앞말만 있는 이름은 지우지 않고 그대로 쓴다.
  assert.equal(schoolInitials("국립"), "국립");
  assert.equal(schoolInitials("🎓대학"), "🎓대");
  assert.equal(schoolInitials(undefined), "");
});

test("텍스트 아바타 색은 연한 토큰 색 중 하나이고, 같은 학교는 늘 같은 색이다", () => {
  assert.ok(AVATAR_COLORS.length >= 6 && AVATAR_COLORS.length <= 8);
  const schools = ["경기대학교", "서울대학교", "가천대학교", "한양대학교(ERICA)", "국립목포대학교", "부산대학교", "전남대학교", "연세대학교"];
  for (const school of schools) {
    assert.ok(AVATAR_COLORS.includes(avatarColor(school)));
    assert.equal(avatarColor(school), avatarColor(school));
  }
  // 여러 학교가 한 색으로 몰리지 않는다.
  assert.ok(new Set(schools.map(avatarColor)).size >= 3);
  // 글자색(ink-2 #302b27)과의 대비가 7:1 이상이다.
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const color of AVATAR_COLORS) assert.ok((luminance(color) + 0.05) / (luminance("#302b27") + 0.05) >= 7, color);
});
