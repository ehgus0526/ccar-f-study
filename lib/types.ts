export type MemberId = "dohyeon" | "yeeun" | "jieun";
export type Member = { id: MemberId; name: string; color: string };
export type CurriculumKind = "video" | "workbook" | "vocab";
export type CurriculumItem = {
  id: string;
  kind: CurriculumKind;
  code: string;
  title: string;
  chapter?: string;
};
export type Todo = {
  id: string;
  member_id: MemberId;
  curriculum_id: string | null;
  title: string;
  date: string;
  completed_at: string | null;
  note: string;
  photo_key: string | null;
  created_at: string;
  batch_id: string;
};
export type TodoView = Todo & { photo_url?: string | null };
export type SharedPost = {
  id: string;
  member_id: MemberId;
  body: string;
  url: string;
  created_at: string;
  updated_at: string;
};
export type ActionResult<T = undefined> =
  { ok: true; data?: T } | { ok: false; error: string };
