import CurriculumList from "@/components/CurriculumList";
import { pageMember } from "@/lib/auth";
import { todayKST } from "@/lib/dates";
import { completedCurriculumIds } from "@/lib/store";

export default async function CurriculumPage() {
  const member = await pageMember();
  const completedIds = await completedCurriculumIds(member.id);
  return (
    <CurriculumList
      member={member}
      today={todayKST()}
      completedIds={completedIds}
    />
  );
}
