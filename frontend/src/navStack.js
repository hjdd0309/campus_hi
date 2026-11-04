// 화면 스택(App.jsx)의 key와 전환 중 잠깐 남는 화면(ghost) 규칙. 화면마다 key는 항상 고유해야 한다.
// key가 겹치면 React가 두 화면을 같은 것으로 보아 화면의 state(수업 단계, 쓰던 기록 등)가 섞이거나 화면이 빠질 수 있다.

let seed = 1;
// 새 화면. key는 이 페이지가 열려 있는 동안 늘어나기만 하는 번호라 겹치지 않는다.
export const makeRoute = (name, params) => ({ name, params, key: seed++ });

// 새로고침 뒤 sessionStorage에 저장된 스택([{ name, params }])을 다시 만든다. key는 저장하지 않고 새로 매긴다
// (예전에 저장된 스택에 key가 있어도 쓰지 않는다). 모르는 화면이 있으면 null(처음부터 시작).
// settled: 잠깐 보여주고 넘어가는 화면이 맨 위면 그다음 화면으로 바꾼다.
export function restoreStack(saved, screens, settled = {}) {
  if (!Array.isArray(saved) || !saved.length || !saved.every((r) => r && typeof r.name === "string" && Object.hasOwn(screens, r.name))) return null;
  return saved.map((r, i) => {
    const name = i === saved.length - 1 ? settled[r.name] || r.name : r.name;
    return makeRoute(name, r.params && typeof r.params === "object" ? r.params : undefined);
  });
}

// 전환 중 사라지는 화면을 ghost로 더한다. 이미 ghost이거나 새 스택에 남아 있는 화면은 다시 넣지 않는다
// (같은 순간에 화면 이동이 두 번 불리면 같은 화면이 두 번 들어와 key가 겹친다).
export function addGhost(ghosts, ghost, stack) {
  if (!ghost || ghosts.some((g) => g.route.key === ghost.route.key) || stack.some((r) => r.key === ghost.route.key)) return ghosts;
  return [...ghosts, ghost];
}
