import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await requireUser();
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, email: true },
  });
  return <AppShell user={user}>{children}</AppShell>;
}
