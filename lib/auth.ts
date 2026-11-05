import { createHash, createHmac, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getMember, MEMBERS } from "./catalog.ts";
import {
  deleteSession,
  failedAttemptCount,
  insertSession,
  memberHash,
  recordFailedAttempt,
  sessionMember,
} from "./store.ts";
import { verifyPassword } from "./password.ts";

const COOKIE = "ccarf_session";
const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function currentMember() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const id = await sessionMember(tokenHash(token));
  return id ? (getMember(id) ?? null) : null;
}
export async function requireMember() {
  const member = await currentMember();
  if (!member)
    throw new Error("로그인이 만료되었습니다. 다시 로그인해 주세요.");
  return member;
}
export async function pageMember() {
  const member = await currentMember();
  if (!member) redirect("/login");
  return member;
}
export async function signIn(name: string, password: string) {
  if (
    typeof name !== "string" ||
    typeof password !== "string" ||
    name.length > 30 ||
    password.length > 30
  )
    throw new Error("이름과 생년월일 여섯 자리를 확인해 주세요.");
  const secret =
    process.env.LOGIN_HASH_SECRET ||
    (process.env.VERCEL ? "" : "local-development-only");
  if (!secret) throw new Error("로그인 서버 설정이 필요합니다.");
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const identifiers = [`name:${name.trim().normalize("NFC")}`, `ip:${ip}`].map(
    (value) => createHmac("sha256", secret).update(value).digest("hex"),
  );
  const attempts = await Promise.all(identifiers.map(failedAttemptCount));
  if (attempts.some((count) => count >= 10))
    throw new Error("로그인 시도가 많습니다. 15분 후 다시 시도해 주세요.");
  const member = MEMBERS.find(
    (item) => item.name === name.trim().normalize("NFC"),
  );
  const hash = member ? await memberHash(member.id) : null;
  if (!member || !hash || !verifyPassword(password, hash)) {
    await recordFailedAttempt(identifiers);
    throw new Error("이름 또는 생년월일이 일치하지 않습니다.");
  }
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 86400000);
  await insertSession(tokenHash(token), member.id, expires.toISOString());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.STUDY_STORAGE !== "local",
    sameSite: "lax",
    expires,
    path: "/",
  });
}
export async function signOut() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (token) await deleteSession(tokenHash(token));
  cookieStore.delete(COOKIE);
}
