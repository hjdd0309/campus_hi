import React from "react";

export default function Mascot({ variant = "hello", small = false }) {
  const student = variant !== "hello";
  return (
    <svg
      className={`mascot ${small ? "small" : ""}`}
      viewBox="0 0 200 190"
      role="img"
      aria-label={
        variant === "graduate"
          ? "졸업 모자를 쓴 하이캠퍼스 캐릭터"
          : "반갑게 인사하는 하이캠퍼스 캐릭터"
      }
    >
      <g
        stroke="#423222"
        strokeWidth="3.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {student && (
          <>
            <path
              d="M81 148q-22 26-28 10l12-15m45 3q-5 29 12 15l9-19"
              fill="#fff9e8"
            />
            {variant !== "graduate" && (
              <>
                <path d="M101 53q-4-25 9-36l-22 9 14 7" fill="#8a663b" />
                <path d="M87 56q0-28 25-23l10 23" fill="#ffe48c" />
                <path d="M103 34v21" stroke="#1bcabd" />
              </>
            )}
          </>
        )}
        <rect
          x={student ? 44 : 42}
          y={student ? 55 : 31}
          width={student ? 115 : 120}
          height={student ? 96 : 120}
          rx={student ? 6 : 36}
          fill="#ffe58c"
        />
        <path
          d={
            student
              ? "M44 113h115v32q0 6-6 6H50q-6 0-6-6Z"
              : "M42 101h120v14q0 36-36 36H78q-36 0-36-36Z"
          }
          fill="#24cdbb"
        />
        <path
          d={student ? "M76 78v16m22-16v16" : "M72 72v15"}
          strokeWidth="7"
        />
        {!student && (
          <>
            <path d="M94 83q9-11 19-2M63 47q14 5 16 16" fill="none" />
            <path
              d="M42 98c-9-17-21-7-16 8-2 14 13 22 20 11l7-10q3-10-11-9Zm89 8c-7-16-20-9-15 2-3 15 9 25 17 12l9-16q-2-9-11 2Z"
              fill="#fffdf4"
            />
          </>
        )}
        {student && (
          <>
            <circle cx="37" cy="114" r="9" fill="#fffdf4" />
            <circle cx="130" cy="116" r="9" fill="#fffdf4" />
            <path d="M76 112q9 7 16 0" fill="none" />
          </>
        )}
        {variant === "study" && (
          <>
            <path d="m144 139 40 5-5 9-38-4Z" fill="#fff9e8" />
            <path d="m146 153 34 3" />
          </>
        )}
        {variant === "graduate" && (
          <>
            <path d="m82 36 29-13 30 13-30 13Z" fill="#24cdbb" />
            <path d="M95 43v12q17 8 31-2V43" fill="#24cdbb" />
            <path d="M141 36v20" />
            <path
              d="m66 22-4-6m89 55 5-4M89 14l1-6m53 6 4-5"
              strokeWidth="2.5"
            />
          </>
        )}
      </g>
    </svg>
  );
}
