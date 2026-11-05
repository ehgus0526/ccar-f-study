import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { MEMBERS } from "./catalog.ts";
import type { MemberId, SharedPost, Todo } from "./types.ts";

export function storageMode() {
  if (process.env.STUDY_STORAGE === "supabase") {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY)
      throw new Error("Supabase 연결 설정이 필요합니다.");
    return "supabase";
  }
  if (process.env.VERCEL || process.env.STUDY_STORAGE !== "local")
    throw new Error(
      "데이터 저장소 설정이 필요합니다. .env.example을 확인해 주세요.",
    );
  return "local";
}
export function dataDirectory() {
  return process.env.STUDY_DATA_DIR || join(process.cwd(), ".data");
}
const databases = new Map<string, DatabaseSync>();
export function localDb() {
  const directory = dataDirectory();
  const cached = databases.get(directory);
  if (cached) return cached;
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(directory, "study.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS members(id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS login_attempts(id TEXT PRIMARY KEY, identifier TEXT NOT NULL, attempted_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS login_attempts_lookup ON login_attempts(identifier, attempted_at);
    CREATE TABLE IF NOT EXISTS todos(id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), curriculum_id TEXT, title TEXT NOT NULL, date TEXT NOT NULL, completed_at TEXT, note TEXT NOT NULL DEFAULT '', photo_key TEXT, created_at TEXT NOT NULL, batch_id TEXT NOT NULL, UNIQUE(member_id, batch_id, date));
    CREATE INDEX IF NOT EXISTS todos_date ON todos(date);
    CREATE TABLE IF NOT EXISTS shared_posts(id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), body TEXT NOT NULL, url TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  `);
  const hashes = JSON.parse(
    process.env.STUDY_PASSWORD_HASHES || "{}",
  ) as Record<string, string>;
  for (const member of MEMBERS) {
    if (hashes[member.id])
      db.prepare(
        "INSERT INTO members(id,name,color,password_hash) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,color=excluded.color,password_hash=excluded.password_hash",
      ).run(member.id, member.name, member.color, hashes[member.id]);
  }
  databases.set(directory, db);
  return db;
}

export async function supabase(path: string, init: RequestInit = {}) {
  const response = await fetch(`${process.env.SUPABASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: process.env.SUPABASE_SECRET_KEY!,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    // Do not include remote request/response bodies: they can contain sensitive values.
    console.error(
      "Storage request failed:",
      response.status,
      path.split("?")[0],
    );
    throw new Error("저장소 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.");
  }
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}
async function rows<T>(
  table: string,
  filters: Record<string, string> = {},
): Promise<T[]> {
  return supabase(`/rest/v1/${table}?${new URLSearchParams(filters)}`);
}
export async function memberHash(id: MemberId): Promise<string | null> {
  if (storageMode() === "local")
    return (
      (
        localDb()
          .prepare("SELECT password_hash FROM members WHERE id=?")
          .get(id) as { password_hash: string } | undefined
      )?.password_hash ?? null
    );
  return (
    (
      await rows<{ password_hash: string }>("members", {
        id: `eq.${id}`,
        select: "password_hash",
      })
    )[0]?.password_hash ?? null
  );
}
export async function insertSession(
  token_hash: string,
  member_id: MemberId,
  expires_at: string,
) {
  if (storageMode() === "local") {
    localDb()
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run(token_hash, member_id, expires_at);
    return;
  }
  await supabase("/rest/v1/sessions", {
    method: "POST",
    body: JSON.stringify({ token_hash, member_id, expires_at }),
  });
}
export async function sessionMember(
  token_hash: string,
): Promise<MemberId | null> {
  const now = new Date().toISOString();
  if (storageMode() === "local")
    return (
      (
        localDb()
          .prepare(
            "SELECT member_id FROM sessions WHERE token_hash=? AND expires_at>?",
          )
          .get(token_hash, now) as { member_id: MemberId } | undefined
      )?.member_id ?? null
    );
  return (
    (
      await rows<{ member_id: MemberId }>("sessions", {
        token_hash: `eq.${token_hash}`,
        expires_at: `gt.${now}`,
        select: "member_id",
      })
    )[0]?.member_id ?? null
  );
}
export async function deleteSession(token_hash: string) {
  if (storageMode() === "local") {
    localDb()
      .prepare("DELETE FROM sessions WHERE token_hash=?")
      .run(token_hash);
    return;
  }
  await supabase(
    `/rest/v1/sessions?${new URLSearchParams({ token_hash: `eq.${token_hash}` })}`,
    { method: "DELETE" },
  );
}
export async function failedAttemptCount(identifier: string): Promise<number> {
  const since = new Date(Date.now() - 15 * 60000).toISOString();
  if (storageMode() === "local")
    return (
      localDb()
        .prepare(
          "SELECT count(*) AS count FROM login_attempts WHERE identifier=? AND attempted_at>?",
        )
        .get(identifier, since) as { count: number }
    ).count;
  return (
    await rows("login_attempts", {
      identifier: `eq.${identifier}`,
      attempted_at: `gt.${since}`,
      select: "id",
      limit: "10",
    })
  ).length;
}
export async function recordFailedAttempt(identifiers: string[]) {
  const attempted_at = new Date().toISOString();
  if (storageMode() === "local") {
    const db = localDb();
    for (const identifier of identifiers)
      db.prepare("INSERT INTO login_attempts VALUES(?,?,?)").run(
        randomUUID(),
        identifier,
        attempted_at,
      );
    db.prepare("DELETE FROM login_attempts WHERE attempted_at<?").run(
      new Date(Date.now() - 86400000).toISOString(),
    );
    return;
  }
  await supabase("/rest/v1/login_attempts", {
    method: "POST",
    body: JSON.stringify(
      identifiers.map((identifier) => ({
        id: randomUUID(),
        identifier,
        attempted_at,
      })),
    ),
  });
}
export async function listTodos(from: string, to: string): Promise<Todo[]> {
  if (storageMode() === "local")
    return localDb()
      .prepare(
        "SELECT * FROM todos WHERE date>=? AND date<=? ORDER BY created_at",
      )
      .all(from, to) as Todo[];
  return rows<Todo>("todos", {
    and: `(date.gte.${from},date.lte.${to})`,
    order: "created_at.asc",
  });
}
export async function completedCurriculumIds(
  memberId: MemberId,
): Promise<string[]> {
  const completed =
    storageMode() === "local"
      ? (localDb()
          .prepare(
            "SELECT DISTINCT curriculum_id FROM todos WHERE member_id=? AND completed_at IS NOT NULL AND curriculum_id IS NOT NULL",
          )
          .all(memberId) as { curriculum_id: string }[])
      : await rows<{ curriculum_id: string }>("todos", {
          select: "curriculum_id",
          member_id: `eq.${memberId}`,
          completed_at: "not.is.null",
          curriculum_id: "not.is.null",
        });
  return [...new Set(completed.map((todo) => todo.curriculum_id))];
}
export async function getTodo(id: string): Promise<Todo | null> {
  if (storageMode() === "local")
    return (
      (localDb().prepare("SELECT * FROM todos WHERE id=?").get(id) as
        Todo | undefined) ?? null
    );
  return (await rows<Todo>("todos", { id: `eq.${id}` }))[0] ?? null;
}
export async function insertTodos(todos: Todo[]) {
  if (storageMode() === "local") {
    const db = localDb();
    db.exec("BEGIN IMMEDIATE");
    try {
      const statement = db.prepare(
        "INSERT INTO todos(id,member_id,curriculum_id,title,date,completed_at,note,photo_key,created_at,batch_id) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(member_id,batch_id,date) DO NOTHING",
      );
      for (const t of todos)
        statement.run(
          t.id,
          t.member_id,
          t.curriculum_id,
          t.title,
          t.date,
          t.completed_at,
          t.note,
          t.photo_key,
          t.created_at,
          t.batch_id,
        );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return;
  }
  await supabase("/rest/v1/todos?on_conflict=member_id,batch_id,date", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify(todos),
  });
}
export async function patchTodo(
  id: string,
  memberId: MemberId,
  changes: Partial<
    Pick<
      Todo,
      "title" | "date" | "curriculum_id" | "completed_at" | "note" | "photo_key"
    >
  >,
) {
  if (storageMode() === "local") {
    const entries = Object.entries(changes);
    const allowed = [
      "title",
      "date",
      "curriculum_id",
      "completed_at",
      "note",
      "photo_key",
    ];
    if (!entries.length || entries.some(([key]) => !allowed.includes(key)))
      throw new Error("수정할 내용을 확인해 주세요.");
    const result = localDb()
      .prepare(
        `UPDATE todos SET ${entries.map(([key]) => `${key}=?`).join(",")} WHERE id=? AND member_id=?`,
      )
      .run(...entries.map(([, value]) => value ?? null), id, memberId);
    if (!result.changes) throw new Error("본인의 일정만 수정할 수 있습니다.");
    return;
  }
  const updated = await supabase(
    `/rest/v1/todos?${new URLSearchParams({ id: `eq.${id}`, member_id: `eq.${memberId}` })}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(changes),
    },
  );
  if (!updated.length) throw new Error("본인의 일정만 수정할 수 있습니다.");
}
export async function removeTodo(id: string, memberId: MemberId) {
  if (storageMode() === "local") {
    if (
      !localDb()
        .prepare("DELETE FROM todos WHERE id=? AND member_id=?")
        .run(id, memberId).changes
    )
      throw new Error("본인의 일정만 삭제할 수 있습니다.");
    return;
  }
  const removed = await supabase(
    `/rest/v1/todos?${new URLSearchParams({ id: `eq.${id}`, member_id: `eq.${memberId}` })}`,
    { method: "DELETE", headers: { Prefer: "return=representation" } },
  );
  if (!removed.length) throw new Error("본인의 일정만 삭제할 수 있습니다.");
}
export async function listPosts(): Promise<SharedPost[]> {
  if (storageMode() === "local")
    return localDb()
      .prepare("SELECT * FROM shared_posts ORDER BY created_at DESC")
      .all() as SharedPost[];
  return rows<SharedPost>("shared_posts", { order: "created_at.desc" });
}
export async function savePost(post: SharedPost, editing = false) {
  if (storageMode() === "local") {
    const db = localDb();
    if (editing) {
      if (
        !db
          .prepare(
            "UPDATE shared_posts SET body=?,url=?,updated_at=? WHERE id=? AND member_id=?",
          )
          .run(post.body, post.url, post.updated_at, post.id, post.member_id)
          .changes
      )
        throw new Error("본인의 글만 수정할 수 있습니다.");
    } else
      db.prepare("INSERT INTO shared_posts VALUES(?,?,?,?,?,?)").run(
        post.id,
        post.member_id,
        post.body,
        post.url,
        post.created_at,
        post.updated_at,
      );
    return;
  }
  const suffix = editing
    ? `?${new URLSearchParams({ id: `eq.${post.id}`, member_id: `eq.${post.member_id}` })}`
    : "";
  const value = editing
    ? { body: post.body, url: post.url, updated_at: post.updated_at }
    : post;
  const changed = await supabase(`/rest/v1/shared_posts${suffix}`, {
    method: editing ? "PATCH" : "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(value),
  });
  if (editing && !changed.length)
    throw new Error("본인의 글만 수정할 수 있습니다.");
}
export async function removePost(id: string, memberId: MemberId) {
  if (storageMode() === "local") {
    if (
      !localDb()
        .prepare("DELETE FROM shared_posts WHERE id=? AND member_id=?")
        .run(id, memberId).changes
    )
      throw new Error("본인의 글만 삭제할 수 있습니다.");
    return;
  }
  const removed = await supabase(
    `/rest/v1/shared_posts?${new URLSearchParams({ id: `eq.${id}`, member_id: `eq.${memberId}` })}`,
    { method: "DELETE", headers: { Prefer: "return=representation" } },
  );
  if (!removed.length) throw new Error("본인의 글만 삭제할 수 있습니다.");
}
