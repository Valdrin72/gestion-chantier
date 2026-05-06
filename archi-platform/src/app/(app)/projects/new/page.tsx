import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function createProjectAction(formData: FormData) {
  "use server";
  const { userId } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) throw new Error("Nom requis");

  // Première organisation de l'utilisateur (MVP — sélecteur multi-org plus tard)
  const membership = await db.organizationMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) throw new Error("Aucune organisation");

  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) + "-" + Math.random().toString(36).slice(2, 5);

  const project = await db.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        organizationId: membership.organizationId,
        slug,
        name,
        description,
      },
    });
    await tx.projectMember.create({
      data: { projectId: p.id, userId, role: "ARCHITECT" },
    });
    // dossier racine implicite : on n'en crée pas, l'arbre est virtuel
    return p;
  });

  redirect(`/projects/${project.id}`);
}

export default function NewProjectPage() {
  return (
    <div className="container py-8 max-w-xl">
      <Card>
        <CardHeader><CardTitle>Nouveau projet</CardTitle></CardHeader>
        <CardContent>
          <form action={createProjectAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" />
            </div>
            <Button type="submit">Créer</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
