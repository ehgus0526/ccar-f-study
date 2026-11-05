import AppShell from "@/components/AppShell";
import { pageMember } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function StudyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const member = await pageMember();
  return <AppShell member={member}>{children}</AppShell>;
}
