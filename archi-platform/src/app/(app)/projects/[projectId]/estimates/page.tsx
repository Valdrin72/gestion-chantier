import Link from "next/link";
import { requireProjectAccess } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function EstimatesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireProjectAccess(projectId, "estimate.read");

  const estimates = await db.estimate.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { sheets: true } } },
  });

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Chiffrage</h2>
          <p className="text-sm text-muted-foreground">{estimates.length} document(s) de chiffrage</p>
        </div>
        <Button asChild><Link href={`/projects/${projectId}/estimates/new`}>Nouveau chiffrage</Link></Button>
      </div>

      {estimates.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          Aucun chiffrage. <Link href={`/projects/${projectId}/estimates/new`} className="underline">Créer le premier</Link>.
          <p className="text-xs mt-3">
            Le chiffrage utilise le catalogue d'éléments paramétrables de votre organisation
            (fenêtres, murs, etc.) avec champs adaptés, état de l'existant, quantités et coûts.
          </p>
        </CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {estimates.map((e) => (
            <Link key={e.id} href={`/projects/${projectId}/estimates/${e.id}`}>
              <Card className="hover:shadow-md transition">
                <CardHeader><CardTitle>{e.name}</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {e._count.sheets} feuille(s) · {e.currency}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
