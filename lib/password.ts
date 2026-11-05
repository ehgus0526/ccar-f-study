import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string) {
  if (!/^\d{6}$/.test(password))
    throw new Error("비밀번호는 yymmdd 여섯 자리여야 합니다.");
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, stored: string) {
  if (!/^\d{6}$/.test(password) || !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored))
    return false;
  const [salt, hash] = stored.split(":");
  return timingSafeEqual(
    scryptSync(password, salt, 64),
    Buffer.from(hash, "hex"),
  );
}
