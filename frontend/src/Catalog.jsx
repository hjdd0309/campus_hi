import React, { useEffect, useState } from "react";
import { getCourseList, getSchoolList, getCurriculumList } from "./api.js";
import Icon from "./Icon.jsx";

export default function Catalog({ filter, query, onChoose }) {
  const [courses, setCourses] = useState([]);
  const [selected, setSelected] = useState("");
  const [schools, setSchools] = useState([]);
  const [school, setSchool] = useState("");
  const [curriculum, setCurriculum] = useState([]);
  const [status, setStatus] = useState("courses");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [limit, setLimit] = useState(30);
  useEffect(() => {
    const controller = new AbortController();
    setSelected("");
    setSchool("");
    setSchools([]);
    setCurriculum([]);
    setCourses([]);
    setStatus("courses");
    setError("");
    setLimit(30);
    getCourseList(filter, controller.signal)
      .then((items) => {
        setCourses(items);
        setStatus("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setStatus("");
        }
      });
    return () => controller.abort();
  }, [filter, retry]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setSchool("");
    setSchools([]);
    setCurriculum([]);
    setStatus("schools");
    setError("");
    getSchoolList(selected, controller.signal)
      .then((items) => {
        setSchools(items);
        setStatus("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setStatus("");
        }
      });
    return () => controller.abort();
  }, [selected]);
  useEffect(() => {
    if (!school || !selected) return;
    const controller = new AbortController();
    setCurriculum([]);
    setStatus("curriculum");
    setError("");
    getCurriculumList(school, selected, controller.signal)
      .then((items) => {
        setCurriculum(items);
        setStatus("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setStatus("");
        }
      });
    return () => controller.abort();
  }, [school, selected]);
  const visible = courses.filter((course) =>
    course.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <section className="catalog" aria-label="대학 학과 찾기">
      {status && (
        <p role="status" className="catalog-status">
          {status === "courses"
            ? "관심 분야의 학과를 찾고 있어요…"
            : status === "schools"
              ? "학과가 있는 대학을 찾고 있어요…"
              : "교육과정을 불러오고 있어요…"}
        </p>
      )}
      {error && (
        <div role="alert" className="callout cream">
          <p>{error}</p>
          <button
            className="text-button"
            onClick={() => setRetry((value) => value + 1)}
          >
            다시 불러오기 →
          </button>
        </div>
      )}
      {!selected && !status && !error && (
        <>
          <p className="catalog-count">
            {visible.length.toLocaleString()}개 학과 · 관심 있는 학과를
            선택해주세요
          </p>
          <div className="department-list">
            {visible.slice(0, limit).map((course) => (
              <button
                key={course}
                className="department-card"
                onClick={() => setSelected(course)}
              >
                <span className="department-icon design">
                  <Icon name="cap" />
                </span>
                <span className="department-copy">
                  <strong>{course}</strong>
                  <small>개설 대학과 교육과정 살펴보기</small>
                </span>
                <Icon name="next" size={16} />
              </button>
            ))}
          </div>
          {!visible.length && (
            <div className="empty-state">
              <Icon name="search" size={28} />
              <h3>검색 결과가 없어요</h3>
              <p>다른 분야나 학과 이름으로 찾아보세요.</p>
            </div>
          )}
          {visible.length > limit && (
            <button
              className="text-button"
              onClick={() => setLimit((n) => n + 30)}
            >
              학과 더 보기 ({Math.min(limit, visible.length)} / {visible.length}
              )
            </button>
          )}
        </>
      )}
      {selected && (
        <>
          <button
            className="text-button"
            onClick={() => {
              setSelected("");
              setSchool("");
              setSchools([]);
              setCurriculum([]);
              setStatus("");
              setError("");
            }}
          >
            ← 학과 목록으로
          </button>
          <div className="callout mint">
            <span className="eyebrow">관심 학과</span>
            <h2>{selected}</h2>
            <p>같은 학과도 대학마다 배우는 내용이 달라요.</p>
          </div>
          <label className="school-select">
            대학 선택
            <select
              value={school}
              onChange={(e) => {
                setSchool(e.target.value);
                setCurriculum([]);
                setError("");
                if (!e.target.value) setStatus("");
              }}
              disabled={status === "schools"}
            >
              <option value="">대학을 선택해주세요</option>
              {schools.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          {!status && !schools.length && !error && (
            <p className="body-copy">
              등록된 대학 정보가 없어요. 다른 학과를 선택해주세요.
            </p>
          )}
          {school && !status && !error && (
            <div className="school-curriculum">
              <h3>{school} 교육과정</h3>
              <p className="body-copy">
                {curriculum.length
                  ? curriculum.slice(0, 12).join(" · ")
                  : "등록된 교과목 정보가 없어요. 전공 탐색 활동으로 시작할 수 있어요."}
                {curriculum.length > 12 && ` 외 ${curriculum.length - 12}개`}
              </p>
              <button
                className="button"
                onClick={() => onChoose(selected, school, curriculum)}
              >
                이 대학·학과 알아보기
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
