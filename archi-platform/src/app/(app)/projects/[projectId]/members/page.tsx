import { requireProjectAccess } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { ProjectRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

const ROLES: ProjectRole[] = ["OWNER", "ARCHITECT", "ENGINEER", "CONTRACTOR", "REVIEWER", "VIEWER"];

async function inviteAction(formData: FormData) {
  "use server";
  const projectId = String(formData.get("projectId"));
  await requireProjectAccess(projectId, "project.update");
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const role = String(formData.get("role") ?? "VIEWER") as ProjectRole;
  if (!email) return;

  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { organizationId: true },
  });

  // Trouver ou créer l'utilisateur (création simplifiée, sans email d'invitation pour MVP)
  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    user = await db.user.create({ data: { email } });
  }

  await db.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: project.organizationId, userId: user.id } },
    create: { organizationId: project.organizationId, userId: user.id, role: "MEMBER" },
    update: {},
  });

  await db.projectMember.upsert({
    where: { projectId_userId: { projectId, userId: user.id } },
    create: { projectId, userId: user.id, role },
    update: { role },
  });

  revalidatePath(`/projects/${projectId}/members`);
}

export default async function MembersPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireProjectAccess(projectId);

  const members = await db.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="container py-6 space-y-6">
      <Card>
        <CardHeader><CardTitle>Inviter un membre</CardTitle></CardHeader>
        <CardContent>
          <form action={inviteAction} className="grid md:grid-cols-[2fr_1fr_auto] gap-2 items-end">
            <input type="hidden" name="projectId" value={projectId} />
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input type="email" name="email" required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rôle</Label>
              <select name="role" className="h-10 w-full rounded-md border px-2 text-sm">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <Button type="submit">Inviter</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Membres ({members.length})</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y">
            {members.map((m) => (
              <li key={m.id} className="py-2 flex items-center justify-between">
                <div>
                  <div className="font-medium">{m.user.name ?? m.user.email}</div>
                  <div className="text-xs text-muted-foreground">{m.user.email}</div>
                </div>
                <Badge variant="outline">{m.role}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
