"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeTodoAction } from "@/lib/client-actions";
import { calendarDates, readableDate, shiftMonth } from "@/lib/dates";
import { CURRICULUM, getMember, KIND_LABELS, MEMBERS } from "@/lib/catalog";
import type { Member, MemberId, TodoView } from "@/lib/types";
import Icon from "./Icon";
import TodoEditor from "./TodoEditor";

export default function Calendar({
  member,
  todos,
  month,
  selectedDate,
  today,
}: {
  member: Member;
  todos: TodoView[];
  month: string;
  selectedDate: string;
  today: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<MemberId | "all">("all");
  const [editor, setEditor] = useState<{
    date: string;
    todo?: TodoView;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const monthTodos = todos.filter((todo) => todo.date.startsWith(month));
  const complete = monthTodos.filter((todo) => todo.completed_at).length;
  const visibleTodos = todos.filter(
    (todo) => filter === "all" || todo.member_id === filter,
  );
  const dayTodos = visibleTodos.filter((todo) => todo.date === selectedDate);
  const navigate = (newMonth: string, date: string) => {
    router.push(`/?month=${newMonth}&date=${date}`, { scroll: false });
  };
  const toggle = (todo: TodoView) => {
    setError("");
    setPendingId(todo.id);
    startTransition(async () => {
      const result = await completeTodoAction(todo.id, !todo.completed_at);
      if (!result.ok) setError(result.error);
      router.refresh();
      setPendingId("");
    });
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            학습 캘린더<span className="heading-dot">.</span>
          </h1>
          <p className="page-description">
            구성원별 학습 일정과 완료 상태를 확인하세요.
          </p>
        </div>
        <button
          className="button primary"
          onClick={() => setEditor({ date: selectedDate })}
        >
          <Icon name="plus" size={18} />
          일정 추가
        </button>
      </div>
      <section className="study-overview" aria-label="이번 달 학습 현황">
        <div className="overview-item">
          <span className="overview-icon">
            <Icon name="calendar" />
          </span>
          <div>
            <span className="stat-label">이번 달 계획</span>
            <p>
              <strong>{monthTodos.length}</strong>
              <span>개의 학습</span>
            </p>
          </div>
        </div>
        <div className="overview-item">
          <span className="overview-icon">
            <Icon name="check" />
          </span>
          <div>
            <span className="stat-label">이번 달 완료</span>
            <p>
              <strong>{complete}</strong>
              <span>개 완료</span>
            </p>
          </div>
          <div
            className="stat-progress"
            aria-label={`완료율 ${monthTodos.length ? Math.round((complete / monthTodos.length) * 100) : 0}%`}
          >
            <span
              style={{
                width: `${monthTodos.length ? (complete / monthTodos.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
        <div className="overview-item together-stat">
          <div className="avatar-stack">
            {MEMBERS.map((person) => (
              <span className={`avatar ${person.color}`} key={person.id}>
                {person.name[0]}
              </span>
            ))}
          </div>
          <div>
            <span className="stat-label">스터디 구성원</span>
            <p className="together-names">도현 · 예은 · 지은</p>
          </div>
          <span className="study-badge">3인 스터디</span>
        </div>
      </section>
      <div className="calendar-workspace">
        <section className="calendar-panel" aria-label="월간 학습 캘린더">
          <div className="calendar-toolbar">
            <div className="month-control">
              <h2>
                {Number(month.slice(0, 4))}
                <span>년</span> {Number(month.slice(5))}
                <span>월</span>
              </h2>
              <button
                className="today-button"
                onClick={() => navigate(today.slice(0, 7), today)}
              >
                오늘
              </button>
            </div>
            <div className="month-arrows">
              <button
                className="icon-button"
                aria-label="이전 달"
                onClick={() => {
                  const next = shiftMonth(month, -1);
                  navigate(next, `${next}-01`);
                }}
              >
                <Icon name="left" size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="다음 달"
                onClick={() => {
                  const next = shiftMonth(month, 1);
                  navigate(next, `${next}-01`);
                }}
              >
                <Icon name="right" size={18} />
              </button>
            </div>
          </div>
          <div className="calendar-filter">
            <div className="filter-buttons">
              <button
                onClick={() => setFilter("all")}
                className={filter === "all" ? "selected" : ""}
                aria-pressed={filter === "all"}
              >
                전체
              </button>
              {MEMBERS.map((person) => (
                <button
                  key={person.id}
                  onClick={() => setFilter(person.id)}
                  className={filter === person.id ? "selected" : ""}
                  aria-pressed={filter === person.id}
                >
                  <span className={`member-dot ${person.color}`} />
                  {person.name}
                </button>
              ))}
            </div>
          </div>
          <div className="calendar-weekdays" aria-hidden="true">
            {"일월화수목금토".split("").map((value, i) => (
              <span className={i === 0 ? "sunday" : ""} key={value}>
                {value}
              </span>
            ))}
          </div>
          <div className="calendar-grid">
            {calendarDates(month).map((date, index) => {
              const entries = visibleTodos.filter((todo) => todo.date === date);
              return (
                <button
                  key={date}
                  type="button"
                  aria-label={`${date} ${entries.length}개 일정${date === today ? ", 오늘" : ""}`}
                  aria-pressed={date === selectedDate}
                  className={`calendar-day ${date === selectedDate ? "chosen" : ""} ${date === today ? "is-today" : ""} ${!date.startsWith(month) ? "outside" : ""} ${index % 7 === 0 ? "sunday" : ""}`}
                  onClick={() => navigate(date.slice(0, 7), date)}
                >
                  <span className="day-number">{Number(date.slice(-2))}</span>
                  {date === today && <span className="today-label">오늘</span>}
                  <span className="calendar-entries">
                    {entries.slice(0, 2).map((todo) => (
                      <span
                        key={todo.id}
                        className={`calendar-entry ${getMember(todo.member_id)!.color} ${todo.completed_at ? "done" : ""}`}
                      >
                        <span className="entry-name">
                          {getMember(todo.member_id)!.name}
                        </span>
                        <span className="entry-title">{todo.title}</span>
                        {todo.completed_at && <Icon name="check" size={11} />}
                      </span>
                    ))}
                    {entries.length > 2 && (
                      <span className="more-entries">
                        +{entries.length - 2}개 더
                      </span>
                    )}
                  </span>
                  <span className="mobile-day-dots">
                    {MEMBERS.filter((person) =>
                      entries.some((todo) => todo.member_id === person.id),
                    ).map((person) => (
                      <span
                        className={`member-dot ${person.color}`}
                        key={person.id}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="calendar-bottom-note">
            <Icon name="check" size={14} />
            <span>완료한 일정은 체크 표시로 구분됩니다.</span>
          </div>
        </section>
        <section className="day-panel" aria-label="선택한 날짜의 일정">
          <div className="day-panel-heading">
            <h2>{readableDate(selectedDate)}</h2>
            <div>
              <span>
                {dayTodos.length
                  ? `${dayTodos.length}개 일정`
                  : "등록된 일정이 없습니다."}
              </span>
              {selectedDate === today && (
                <span className="badge soft-green">TODAY</span>
              )}
            </div>
          </div>
          <div className="day-members">
            {MEMBERS.filter(
              (person) => filter === "all" || person.id === filter,
            ).map((person) => {
              const entries = dayTodos.filter(
                (todo) => todo.member_id === person.id,
              );
              return (
                <div className="day-member" key={person.id}>
                  <div className="day-member-heading">
                    <span className={`avatar tiny ${person.color}`}>
                      {person.name[0]}
                    </span>
                    <strong>{person.name}</strong>
                    {person.id === member.id && (
                      <span className="me-label">나</span>
                    )}
                    <span className="member-count">
                      {entries.filter((todo) => todo.completed_at).length}
                      <span> / {entries.length}</span>
                    </span>
                  </div>
                  {entries.length ? (
                    <ul className="todo-list">
                      {entries.map((todo) => {
                        const item = CURRICULUM.find(
                          (value) => value.id === todo.curriculum_id,
                        );
                        return (
                          <li
                            key={todo.id}
                            className={
                              todo.completed_at
                                ? "todo-card completed"
                                : "todo-card"
                            }
                          >
                            <button
                              className="todo-check"
                              aria-label={`${todo.title} ${todo.completed_at ? "완료 취소" : "완료 체크"}`}
                              aria-pressed={Boolean(todo.completed_at)}
                              disabled={person.id !== member.id || pending}
                              onClick={() => toggle(todo)}
                            >
                              {pendingId === todo.id ? (
                                <span className="small-spinner" />
                              ) : (
                                todo.completed_at && (
                                  <Icon name="check" size={13} />
                                )
                              )}
                            </button>
                            <button
                              className="todo-content"
                              onClick={() =>
                                setEditor({ date: todo.date, todo })
                              }
                            >
                              <span className="todo-title">{todo.title}</span>
                              <span className="todo-metadata">
                                {item ? (
                                  <>
                                    <Icon
                                      name={
                                        item.kind === "workbook"
                                          ? "book"
                                          : item.kind
                                      }
                                      size={12}
                                    />
                                    {KIND_LABELS[item.kind]} {item.code}
                                  </>
                                ) : (
                                  "자유 학습"
                                )}
                                {todo.note && (
                                  <span className="note-indicator">메모</span>
                                )}
                                {todo.photo_key && (
                                  <Icon name="image" size={12} />
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="empty-member">등록된 일정이 없습니다.</p>
                  )}
                  {person.id === member.id && (
                    <button
                      className="inline-add"
                      onClick={() => setEditor({ date: selectedDate })}
                    >
                      <Icon name="plus" size={14} />
                      학습 계획 추가
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <div className="calendar-shortcut">
        <span className="shortcut-book">
          <Icon name="book" size={20} />
        </span>
        <div>
          <strong>커리큘럼 일정 등록</strong>
          <span>강의·워크북·영단어를 선택해 일정에 추가할 수 있습니다.</span>
        </div>
        <a href="/curriculum">
          학습 목록 보기
          <Icon name="arrow" size={16} />
        </a>
      </div>
      {error && (
        <p className="floating-error" role="alert">
          {error}
          <button
            className="icon-button"
            aria-label="오류 닫기"
            onClick={() => setError("")}
          >
            <Icon name="close" size={16} />
          </button>
        </p>
      )}
      {editor && (
        <TodoEditor
          member={member}
          date={editor.date}
          todo={editor.todo}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  );
}
