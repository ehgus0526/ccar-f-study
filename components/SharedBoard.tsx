"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { deletePostAction } from "@/lib/client-actions";
import { getMember } from "@/lib/catalog";
import { readableTime } from "@/lib/dates";
import type { Member, SharedComment, SharedPostView } from "@/lib/types";
import Icon from "./Icon";
import Dialog from "./Dialog";
import PostComments from "./PostComments";

export default function SharedBoard({
  member,
  posts,
  comments,
}: {
  member: Member;
  posts: SharedPostView[];
  comments: SharedComment[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<SharedPostView | "new" | null>(null);
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  useEffect(() => {
    if (photo) return () => URL.revokeObjectURL(photo.url);
  }, [photo]);
  const imagePreview = photo
    ? photo.url
    : !removePhoto && editing && editing !== "new"
      ? editing.photo_url
      : null;
  const commentsByPost = new Map<string, SharedComment[]>();
  for (const comment of comments) {
    const group = commentsByPost.get(comment.post_id);
    if (group) group.push(comment);
    else commentsByPost.set(comment.post_id, [comment]);
  }
  const open = (post?: SharedPostView) => {
    setBody(post?.body || "");
    setUrl(post?.url || "");
    setError("");
    setPhoto(null);
    setRemovePhoto(false);
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
            학습 메모, 이미지와 자료 링크를 공유하세요.
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
                        onClick={() => {
                          setError("");
                          setConfirm(post.id);
                        }}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  )}
                </div>
                <p className="post-body">{post.body}</p>
                {post.photo_url && (
                  <a
                    className="post-image"
                    href={post.photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${owner.name}의 첨부 이미지 크게 보기 (새 탭)`}
                  >
                    <Image
                      src={post.photo_url}
                      alt={`${owner.name}의 첨부 이미지`}
                      width={1200}
                      height={800}
                      unoptimized
                    />
                  </a>
                )}
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
                <PostComments
                  member={member}
                  postId={post.id}
                  comments={commentsByPost.get(post.id) || []}
                />
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
            if (!pending) {
              setEditing(null);
              setPhoto(null);
            }
          }}
        >
          <form
            className="editor-form"
            onSubmit={(event) => {
              event.preventDefault();
              setError("");
              startTransition(async () => {
                try {
                  const form = new FormData();
                  if (editing !== "new") form.set("id", editing.id);
                  form.set("body", body);
                  form.set("url", url);
                  form.set("removePhoto", String(removePhoto));
                  if (photo) form.set("photo", photo.file);
                  const response = await fetch("/api/posts", {
                    method: "POST",
                    body: form,
                  });
                  const result = await response.json();
                  if (!response.ok)
                    throw new Error(
                      result.error || "글을 저장하지 못했습니다.",
                    );
                  setEditing(null);
                  setPhoto(null);
                  router.refresh();
                } catch (error) {
                  setError(
                    error instanceof Error && /[가-힣]/.test(error.message)
                      ? error.message
                      : "연결이 원활하지 않습니다. 입력한 내용은 유지됩니다. 다시 시도해 주세요.",
                  );
                }
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
            <span className="field-label">
              이미지 <small>선택 · 1장</small>
            </span>
            {imagePreview && (
              <div className="post-image-editor">
                <Image
                  src={imagePreview}
                  alt="첨부 이미지 미리보기"
                  width={600}
                  height={400}
                  unoptimized
                />
                <button
                  type="button"
                  className="button secondary"
                  disabled={pending}
                  onClick={() => {
                    setPhoto(null);
                    setRemovePhoto(true);
                  }}
                >
                  <Icon name="trash" size={16} />
                  이미지 삭제
                </button>
              </div>
            )}
            <label
              className={`photo-picker post-photo-picker ${pending ? "disabled" : ""}`}
            >
              <Icon name="image" size={18} />
              {imagePreview ? "이미지 교체" : "이미지 첨부"}
              <input
                id="post-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label={imagePreview ? "이미지 교체" : "이미지 첨부"}
                disabled={pending}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  if (
                    !["image/jpeg", "image/png", "image/webp"].includes(
                      file.type,
                    ) ||
                    file.size === 0 ||
                    file.size > 2 * 1024 * 1024
                  ) {
                    setError(
                      "JPEG·PNG·WebP 이미지를 2MB 이내로 선택해 주세요.",
                    );
                    return;
                  }
                  setError("");
                  setPhoto({ file, url: URL.createObjectURL(file) });
                  setRemovePhoto(false);
                }}
              />
            </label>
            <p className="field-help">
              JPEG·PNG·WebP · 최대 2MB. 이미지 변경은 글을 저장하면 반영됩니다.
            </p>
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
            <p className="muted">
              이 글과 첨부 이미지, 댓글이 모두 삭제되며 복구할 수 없습니다.
            </p>
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
