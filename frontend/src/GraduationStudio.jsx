import React, { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";

const W = 640,
  H = 660;
const colors = [
  ["민트", "#27d8cd"],
  ["라벤더", "#9584df"],
  ["코랄", "#fa8070"],
  ["노랑", "#f3c94f"],
  ["파랑", "#5498dc"],
];
const silhouette = () =>
  new Path2D(
    "M224 151 381 162 405 205 472 221 518 311 473 351 398 377 389 453 280 480 223 454 203 383 143 332 166 258 203 224Z",
  );

export function ArtworkPreview({ src }) {
  return (
    <div className="artwork-preview">
      <svg viewBox="0 0 640 660" aria-hidden="true">
        <path
          d="M224 151 381 162 405 205 472 221 518 311 473 351 398 377 389 453 280 480 223 454 203 383 143 332 166 258 203 224Z"
          fill="#dddcd3"
          stroke="#595749"
          strokeWidth="7"
        />
        <path
          d="m224 151 95 151 62-140-4 127 95-68-11 111-142-30 79 75-9 76-70-151-96 152-20-71 116-81-153-44 37-34Z"
          fill="#b5b6ad"
        />
      </svg>
      <img src={src} alt="나의 졸업작품" />
    </div>
  );
}

export default function GraduationStudio({ value, onChange }) {
  const canvasRef = useRef(null);
  const callback = useRef(onChange);
  const frame = useRef(0);
  const drawing = useRef(false);
  const touched = useRef(false);
  const position = useRef({ x: 320, y: 290 });
  const colorRef = useRef(colors[0][1]);
  const radiusRef = useRef(28);
  const undoRef = useRef([]);
  const mounted = useRef(true);
  const [color, setColor] = useState(colors[0][1]);
  const [radius, setRadius] = useState(28);
  const [cursor, setCursor] = useState({ x: 320, y: 290 });
  const [spraying, setSpraying] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [hasPaint, setHasPaint] = useState(!!value);
  const [notice, setNotice] = useState("");
  callback.current = onChange;
  colorRef.current = color;
  radiusRef.current = radius;

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    const canvas = canvasRef.current;
    if (value) {
      const image = new Image();
      image.onload = () => {
        if (!cancelled) {
          const ctx = canvas.getContext("2d");
          ctx.clearRect(0, 0, W, H);
          ctx.drawImage(image, 0, 0, W, H);
        }
      };
      image.src = value;
    }
    return () => {
      cancelled = true;
      mounted.current = false;
      drawing.current = false;
      cancelAnimationFrame(frame.current);
    };
  }, []);

  function stamp(x, y) {
    const ctx = canvasRef.current.getContext("2d");
    const mask = silhouette();
    const r = radiusRef.current;
    ctx.save();
    ctx.clip(mask);
    ctx.fillStyle = colorRef.current;
    for (let i = 0; i < 85; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.sqrt(Math.random()) * r;
      const px = x + Math.cos(angle) * distance,
        py = y + Math.sin(angle) * distance;
      if (ctx.isPointInPath(mask, px, py)) touched.current = true;
      ctx.globalAlpha = 0.1 + (1 - distance / r) * 0.35;
      ctx.beginPath();
      ctx.arc(px, py, 0.7 + Math.random() * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  function tick() {
    if (!drawing.current) return;
    stamp(position.current.x, position.current.y);
    frame.current = requestAnimationFrame(tick);
  }
  function start(x, y) {
    if (drawing.current) return;
    undoRef.current.push({
      image: canvasRef.current.toDataURL("image/png"),
      hasPaint,
    });
    if (undoRef.current.length > 12) undoRef.current.shift();
    touched.current = false;
    drawing.current = true;
    position.current = { x, y };
    setCursor({ x, y });
    setSpraying(true);
    tick();
  }
  function move(x, y) {
    const previous = position.current;
    if (drawing.current) {
      const distance = Math.hypot(x - previous.x, y - previous.y);
      const steps = Math.max(1, Math.ceil(distance / 5));
      for (let i = 1; i <= steps; i++)
        stamp(
          previous.x + ((x - previous.x) * i) / steps,
          previous.y + ((y - previous.y) * i) / steps,
        );
    }
    position.current = { x, y };
    setCursor({ x, y });
  }
  function stop() {
    if (!drawing.current) return;
    drawing.current = false;
    cancelAnimationFrame(frame.current);
    setSpraying(false);
    if (touched.current) {
      setHasPaint(true);
      setUndoCount(undoRef.current.length);
      callback.current(canvasRef.current.toDataURL("image/png"));
      setNotice("색을 칠했어요. 작품이 저장됐어요.");
    } else {
      undoRef.current.pop();
      setNotice("가운데 작품 위로 스프레이를 움직여주세요.");
    }
  }
  function point(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(W, ((event.clientX - rect.left) * W) / rect.width),
      ),
      y: Math.max(
        0,
        Math.min(H, ((event.clientY - rect.top) * H) / rect.height),
      ),
    };
  }
  function undo() {
    const last = undoRef.current.pop();
    if (!last) return;
    const ctx = canvasRef.current.getContext("2d");
    const image = new Image();
    image.onload = () => {
      if (!mounted.current) return;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(image, 0, 0);
      setHasPaint(last.hasPaint);
      callback.current(last.hasPaint ? last.image : "");
      setUndoCount(undoRef.current.length);
    };
    image.src = last.image;
  }
  function clear() {
    stop();
    undoRef.current.push({
      image: canvasRef.current.toDataURL("image/png"),
      hasPaint,
    });
    if (undoRef.current.length > 12) undoRef.current.shift();
    canvasRef.current.getContext("2d").clearRect(0, 0, W, H);
    setHasPaint(false);
    setUndoCount(undoRef.current.length);
    callback.current("");
    setNotice("새로운 색으로 다시 시작해요.");
  }
  function download() {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f4f2e8";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#e1e0d8";
    ctx.fill(silhouette());
    ctx.drawImage(canvasRef.current, 0, 0);
    ctx.strokeStyle = "#453f34";
    ctx.lineWidth = 7;
    ctx.stroke(silhouette());
    canvas.toBlob((blob) => {
      if (!blob) {
        setNotice("작품 파일을 만들지 못했어요. 다시 시도해주세요.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "하이캠퍼스-졸업작품.png";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }, "image/png");
  }
  return (
    <section
      className="graduation-studio"
      aria-label="졸업작품 도색 작업실"
    >
      <div className="studio-heading">
        <span className="tag">마지막 학년</span>
        <h2>졸업작품</h2>
        <p>스프레이를 드래그해서 나만의 색을 입혀요.</p>
      </div>
      <div className="studio-scene" style={{ "--spray-color": color }}>
        <svg className="workshop" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <defs>
            <linearGradient id="room" x2="0" y2="1">
              <stop stopColor="#78847c" />
              <stop offset="1" stopColor="#b4a590" />
            </linearGradient>
            <linearGradient id="table" x2="1" y2="1">
              <stop stopColor="#c6bda4" />
              <stop offset="1" stopColor="#9c917c" />
            </linearGradient>
          </defs>
          <rect width="640" height="660" fill="url(#room)" />
          <path d="M0 0h640v53H0zM0 126h640v18H0z" fill="#514f48" />
          <path d="M0 47h640M0 138h640" stroke="#c2c9b3" strokeWidth="8" />
          {[26, 142, 467, 574].map((x, i) => (
            <g key={x}>
              <rect
                x={x}
                y={55}
                width="60"
                height="69"
                rx="8"
                fill={["#9aa79b", "#c09a91", "#769590", "#bda084"][i]}
              />
              <rect
                x={x + 12}
                y="40"
                width="37"
                height="20"
                rx="5"
                fill="#4b514c"
              />
              <path d={`M${x + 12} 87h36`} stroke="#d9d8c7" strokeWidth="8" />
            </g>
          ))}
          <path
            d="M0 239 81 212l51 215L0 454Zm640-28-83 28-44 199 127 19Z"
            fill="#777c6c"
            opacity=".7"
          />
          <path d="M0 387 640 377v283H0Z" fill="url(#table)" />
          <ellipse
            cx="333"
            cy="468"
            rx="197"
            ry="32"
            fill="#564e40"
            opacity=".23"
          />
          <path
            d="M224 151 381 162 405 205 472 221 518 311 473 351 398 377 389 453 280 480 223 454 203 383 143 332 166 258 203 224Z"
            fill="#dadbd4"
            stroke="#443f36"
            strokeWidth="17"
            strokeLinejoin="round"
          />
          <path
            d="m224 151 95 151 62-140-4 127 95-68-11 111-142-30 79 75-9 76-70-151-96 152-20-71 116-81-153-44 37-34Z"
            fill="#b5b6ad"
          />
          <path
            d="m224 151 95 151 62-140Zm95 151 153-81 46 90Zm0 0-116-78-37 34Z"
            fill="#f1f2e8"
          />
          <path d="m319 302 79 75-9 76Z" fill="#949a92" />
          <rect
            x="63"
            y="475"
            width="110"
            height="107"
            rx="9"
            fill="#444743"
            stroke="#ccc9ba"
            strokeWidth="8"
          />
          <path
            d="m160 660 36-116m15 116 31-137m18 137 23-120m10 120 28-117"
            stroke="#53675f"
            strokeWidth="20"
            strokeLinecap="round"
          />
          <path
            d="m170 655 34-106m20 104 26-122m25 122 14-104"
            stroke="#99b2a8"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <path
            d="M0 452q35-28 70 5l47 46q27 48-22 65-26 23-53-8L0 544Z"
            fill="#fffef5"
            stroke="#463527"
            strokeWidth="16"
          />
          <path
            d="M640 457q-26-28-61-10l-36 38q-24-40-52-15-32 31-7 77 19 44 52 36 35 3 54-29l50-34Z"
            fill="#fffef5"
            stroke="#463527"
            strokeWidth="16"
          />
        </svg>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          tabIndex={0}
          aria-label="졸업작품 도색 캔버스. 드래그하여 칠하기. 키보드는 방향키로 이동하고 스페이스를 눌러 분사."
          onPointerDown={(e) => {
            if (e.button !== 0 || drawing.current) return;
            e.preventDefault();
            e.currentTarget.focus();
            e.currentTarget.setPointerCapture(e.pointerId);
            const p = point(e);
            start(p.x, p.y);
          }}
          onPointerMove={(e) => {
            const p = point(e);
            move(p.x, p.y);
          }}
          onPointerUp={stop}
          onPointerCancel={stop}
          onLostPointerCapture={stop}
          onBlur={stop}
          onKeyDown={(e) => {
            if (e.key === " ") {
              e.preventDefault();
              if (!e.repeat) start(position.current.x, position.current.y);
            } else if (
              ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                e.key,
              )
            ) {
              e.preventDefault();
              move(
                Math.max(
                  0,
                  Math.min(
                    W,
                    position.current.x +
                      (e.key === "ArrowRight"
                        ? 15
                        : e.key === "ArrowLeft"
                          ? -15
                          : 0),
                  ),
                ),
                Math.max(
                  0,
                  Math.min(
                    H,
                    position.current.y +
                      (e.key === "ArrowDown"
                        ? 15
                        : e.key === "ArrowUp"
                          ? -15
                          : 0),
                  ),
                ),
              );
            }
          }}
          onKeyUp={(e) => {
            if (e.key === " ") {
              e.preventDefault();
              stop();
            }
          }}
        >
          드래그하거나 방향키와 스페이스로 졸업작품을 도색하세요.
        </canvas>
        <div
          className={`spray-cursor ${spraying ? "spraying" : ""}`}
          style={{
            left: `${(cursor.x / W) * 100}%`,
            top: `${(cursor.y / H) * 100}%`,
          }}
          aria-hidden="true"
        >
          <span className="spray-cloud" />
          <svg viewBox="0 0 85 150">
            <defs>
              <linearGradient id="can" x2="1">
                <stop stopColor="#101819" />
                <stop offset=".5" stopColor="#4d5554" />
                <stop offset="1" stopColor="#0c1314" />
              </linearGradient>
            </defs>
            <g transform="rotate(18 40 70)" stroke="#fbfcf6" strokeWidth="3">
              <rect
                x="30"
                y="12"
                width="22"
                height="15"
                rx="4"
                fill="#c4cbc6"
              />
              <rect
                x="25"
                y="23"
                width="34"
                height="13"
                rx="6"
                fill="#343d3b"
              />
              <rect
                x="17"
                y="33"
                width="50"
                height="104"
                rx="12"
                fill="url(#can)"
              />
              <path d="M20 51h44M23 127h39" />
              <path d="M28 67h29v31H28Z" fill={color} stroke="none" />
              <path d="M36 17h8" stroke="#151e1c" />
            </g>
          </svg>
        </div>
        <span className="studio-caption">
          {spraying
            ? "칙— 나만의 색을 입히는 중"
            : hasPaint
              ? "멋져요! 다른 색도 겹쳐보세요"
              : "가운데 작품 위를 드래그해보세요"}
        </span>
      </div>
      <div className="studio-controls">
        <div className="paint-colors" role="group" aria-label="스프레이 색상">
          {colors.map(([name, hex]) => (
            <button
              key={hex}
              aria-label={`${name} 스프레이`}
              aria-pressed={color === hex}
              style={{ background: hex }}
              onClick={() => setColor(hex)}
            >
              {color === hex && <Icon name="check" size={16} />}
            </button>
          ))}
        </div>
        <label className="spray-size">
          분사 크기
          <input
            aria-label="분사 크기"
            type="range"
            min="12"
            max="55"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
          />
        </label>
        <div className="studio-actions">
          <button disabled={!undoCount} onClick={undo}>
            되돌리기
          </button>
          <button disabled={!hasPaint} onClick={clear}>
            다시 칠하기
          </button>
          <button disabled={!hasPaint} onClick={download}>
            <Icon name="download" size={14} /> 작품 저장
          </button>
        </div>
      </div>
      <span className="sr-only" role="status">
        {notice}
      </span>
    </section>
  );
}
