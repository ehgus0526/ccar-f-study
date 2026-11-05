import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { MEMBERS } from "../lib/catalog.ts";
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";

try {
  process.loadEnvFile(".env.local");
} catch {}
const base = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!base || !key || !base.startsWith("https://"))
  throw new Error("SUPABASE_URL과 SUPABASE_SECRET_KEY를 먼저 설정해 주세요.");
const hashes = JSON.parse(process.env.STUDY_PASSWORD_HASHES || "{}");
const request = async (path, body, headers = {}) => {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json", ...headers },
    body,
  });
  if (!response.ok)
    throw new Error(
      `Supabase 초기화 실패 (${response.status}). schema.sql 적용 여부를 확인해 주세요.`,
    );
};
const members = MEMBERS.map((member) => {
  if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(hashes[member.id] || ""))
    throw new Error("먼저 npm run setup:members로 계정 해시를 생성해 주세요.");
  return { ...member, password_hash: hashes[member.id] };
});
await request("/rest/v1/members?on_conflict=id", JSON.stringify(members), {
  Prefer: "resolution=merge-duplicates",
});
const directory = process.env.STUDY_DATA_DIR || join(process.cwd(), ".data");
const file = join(directory, "study.sqlite");
if (process.argv.includes("--migrate-local") && existsSync(file)) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const todos = db.prepare("SELECT * FROM todos").all();
    const posts = db.prepare("SELECT * FROM shared_posts").all();
    for (const todo of todos) {
      if (!todo.photo_key) continue;
      const bytes = await readFile(join(directory, "photos", todo.photo_key));
      const ext = todo.photo_key.split(".").at(-1);
      await request(`/storage/v1/object/proofs/${todo.photo_key}`, bytes, {
        "Content-Type": `image/${ext === "jpg" ? "jpeg" : ext}`,
        "x-upsert": "true",
      });
    }
    for (const [table, records] of [
      ["todos", todos],
      ["shared_posts", posts],
    ]) {
      if (records.length)
        await request(
          `/rest/v1/${table}?on_conflict=id`,
          JSON.stringify(records),
          { Prefer: "resolution=merge-duplicates" },
        );
    }
    console.log(
      `로컬 일정 ${todos.length}개, 공유 글 ${posts.length}개와 연결 사진을 이전했습니다.`,
    );
  } finally {
    db.close();
  }
}
let env = "";
try {
  env = await readFile(".env.local", "utf8");
} catch {}
env = env.replace(/^STUDY_STORAGE=.*\n?/m, "");
await writeFile(".env.local", `STUDY_STORAGE=supabase\n${env}`, {
  mode: 0o600,
});
console.log(
  "Supabase 계정 등록과 저장소 전환이 완료됐습니다. 개발 서버를 재시작해 주세요.",
);
