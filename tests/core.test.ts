import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "../lib/password.ts";
import { calendarDates, isDate, shiftMonth, todayKST } from "../lib/dates.ts";
import { CURRICULUM, MEMBERS } from "../lib/catalog.ts";
import * as store from "../lib/store.ts";
import * as service from "../lib/service.ts";
import {
  localPhoto,
  photoType,
  putPhoto,
  removePhoto,
  validPhotoKey,
} from "../lib/photos.ts";
import { hasSameOrigin } from "../lib/request.ts";

const directory = mkdtempSync(join(tmpdir(), "ccarf-test-"));
process.env.STUDY_STORAGE = "local";
process.env.STUDY_DATA_DIR = directory;
delete process.env.VERCEL;
process.env.STUDY_PASSWORD_HASHES = JSON.stringify(
  Object.fromEntries(
    MEMBERS.map((member) => [member.id, hashPassword("010101")]),
  ),
);
after(() => {
  store.localDb().close();
  rmSync(directory, { recursive: true, force: true });
});

test("yymmdd passwords preserve leading zeroes and never store the original", () => {
  const hashed = hashPassword("010101");
  assert.equal(verifyPassword("010101", hashed), true);
  assert.equal(verifyPassword("10101", hashed), false);
  assert.equal(verifyPassword("010102", hashed), false);
  assert.equal(verifyPassword("010101", "malformed"), false);
  assert.notEqual(hashPassword("010101"), hashed);
  assert.throws(() => hashPassword("0101"));
});
test("completed curriculum history includes only the member's completed linked items", async () => {
  for (const [memberId, item, completed] of [
    ["dohyeon", "vocab-1", true],
    ["dohyeon", "vocab-1", true],
    ["dohyeon", "vocab-2", false],
    ["dohyeon", null, true],
    ["yeeun", "vocab-3", true],
  ] as const) {
    const batchId = randomUUID();
    await service.createTodos(memberId, {
      batchId,
      title: "완료 이력 검증",
      curriculumId: item,
      dates: ["2026-10-01"],
      note: "",
    });
    const todo = (await store.listTodos("2026-10-01", "2026-10-01")).find(
      (todo) => todo.batch_id === batchId,
    )!;
    if (completed) await service.completeTodo(memberId, todo.id, true);
  }
  assert.deepEqual(await store.completedCurriculumIds("dohyeon"), ["vocab-1"]);
  assert.deepEqual(await store.completedCurriculumIds("yeeun"), ["vocab-3"]);
  assert.deepEqual(await store.completedCurriculumIds("jieun"), []);
});
test("Korean calendar dates work across midnight, leap day, and year boundaries", () => {
  assert.equal(todayKST(new Date("2026-11-04T14:59:59Z")), "2026-11-04");
  assert.equal(todayKST(new Date("2026-11-04T15:00:00Z")), "2026-11-05");
  assert.equal(isDate("2026-02-29"), false);
  assert.equal(isDate("2028-02-29"), true);
  assert.equal(isDate("2026-13-01"), false);
  assert.equal(isDate(["2026-11-05"]), false);
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  const dates = calendarDates("2026-11");
  assert.equal(dates.length, 42);
  assert.equal(dates[0], "2026-11-01");
  assert.equal(dates.at(-1), "2026-12-12");
});
test("catalog matches the supplied 4 videos, 18 workbooks, and 4 vocabulary bundles", () => {
  assert.equal(CURRICULUM.length, 26);
  assert.equal(
    CURRICULUM.filter((item) => item.kind === "workbook").length,
    18,
  );
  assert.equal(new Set(CURRICULUM.map((item) => item.id)).size, 26);
});
test("batch creation is atomic, idempotent, and dates are independent", async () => {
  const batchId = randomUUID();
  const input = {
    batchId,
    title: "인증 테스트",
    curriculumId: "vocab-1",
    dates: ["2026-11-05", "2026-11-06", "2026-11-06"],
    note: "",
  };
  await service.createTodos("dohyeon", input);
  await service.createTodos("dohyeon", input);
  const todos = (await store.listTodos("2026-11-05", "2026-11-06")).filter(
    (todo) => todo.batch_id === batchId,
  );
  assert.equal(todos.length, 2);
  await service.completeTodo("dohyeon", todos[0].id, true);
  assert.ok((await store.getTodo(todos[0].id))!.completed_at);
  assert.equal((await store.getTodo(todos[1].id))!.completed_at, null);
  await assert.rejects(() =>
    service.createTodos("dohyeon", {
      ...input,
      batchId: randomUUID(),
      dates: ["2026-11-05", "2026-02-30"],
    }),
  );
  assert.equal((await store.listTodos("2026-11-05", "2026-11-06")).length, 2);
});
test("members can read shared plans but cannot edit or delete another member’s record", async () => {
  const todo = (await store.listTodos("2026-11-05", "2026-11-06"))[0];
  await assert.rejects(() => service.completeTodo("yeeun", todo.id, true));
  await assert.rejects(() =>
    service.updateTodo("jieun", todo.id, {
      title: "변경",
      date: "2026-11-07",
      curriculumId: null,
      note: "",
    }),
  );
  await assert.rejects(() => store.removeTodo(todo.id, "yeeun"));
  assert.equal((await store.getTodo(todo.id))!.title, "인증 테스트");
});
test("completion cancellation preserves proof notes", async () => {
  const todo = (await store.listTodos("2026-11-05", "2026-11-06"))[0];
  await store.patchTodo(todo.id, "dohyeon", { note: "배운 점" });
  await service.completeTodo("dohyeon", todo.id, false);
  assert.equal((await store.getTodo(todo.id))!.note, "배운 점");
  assert.equal((await store.getTodo(todo.id))!.completed_at, null);
});
test("sessions expire and are revoked immediately on logout", async () => {
  const token = randomUUID();
  await store.insertSession(
    token,
    "yeeun",
    new Date(Date.now() + 60000).toISOString(),
  );
  assert.equal(await store.sessionMember(token), "yeeun");
  await store.deleteSession(token);
  assert.equal(await store.sessionMember(token), null);
  await store.insertSession(
    token,
    "yeeun",
    new Date(Date.now() - 60000).toISOString(),
  );
  assert.equal(await store.sessionMember(token), null);
});
test("login failures are stored durably in the DB", async () => {
  assert.equal(await store.failedAttemptCount("test-name"), 0);
  await store.recordFailedAttempt(["test-name", "test-ip"]);
  assert.equal(await store.failedAttemptCount("test-name"), 1);
  assert.equal(await store.failedAttemptCount("test-ip"), 1);
  assert.equal(
    store.localDb().prepare("SELECT count(*) AS n FROM login_attempts").get()!
      .n,
    2,
  );
});
test("shared links reject executable schemes and post ownership is enforced", async () => {
  assert.throws(() => service.safeUrl("javascript:alert(1)"));
  assert.throws(() => service.safeUrl("data:text/html,hello"));
  assert.throws(() => service.safeUrl("https://user:password@example.com"));
  assert.equal(
    service.safeUrl("https://example.com/guide"),
    "https://example.com/guide",
  );
  await service.writePost("jieun", {
    body: "함께 볼 자료",
    url: "https://example.com",
  });
  const post = (await store.listPosts())[0];
  await assert.rejects(() =>
    service.writePost("yeeun", { id: post.id, body: "변경", url: "" }),
  );
  await assert.rejects(() => store.removePost(post.id, "dohyeon"));
  await store.removePost(post.id, "jieun");
  assert.equal((await store.listPosts()).length, 0);
});
test("proof validation rejects disguised files, traversal paths, and oversized uploads", async () => {
  assert.equal(
    photoType(new TextEncoder().encode("<script>bad</script>")),
    null,
  );
  assert.equal(validPhotoKey("../../etc/passwd"), false);
  const bytes = new Uint8Array(20);
  bytes.set([0xff, 0xd8, 0xff]);
  assert.equal(photoType(bytes), "jpg");
  const key = await putPhoto("dohyeon", randomUUID(), bytes);
  assert.equal(validPhotoKey(key), true);
  assert.ok(await localPhoto(key));
  await removePhoto(key);
  assert.equal(await localPhoto(key), null);
  const large = new Uint8Array(2097153);
  large.set([0xff, 0xd8, 0xff]);
  await assert.rejects(() => putPhoto("dohyeon", randomUUID(), large));
});
test("upload CSRF checks use the public request host, including a proxy", () => {
  assert.equal(
    hasSameOrigin(
      new Headers({ origin: "http://localhost:3000", host: "localhost:3000" }),
    ),
    true,
  );
  assert.equal(
    hasSameOrigin(
      new Headers({
        origin: "https://study.example.com",
        host: "internal:3000",
        "x-forwarded-host": "study.example.com",
      }),
    ),
    true,
  );
  assert.equal(
    hasSameOrigin(
      new Headers({
        origin: "https://evil.example",
        host: "study.example.com",
      }),
    ),
    false,
  );
  assert.equal(
    hasSameOrigin(new Headers({ host: "study.example.com" })),
    false,
  );
  assert.equal(
    hasSameOrigin(new Headers({ origin: "null", host: "study.example.com" })),
    false,
  );
});
