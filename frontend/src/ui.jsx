import React, { useEffect, useId, useRef } from "react";
import { confetti, icon } from "./assets.js";

/** 뽑아낸 아이콘을 CSS 마스크로 그려 색을 입힐 수 있게 한다. */
export function Mask({ src, w, h, color = "currentColor", className = "", style }) {
  return (
    <span
      aria-hidden
      className={`block shrink-0 ${className}`}
      style={{
        width: w,
        height: h,
        background: color,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
        ...style,
      }}
    />
  );
}

const ARTBOARD_H = 874;
const GLYPH_OFFSET = 0.06;

/**
 * 시안의 글자 윗선(논리 px)에 맞춰 놓는 글. clip을 주면 그 폭을 넘는 글은 말줄임표로 자른다
 * (학교·학과 이름처럼 길이를 알 수 없는 글에 쓴다).
 */
export function T({ y, size, lh, left, right, center, clip, className = "", style, children }) {
  const lineHeight = lh ?? Math.round(size * 1.4);
  const top = y - (lineHeight - size) / 2 - size * GLYPH_OFFSET;
  const clipped = clip
    ? { maxWidth: clip, overflow: "hidden", textOverflow: "ellipsis" }
    : undefined;
  return (
    <div
      className={`absolute whitespace-pre ${center ? "left-0 right-0 text-center" : ""} ${center && clip ? "mx-auto" : ""} ${className}`}
      style={{ top, left, right, fontSize: size, lineHeight: `${lineHeight}px`, ...clipped, ...style }}
    >
      {children}
    </div>
  );
}

/**
 * 화면 하나. 아트보드 높이는 기기마다 달라서(App.jsx) 내용을 세 군데에 나눠 붙인다.
 * - children: 위쪽 기준. 시안의 좌표 그대로 놓는다. h(내용이 끝나는 y)를 주면 화면이 모자랄 때 세로로 스크롤된다.
 * - footer: 아래쪽 기준. 시안의 좌표 그대로 주면 화면 아래 끝에 붙는다. foot은 그 영역이 시작하는 y다.
 * - 가운데 기준으로 둘 것은 Center로 감싼다.
 */
export function Screen({ children, footer, foot = 740, veil = true, h, resetOn, bg = "#fff", className = "", overlay }) {
  const scroller = useRef(null);
  useEffect(() => {
    scroller.current.scrollTop = 0;
  }, [resetOn]);
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} style={{ background: bg }}>
      <div ref={scroller} className="no-scrollbar absolute inset-0 overflow-y-auto overflow-x-hidden">
        <div
          className="relative min-h-full"
          style={h ? { height: `calc(${h + (footer ? ARTBOARD_H - foot : 0)}px - (var(--tt) + var(--bt)) * 1px)` } : undefined}
        >
          <div className="absolute inset-x-0 bottom-0" style={{ top: "calc(var(--tt) * -1px)" }}>
            {children}
          </div>
        </div>
      </div>
      {footer && (
        <div
          className="pointer-events-none absolute inset-x-0 *:pointer-events-auto"
          style={{ height: ARTBOARD_H, bottom: "calc(var(--bt) * -1px)" }}
        >
          {/* 스크롤된 내용이 아래 버튼 뒤로 비치지 않게 가린다. */}
          {veil && (
            <div
              className="absolute inset-x-0 bottom-0"
              style={{ top: foot, background: `linear-gradient(transparent, ${veil === true ? bg : veil} 12px)` }}
            />
          )}
          {footer}
        </div>
      )}
      {/* 화면 전체를 덮는 것(확인 창, 알림). 스크롤과 상관없이 보이는 영역에 놓인다. */}
      {overlay}
    </div>
  );
}

/**
 * 확인 창. 화면을 어둡게 덮고 가운데에 띄운다. 열리면 첫 버튼에 초점을 두고, Tab은 창 안에서만 돌며,
 * Esc나 바깥을 누르면 닫힌다. 닫히면 열기 전에 초점이 있던 곳으로 돌려준다.
 */
export function Dialog({ title, children, actions, onClose }) {
  const box = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const opener = document.activeElement;
    box.current.querySelector("button:not([disabled])")?.focus({ preventScroll: true });
    return () => opener?.focus?.({ preventScroll: true });
  }, []);
  const keys = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
    if (e.key !== "Tab") return;
    const buttons = [...box.current.querySelectorAll("button:not([disabled])")];
    const at = buttons.indexOf(document.activeElement);
    const next = (at + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
    e.preventDefault();
    buttons[next]?.focus();
  };
  return (
    <div className="a-fade absolute inset-0 z-40 flex items-center justify-center bg-[rgba(32,43,60,0.42)] px-[24px]" onClick={onClose}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={keys}
        onClick={(e) => e.stopPropagation()}
        className="a-pop w-full max-w-[354px] rounded-[20px] bg-white px-[22px] pb-[18px] pt-[24px] shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
      >
        <h2 id={titleId} className="text-[18px] font-bold leading-[26px] text-ink-2" style={{ wordBreak: "keep-all" }}>
          {title}
        </h2>
        <div className="mt-[8px] text-[14px] leading-[22px] text-ink-3" style={{ wordBreak: "keep-all" }}>
          {children}
        </div>
        <div className="mt-[20px] grid gap-[8px]">{actions}</div>
      </div>
    </div>
  );
}

/** 잠깐 떴다 사라지는 알림. 스크린 리더도 읽는다. */
export function Toast({ children }) {
  return (
    <div role="status" className="pointer-events-none absolute inset-x-[20px] z-50 flex justify-center" style={{ bottom: "calc(150px - var(--bt) * 1px)" }}>
      {children && (
        <p className="a-up rounded-full bg-navy/90 px-[18px] py-[10px] text-center text-[13.5px] font-medium leading-[20px] text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          {children}
        </p>
      )}
    </div>
  );
}

/** 화면 가운데를 기준으로 놓는 내용(마스코트, 증명서). 안에는 시안의 좌표를 그대로 쓴다. */
export function Center({ children }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-x-0 top-1/2" style={{ height: ARTBOARD_H, marginTop: -ARTBOARD_H / 2 }}>
        {children}
      </div>
    </div>
  );
}

export function BackButton({ onClick, color = "#949494" }) {
  return (
    <button
      aria-label="뒤로"
      onClick={onClick}
      className="pressable absolute left-[17px] top-[51px] z-20 flex h-[40px] w-[40px] items-center justify-center"
    >
      <Mask src={icon.back} w={16} h={24} color={color} />
    </button>
  );
}

export function Header({ title, count, onBack, backColor }) {
  return (
    <>
      {onBack && <BackButton onClick={onBack} color={backColor} />}
      {title && (
        <div className="absolute left-[70px] right-[70px] top-[60px] overflow-hidden text-ellipsis whitespace-nowrap text-center text-[14px] leading-[22px] text-mint">
          {title}
        </div>
      )}
      {count && (
        <div className="absolute right-[35px] top-[60px] text-[14px] leading-[22px] text-mint tabular-nums">
          {count}
        </div>
      )}
    </>
  );
}

export function ProgressBar({ value }) {
  return (
    <div className="absolute left-[24px] top-[103px] h-[8px] w-[354px] overflow-hidden rounded-full bg-track">
      <div
        className="h-full rounded-full bg-mint"
        style={{ width: `${value * 100}%`, transition: "width 0.7s cubic-bezier(0.22, 1, 0.36, 1)" }}
      />
    </div>
  );
}

export function OutlineButton({ children, onClick, top = 756, className = "", style }) {
  return (
    <button
      onClick={onClick}
      className={`pressable absolute left-[20px] z-10 flex h-[68px] w-[362px] items-center justify-center rounded-[18px] border border-mint bg-white px-[16px] text-[20px] font-medium text-mint active:bg-mint-soft ${className}`}
      style={{ top, ...style }}
    >
      <span className="overflow-hidden text-ellipsis whitespace-nowrap">{children}</span>
    </button>
  );
}

/** 민트색이 꽉 찬 버튼(홈의 시작 버튼과 같은 모양). 화면 아래의 주 행동에 쓴다. */
export function FilledButton({ children, onClick, disabled, top = 752, className = "", style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`pressable absolute left-[20px] z-10 flex h-[56.5px] w-[362px] items-center justify-center rounded-[14px] bg-mint px-[16px] text-[17.5px] font-semibold text-white active:brightness-95 disabled:cursor-default disabled:opacity-40 ${className}`}
      style={{ top, ...style }}
    >
      <span className="overflow-hidden text-ellipsis whitespace-nowrap">{children}</span>
    </button>
  );
}

/** 모서리가 접힌 종이. 입학증·성적표·졸업증명서에 쓴다. */
export function Paper({ children, className = "", style }) {
  return (
    <div
      className={`absolute left-[64px] top-[254px] h-[365px] w-[273px] rounded-[8px] bg-white ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function PaperFold({ src, delay: wait = 0.35 }) {
  return (
    <img
      src={src}
      alt=""
      className="absolute left-0 top-0 h-[58px] w-[58px] origin-top-left"
      style={{ animation: `fold-in 0.6s cubic-bezier(0.34,1.56,0.64,1) ${wait}s both` }}
    />
  );
}

/** 색종이가 마스코트에서 튀어나와 제자리로 날아간 뒤 살랑거린다. */
export function Confetti({ originX = 201, originY = 200, delay: wait = 0.15 }) {
  return (
    <>
      {confetti.map((p, i) => {
        const dx = originX - (p.x + p.w / 2);
        const dy = originY - (p.y + p.h / 2);
        return (
          <span
            key={i}
            className="pointer-events-none absolute z-10"
            style={{
              left: p.x,
              top: p.y,
              width: p.w,
              height: p.h,
              animation: `confetti 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${wait + i * 0.025}s both`,
              "--dx": `${dx}px`,
              "--dy": `${dy}px`,
              "--r": `${(i % 2 ? 1 : -1) * 160}deg`,
            }}
          >
            <img
              src={p.src}
              alt=""
              className="loop block h-full w-full"
              style={{ animation: `drift ${2.6 + (i % 3) * 0.5}s ease-in-out ${1.1 + i * 0.12}s infinite` }}
            />
          </span>
        );
      })}
    </>
  );
}

export function delay(s) {
  return { animationDelay: `${s}s` };
}
