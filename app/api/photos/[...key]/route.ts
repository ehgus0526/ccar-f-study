import { currentMember } from "@/lib/auth";
import { localPhoto, photoUrl, validPhotoKey } from "@/lib/photos";
import { getTodo, storageMode } from "@/lib/store";

export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  if (!(await currentMember())) return new Response(null, { status: 401 });
  const { key: parts } = await context.params;
  const key = parts.join("/");
  if (!validPhotoKey(key)) return new Response(null, { status: 404 });
  const todo = await getTodo(parts[1]);
  if (!todo || todo.photo_key !== key)
    return new Response(null, { status: 404 });
  if (storageMode() === "supabase") {
    const url = await photoUrl(key);
    return new Response(null, {
      status: 307,
      headers: { Location: url!, "Cache-Control": "private, no-store" },
    });
  }
  const bytes = await localPhoto(key);
  if (!bytes) return new Response(null, { status: 404 });
  const extension = key.split(".").at(-1);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": `image/${extension === "jpg" ? "jpeg" : extension}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
