import Link from "next/link";
import { requireProjectAccess } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "warning" | "destructive" | "outline" }> = {
  OPERATIONAL: { label: "Opérationnel", variant: "default" },
  NEEDS_INSPECTION: { label: "Inspection", variant: "warning" },
  NEEDS_MAINTENANCE: { label: "Maintenance", variant: "warning" },
  END_OF_LIFE: { label: "Fin de vie", variant: "destructive" },
  REPLACED: { label: "Remplacé", variant: "outline" },
  DECOMMISSIONED: { label: "Déclassé", variant: "outline" },
};

export default async function AssetsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireProjectAccess(projectId, "asset.read");

  const inventory = await db.assetInventory.findUnique({
    where: { projectId },
    include: {
      assets: {
        orderBy: { label: "asc" },
        include: { events: { take: 1, orderBy: { performedAt: "desc" } }, alerts: { where: { resolvedAt: null } } },
      },
    },
  });

  if (!inventory) {
    return (
      <div className="container py-6">
        <Card>
          <CardHeader>
            <CardTitle>Cycle de vie</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              L'inventaire n'a pas encore été remis. À la livraison du projet,
              les éléments du chiffrage marqués comme "suivables" deviennent des
              <strong> assets</strong> que le propriétaire peut suivre.
            </p>
            <p className="text-xs">
              Implémentation à compléter — voir ROADMAP, action "handover".
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Inventaire ({inventory.assets.length})</h2>
          <p className="text-sm text-muted-foreground">
            Remis le {inventory.handedOverAt?.toLocaleDateString() ?? "—"}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/projects/${projectId}/assets/alerts`}>Alertes</Link>
        </Button>
      </div>

      <div className="border rounded-md divide-y">
        {inventory.assets.map((a) => {
          const s = STATUS_LABEL[a.status] ?? { label: a.status, variant: "outline" as const };
          return (
            <div key={a.id} className="p-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="font-medium">{a.label}</div>
                <div className="text-xs text-muted-foreground">
                  {a.location ?? "—"} ·{" "}
                  {a.endOfLifeDate ? `Fin de vie estimée : ${a.endOfLifeDate.toLocaleDateString()}` : "Pas de fin de vie estimée"}
                </div>
              </div>
              <div className="flex gap-2">
                {a.alerts.length > 0 && (
                  <Badge variant="destructive">{a.alerts.length} alerte(s)</Badge>
                )}
                <Badge variant={s.variant}>{s.label}</Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
