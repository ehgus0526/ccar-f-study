"use client";

import * as actions from "@/app/actions";
import type { ActionResult } from "./types";

// Keep editor state intact on network failures as well as server validation failures.
function safe<Args extends unknown[]>(
  action: (...args: Args) => Promise<ActionResult>,
) {
  return async (...args: Args): Promise<ActionResult> => {
    try {
      return await action(...args);
    } catch {
      return {
        ok: false,
        error:
          "연결이 원활하지 않아요. 입력한 내용은 유지됩니다. 다시 시도해 주세요.",
      };
    }
  };
}
export const createTodoAction = safe(actions.createTodoAction);
export const updateTodoAction = safe(actions.updateTodoAction);
export const completeTodoAction = safe(actions.completeTodoAction);
export const deleteTodoAction = safe(actions.deleteTodoAction);
export const deleteTodoPhotoAction = safe(actions.deleteTodoPhotoAction);
export const savePostAction = safe(actions.savePostAction);
export const deletePostAction = safe(actions.deletePostAction);
