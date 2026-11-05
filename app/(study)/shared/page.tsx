import SharedBoard from "@/components/SharedBoard";
import { pageMember } from "@/lib/auth";
import { listPosts } from "@/lib/store";

export default async function SharedPage() {
  return <SharedBoard member={await pageMember()} posts={await listPosts()} />;
}
