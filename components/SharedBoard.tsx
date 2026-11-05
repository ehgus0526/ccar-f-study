"use client";

import { useState, useTransition } from "react";
import { deletePostAction, savePostAction } from "@/lib/client-actions";
import { getMember } from "@/lib/catalog";
import { readableTime } from "@/lib/dates";
import type { Member, SharedPost } from "@/lib/types";
import Icon from "./Icon";
import Dialog from "./Dialog";

export default function SharedBoard({
  member,
  posts,
}: {
  member: Member;
  posts: SharedPost[];
}) {
  const [editing, setEditing] = useState<SharedPost | "new" | null>(null);
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<string | null>(null);
  const open = (post?: SharedPost) => {
    setBody(post?.body || "");
    setUrl(post?.url || "");
    setError("");
    setEditing(post || "new");
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            공유함<span className="heading-dot">.</span>
          </h1>
          <p className="page-description">
            학습 메모와 자료 링크를 공유하세요.
          </p>
        </div>
        <button className="button primary" onClick={() => open()}>
          <Icon name="plus" size={18} />글 남기기
        </button>
      </div>
      <div className="board-toolbar">
        <span>
          공유 글 <strong>{posts.length}</strong>
        </span>
        <span>최신순</span>
      </div>
      {posts.length ? (
        <div className="post-list">
          {posts.map((post) => {
            const owner = getMember(post.member_id)!;
            return (
              <article className="post-card" key={post.id}>
                <div className="post-top">
                  <span className={`avatar small ${owner.color}`}>
                    {owner.name[0]}
                  </span>
                  <div>
                    <strong>{owner.name}</strong>
                    <time dateTime={post.created_at}>
                      {readableTime(post.created_at)}
                      {post.updated_at !== post.created_at && " · 수정됨"}
                    </time>
                  </div>
                  {member.id === post.member_id && (
                    <div className="post-actions">
                      <button
                        className="icon-button"
                        aria-label={`${owner.name} 글 수정`}
                        onClick={() => open(post)}
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`${owner.name} 글 삭제`}
                        onClick={() => setConfirm(post.id)}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  )}
                </div>
                <p className="post-body">{post.body}</p>
                {post.url && (
                  <a
                    href={post.url}
                    className="shared-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="link-icon">
                      <Icon name="link" size={18} />
                    </span>
                    <span>{post.url}</span>
                    <Icon name="external" size={15} />
                  </a>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-board">
          <span className="empty-board-icon">
            <Icon name="share" size={30} />
          </span>
          <h2>등록된 글이 없습니다.</h2>
          <p>학습 메모나 자료 링크를 등록하세요.</p>
          <button className="button secondary" onClick={() => open()}>
            <Icon name="plus" size={16} />첫 글 남기기
          </button>
        </div>
      )}
      {editing && (
        <Dialog
          title={editing === "new" ? "공유 글 작성" : "공유 글 수정"}
          onClose={() => {
            if (!pending) setEditing(null);
          }}
        >
          <form
            className="editor-form"
            onSubmit={(event) => {
              event.preventDefault();
              setError("");
              startTransition(async () => {
                const result = await savePostAction({
                  id: editing === "new" ? undefined : editing.id,
                  body,
                  url,
                });
                if (result.ok) {
                  setEditing(null);
                } else setError(result.error);
              });
            }}
          >
            <label className="field-label" htmlFor="post-body">
              내용
            </label>
            <textarea
              id="post-body"
              rows={6}
              value={body}
              maxLength={4000}
              required
              placeholder="학습 메모나 자료 설명을 입력하세요."
              onChange={(event) => setBody(event.target.value)}
              disabled={pending}
            />
            <label htmlFor="post-url" className="field-label">
              자료 링크 <small>선택</small>
            </label>
            <input
              id="post-url"
              type="url"
              value={url}
              maxLength={2000}
              placeholder="https://"
              onChange={(event) => setUrl(event.target.value)}
              disabled={pending}
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <span className="field-help">스터디 구성원에게 공개됩니다.</span>
              <button className="button primary" disabled={pending}>
                {pending ? "저장하는 중…" : "공유하기"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {confirm && (
        <Dialog
          title="공유 글을 삭제할까요?"
          onClose={() => {
            if (!pending) setConfirm(null);
          }}
        >
          <div className="editor-form">
            <p className="muted">삭제한 글은 복구할 수 없어요.</p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button
                className="button secondary"
                disabled={pending}
                onClick={() => setConfirm(null)}
              >
                취소
              </button>
              <button
                className="button danger-button"
                disabled={pending}
                onClick={() => {
                  setError("");
                  startTransition(async () => {
                    const result = await deletePostAction(confirm);
                    if (result.ok) {
                      setConfirm(null);
                    } else setError(result.error);
                  });
                }}
              >
                {pending ? "삭제하는 중…" : "삭제"}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
