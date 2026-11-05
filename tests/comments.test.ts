import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import * as store from "../lib/store.ts";
import { writeComment } from "../lib/service.ts";
import type { MemberId, SharedComment } from "../lib/types.ts";

const directory = mkdtempSync(join(tmpdir(), "nodit-comments-test-"));
process.env.STUDY_STORAGE = "local";
process.env.STUDY_DATA_DIR = directory;
process.env.STUDY_PASSWORD_HASHES = "{}";
delete process.env.VERCEL;
for (const [id, name] of [
  ["dohyeon", "도현"],
  ["yeeun", "예은"],
  ["jieun", "지은"],
])
  store
    .localDb()
    .prepare("INSERT INTO members VALUES(?,?,?,?)")
    .run(id, name, "gold", "unused-test-hash");
after(() => {
  store.localDb().close();
  rmSync(directory, { recursive: true, force: true });
});

async function post(memberId: MemberId = "dohyeon") {
  const id = randomUUID();
  await store.savePost({
    id,
    member_id: memberId,
    body: "게시글",
    url: "",
    photo_key: null,
    created_at: "2026-11-01T00:00:00.000Z",
    updated_at: "2026-11-01T00:00:00.000Z",
  });
  return id;
}
async function comments(postId: string) {
  return (await store.listComments()).filter(
    (comment) => comment.post_id === postId,
  );
}

test("comments remain oldest first, break timestamp ties by ID, and edits preserve position", async () => {
  const postId = await post();
  const older: SharedComment = {
    id: randomUUID(),
    post_id: postId,
    member_id: "yeeun",
    body: "오래된 댓글",
    created_at: "2026-11-01T00:00:00.000Z",
    updated_at: "2026-11-01T00:00:00.000Z",
  };
  const newer: SharedComment = {
    ...older,
    id: randomUUID(),
    member_id: "dohyeon",
    body: "새 댓글",
    created_at: "2026-11-02T00:00:00.000Z",
    updated_at: "2026-11-02T00:00:00.000Z",
  };
  const tie = { ...newer, id: randomUUID(), member_id: "jieun" as const };
  await store.saveComment(newer);
  await store.saveComment(tie);
  await store.saveComment(older);
  const order = [older.id, ...[newer.id, tie.id].sort()];
  assert.deepEqual(
    (await comments(postId)).map((comment) => comment.id),
    order,
  );
  await writeComment("yeeun", { id: older.id, postId, body: " 수정한 댓글 " });
  const updated = await comments(postId);
  assert.deepEqual(
    updated.map((comment) => comment.id),
    order,
  );
  assert.equal(updated[0].created_at, older.created_at);
  assert.equal(updated[0].body, "수정한 댓글");
});

test("all members can comment but only the comment author can edit or delete, including the post owner", async () => {
  const postId = await post();
  for (const id of ["dohyeon", "yeeun", "jieun"] as const)
    await writeComment(id, { postId, body: `${id} 댓글` });
  const original = (await comments(postId)).find(
    (comment) => comment.member_id === "yeeun",
  )!;
  await assert.rejects(
    () =>
      writeComment("dohyeon", {
        id: original.id,
        postId,
        body: "게시글 작성자의 수정 시도",
      }),
    /본인의 댓글/,
  );
  await assert.rejects(
    () => store.removeComment(original.id, "jieun"),
    /본인의 댓글/,
  );
  const otherPost = await post("yeeun");
  await assert.rejects(() =>
    writeComment("yeeun", {
      id: original.id,
      postId: otherPost,
      body: "다른 게시글로 이동",
    }),
  );
  assert.equal(
    (await comments(postId)).find((comment) => comment.id === original.id)!
      .body,
    original.body,
  );
  await writeComment("yeeun", { id: original.id, postId, body: "본인 수정" });
  await store.removeComment(original.id, "yeeun");
  assert.equal((await comments(postId)).length, 2);
  assert.ok(
    !(await store.listComments()).some((comment) => comment.id === original.id),
  );
});

test("comments reject invalid IDs, blank or oversized bodies, missing parents, and stale edits", async () => {
  const postId = await post();
  for (const body of ["", "  \n ", "가".repeat(1001)])
    await assert.rejects(() => writeComment("dohyeon", { postId, body }));
  await assert.rejects(() =>
    writeComment("dohyeon", { postId: "invalid", body: "댓글" }),
  );
  await assert.rejects(() =>
    writeComment("dohyeon", { id: "", postId, body: "댓글" }),
  );
  await assert.rejects(() =>
    writeComment("dohyeon", { postId: randomUUID(), body: "부모 없음" }),
  );
  await assert.rejects(() =>
    writeComment("dohyeon", {
      id: randomUUID(),
      postId,
      body: "삭제된 댓글 수정",
    }),
  );
  assert.equal((await comments(postId)).length, 0);
  await writeComment("dohyeon", { postId, body: "가".repeat(1000) });
  assert.equal((await comments(postId))[0].body.length, 1000);
});

test("deleting a post cascades its comments and preserves comments on other posts", async () => {
  const first = await post();
  const second = await post("yeeun");
  await writeComment("yeeun", { postId: first, body: "첫 글 댓글" });
  await writeComment("jieun", { postId: first, body: "첫 글의 다른 댓글" });
  await writeComment("dohyeon", { postId: second, body: "다른 글 댓글" });
  await assert.rejects(() => store.removePost(first, "jieun"));
  assert.equal((await comments(first)).length, 2);
  await store.removePost(first, "dohyeon");
  assert.equal((await comments(first)).length, 0);
  assert.equal((await comments(second)).length, 1);
});
