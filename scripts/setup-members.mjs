import { createInterface } from "node:readline";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { hashPassword } from "../lib/password.ts";
import { MEMBERS } from "../lib/catalog.ts";

// --stdin accepts one JSON object on stdin; values never appear in arguments or output.
let values = {};
if (process.argv.includes("--stdin")) {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  values = JSON.parse(input);
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const question = (prompt) =>
    new Promise((resolve) => rl.question(prompt, resolve));
  for (const member of MEMBERS)
    values[member.id] = await question(`${member.name} 생년월일 (yymmdd): `);
  rl.close();
}
const hashes = {};
for (const member of MEMBERS)
  hashes[member.id] = hashPassword(values[member.id] || "");
let env = "";
try {
  env = await readFile(".env.local", "utf8");
} catch {}
const lines = env
  .split("\n")
  .filter((line) => !/^(STUDY_PASSWORD_HASHES|LOGIN_HASH_SECRET)=/.test(line));
if (!lines.some((line) => line.startsWith("STUDY_STORAGE=")))
  lines.push("STUDY_STORAGE=local");
lines.push(`STUDY_PASSWORD_HASHES='${JSON.stringify(hashes)}'`);
const oldSecret = env.match(/^LOGIN_HASH_SECRET=(.*)$/m)?.[1];
lines.push(`LOGIN_HASH_SECRET=${oldSecret || randomBytes(32).toString("hex")}`);
await writeFile(".env.local", lines.filter(Boolean).join("\n") + "\n", {
  mode: 0o600,
});
console.log(
  "3개 계정의 비밀번호 해시를 .env.local에 저장했습니다. 원문 생년월일은 저장하지 않았습니다.",
);
