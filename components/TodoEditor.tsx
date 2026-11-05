"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  createTodoAction,
  deleteTodoAction,
  deleteTodoPhotoAction,
  updateTodoAction,
} from "@/lib/client-actions";
import { CURRICULUM, getMember, KIND_LABELS } from "@/lib/catalog";
import {
  calendarDates,
  readableDate,
  readableTime,
  shiftMonth,
  todayKST,
} from "@/lib/dates";
import type { CurriculumItem, Member, TodoView } from "@/lib/types";
import Icon from "./Icon";
import Dialog from "./Dialog";

async function compressedPhoto(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("JPEG·PNG·WebP 사진을 선택해 주세요.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("원본 사진은 20MB 이내로 선택해 주세요.");
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error(
        "사진을 처리하지 못했습니다. 다른 사진으로 시도해 주세요.",
      );
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob || blob.size > 2 * 1024 * 1024)
      throw new Error("사진이 너무 큽니다. 더 작은 사진을 선택해 주세요.");
    return blob;
  } finally {
    bitmap.close();
  }
}

export default function TodoEditor({
  member,
  date,
  todo,
  item,
  onClose,
}: {
  member: Member;
  date: string;
  todo?: TodoView;
  item?: CurriculumItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const own = !todo || todo.member_id === member.id;
  const initialItem =
    item || CURRICULUM.find((value) => value.id === todo?.curriculum_id);
  const [kind, setKind] = useState(initialItem?.kind || "custom");
  const [curriculum, setCurriculum] = useState(initialItem?.id || "");
  const [title, setTitle] = useState(todo?.title || item?.title || "");
  const [note, setNote] = useState(todo?.note || "");
  const [dates, setDates] = useState([todo?.date || date]);
  const [month, setMonth] = useState((todo?.date || date).slice(0, 7));
  const [batchId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [photo, setPhoto] = useState(todo?.photo_url || null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = pending || uploading;
  const owner = todo ? getMember(todo.member_id)! : member;
  const toggleDate = (value: string) => {
    setDates((previous) =>
      previous.includes(value)
        ? previous.filter((day) => day !== value)
        : previous.length < 31
          ? [...previous, value].sort()
          : previous,
    );
  };
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = todo
        ? await updateTodoAction(todo.id, {
            title,
            date: dates[0],
            curriculumId: curriculum || null,
            note,
          })
        : await createTodoAction({
            batchId,
            title,
            dates,
            curriculumId: curriculum || null,
            note,
          });
      if (result.ok) {
        router.refresh();
        onClose();
      } else setError(result.error);
    });
  };
  const upload = async (file?: File) => {
    if (!file || !todo) return;
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const blob = await compressedPhoto(file);
      const form = new FormData();
      form.set("todoId", todo.id);
      form.set("photo", blob, "proof.jpg");
      const response = await fetch("/api/photos", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "사진을 저장하지 못했습니다.");
      setPhoto(result.photoUrl);
      setMessage("인증 사진을 저장했어요.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error && /[가-힣]/.test(err.message)
          ? err.message
          : "사진을 처리하지 못했습니다. 다시 시도해 주세요.",
      );
    } finally {
      setUploading(false);
    }
  };
  return (
    <Dialog
      title={todo ? "학습 기록" : "새 학습 일정"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={save} className="editor-form">
        <div className="editor-owner">
          <span className={`avatar small ${owner.color}`}>{owner.name[0]}</span>
          <strong>{owner.name}</strong>
          <span>{todo?.completed_at ? "학습 완료" : "학습 예정"}</span>
        </div>
        <fieldset disabled={!own || busy} className="plain-fieldset">
          <label className="field-label">학습 항목</label>
          <div className="segmented kind-tabs">
            {[...Object.entries(KIND_LABELS), ["custom", "직접 입력"]].map(
              ([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={kind === value}
                  className={kind === value ? "selected" : ""}
                  onClick={() => {
                    setKind(value);
                    setCurriculum("");
                    setTitle("");
                  }}
                >
                  {label}
                </button>
              ),
            )}
          </div>
          {kind !== "custom" && (
            <>
              <label htmlFor="curriculum" className="sr-only">
                학습 항목
              </label>
              <select
                id="curriculum"
                value={curriculum}
                required
                onChange={(event) => {
                  setCurriculum(event.target.value);
                  setTitle(
                    CURRICULUM.find((value) => value.id === event.target.value)
                      ?.title || "",
                  );
                }}
              >
                <option value="">학습할 항목을 선택해 주세요</option>
                {CURRICULUM.filter((value) => value.kind === kind).map(
                  (value) => (
                    <option value={value.id} key={value.id}>
                      {value.code} · {value.title}
                    </option>
                  ),
                )}
              </select>
            </>
          )}
          <label htmlFor="todo-title" className="field-label">
            일정 이름
          </label>
          <input
            id="todo-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="예: A-1 단어 복습하기"
            required
            maxLength={120}
          />
          <div className="field-label field-heading">
            <span>학습 날짜</span>
            {!todo && <small>여러 날짜를 선택할 수 있어요 · 최대 31일</small>}
          </div>
          {todo ? (
            <input
              aria-label="학습 날짜"
              type="date"
              value={dates[0]}
              min="2000-01-01"
              max="2100-12-31"
              required
              onChange={(event) => setDates([event.target.value])}
            />
          ) : (
            <div className="mini-calendar">
              <div className="mini-calendar-head">
                <strong>{month.replace("-", "년 ")}월</strong>
                <div>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="이전 달"
                    onClick={() => setMonth(shiftMonth(month, -1))}
                  >
                    <Icon name="left" size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="다음 달"
                    onClick={() => setMonth(shiftMonth(month, 1))}
                  >
                    <Icon name="right" size={16} />
                  </button>
                </div>
              </div>
              <div className="mini-calendar-grid">
                {"일월화수목금토".split("").map((day) => (
                  <span className="mini-weekday" key={day}>
                    {day}
                  </span>
                ))}
                {calendarDates(month).map((day) => (
                  <button
                    type="button"
                    key={day}
                    className={`${dates.includes(day) ? "picked" : ""} ${!day.startsWith(month) ? "outside" : ""}`}
                    aria-label={`${readableDate(day)}${dates.includes(day) ? " 선택됨" : ""}`}
                    aria-pressed={dates.includes(day)}
                    onClick={() => toggleDate(day)}
                  >
                    {Number(day.slice(-2))}
                  </button>
                ))}
              </div>
              <div className="mini-calendar-footer">
                <span>{dates.length}일 선택</span>
                <button
                  type="button"
                  onClick={() => {
                    setDates([todayKST()]);
                    setMonth(todayKST().slice(0, 7));
                  }}
                >
                  오늘만 선택
                </button>
              </div>
            </div>
          )}
          <label htmlFor="todo-note" className="field-label">
            학습 메모 <small>선택</small>
          </label>
          <textarea
            id="todo-note"
            rows={3}
            maxLength={2000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="학습 내용을 입력하세요."
          />
        </fieldset>
        {todo && (
          <section className="proof-section">
            <div className="field-label field-heading">
              <span>
                인증 사진 <small>선택</small>
              </span>
              {photo && own && (
                <button
                  type="button"
                  disabled={busy}
                  className="text-button danger"
                  onClick={() => {
                    setError("");
                    startTransition(async () => {
                      const result = await deleteTodoPhotoAction(todo.id);
                      if (result.ok) {
                        setPhoto(null);
                        setMessage("사진을 삭제했어요.");
                        router.refresh();
                      } else setError(result.error);
                    });
                  }}
                >
                  사진 삭제
                </button>
              )}
            </div>
            {photo && (
              <a
                href={photo}
                target="_blank"
                rel="noopener noreferrer"
                className="proof-preview"
              >
                <Image
                  src={photo}
                  alt={`${owner.name}의 학습 인증 사진`}
                  width={1600}
                  height={1200}
                  unoptimized
                />
              </a>
            )}
            {own && (
              <label className={`photo-picker ${busy ? "disabled" : ""}`}>
                <Icon name="image" size={18} />
                {uploading
                  ? "사진을 저장하는 중…"
                  : photo
                    ? "사진 바꾸기"
                    : "인증 사진 첨부"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={(event) => {
                    void upload(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                <small>JPEG·PNG·WebP · 자동 압축</small>
              </label>
            )}
            {todo.completed_at && (
              <p className="completion-time">
                <Icon name="check" size={14} />
                {readableTime(todo.completed_at)} 완료
              </p>
            )}
          </section>
        )}
        {!todo && (
          <p className="field-help">
            일정을 등록한 뒤 학습 기록에서 인증 사진을 붙일 수 있어요.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="form-success" role="status">
            {message}
          </p>
        )}
        {own ? (
          <div className="dialog-actions">
            {todo && (
              <button
                type="button"
                className={`button ${confirmDelete ? "danger-button" : "danger-ghost"}`}
                disabled={busy}
                onClick={() => {
                  if (!confirmDelete) {
                    setConfirmDelete(true);
                    return;
                  }
                  setError("");
                  startTransition(async () => {
                    const result = await deleteTodoAction(todo.id);
                    if (result.ok) {
                      router.refresh();
                      onClose();
                    } else setError(result.error);
                  });
                }}
              >
                <Icon name="trash" size={16} />
                {confirmDelete ? "정말 삭제" : "삭제"}
              </button>
            )}
            <div className="dialog-actions-end">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={onClose}
              >
                닫기
              </button>
              <button
                className="button primary"
                disabled={busy || !dates.length}
              >
                {pending
                  ? "저장하는 중…"
                  : todo
                    ? "변경 저장"
                    : `${dates.length > 1 ? `${dates.length}개 ` : ""}일정 등록`}
              </button>
            </div>
          </div>
        ) : (
          <div className="dialog-actions">
            <p className="field-help">작성자만 수정할 수 있습니다.</p>
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              닫기
            </button>
          </div>
        )}
      </form>
    </Dialog>
  );
}
