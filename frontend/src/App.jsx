import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SCREENS } from "./screens.jsx";
import { STORAGE_KEY, loadState } from "./model.js";

// 화면은 402×874 아트보드에 맞춰 그리고, 창 크기에 맞게 통째로 줄이거나 늘린다.
const W = 402;
const H = 874;
// 휴대폰에서 아트보드가 이보다 낮아지면 폭을 채우지 않고 높이에 맞춰 줄인다.
const MIN_H = 560;
// 시안에서 기기 상태바와 홈 인디케이터 자리였던 위아래 여백. 높이가 모자라면 이만큼까지 먼저 줄인다.
const TRIM_TOP = 32;
const TRIM_BOTTOM = 28;
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

// 폭이 좁은 화면(휴대폰)에서는 폭을 꽉 채우고 아트보드의 높이를 화면에 맞춘다. 주소창 때문에 화면이
// 시안보다 납작해도 양옆이 비지 않는다. 넓은 화면에서는 시안 비율 그대로 가운데에 둔다.
function fit(vw, vh) {
  if (vw >= 520) return { scale: Math.min(1, vw / W, vh / H), height: H };
  const scale = Math.min(vw / W, vh / MIN_H);
  return { scale, height: vh / scale };
}

// 창 크기가 아니라 실제로 그려지는 영역(main)을 재서 맞춘다. 모바일 브라우저는 주소창·도구 막대 때문에
// 창 높이와 보이는 영역이 다를 수 있다.
function useFit(ref) {
  const [box, setBox] = useState(() => fit(window.innerWidth, window.innerHeight));
  useLayoutEffect(() => {
    const el = ref.current;
    const update = () =>
      setBox((cur) => {
        const next = fit(el.clientWidth, el.clientHeight);
        return next.scale === cur.scale && next.height === cur.height ? cur : next;
      });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return box;
}

export default function App() {
  const [state, setState] = useState(() => loadState(window.localStorage));
  const [stack, setStack] = useState(() => initialStack(state));
  const [ghosts, setGhosts] = useState([]);
  const [anim, setAnim] = useState({});
  const [busy, setBusy] = useState(false);
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const stage = useRef(null);
  const { scale, height } = useFit(stage);
  const short = Math.max(0, H - height);
  const trimBottom = Math.min(short, TRIM_BOTTOM);
  const trimTop = Math.min(short - trimBottom, TRIM_TOP);

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
    <main ref={stage} className="stage flex w-full items-center justify-center bg-white min-[520px]:bg-[#e9ecef]">
      <div className="relative shrink-0 overflow-hidden" style={{ width: W * scale, height: height * scale }}>
        <div
          className="absolute left-0 top-0 overflow-hidden bg-white"
          style={{
            width: W,
            height,
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
            "--vh": height,
            "--tt": trimTop,
            "--bt": trimBottom,
          }}
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
    </main>
  );
}
