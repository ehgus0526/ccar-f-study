import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { listComments, removeComment, saveComment } from "../lib/store.ts";
import type { SharedComment } from "../lib/types.ts";

process.env.STUDY_STORAGE = "supabase";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY = "fake-test-key";
const comment: SharedComment = {
  id: randomUUID(),
  post_id: randomUUID(),
  member_id: "dohyeon",
  body: "댓글",
  created_at: "2026-11-01T00:00:00.000Z",
  updated_at: "2026-11-02T00:00:00.000Z",
};

test("Supabase loads all comments in chronological order beyond the default 1000-row limit", async (t) => {
  const previous = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = previous;
  });
  const page = Array.from({ length: 1000 }, () => ({
    ...comment,
    id: randomUUID(),
  }));
  const queries: URL[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    queries.push(url);
    assert.equal(init?.cache, "no-store");
    assert.equal(url.pathname, "/rest/v1/shared_comments");
    assert.equal(url.searchParams.get("order"), "created_at.asc,id.asc");
    return Response.json(
      url.searchParams.get("offset") === "0" ? page : [comment],
    );
  };
  assert.equal((await listComments()).length, 1001);
  assert.deepEqual(
    queries.map((url) => url.searchParams.get("offset")),
    ["0", "1000"],
  );
});

test("Supabase updates bind comment, parent and owner and never replace the original timestamp", async (t) => {
  const previous = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = previous;
  });
  globalThis.fetch = async (input, init) => {
    const query = new URL(String(input)).searchParams;
    assert.equal(init?.method, "PATCH");
    assert.equal(query.get("id"), `eq.${comment.id}`);
    assert.equal(query.get("post_id"), `eq.${comment.post_id}`);
    assert.equal(query.get("member_id"), "eq.dohyeon");
    assert.deepEqual(JSON.parse(String(init?.body)), {
      body: comment.body,
      updated_at: comment.updated_at,
    });
    return Response.json([]);
  };
  await assert.rejects(() => saveComment(comment, true), /본인의 댓글/);
});

test("Supabase deletion requires the comment owner and rejects missing or unauthorized records", async (t) => {
  const previous = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = previous;
  });
  globalThis.fetch = async (input, init) => {
    const query = new URL(String(input)).searchParams;
    assert.equal(init?.method, "DELETE");
    assert.equal(query.get("id"), `eq.${comment.id}`);
    assert.equal(query.get("member_id"), "eq.yeeun");
    return Response.json([]);
  };
  await assert.rejects(() => removeComment(comment.id, "yeeun"), /본인의 댓글/);
});
