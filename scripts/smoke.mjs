import { createHash, randomBytes, randomUUID } from "node:crypto";
try {
  process.loadEnvFile(".env.local");
} catch {}
const store = await import("../lib/store.ts");
const service = await import("../lib/service.ts");
const photos = await import("../lib/photos.ts");
const { MEMBERS } = await import("../lib/catalog.ts");
const base = process.env.SMOKE_URL || "http://localhost:3000";
const tokens = [];
const todoIds = [];
const check = (condition, description) => {
  if (!condition) throw new Error(description);
  console.log(`PASS ${description}`);
};
try {
  const anonymous = await fetch(base, { redirect: "manual" });
  check(
    anonymous.status === 307 && anonymous.headers.get("location") === "/login",
    "미로그인 페이지 접근 차단",
  );
  for (const member of MEMBERS) {
    const token = randomBytes(32).toString("hex");
    const hash = createHash("sha256").update(token).digest("hex");
    tokens.push({ token, hash });
    await store.insertSession(
      hash,
      member.id,
      new Date(Date.now() + 60000).toISOString(),
    );
    for (const path of ["/", "/curriculum", "/quiz", "/shared"]) {
      const response = await fetch(`${base}${path}`, {
        headers: { Cookie: `ccarf_session=${token}` },
      });
      check(response.status === 200, `${member.name} ${path} 공유 화면 접근`);
    }
  }
  const batchId = randomUUID();
  await service.createTodos("dohyeon", {
    batchId,
    title: "[검증용] HTTP 사진",
    note: "",
    dates: ["2026-11-05"],
    curriculumId: null,
  });
  const todo = (await store.listTodos("2026-11-05", "2026-11-05")).find(
    (todo) => todo.batch_id === batchId,
  );
  todoIds.push(todo.id);
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  const form = () => {
    const body = new FormData();
    body.set("todoId", todo.id);
    body.set("photo", new Blob([bytes], { type: "image/png" }), "proof.png");
    return body;
  };
  const upload = await fetch(`${base}/api/photos`, {
    method: "POST",
    headers: { Cookie: `ccarf_session=${tokens[0].token}`, Origin: base },
    body: form(),
  });
  const uploadResult = await upload.json();
  check(
    upload.status === 200 && uploadResult.ok,
    "본인 일정에 실제 사진 업로드",
  );
  const read = await fetch(`${base}${uploadResult.photoUrl}`, {
    headers: { Cookie: `ccarf_session=${tokens[1].token}` },
  });
  check(
    read.status === 200 && Buffer.from(await read.arrayBuffer()).equals(bytes),
    "다른 구성원이 인증 사진 열람",
  );
  check(
    (await fetch(`${base}${uploadResult.photoUrl}`)).status === 401,
    "비로그인 사진 열람 차단",
  );
  const other = await fetch(`${base}/api/photos`, {
    method: "POST",
    headers: { Cookie: `ccarf_session=${tokens[1].token}`, Origin: base },
    body: form(),
  });
  check(other.status === 400, "다른 구성원의 사진 변경 차단");
  const crossOrigin = await fetch(`${base}/api/photos`, {
    method: "POST",
    headers: {
      Cookie: `ccarf_session=${tokens[0].token}`,
      Origin: "https://example.com",
    },
    body: form(),
  });
  check(crossOrigin.status === 403, "다른 출처의 사진 변경 요청 차단");
  await store.deleteSession(tokens[0].hash);
  const revoked = await fetch(base, {
    redirect: "manual",
    headers: { Cookie: `ccarf_session=${tokens[0].token}` },
  });
  check(revoked.status === 307, "폐기된 세션의 즉시 접근 차단");
} finally {
  for (const id of todoIds) {
    const todo = await store.getTodo(id);
    if (todo?.photo_key) await photos.removePhoto(todo.photo_key);
    if (todo) await store.removeTodo(id, todo.member_id);
  }
  for (const { hash } of tokens) await store.deleteSession(hash);
}
