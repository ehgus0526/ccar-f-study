"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { deleteCommentAction, saveCommentAction } from "@/lib/client-actions";
import { getMember } from "@/lib/catalog";
import { readableTime } from "@/lib/dates";
import type { Member, SharedComment } from "@/lib/types";
import Dialog from "./Dialog";
import Icon from "./Icon";

export default function PostComments({
  member,
  postId,
  comments,
}: {
  member: Member;
  postId: string;
  comments: SharedComment[];
}) {
  const [draft, setDraft] = useState("");
  const [composing, setComposing] = useState(false);
  const composeButton = useRef<HTMLButtonElement>(null);
  const restoreComposeFocus = useRef(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (!composing && !pending && restoreComposeFocus.current) {
      restoreComposeFocus.current = false;
      composeButton.current?.focus();
    }
  }, [composing, pending]);

  function closeComposer() {
    setComposing(false);
    setError("");
    restoreComposeFocus.current = true;
  }

  function save(event: React.FormEvent, id?: string) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await saveCommentAction({
        postId,
        id,
        body: id ? editBody : draft,
      });
      if (result.ok) {
        if (id) setEditing(null);
        else {
          setDraft("");
          closeComposer();
        }
      } else setError(result.error);
    });
  }

  return (
    <section
      className="post-comments"
      aria-labelledby={`comments-heading-${postId}`}
    >
      <div className="comments-heading">
        <h3 id={`comments-heading-${postId}`}>
          댓글 <span>{comments.length}</span>
        </h3>
        <span>오래된순</span>
      </div>
      {comments.length > 0 && (
        <ol className="comment-list">
          {comments.map((comment) => {
            const owner = getMember(comment.member_id)!;
            return (
              <li className="comment-item" key={comment.id}>
                <div className="comment-top">
                  <span className={`avatar tiny ${owner.color}`}>
                    {owner.name[0]}
                  </span>
                  <div className="comment-author">
                    <strong>{owner.name}</strong>
                    <time dateTime={comment.created_at}>
                      {readableTime(comment.created_at)}
                    </time>
                    {comment.updated_at !== comment.created_at && (
                      <span className="comment-edited">수정됨</span>
                    )}
                  </div>
                  {member.id === comment.member_id &&
                    editing !== comment.id && (
                      <div className="comment-actions">
                        <button
                          type="button"
                          className="text-button"
                          disabled={pending}
                          onClick={() => {
                            setEditing(comment.id);
                            setEditBody(comment.body);
                            setError("");
                          }}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          className="text-button"
                          disabled={pending}
                          onClick={() => {
                            setConfirmDelete(comment.id);
                            setError("");
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    )}
                </div>
                {editing === comment.id ? (
                  <form
                    className="comment-edit-form"
                    onSubmit={(event) => save(event, comment.id)}
                  >
                    <label
                      className="sr-only"
                      htmlFor={`comment-edit-${comment.id}`}
                    >
                      댓글 수정
                    </label>
                    <textarea
                      id={`comment-edit-${comment.id}`}
                      value={editBody}
                      rows={3}
                      maxLength={1000}
                      required
                      disabled={pending}
                      autoFocus
                      onChange={(event) => setEditBody(event.target.value)}
                    />
                    <div className="comment-form-actions">
                      <button
                        type="button"
                        className="button secondary small-button"
                        disabled={pending}
                        onClick={() => {
                          setEditing(null);
                          setError("");
                        }}
                      >
                        취소
                      </button>
                      <button
                        className="button primary small-button"
                        disabled={pending || !editBody.trim()}
                      >
                        {pending ? "저장 중…" : "저장"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="comment-body">{comment.body}</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {error && !confirmDelete && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        ref={composeButton}
        type="button"
        className="button secondary small-button comment-compose-toggle"
        aria-expanded={composing}
        aria-controls={`comment-form-${postId}`}
        disabled={pending}
        onClick={() => {
          if (composing) closeComposer();
          else {
            setError("");
            setComposing(true);
          }
        }}
      >
        <Icon name={composing ? "close" : "pen"} size={15} />
        {composing ? "입력창 닫기" : "댓글 쓰기"}
      </button>
      {composing && (
        <form
          id={`comment-form-${postId}`}
          className="comment-form"
          onSubmit={(event) => save(event)}
        >
          <label className="sr-only" htmlFor={`comment-new-${postId}`}>
            댓글 내용
          </label>
          <textarea
            id={`comment-new-${postId}`}
            value={draft}
            rows={2}
            maxLength={1000}
            required
            autoFocus
            placeholder="댓글을 입력하세요."
            disabled={pending}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="comment-form-actions">
            <span className="field-help">최대 1,000자</span>
            <button
              className="button secondary small-button"
              disabled={pending || !draft.trim()}
            >
              {pending && !editing && !confirmDelete ? "등록 중…" : "댓글 등록"}
            </button>
          </div>
        </form>
      )}
      {confirmDelete && (
        <Dialog
          title="댓글을 삭제할까요?"
          onClose={() => {
            if (!pending) setConfirmDelete(null);
          }}
        >
          <div className="editor-form">
            <p className="muted">삭제한 댓글은 복구할 수 없습니다.</p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button
                className="button secondary"
                disabled={pending}
                onClick={() => setConfirmDelete(null)}
              >
                취소
              </button>
              <button
                className="button danger-button"
                disabled={pending}
                onClick={() => {
                  setError("");
                  startTransition(async () => {
                    const result = await deleteCommentAction(confirmDelete);
                    if (result.ok) {
                      setConfirmDelete(null);
                      if (editing === confirmDelete) setEditing(null);
                    } else setError(result.error);
                  });
                }}
              >
                {pending ? "삭제 중…" : "삭제"}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}
