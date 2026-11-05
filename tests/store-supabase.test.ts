import { test } from "node:test";
import assert from "node:assert/strict";
import { completedCurriculumIds } from "../lib/store.ts";

test("Supabase curriculum history filters on the server and selects only curriculum IDs", async () => {
  const previousFetch = globalThis.fetch;
  const previousEnv = { ...process.env };
  const queries: URL[] = [];
  process.env.STUDY_STORAGE = "supabase";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "fake-test-key";
  globalThis.fetch = async (input, init) => {
    queries.push(new URL(String(input)));
    assert.equal(init?.cache, "no-store");
    return Response.json([
      { curriculum_id: "vocab-1" },
      { curriculum_id: "vocab-1" },
      { curriculum_id: "video-1" },
    ]);
  };
  try {
    assert.deepEqual(await completedCurriculumIds("dohyeon"), [
      "vocab-1",
      "video-1",
    ]);
    assert.equal(queries.length, 1);
    const query = queries[0].searchParams;
    assert.equal(query.get("select"), "curriculum_id");
    assert.equal(query.get("member_id"), "eq.dohyeon");
    assert.equal(query.get("completed_at"), "not.is.null");
    assert.equal(query.get("curriculum_id"), "not.is.null");
  } finally {
    globalThis.fetch = previousFetch;
    for (const name of [
      "STUDY_STORAGE",
      "SUPABASE_URL",
      "SUPABASE_SECRET_KEY",
    ]) {
      if (previousEnv[name] === undefined) delete process.env[name];
      else process.env[name] = previousEnv[name];
    }
  }
});
