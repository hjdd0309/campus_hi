import React, { useEffect, useState } from "react";
import { getCourseList, getSchoolList, getCurriculum } from "./api.js";
import Icon from "./Icon.jsx";

export default function Catalog({ filter, query, onChoose }) {
  const [courses, setCourses] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState(query);
  const [loadingMore, setLoadingMore] = useState(false);
  const [category, setCategory] = useState("");
  const [years, setYears] = useState(null);
  // 화면의 교육과정이 어느 대학·학과의 것인지 기억해, 불러오기 전의 빈 값으로 넘어가지 않게 한다.
  const [loadedFor, setLoadedFor] = useState("");
  const [selected, setSelected] = useState("");
  const [schools, setSchools] = useState([]);
  const [school, setSchool] = useState("");
  const [curriculum, setCurriculum] = useState([]);
  const [status, setStatus] = useState("courses");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  // 입력이 멈춘 뒤에 검색한다.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    setSelected("");
    setSchool("");
    setSchools([]);
    setCurriculum([]);
    setCourses([]);
    setTotal(0);
    setLoadingMore(false);
    setStatus("courses");
    setError("");
    getCourseList(filter, search, 0, controller.signal)
      .then((result) => {
        setCourses(result.courses);
        setTotal(result.total);
        setStatus("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setStatus("");
        }
      });
    return () => controller.abort();
  }, [filter, search, retry]);
  function loadMore() {
    setLoadingMore(true);
    setError("");
    getCourseList(filter, search, courses.length)
      .then((result) => {
        setCourses((items) => [...new Set([...items, ...result.courses])]);
        setTotal(result.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingMore(false));
  }
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
    getCurriculum(school, selected, controller.signal)
      .then((result) => {
        setCurriculum(result.curriculum);
        setCategory(result.category);
        setYears(result.years);
        setLoadedFor(`${school}
${selected}`);
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
      {!selected && !status && (!error || courses.length > 0) && (
        <>
          <p className="catalog-count">
            {total.toLocaleString()}개 학과 · 관심 있는 학과를 선택해주세요
          </p>
          <div className="department-list">
            {courses.map((course) => (
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
          {!courses.length && (
            <div className="empty-state">
              <Icon name="search" size={28} />
              <h3>검색 결과가 없어요</h3>
              <p>다른 분야나 학과 이름으로 찾아보세요.</p>
            </div>
          )}
          {courses.length < total && (
            <button
              className="text-button"
              disabled={loadingMore}
              onClick={loadMore}
            >
              {loadingMore
                ? "불러오는 중…"
                : `학과 더 보기 (${courses.length.toLocaleString()} / ${total.toLocaleString()})`}
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
          {school && !status && !error && loadedFor === `${school}
${selected}` && (
            <div className="school-curriculum">
              <h3>{school} 교육과정</h3>
              <p className="body-copy">
                {curriculum.slice(0, 12).join(" · ")}
                {curriculum.length > 12 && ` 외 ${curriculum.length - 12}개`}
              </p>
              <button
                className="button"
                onClick={() => onChoose(selected, school, curriculum, category, years)}
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
