import { revalidatePath } from "next/cache";
import { currentMember } from "@/lib/auth";
import { MAX_PHOTO_SIZE } from "@/lib/photos";
import { hasSameOrigin } from "@/lib/request";
import { writePost } from "@/lib/service";

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
    if (
      Number(request.headers.get("content-length") || 0) >
      MAX_PHOTO_SIZE + 65536
    )
      return Response.json(
        { error: "이미지는 2MB 이내로 첨부해 주세요." },
        { status: 413 },
      );
    const form = await request.formData();
    const photos = form.getAll("photo");
    const file = photos[0];
    if (
      photos.length > 1 ||
      (file !== undefined &&
        (!(file instanceof File) ||
          file.size === 0 ||
          file.size > MAX_PHOTO_SIZE))
    )
      return Response.json(
        { error: "2MB 이내의 이미지 1장을 첨부해 주세요." },
        { status: 400 },
      );
    const id = form.get("id");
    const body = form.get("body");
    const url = form.get("url");
    if (
      (id !== null && typeof id !== "string") ||
      typeof body !== "string" ||
      typeof url !== "string"
    )
      return Response.json(
        { error: "입력한 내용을 확인해 주세요." },
        { status: 400 },
      );
    await writePost(member.id, {
      id: id === null ? undefined : id,
      body,
      url,
      photo:
        file instanceof File
          ? new Uint8Array(await file.arrayBuffer())
          : undefined,
      removePhoto: form.get("removePhoto") === "true",
    });
    revalidatePath("/shared");
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error && /[가-힣]/.test(error.message)
            ? error.message
            : "글을 저장하지 못했습니다. 다시 시도해 주세요.",
      },
      { status: 400 },
    );
  }
}
