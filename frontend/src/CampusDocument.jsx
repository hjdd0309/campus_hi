import React from "react";
import Icon from "./Icon.jsx";

export const documentTitles = {
  admission: "체험 입학증",
  transcript: "체험 성적표",
  diploma: "체험 졸업증명서",
};

export default function CampusDocument({ type, department, completed, onNext }) {
  return (
    <div className="document-scene">
      <article className="document-paper" aria-label={documentTitles[type]}>
        <span className="document-fold" aria-hidden="true" />
        <h3>{documentTitles[type]}</h3>
        <p className="document-school">{department.school || "미래캠퍼스"}</p>
        <strong>{department.name}</strong>
        {type === "transcript" ? (
          <dl className="document-lessons">
            {department.years.map((year, index) => (
              <div key={year}>
                <dt>{index + 1}단계 · {year}</dt>
                <dd>{index < completed ? "완료" : "미완료"}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="document-copy">
            {type === "admission"
              ? "이 학과의 전공 체험을 시작합니다."
              : "세 단계의 학습과 실습을 모두 마쳤습니다."}
          </p>
        )}
        <Icon name="cap" size={42} />
        <small>전공 탐색 체험 기록</small>
      </article>
      {type === "transcript" && (
        <button className="button document-next" onClick={onNext}>
          졸업증명서 보기
        </button>
      )}
    </div>
  );
}
