"use client";

import { useState } from "react";
import { CURRICULUM, KIND_LABELS } from "@/lib/catalog";
import type { CurriculumItem, CurriculumKind, Member } from "@/lib/types";
import Icon from "./Icon";
import TodoEditor from "./TodoEditor";

export default function CurriculumList({
  member,
  today,
  completedIds,
}: {
  member: Member;
  today: string;
  completedIds: string[];
}) {
  const [kind, setKind] = useState<CurriculumKind>("video");
  const [selected, setSelected] = useState<CurriculumItem | null>(null);
  const items = CURRICULUM.filter((item) => item.kind === kind);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            학습 목록<span className="heading-dot">.</span>
          </h1>
          <p className="page-description">
            강의·워크북·영단어를 선택해 학습 일정에 추가하세요.
          </p>
        </div>
        <div className="catalog-count">
          <strong>26</strong>개 학습 항목
        </div>
      </div>
      <div className="curriculum-tabs" role="group" aria-label="학습 종류">
        {Object.entries(KIND_LABELS).map(([value, label]) => (
          <button
            key={value}
            aria-pressed={kind === value}
            className={kind === value ? "active" : ""}
            onClick={() => setKind(value as CurriculumKind)}
          >
            <Icon name={value === "workbook" ? "book" : value} size={18} />
            {label}
            <span>
              {CURRICULUM.filter((item) => item.kind === value).length}
            </span>
          </button>
        ))}
      </div>
      <div className="catalog-section-heading">
        <div>
          <h2>{KIND_LABELS[kind]}</h2>
          <p>
            {kind === "video"
              ? "영어 시험 대비 영상 강의"
              : kind === "workbook"
                ? "챕터별 핵심 개념과 연습 문제"
                : "필수 영단어 A-1~A-4"}
          </p>
        </div>
        <span className="muted">
          내 학습 완료{" "}
          {items.filter((item) => completedIds.includes(item.id)).length} /{" "}
          {items.length}
        </span>
      </div>
      {kind === "vocab" && (
        <div className="vocab-tip">
          <Icon name="book" />
          <p>
            <strong>권장 복습 순서</strong>
            <span>1주 차 A-1·A-2, 2주 차 A-3·A-4, 3주 차 전체 복습.</span>
          </p>
        </div>
      )}
      <div
        className={`curriculum-list ${kind === "vocab" ? "vocab-list" : ""}`}
      >
        {items.map((item, index) => (
          <div key={item.id} className="curriculum-group">
            {kind === "workbook" &&
              item.chapter !== items[index - 1]?.chapter && (
                <h3 className="chapter-label">{item.chapter}</h3>
              )}
            <article className="curriculum-card">
              <span className={`curriculum-icon ${kind}`}>
                <Icon name={kind === "workbook" ? "book" : kind} size={23} />
              </span>
              <div className="curriculum-content">
                <div className="curriculum-labels">
                  <span>
                    {kind === "vocab" ? "필수 영단어" : KIND_LABELS[kind]}{" "}
                    {item.code}
                  </span>
                  {completedIds.includes(item.id) && (
                    <span className="learned">
                      <Icon name="check" size={12} />
                      학습 이력 있음
                    </span>
                  )}
                </div>
                <h3>{item.title}</h3>
                {kind === "vocab" && (
                  <p>복습 일정을 여러 날짜에 등록할 수 있습니다.</p>
                )}
              </div>
              <button
                className="button secondary small-button"
                onClick={() => setSelected(item)}
              >
                <Icon name="plus" size={16} />
                <span>일정에 추가</span>
              </button>
            </article>
          </div>
        ))}
      </div>
      <p className="catalog-footnote">
        <Icon name="external" size={14} />
        강의와 자료는 상단의 CCAR-F 학습 사이트에서 확인할 수 있습니다.
      </p>
      {selected && (
        <TodoEditor
          member={member}
          date={today}
          item={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
