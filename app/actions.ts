"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember, signIn, signOut } from "@/lib/auth";
import * as service from "@/lib/service";
import * as store from "@/lib/store";
import { removePhoto } from "@/lib/photos";
import type { ActionResult } from "@/lib/types";

function failure(error: unknown): ActionResult {
  return {
    ok: false,
    error:
      error instanceof Error && /[가-힣]/.test(error.message)
        ? error.message
        : "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  };
}
function refreshTodos() {
  revalidatePath("/");
  revalidatePath("/curriculum");
}
export async function loginAction(form: FormData): Promise<ActionResult> {
  try {
    await signIn(
      String(form.get("name") || ""),
      String(form.get("password") || ""),
    );
  } catch (error) {
    return failure(error);
  }
  redirect("/");
}
export async function logoutAction() {
  await signOut();
  redirect("/login");
}
export async function createTodoAction(
  input: service.CreateTodoInput,
): Promise<ActionResult> {
  try {
    const member = await requireMember();
    await service.createTodos(member.id, input);
    refreshTodos();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
export async function updateTodoAction(
  id: string,
  input: {
    title: string;
    date: string;
    curriculumId: string | null;
    note: string;
  },
): Promise<ActionResult> {
  try {
    const member = await requireMember();
    await service.updateTodo(member.id, id, input);
    refreshTodos();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
export async function completeTodoAction(
  id: string,
  completed: boolean,
): Promise<ActionResult> {
  try {
    const member = await requireMember();
    await service.completeTodo(member.id, id, completed);
    refreshTodos();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
export async function deleteTodoAction(id: string): Promise<ActionResult> {
  try {
    const member = await requireMember();
    const todo = await service.ownedTodo(member.id, id);
    // Remove the file first: if storage fails, the record stays available for retry.
    if (todo.photo_key) await removePhoto(todo.photo_key);
    await store.removeTodo(id, member.id);
    refreshTodos();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
export async function deleteTodoPhotoAction(id: string): Promise<ActionResult> {
  try {
    const member = await requireMember();
    const todo = await service.ownedTodo(member.id, id);
    if (todo.photo_key) await removePhoto(todo.photo_key);
    await store.patchTodo(id, member.id, { photo_key: null });
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
export async function savePostAction(input: {
  id?: string;
  body: string;
  url: string;
}): Promise<ActionResult> {
  try {
    const member = await requireMember();
    await service.writePost(member.id, input);
    revalidatePath("/shared");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
export async function deletePostAction(id: string): Promise<ActionResult> {
  try {
    const member = await requireMember();
    service.validId(id);
    await store.removePost(id, member.id);
    revalidatePath("/shared");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
