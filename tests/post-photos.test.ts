import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import * as store from "../lib/store.ts";
import { writePost, deletePost } from "../lib/service.ts";
import { localPhoto, postPhotoPath } from "../lib/photos.ts";

const directory = mkdtempSync(join(tmpdir(), "nodit-post-photos-"));
// Start from an existing database, before the image column was added.
const legacyId = randomUUID();
const legacy = new DatabaseSync(join(directory, "study.sqlite"));
legacy.exec(`
  CREATE TABLE members(id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, password_hash TEXT NOT NULL);
  INSERT INTO members VALUES('dohyeon','도현','gold','unused');
  CREATE TABLE shared_posts(id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), body TEXT NOT NULL, url TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
`);
legacy
  .prepare("INSERT INTO shared_posts VALUES(?,?,?,?,?,?)")
  .run(legacyId, "dohyeon", "기존 글", "", "2026-11-01", "2026-11-01");
legacy.close();
process.env.STUDY_STORAGE = "local";
process.env.STUDY_DATA_DIR = directory;
process.env.STUDY_PASSWORD_HASHES = "{}";
delete process.env.VERCEL;
for (const id of ["yeeun", "jieun"])
  store
    .localDb()
    .prepare("INSERT INTO members VALUES(?,?,?,?)")
    .run(id, id, "gold", "unused");
after(() => {
  store.localDb().close();
  rmSync(directory, { recursive: true, force: true });
});
const png = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNlsAAAAASUVORK5CYII=",
    "base64",
  ),
);
const input = { body: "이미지 첨부 글", url: "" };

test("existing SQLite posts gain a nullable photo column without losing content", async () => {
  const post = await store.getPost(legacyId);
  assert.equal(post?.body, "기존 글");
  assert.equal(post?.photo_key, null);
  assert.equal(postPhotoPath(null), null);
  assert.equal(postPhotoPath("../private.jpg"), null);
});

test("posts save an image privately, preserve it during text edits, and retain creation time", async () => {
  const id = await writePost("dohyeon", { ...input, photo: png });
  const original = (await store.getPost(id))!;
  assert.ok(original.photo_key?.startsWith(`dohyeon/${id}/`));
  assert.deepEqual(
    new Uint8Array((await localPhoto(original.photo_key!))!),
    png,
  );
  assert.equal(
    postPhotoPath(original.photo_key),
    `/api/post-photos/${original.photo_key}`,
  );
  await writePost("dohyeon", { ...input, id, body: "본문만 수정" });
  const edited = (await store.getPost(id))!;
  assert.equal(edited.body, "본문만 수정");
  assert.equal(edited.photo_key, original.photo_key);
  assert.equal(edited.created_at, original.created_at);
});

test("replacement and removal clean up the old file only after saving the post", async () => {
  const id = await writePost("yeeun", { ...input, photo: png });
  const first = (await store.getPost(id))!.photo_key!;
  await writePost("yeeun", { ...input, id, photo: png });
  const second = (await store.getPost(id))!.photo_key!;
  assert.notEqual(second, first);
  assert.equal(await localPhoto(first), null);
  assert.ok(await localPhoto(second));
  await writePost("yeeun", { ...input, id, removePhoto: true });
  assert.equal((await store.getPost(id))!.photo_key, null);
  assert.equal(await localPhoto(second), null);
});

test("post deletion removes its image and comments while preserving other posts", async () => {
  const id = await writePost("jieun", { ...input, photo: png });
  const key = (await store.getPost(id))!.photo_key!;
  await store.saveComment({
    id: randomUUID(),
    post_id: id,
    member_id: "dohyeon",
    body: "댓글",
    created_at: "2026-11-01",
    updated_at: "2026-11-01",
  });
  await deletePost("jieun", id);
  assert.equal(await store.getPost(id), null);
  assert.equal(await localPhoto(key), null);
  assert.ok(
    !(await store.listComments()).some((comment) => comment.post_id === id),
  );
  assert.ok(await store.getPost(legacyId));
});

test("another member cannot replace, remove, or delete the author's image", async () => {
  const id = await writePost("dohyeon", { ...input, photo: png });
  const original = (await store.getPost(id))!;
  for (const extra of [{ photo: png }, { removePhoto: true }])
    await assert.rejects(
      () => writePost("yeeun", { ...input, ...extra, id }),
      /본인의 글/,
    );
  await assert.rejects(() => deletePost("yeeun", id), /본인의 글/);
  assert.deepEqual(await store.getPost(id), original);
  assert.ok(await localPhoto(original.photo_key!));
});

test("invalid images, oversized files and invalid post fields never create records", async () => {
  const count = (await store.listPosts()).length;
  for (const photo of [
    new Uint8Array(),
    new TextEncoder().encode("<svg>bad</svg>"),
    new Uint8Array(2097153),
  ])
    await assert.rejects(() => writePost("dohyeon", { ...input, photo }));
  for (const fields of [
    { body: " " },
    { url: "javascript:alert(1)" },
    { id: "" },
    { id: randomUUID() },
  ])
    await assert.rejects(() =>
      writePost("dohyeon", { ...input, ...fields, photo: png }),
    );
  assert.equal((await store.listPosts()).length, count);
});

test("failed database updates roll back the uploaded file and keep the original image and text", async () => {
  const id = await writePost("dohyeon", { ...input, photo: png });
  const original = (await store.getPost(id))!;
  const photoDirectory = join(directory, "photos", "dohyeon", id);
  const files = readdirSync(photoDirectory);
  store
    .localDb()
    .exec(
      "CREATE TRIGGER reject_post_update BEFORE UPDATE ON shared_posts WHEN NEW.body='DB failure' BEGIN SELECT RAISE(ABORT,'fixture write failure'); END;",
    );
  try {
    await assert.rejects(() =>
      writePost("dohyeon", { id, body: "DB failure", url: "", photo: png }),
    );
    assert.deepEqual(await store.getPost(id), original);
    assert.deepEqual(readdirSync(photoDirectory), files);
    assert.ok(await localPhoto(original.photo_key!));
  } finally {
    store.localDb().exec("DROP TRIGGER reject_post_update");
  }
});
