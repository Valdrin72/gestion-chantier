import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ProjectsPage() {
  const { userId } = await requireUser();
  const projects = await db.project.findMany({
    where: { members: { some: { userId } } },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { files: true, members: true } } },
  });

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projets</h1>
        <Button asChild><Link href="/projects/new">Nouveau projet</Link></Button>
      </div>

      {projects.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          Aucun projet. <Link href="/projects/new" className="underline">Créer le premier</Link>.
        </CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-3 gap-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="hover:shadow-md transition h-full">
                <CardHeader>
                  <CardTitle>{p.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">{p.description ?? "—"}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <Badge variant="secondary">{p.status}</Badge>
                    <span>{p._count.files} fichiers</span>
                    <span>·</span>
                    <span>{p._count.members} membres</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
