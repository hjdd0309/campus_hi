import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SCREENS } from "./screens.jsx";
import { STORAGE_KEY, loadState } from "./model.js";

// 화면은 402×874 아트보드에 맞춰 그리고, 창 크기에 맞게 통째로 줄이거나 늘린다.
const W = 402;
const H = 874;
const DURATION = 520;
const STACK_KEY = "hi-campus-stack";

const ENTER = { push: "tr-push-in", fade: "tr-fade-in", rise: "tr-rise-in" };
const EXIT = { push: "tr-push-out", fade: "tr-fade-out", rise: "tr-fade-out" };
// 잠깐 보여주고 넘어가는 화면. 새로고침으로 돌아왔을 때는 그다음 화면을 보여준다.
const SETTLED = { loading: "result", enrolled: "welcome", grades: "graduation", diploma: "graduation" };

let keySeed = 1;
const make = (name, params) => ({ name, params, key: keySeed++ });

function initialStack(state) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STACK_KEY));
    if (Array.isArray(saved) && saved.length && saved.every((r) => r && r.name in SCREENS))
      return saved.map((r, i) =>
        make(i === saved.length - 1 ? SETTLED[r.name] || r.name : r.name, r.params || undefined),
      );
  } catch {
    // 저장된 화면 기록을 읽을 수 없으면 처음부터 시작한다.
  }
  return [make(Object.keys(state.journeys).length ? "home" : "splash")];
}

function useFitScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () =>
      setScale(
        Math.min(
          window.innerWidth / W,
          window.innerHeight / H,
          window.innerWidth < 520 ? Infinity : 1,
        ),
      );
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return scale;
}

export default function App() {
  const [state, setState] = useState(() => loadState(window.localStorage));
  const [stack, setStack] = useState(() => initialStack(state));
  const [ghosts, setGhosts] = useState([]);
  const [anim, setAnim] = useState({});
  const [busy, setBusy] = useState(false);
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const scale = useFitScale();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 저장 공간을 쓸 수 없으면 이번 방문 동안만 기록이 유지된다.
    }
  }, [state]);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        STACK_KEY,
        JSON.stringify(stack.map(({ name, params }) => ({ name, params }))),
      );
    } catch {
      // 화면 기록을 저장하지 못해도 사용에는 지장이 없다.
    }
  }, [stack]);

  const run = useCallback((next, enter, exitKey, exitCls, ghost) => {
    const top = next[next.length - 1];
    const map = { [top.key]: enter };
    if (exitKey !== null) map[exitKey] = exitCls;
    setAnim(map);
    if (ghost) setGhosts((g) => [...g, { route: ghost, cls: exitCls }]);
    setStack(next);
    setBusy(true);
    window.setTimeout(() => {
      setAnim({});
      setBusy(false);
      if (ghost) setGhosts((g) => g.filter((x) => x.route.key !== ghost.key));
    }, DURATION);
  }, []);

  const nav = useMemo(
    () => ({
      push: (name, params, tr = "push") => {
        const cur = stackRef.current;
        const prev = cur[cur.length - 1];
        run([...cur, make(name, params)], ENTER[tr], prev.key, EXIT[tr], null);
      },
      replace: (name, params, tr = "fade") => {
        const cur = stackRef.current;
        const prev = cur[cur.length - 1];
        run([...cur.slice(0, -1), make(name, params)], ENTER[tr], null, EXIT[tr], prev);
      },
      reset: (names, tr = "fade") => {
        const cur = stackRef.current;
        const prev = cur[cur.length - 1];
        run(names.map((n) => make(n)), ENTER[tr], null, EXIT[tr], prev);
      },
      back: () => {
        const cur = stackRef.current;
        if (cur.length <= 1) return;
        const prev = cur[cur.length - 1];
        run(cur.slice(0, -1), "tr-pop-in", null, "tr-pop-out", prev);
      },
    }),
    [run],
  );

  // 브라우저의 뒤로 가기를 앱의 이전 화면으로 연결한다. 더 돌아갈 화면이 없으면 브라우저에 맡긴다.
  useEffect(() => {
    if (!history.state?.hiCampus) history.pushState({ hiCampus: true }, "");
    const onPop = () => {
      if (stackRef.current.length <= 1) return;
      nav.back();
      history.pushState({ hiCampus: true }, "");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [nav]);

  const top = stack[stack.length - 1];
  const layers = [
    ...stack.map((route) => ({
      route,
      cls: anim[route.key] ?? (route.key === top.key ? "" : "invisible pointer-events-none"),
      ghost: false,
    })),
    ...ghosts.map((g) => ({ route: g.route, cls: `${g.cls} pointer-events-none`, ghost: true })),
  ];

  return (
    <main className="flex h-full w-full items-center justify-center bg-white min-[520px]:bg-[#e9ecef]">
      <div className="relative shrink-0 overflow-hidden" style={{ width: W * scale, height: H * scale }}>
        <div
          className="absolute left-1/2 top-1/2"
          style={{ width: W, height: H, marginLeft: -W / 2, marginTop: -H / 2 }}
        >
          <div
            className="relative overflow-hidden bg-white"
            style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "center center" }}
          >
            {layers.map(({ route, cls, ghost }) => {
              const S = SCREENS[route.name];
              return (
                <div
                  key={route.key}
                  className={`absolute inset-0 ${cls}`}
                  style={ghost ? { zIndex: 3 } : undefined}
                  aria-hidden={route.key !== top.key}
                >
                  <S
                    nav={nav}
                    route={route}
                    state={state}
                    setState={setState}
                    active={!ghost && route.key === top.key}
                  />
                </div>
              );
            })}
            {busy && <div className="absolute inset-0 z-50" />}
          </div>
        </div>
      </div>
    </main>
  );
}
