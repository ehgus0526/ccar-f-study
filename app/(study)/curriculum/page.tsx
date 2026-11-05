import CurriculumList from "@/components/CurriculumList";
import { pageMember } from "@/lib/auth";
import { todayKST } from "@/lib/dates";
import { listTodos } from "@/lib/store";

export default async function CurriculumPage() {
  const member = await pageMember();
  const todos = await listTodos("2000-01-01", "2100-12-31");
  const completedIds = [
    ...new Set(
      todos
        .filter(
          (todo) =>
            todo.member_id === member.id &&
            todo.completed_at &&
            todo.curriculum_id,
        )
        .map((todo) => todo.curriculum_id!),
    ),
  ];
  return (
    <CurriculumList
      member={member}
      today={todayKST()}
      completedIds={completedIds}
    />
  );
}
