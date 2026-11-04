import test from "node:test";
import assert from "node:assert/strict";
import { addGhost, makeRoute, restoreStack } from "./navStack.js";

const SCREENS = { splash: 1, home: 1, lesson: 1, elective: 1, grades: 1, graduation: 1 };
const keys = (routes) => routes.map((r) => r.key);
const unique = (list) => new Set(list).size === list.length;

test("새 화면의 key는 항상 고유하다", () => {
  const routes = Array.from({ length: 200 }, (_, i) => makeRoute(i % 2 ? "home" : "lesson"));
  assert.ok(unique(keys(routes)));
});

test("저장된 스택을 불러올 때 key를 새로 매기고, 이미 있는 화면과도 겹치지 않는다", () => {
  const before = [makeRoute("home"), makeRoute("lesson")];
  // 예전에 저장된 스택: key가 없거나, 있더라도(혹시 남은 값) 쓰지 않는다. params가 없거나 null이어도 된다.
  const saved = [{ name: "home" }, { name: "elective", params: { subject: "이산구조" }, key: before[0].key }, { name: "grades", params: null }];
  const restored = restoreStack(JSON.parse(JSON.stringify(saved)), SCREENS, { grades: "graduation" });
  assert.deepEqual(restored.map((r) => r.name), ["home", "elective", "graduation"]);
  assert.deepEqual(restored[1].params, { subject: "이산구조" });
  assert.equal(restored[2].params, undefined);
  assert.ok(unique([...keys(before), ...keys(restored)]));
  // 같은 저장 스택을 두 번 불러와도(StrictMode에서 초기화가 두 번 불려도) 겹치지 않는다.
  const again = restoreStack(saved, SCREENS, { grades: "graduation" });
  assert.ok(unique([...keys(restored), ...keys(again)]));
});

test("저장된 스택이 깨졌거나 모르는 화면이 있으면 처음부터 시작한다", () => {
  for (const saved of [null, undefined, "home", [], [null], [{}], [{ name: "home" }, { name: "없는화면" }], [{ name: "toString" }], { 0: { name: "home" } }])
    assert.equal(restoreStack(saved, SCREENS), null, JSON.stringify(saved));
});

test("같은 화면은 ghost로 두 번 들어가지 않고, 스택에 남은 화면도 ghost가 되지 않는다", () => {
  const home = makeRoute("home");
  const elective = makeRoute("elective", { subject: "이산구조" });
  // 화면 이동이 다시 그리기 전에 두 번 불린 경우: 같은 화면(elective)이 두 번 ghost로 온다.
  const next = [makeRoute("home")];
  let ghosts = addGhost([], { route: elective, cls: "out" }, next);
  ghosts = addGhost(ghosts, { route: elective, cls: "out" }, next);
  assert.deepEqual(keys(ghosts.map((g) => g.route)), [elective.key]);
  // 새 스택에 남아 있는 화면은 ghost로 넣지 않는다.
  assert.equal(addGhost(ghosts, { route: home, cls: "out" }, [home]), ghosts);
  assert.equal(addGhost(ghosts, null, next), ghosts);
  // 화면 층(스택 + ghost)의 key가 모두 다르다.
  assert.ok(unique([...keys(next), ...keys(ghosts.map((g) => g.route))]));
});
