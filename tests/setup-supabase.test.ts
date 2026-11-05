import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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
