import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { dataDirectory, storageMode, supabase } from "./store.ts";
import type { MemberId } from "./types.ts";

export const MAX_PHOTO_SIZE = 2 * 1024 * 1024;
export function photoType(bytes: Uint8Array): "jpg" | "png" | "webp" | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (
    Buffer.from(bytes.slice(0, 8)).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
  )
    return "png";
  if (
    Buffer.from(bytes.slice(0, 4)).toString() === "RIFF" &&
    Buffer.from(bytes.slice(8, 12)).toString() === "WEBP"
  )
    return "webp";
  return null;
}
export function validPhotoKey(key: string) {
  return /^(dohyeon|yeeun|jieun)\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(
    key,
  );
}
export async function putPhoto(
  memberId: MemberId,
  todoId: string,
  bytes: Uint8Array,
) {
  const extension = photoType(bytes);
  if (!extension || bytes.length > MAX_PHOTO_SIZE)
    throw new Error("JPEG·PNG·WebP 사진을 2MB 이내로 첨부해 주세요.");
  const key = `${memberId}/${todoId}/${randomUUID()}.${extension}`;
  if (storageMode() === "local") {
    const path = join(dataDirectory(), "photos", key);
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, bytes, { mode: 0o600 });
  } else {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/storage/v1/object/proofs/${key}`,
      {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_SECRET_KEY!,
          "Content-Type": `image/${extension === "jpg" ? "jpeg" : extension}`,
        },
        body: bytes as BodyInit,
      },
    );
    if (!response.ok)
      throw new Error("사진 저장에 실패했습니다. 다시 시도해 주세요.");
  }
  return key;
}
export async function removePhoto(key: string) {
  if (!validPhotoKey(key)) return;
  if (storageMode() === "local") {
    try {
      await unlink(join(dataDirectory(), "photos", key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  } else
    await supabase("/storage/v1/object/proofs", {
      method: "DELETE",
      body: JSON.stringify({ prefixes: [key] }),
    });
}
export async function photoUrl(key: string | null) {
  if (!key || !validPhotoKey(key)) return null;
  if (storageMode() === "local") return `/api/photos/${key}`;
  const result = await supabase(`/storage/v1/object/sign/proofs/${key}`, {
    method: "POST",
    body: JSON.stringify({ expiresIn: 3600 }),
  });
  return `${process.env.SUPABASE_URL}/storage/v1${result.signedURL}`;
}
export async function localPhoto(key: string) {
  if (storageMode() !== "local" || !validPhotoKey(key)) return null;
  try {
    return await readFile(join(dataDirectory(), "photos", key));
  } catch {
    return null;
  }
}
