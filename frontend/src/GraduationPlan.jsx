import React, { useEffect, useRef, useState } from "react";
import { PLAN_FIELDS } from "./model.js";

// 조형·디자인 계열이 아닌 학과의 마지막 학년 과제. 계열에 맞는 졸업 과제의 계획서를 직접 써본다.
export default function GraduationPlan({ final, value, onChange }) {
  const [plan, setPlan] = useState(() => ({
    topic: value?.topic || "",
    reason: value?.reason || "",
    method: value?.method || "",
  }));
  const latest = useRef(plan);
  const callback = useRef(onChange);
  const timer = useRef(0);
  callback.current = onChange;

  // 입력할 때마다 전체 상태를 저장하지 않도록 잠시 모았다가 저장하고, 칸을 벗어나거나 화면을 떠날 때는 바로 저장한다.
  function flush() {
    clearTimeout(timer.current);
    callback.current(latest.current);
  }
  function edit(field, text) {
    const next = { ...latest.current, [field]: text };
    latest.current = next;
    setPlan(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 300);
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <section className="graduation-plan" aria-label={`${final.name} 계획서`}>
      <div className="studio-heading">
        <span className="tag">마지막 학년</span>
        <h2>{final.name}</h2>
        <p>{final.intro}</p>
      </div>
      {PLAN_FIELDS.map((field, i) => (
        <label className="note-card plan-field" key={field}>
          <span>
            <strong>
              {i + 1}. {final.prompts[i].label}
            </strong>
          </span>
          <textarea
            placeholder={final.prompts[i].placeholder}
            value={plan[field]}
            maxLength={500}
            onChange={(e) => edit(field, e.target.value)}
            onBlur={flush}
          />
        </label>
      ))}
    </section>
  );
}

export function PlanSummary({ final, plan }) {
  return (
    <dl className="plan-summary">
      {PLAN_FIELDS.map((field, i) => (
        <div key={field}>
          <dt>{final.prompts[i].label}</dt>
          <dd>{plan[field]}</dd>
        </div>
      ))}
    </dl>
  );
}
