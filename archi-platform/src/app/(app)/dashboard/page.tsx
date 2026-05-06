import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const { userId } = await requireUser();

  const [projects, pendingValidations, mentions] = await Promise.all([
    db.project.findMany({
      where: { members: { some: { userId } } },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { _count: { select: { files: true } } },
    }),
    db.validationStep.findMany({
      where: { approverId: userId, status: "PENDING" },
      include: { request: { include: { file: { include: { project: true } } } } },
      take: 10,
    }),
    db.commentMention.findMany({
      where: { userId, awaitingResponse: true },
      include: { comment: { include: { file: { include: { project: true } }, author: true } } },
      take: 10,
    }),
  ]);

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>

      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Mes projets</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{projects.length}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Validations en attente</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{pendingValidations.length}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Mentions à traiter</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{mentions.length}</CardContent>
        </Card>
      </div>

      <section className="mt-10">
        <h2 className="font-semibold mb-3">Projets récents</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun projet pour l'instant. <Link href="/projects/new" className="underline">Créer un projet</Link>
          </p>
        ) : (
          <div className="grid md:grid-cols-3 gap-3">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="block">
                <Card className="hover:shadow-md transition">
                  <CardHeader>
                    <CardTitle>{p.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground flex items-center gap-2">
                    <Badge variant="secondary">{p.status}</Badge>
                    <span>{p._count.files} fichier(s)</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-semibold mb-3">À valider</h2>
        {pendingValidations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Rien à valider.</p>
        ) : (
          <ul className="divide-y border rounded-md">
            {pendingValidations.map((step) => (
              <li key={step.id} className="p-3">
                <Link
                  href={`/projects/${step.request.file.projectId}/files/${step.request.fileId}`}
                  className="flex justify-between items-center"
                >
                  <span>
                    <span className="font-medium">{step.request.file.name}</span>
                    <span className="text-muted-foreground text-sm"> · {step.request.file.project.name}</span>
                  </span>
                  <Badge variant="warning">en attente</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
