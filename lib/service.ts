import { randomUUID } from "node:crypto";
import { CURRICULUM } from "./catalog.ts";
import { isDate } from "./dates.ts";
import * as store from "./store.ts";
import { putPhoto, removePhoto } from "./photos.ts";
import type { MemberId, Todo } from "./types.ts";

export function validId(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      value,
    )
  )
    throw new Error("항목을 찾을 수 없습니다.");
}
function text(value: unknown, limit: number, required = false) {
  if (
    typeof value !== "string" ||
    value.trim().length > limit ||
    (required && !value.trim())
  )
    throw new Error(`내용을 ${limit}자 이내로 입력해 주세요.`);
  return value.trim();
}
function curriculumId(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (
    typeof value !== "string" ||
    !CURRICULUM.some((item) => item.id === value)
  )
    throw new Error("학습 목록에서 항목을 선택해 주세요.");
  return value;
}
export async function ownedTodo(memberId: MemberId, id: string) {
  validId(id);
  const todo = await store.getTodo(id);
  if (!todo || todo.member_id !== memberId)
    throw new Error("본인의 일정만 변경할 수 있습니다.");
  return todo;
}
export type CreateTodoInput = {
  batchId: string;
  title: string;
  curriculumId: string | null;
  dates: string[];
  note: string;
};
export async function createTodos(memberId: MemberId, input: CreateTodoInput) {
  validId(input.batchId);
  const title = text(input.title, 120, true);
  const note = text(input.note, 2000);
  const curriculum_id = curriculumId(input.curriculumId);
  if (
    !Array.isArray(input.dates) ||
    !input.dates.length ||
    input.dates.length > 31 ||
    input.dates.some((date) => !isDate(date))
  )
    throw new Error("올바른 날짜를 1~31개 선택해 주세요.");
  const todos: Todo[] = [...new Set(input.dates)].map((date) => ({
    id: randomUUID(),
    member_id: memberId,
    title,
    curriculum_id,
    date,
    completed_at: null,
    note,
    photo_key: null,
    created_at: new Date().toISOString(),
    batch_id: input.batchId,
  }));
  await store.insertTodos(todos);
}
export async function updateTodo(
  memberId: MemberId,
  id: string,
  input: {
    title: string;
    date: string;
    curriculumId: string | null;
    note: string;
  },
) {
  await ownedTodo(memberId, id);
  if (!isDate(input.date)) throw new Error("올바른 날짜를 선택해 주세요.");
  await store.patchTodo(id, memberId, {
    title: text(input.title, 120, true),
    date: input.date,
    curriculum_id: curriculumId(input.curriculumId),
    note: text(input.note, 2000),
  });
}
export async function completeTodo(
  memberId: MemberId,
  id: string,
  completed: boolean,
) {
  if (typeof completed !== "boolean")
    throw new Error("완료 상태를 확인해 주세요.");
  const todo = await ownedTodo(memberId, id);
  await store.patchTodo(id, memberId, {
    completed_at: completed
      ? todo.completed_at || new Date().toISOString()
      : null,
  });
}
export function safeUrl(value: unknown) {
  const valueText = text(value, 2000);
  if (!valueText) return "";
  try {
    const parsed = new URL(valueText);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    )
      throw new Error();
    return parsed.toString();
  } catch {
    throw new Error("http 또는 https로 시작하는 링크를 입력해 주세요.");
  }
}
export async function writePost(
  memberId: MemberId,
  input: {
    id?: string;
    body: string;
    url: string;
    photo?: Uint8Array;
    removePhoto?: boolean;
  },
) {
  if (input.id !== undefined) validId(input.id);
  const body = text(input.body, 4000, true);
  const url = safeUrl(input.url);
  const previous =
    input.id !== undefined ? await ownedPost(memberId, input.id) : null;
  const id = previous?.id || randomUUID();
  const newKey = input.photo ? await putPhoto(memberId, id, input.photo) : null;
  const photoKey =
    newKey || (input.removePhoto ? null : (previous?.photo_key ?? null));
  const now = new Date().toISOString();
  try {
    await store.savePost(
      {
        id,
        member_id: memberId,
        body,
        url,
        photo_key: photoKey,
        created_at: previous?.created_at || now,
        updated_at: now,
      },
      previous !== null,
    );
  } catch (error) {
    if (newKey) await cleanupPostPhoto(newKey, id);
    throw error;
  }
  if (previous?.photo_key && previous.photo_key !== photoKey)
    await cleanupPostPhoto(previous.photo_key, id);
  return id;
}
export async function ownedPost(memberId: MemberId, id: string) {
  validId(id);
  const post = await store.getPost(id);
  if (!post || post.member_id !== memberId)
    throw new Error("본인의 글만 변경할 수 있습니다.");
  return post;
}
async function cleanupPostPhoto(key: string, postId: string) {
  try {
    await removePhoto(key);
  } catch {
    console.error("Post photo cleanup failed for post", postId);
  }
}
export async function deletePost(memberId: MemberId, id: string) {
  const post = await ownedPost(memberId, id);
  await store.removePost(id, memberId);
  if (post.photo_key) await cleanupPostPhoto(post.photo_key, id);
}
export async function writeComment(
  memberId: MemberId,
  input: { id?: string; postId: string; body: string },
) {
  validId(input.postId);
  if (input.id !== undefined) validId(input.id);
  const now = new Date().toISOString();
  await store.saveComment(
    {
      id: input.id || randomUUID(),
      post_id: input.postId,
      member_id: memberId,
      body: text(input.body, 1000, true),
      created_at: now,
      updated_at: now,
    },
    input.id !== undefined,
  );
}
