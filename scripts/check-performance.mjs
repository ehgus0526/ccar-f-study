// Isolated production checks: no requests or writes reach the real Supabase project.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const baseline = process.argv.includes("--baseline");
const token = "a".repeat(64);
const tokenHash = createHash("sha256").update(token).digest("hex");
const requests = [];
const posts = [];
const state = { failNextTodoWrite: false };
let revoked = false;
const todos = Array.from({ length: 8 }, (_, i) => {
  const id = randomUUID();
  const member_id = ["dohyeon", "yeeun", "jieun"][i % 3];
  return {
    id,
    member_id,
    curriculum_id: "vocab-1",
    title: `검증용 학습 ${i + 1}`,
    date: i === 7 ? "2026-11-06" : "2026-11-05",
    completed_at: i % 2 ? null : "2026-11-05T01:00:00.000Z",
    note: "",
    photo_key: i < 4 ? `${member_id}/${id}/${randomUUID()}.jpg` : null,
    created_at: "2026-11-01T01:00:00.000Z",
    batch_id: randomUUID(),
  };
});
const mock = createServer(async (req, res) => {
  const url = new URL(req.url, "http://mock.local");
  requests.push(url);
  await delay(30);
  let result;
  if (url.pathname === "/rest/v1/sessions")
    result =
      !revoked && url.searchParams.get("token_hash") === `eq.${tokenHash}`
        ? [{ member_id: "dohyeon" }]
        : [];
  else if (url.pathname === "/rest/v1/todos") {
    const id = url.searchParams.get("id");
    if (req.method === "PATCH" || req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const changes = JSON.parse(body);
      await delay(300);
      if (state.failNextTodoWrite) {
        state.failNextTodoWrite = false;
        res.writeHead(503);
        res.end();
        return;
      }
      if (req.method === "POST") {
        todos.push(...changes);
        result = changes;
      } else {
        result = todos.filter(
          (todo) =>
            `eq.${todo.id}` === id &&
            `eq.${todo.member_id}` === url.searchParams.get("member_id"),
        );
        for (const todo of result) Object.assign(todo, changes);
      }
    } else if (id) result = todos.filter((todo) => `eq.${todo.id}` === id);
    else if (url.searchParams.get("select") === "curriculum_id")
      result = todos
        .filter(
          (todo) =>
            `eq.${todo.member_id}` === url.searchParams.get("member_id") &&
            todo.completed_at &&
            todo.curriculum_id,
        )
        .map((todo) => ({ curriculum_id: todo.curriculum_id }));
    else result = todos;
  } else if (url.pathname === "/rest/v1/shared_posts") {
    if (req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const post = JSON.parse(body);
      posts.push(post);
      result = [post];
    } else result = posts;
  } else if (url.pathname.startsWith("/storage/v1/object/sign/proofs/"))
    result = {
      signedURL: `/object/sign/proofs/${url.pathname.split("/proofs/")[1]}?token=fake-test-signature`,
    };
  else {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result));
});
await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
const mockBase = `http://127.0.0.1:${mock.address().port}`;
const reservation = createServer();
await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const base = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    env: {
      ...process.env,
      STUDY_STORAGE: "supabase",
      SUPABASE_URL: mockBase,
      SUPABASE_SECRET_KEY: "fake-test-key",
      LOGIN_HASH_SECRET: "isolated-performance-check",
      STUDY_PASSWORD_HASHES: "{}",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
for (const stream of [server.stdout, server.stderr])
  stream.on("data", (chunk) => {
    output = (output + chunk).slice(-4000);
  });
const get = (path, authenticated = true, extra = {}) =>
  fetch(`${base}${path}`, {
    redirect: "manual",
    headers: authenticated ? { Cookie: `ccarf_session=${token}` } : {},
    ...extra,
  });
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      if ((await get("/login", false)).status === 200) {
        ready = true;
        break;
      }
    } catch {}
    if (server.exitCode !== null) throw new Error(output);
    await delay(100);
  }
  assert.ok(ready, "production server started");
  requests.length = 0;
  assert.equal((await get("/", false)).status, 307);
  assert.equal(
    requests.length,
    0,
    "anonymous visitors do not trigger database reads",
  );
  for (const path of [
    "/?month=2026-11&date=2026-11-05",
    "/curriculum",
    "/quiz",
    "/shared",
  ]) {
    requests.length = 0;
    const started = performance.now();
    const response = await get(path);
    const html = await response.text();
    assert.equal(response.status, 200, path);
    const sessions = requests.filter(
      (url) => url.pathname === "/rest/v1/sessions",
    ).length;
    const signatures = requests.filter((url) =>
      url.pathname.startsWith("/storage/"),
    ).length;
    const visibleEntries = (html.match(/class="calendar-entry /g) || []).length;
    console.log(
      JSON.stringify({
        mode: baseline ? "before" : "after",
        path,
        requests: requests.length,
        sessions,
        signatures,
        visibleEntries,
        ms: Math.round(performance.now() - started),
      }),
    );
    if (!baseline) {
      assert.equal(sessions, 1, "one session lookup per render");
      assert.equal(signatures, 0, "no eager photo signing");
      if (path.startsWith("/?")) {
        assert.equal(
          visibleEntries,
          todos.length,
          "all calendar entries are rendered",
        );
        assert.ok(!html.includes("more-entries"));
        assert.ok(html.includes("nodit"));
      }
      if (path === "/curriculum") {
        const query = requests.find(
          (url) => url.pathname === "/rest/v1/todos",
        ).searchParams;
        assert.equal(query.get("select"), "curriculum_id");
        assert.equal(query.get("member_id"), "eq.dohyeon");
        assert.equal(query.get("completed_at"), "not.is.null");
      }
    }
  }
  if (!baseline) {
    const key = todos[0].photo_key;
    requests.length = 0;
    assert.equal((await get(`/api/photos/${key}`, false)).status, 401);
    assert.equal(requests.length, 0);
    const photo = await get(`/api/photos/${key}`);
    assert.equal(photo.status, 307);
    assert.equal(photo.headers.get("cache-control"), "private, no-store");
    assert.ok(photo.headers.get("location").startsWith(mockBase));
    assert.equal(
      requests.filter((url) => url.pathname.startsWith("/storage/")).length,
      1,
    );
    const invalidKey = `yeeun/${todos[0].id}/${randomUUID()}.jpg`;
    requests.length = 0;
    assert.equal((await get(`/api/photos/${invalidKey}`)).status, 404);
    assert.equal(
      requests.filter((url) => url.pathname.startsWith("/storage/")).length,
      0,
    );
  }
  if (process.argv.includes("--browser")) {
    const { checkBrowser } = await import("./check-browser.mjs");
    await checkBrowser({ base, token, requests, todos, state });
  }
  revoked = true;
  assert.equal(
    (await get("/quiz")).status,
    307,
    "revoked session is checked again on the next request",
  );
  console.log(
    "PASS production HTTP checks; isolated Supabase adds 30 ms per request.",
  );
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => mock.close(resolve));
}
