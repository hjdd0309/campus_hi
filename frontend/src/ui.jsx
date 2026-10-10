import React from "react";
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

export function Screen({ children, bg = "#fff", className = "" }) {
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} style={{ background: bg }}>
      {children}
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
