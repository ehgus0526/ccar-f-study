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
const comments = [];
const photos = new Map();
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNlsAAAAASUVORK5CYII=",
  "base64",
);
const state = {
  failNextTodoWrite: false,
  failNextCommentWrite: false,
  failNextPostWrite: false,
  failNextPhotoWrite: false,
};
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
    if (req.method === "POST" || req.method === "PATCH") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const post = JSON.parse(body);
      if (state.failNextPostWrite) {
        state.failNextPostWrite = false;
        res.writeHead(503);
        res.end();
        return;
      }
      if (req.method === "PATCH") {
        result = posts.filter(
          (item) =>
            `eq.${item.id}` === url.searchParams.get("id") &&
            `eq.${item.member_id}` === url.searchParams.get("member_id"),
        );
        for (const item of result) Object.assign(item, post);
      } else {
        posts.push(post);
        // Seed fixture replies to verify ordering and controls for different authors.
        for (const [index, memberId] of ["yeeun", "dohyeon"].entries()) {
          const created = new Date(
            Date.parse(post.created_at) + index,
          ).toISOString();
          comments.push({
            id: randomUUID(),
            post_id: post.id,
            member_id: memberId,
            body: index ? "나중 쓴 댓글" : "먼저 쓴 댓글",
            created_at: created,
            updated_at: created,
          });
        }
        result = [post];
      }
    } else if (req.method === "DELETE") {
      result = posts.filter(
        (item) =>
          `eq.${item.id}` === url.searchParams.get("id") &&
          `eq.${item.member_id}` === url.searchParams.get("member_id"),
      );
      for (const item of result) {
        posts.splice(posts.indexOf(item), 1);
        for (let i = comments.length - 1; i >= 0; i--)
          if (comments[i].post_id === item.id) comments.splice(i, 1);
      }
    } else
      result = url.searchParams.has("id")
        ? posts.filter((item) => `eq.${item.id}` === url.searchParams.get("id"))
        : posts;
  } else if (url.pathname === "/rest/v1/shared_comments") {
    if (req.method === "POST" || req.method === "PATCH") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const changes = JSON.parse(body);
      if (state.failNextCommentWrite) {
        state.failNextCommentWrite = false;
        res.writeHead(503);
        res.end();
        return;
      }
      if (req.method === "POST") {
        comments.push(changes);
        result = [changes];
      } else {
        result = comments.filter(
          (comment) =>
            `eq.${comment.id}` === url.searchParams.get("id") &&
            `eq.${comment.post_id}` === url.searchParams.get("post_id") &&
            `eq.${comment.member_id}` === url.searchParams.get("member_id"),
        );
        for (const comment of result) Object.assign(comment, changes);
      }
    } else if (req.method === "DELETE") {
      result = comments.filter(
        (comment) =>
          `eq.${comment.id}` === url.searchParams.get("id") &&
          `eq.${comment.member_id}` === url.searchParams.get("member_id"),
      );
      for (const comment of result)
        comments.splice(comments.indexOf(comment), 1);
    } else
      result = comments
        .slice()
        .sort(
          (a, b) =>
            a.created_at.localeCompare(b.created_at) ||
            a.id.localeCompare(b.id),
        )
        .slice(
          Number(url.searchParams.get("offset") || 0),
          Number(url.searchParams.get("offset") || 0) +
            Number(url.searchParams.get("limit") || 1000),
        );
  } else if (
    url.pathname.startsWith("/storage/v1/object/proofs/") &&
    req.method === "POST"
  ) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (state.failNextPhotoWrite) {
      state.failNextPhotoWrite = false;
      res.writeHead(503);
      res.end();
      return;
    }
    photos.set(url.pathname.split("/proofs/")[1], Buffer.concat(chunks));
    result = { Key: url.pathname };
  } else if (
    url.pathname === "/storage/v1/object/proofs" &&
    req.method === "DELETE"
  ) {
    let body = "";
    for await (const chunk of req) body += chunk;
    for (const key of JSON.parse(body).prefixes) photos.delete(key);
    result = [];
  } else if (
    url.pathname.startsWith("/storage/v1/object/sign/proofs/") &&
    req.method === "GET"
  ) {
    const bytes = photos.get(url.pathname.split("/proofs/")[1]);
    res.writeHead(bytes ? 200 : 404, { "Content-Type": "image/png" });
    res.end(bytes);
    return;
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
  if (!baseline) {
    const save = (fields, images = [], authenticated = true, origin = base) => {
      const form = new FormData();
      for (const [key, value] of Object.entries(fields)) form.set(key, value);
      for (const image of images)
        form.append(
          "photo",
          new Blob([image], { type: "image/png" }),
          "image.png",
        );
      return fetch(`${base}/api/posts`, {
        method: "POST",
        headers: {
          Origin: origin,
          ...(authenticated ? { Cookie: `ccarf_session=${token}` } : {}),
        },
        body: form,
      });
    };
    const fields = { body: "HTTP image test", url: "" };
    assert.equal((await save(fields, [png], false)).status, 401);
    assert.equal(
      (await save(fields, [png], true, "https://other.example")).status,
      403,
    );
    for (const images of [
      [png, png],
      [Buffer.from("<svg>bad</svg>")],
      [Buffer.alloc(2097153)],
    ])
      assert.ok(
        !(await save(fields, images)).ok,
        "invalid or oversized image rejected",
      );
    assert.equal(posts.length, 0);
    assert.equal(photos.size, 0);
    assert.ok((await save(fields, [png])).ok);
    const post = posts[0];
    const id = post.id;
    const created = post.created_at;
    const firstKey = post.photo_key;
    assert.ok(photos.has(firstKey));
    assert.equal(
      (await get(`/api/post-photos/${firstKey}`, false)).status,
      401,
    );
    const response = await get(`/api/post-photos/${firstKey}`);
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(
      (await get(`/api/photos/${firstKey}`)).status,
      404,
      "post images cannot be read as todo proofs",
    );
    assert.equal(
      (await get(`/api/post-photos/${todos[0].photo_key}`)).status,
      404,
      "todo proofs cannot be read as post images",
    );
    state.failNextPostWrite = true;
    assert.ok(
      !(await save({ ...fields, id, body: "failed update" }, [png])).ok,
    );
    assert.equal(post.body, fields.body);
    assert.equal(post.photo_key, firstKey);
    assert.equal(
      photos.size,
      1,
      "failed DB write cleans up the newly uploaded file",
    );
    state.failNextPhotoWrite = true;
    assert.ok(!(await save({ ...fields, id }, [png])).ok);
    assert.equal(post.photo_key, firstKey);
    assert.ok((await save({ ...fields, id, body: "text edit" })).ok);
    assert.equal(post.photo_key, firstKey, "text editing preserves image");
    assert.ok((await save({ ...fields, id }, [png])).ok);
    const secondKey = post.photo_key;
    assert.notEqual(secondKey, firstKey);
    assert.equal(post.created_at, created);
    assert.ok(!photos.has(firstKey));
    assert.equal((await get(`/api/post-photos/${firstKey}`)).status, 404);
    assert.ok((await save({ ...fields, id, removePhoto: "true" })).ok);
    assert.equal(post.photo_key, null);
    assert.equal(photos.size, 0);
    post.member_id = "yeeun";
    assert.ok(
      !(await save({ ...fields, id }, [png])).ok,
      "other author's post cannot be edited",
    );
    assert.equal(photos.size, 0);
    posts.length = 0;
    comments.length = 0;
    console.log(
      "PASS post image HTTP checks: uploads, validation, access, replacement/removal, ownership and failure rollback.",
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
