import { currentMember } from "@/lib/auth";
import { ownedTodo } from "@/lib/service";
import { MAX_PHOTO_SIZE, photoPath, putPhoto, removePhoto } from "@/lib/photos";
import { patchTodo } from "@/lib/store";
import { revalidatePath } from "next/cache";
import { hasSameOrigin } from "@/lib/request";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!hasSameOrigin(request.headers))
    return Response.json(
      { error: "올바르지 않은 요청입니다." },
      { status: 403 },
    );
  try {
    const member = await currentMember();
    if (!member)
      return Response.json({ error: "다시 로그인해 주세요." }, { status: 401 });
    const length = Number(request.headers.get("content-length") || 0);
    if (length > MAX_PHOTO_SIZE + 65536)
      return Response.json(
        { error: "사진을 2MB 이내로 줄여 주세요." },
        { status: 413 },
      );
    const form = await request.formData();
    const todo = await ownedTodo(member.id, String(form.get("todoId") || ""));
    const file = form.get("photo");
    if (!(file instanceof File) || file.size > MAX_PHOTO_SIZE)
      return Response.json(
        { error: "사진을 2MB 이내로 첨부해 주세요." },
        { status: 400 },
      );
    const key = await putPhoto(
      member.id,
      todo.id,
      new Uint8Array(await file.arrayBuffer()),
    );
    try {
      await patchTodo(todo.id, member.id, { photo_key: key });
    } catch (error) {
      await removePhoto(key);
      throw error;
    }
    if (todo.photo_key) {
      try {
        await removePhoto(todo.photo_key);
      } catch {
        console.error("Old proof cleanup failed for todo", todo.id);
      }
    }
    revalidatePath("/");
    return Response.json({ ok: true, photoUrl: photoPath(key) });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error && /[가-힣]/.test(error.message)
            ? error.message
            : "사진을 저장하지 못했습니다. 다시 시도해 주세요.",
      },
      { status: 400 },
    );
  }
}
