import { requireProjectAccess } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATE_LABEL: Record<string, string> = {
  NEW: "Neuf",
  TO_KEEP: "Conservé",
  TO_RENOVATE: "À rénover",
  TO_REPLACE: "À remplacer",
  TO_REMOVE: "À déposer",
};

export default async function EstimateDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; estimateId: string }>;
}) {
  const { projectId, estimateId } = await params;
  await requireProjectAccess(projectId, "estimate.read");

  const estimate = await db.estimate.findUniqueOrThrow({
    where: { id: estimateId },
    include: {
      sheets: {
        orderBy: { position: "asc" },
        include: {
          lines: {
            orderBy: { position: "asc" },
            include: { elementType: true },
          },
        },
      },
    },
  });

  return (
    <div className="container py-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold">{estimate.name}</h2>
        <p className="text-sm text-muted-foreground">
          Devise : {estimate.currency}
        </p>
      </div>

      {estimate.sheets.map((sheet) => {
        let total = 0;
        for (const l of sheet.lines) {
          const unit = Number(l.unitCostMaterial) + Number(l.unitCostLabor) + Number(l.unitCostOther);
          total += Number(l.quantity) * unit;
        }
        return (
          <Card key={sheet.id}>
            <CardHeader className="flex-row justify-between items-center">
              <CardTitle>{sheet.name}</CardTitle>
              <Badge variant="outline">Total : {total.toFixed(2)} {estimate.currency}</Badge>
            </CardHeader>
            <CardContent>
              {sheet.lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune ligne. (UI d'édition à compléter — voir ROADMAP.)
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-1">Élément</th>
                      <th className="text-left">Type</th>
                      <th className="text-left">État</th>
                      <th className="text-right">Qté</th>
                      <th className="text-right">PU</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.lines.map((l) => {
                      const unit = Number(l.unitCostMaterial) + Number(l.unitCostLabor) + Number(l.unitCostOther);
                      return (
                        <tr key={l.id} className="border-b">
                          <td className="py-1.5">{l.label}</td>
                          <td>{l.elementType?.name ?? "—"}</td>
                          <td>{STATE_LABEL[l.existingState] ?? l.existingState}</td>
                          <td className="text-right">{Number(l.quantity)} {l.unit}</td>
                          <td className="text-right">{unit.toFixed(2)}</td>
                          <td className="text-right font-medium">{(Number(l.quantity) * unit).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
