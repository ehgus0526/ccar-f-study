import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const script = fileURLToPath(
  new URL("../scripts/setup-supabase.mjs", import.meta.url),
);

for (const fixture of [
  {
    url: "https://프로젝트주소.supabase.co",
    key: "fake-test-key",
    field: "SUPABASE_URL",
  },
  {
    url: "https://example.supabase.co",
    key: "프로젝트의_Secret_key",
    field: "SUPABASE_SECRET_KEY",
  },
  {
    url: "https://example.supabase.co",
    key: "fake test key",
    field: "SUPABASE_SECRET_KEY",
  },
  { url: "", key: "", field: "SUPABASE_URL" },
]) {
  test(`migration rejects invalid ${fixture.field} without network access or changing settings: ${fixture.key ? (fixture.key.includes(" ") ? "whitespace" : "placeholder") : "missing"}`, () => {
    const directory = mkdtempSync(join(tmpdir(), "ccarf-setup-test-"));
    const envFile = join(directory, ".env.local");
    const original = "STUDY_STORAGE=local\n";
    writeFileSync(envFile, original);
    try {
      const result = spawnSync(
        process.execPath,
        [
          "--import",
          `data:text/javascript,${encodeURIComponent('globalThis.fetch = () => { throw new Error("Unexpected network access"); };')}`,
          script,
          "--migrate-local",
        ],
        {
          cwd: directory,
          env: {
            ...process.env,
            SUPABASE_URL: fixture.url,
            SUPABASE_SECRET_KEY: fixture.key,
            STUDY_PASSWORD_HASHES: "{}",
          },
          encoding: "utf8",
          timeout: 5000,
        },
      );
      assert.equal(result.error, undefined);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, new RegExp(fixture.field));
      assert.doesNotMatch(
        result.stderr,
        /ByteString|Unexpected network access/,
      );
      if (fixture.key) assert.ok(!result.stderr.includes(fixture.key));
      assert.equal(readFileSync(envFile, "utf8"), original);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

for (const [hasComments, hasImages] of [
  [false, false],
  [true, false],
  [true, true],
]) {
  test(`local migration supports ${hasImages ? "post-image-enabled" : hasComments ? "comment-enabled" : "older"} SQLite files`, () => {
    const directory = mkdtempSync(join(tmpdir(), "nodit-comment-migration-"));
    const db = new DatabaseSync(join(directory, "study.sqlite"));
    const requests = join(directory, "requests.jsonl");
    db.exec(
      "CREATE TABLE todos(id TEXT, photo_key TEXT); CREATE TABLE shared_posts(id TEXT);",
    );
    db.prepare("INSERT INTO shared_posts VALUES(?)").run("fixture-post");
    const photoKey = "fixture/post/image.png";
    if (hasImages) {
      db.exec("ALTER TABLE shared_posts ADD COLUMN photo_key TEXT");
      db.prepare("UPDATE shared_posts SET photo_key=?").run(photoKey);
      mkdirSync(join(directory, "photos", "fixture", "post"), {
        recursive: true,
      });
      writeFileSync(
        join(directory, "photos", photoKey),
        Buffer.from([137, 80, 78, 71]),
      );
    }
    if (hasComments) {
      db.exec("CREATE TABLE shared_comments(id TEXT, post_id TEXT);");
      db.prepare("INSERT INTO shared_comments VALUES(?,?)").run(
        "fixture-comment",
        "fixture-post",
      );
    }
    db.close();
    writeFileSync(join(directory, ".env.local"), "STUDY_STORAGE=local\n");
    const hook = `import { appendFileSync } from 'node:fs'; globalThis.fetch = async (url, init) => {
      const upload = new URL(url).pathname.startsWith('/storage/');
      appendFileSync(${JSON.stringify(requests)}, JSON.stringify({path:new URL(url).pathname,rows:upload ? init.body.length : JSON.parse(init.body).length})+'\\n');
      return new Response(null, {status:201});
    };`;
    try {
      const result = spawnSync(
        process.execPath,
        [
          "--import",
          `data:text/javascript,${encodeURIComponent(hook)}`,
          script,
          "--migrate-local",
        ],
        {
          cwd: directory,
          env: {
            ...process.env,
            STUDY_DATA_DIR: directory,
            STUDY_STORAGE: "local",
            SUPABASE_URL: "https://example.supabase.co",
            SUPABASE_SECRET_KEY: "fake-test-key",
            STUDY_PASSWORD_HASHES: JSON.stringify(
              Object.fromEntries(
                ["dohyeon", "yeeun", "jieun"].map((id) => [
                  id,
                  `${"a".repeat(32)}:${"b".repeat(128)}`,
                ]),
              ),
            ),
          },
          encoding: "utf8",
          timeout: 5000,
        },
      );
      assert.equal(result.status, 0, result.stderr);
      const sent = readFileSync(requests, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      assert.deepEqual(
        sent.map((request) => request.path),
        [
          "/rest/v1/members",
          ...(hasImages ? [`/storage/v1/object/proofs/${photoKey}`] : []),
          "/rest/v1/shared_posts",
          ...(hasComments ? ["/rest/v1/shared_comments"] : []),
        ],
      );
      if (hasComments) assert.equal(sent.at(-1).rows, 1);
      assert.match(
        readFileSync(join(directory, ".env.local"), "utf8"),
        /^STUDY_STORAGE=supabase/m,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
