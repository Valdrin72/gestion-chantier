import { redirect } from "next/navigation";
import { requireProjectAccess } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

async function createAction(formData: FormData) {
  "use server";
  const projectId = String(formData.get("projectId"));
  const { userId } = await requireProjectAccess(projectId, "estimate.write");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Nom requis");
  const e = await db.estimate.create({
    data: {
      projectId,
      name,
      authorId: userId,
      sheets: { create: [{ name: "Feuille 1", position: 0 }] },
    },
  });
  redirect(`/projects/${projectId}/estimates/${e.id}`);
}

export default async function NewEstimatePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireProjectAccess(projectId, "estimate.write");
  return (
    <div className="container py-6 max-w-xl">
      <Card>
        <CardHeader><CardTitle>Nouveau chiffrage</CardTitle></CardHeader>
        <CardContent>
          <form action={createAction} className="space-y-4">
            <input type="hidden" name="projectId" value={projectId} />
            <div className="space-y-2">
              <Label htmlFor="name">Nom du chiffrage</Label>
              <Input id="name" name="name" placeholder="ex: Avant-projet sommaire" required />
            </div>
            <Button type="submit">Créer</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
