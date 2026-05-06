import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasCapability, type ProjectCapability } from "@/lib/permissions";

export async function requireUser() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");
  return { userId, session };
}

export async function requireProjectAccess(
  projectId: string,
  capability: ProjectCapability = "project.read",
) {
  const { userId } = await requireUser();
  const member = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member) {
    // Permettre aux admins d'organisation
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (!project) redirect("/dashboard");
    const orgMember = await db.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: project.organizationId, userId },
      },
    });
    if (!orgMember || (orgMember.role !== "OWNER" && orgMember.role !== "ADMIN")) {
      redirect("/dashboard");
    }
    return { userId, role: "ARCHITECT" as const, isOrgAdmin: true };
  }
  const ok = hasCapability(
    member.role,
    capability,
    (member.permissions as Record<string, boolean> | null) ?? null,
  );
  if (!ok) redirect(`/projects/${projectId}`);
  return { userId, role: member.role, isOrgAdmin: false };
}
