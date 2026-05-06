"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, CheckCircle2, XCircle, Clock } from "lucide-react";

type Step = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  approverName: string;
  approverId: string;
  comment: string | null;
};
type Validation = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  mode: "ANY" | "ALL" | "SEQUENTIAL";
  message: string | null;
  createdAt: Date;
  requesterName: string;
  steps: Step[];
};

const statusBadge = {
  PENDING: { variant: "warning" as const, label: "En attente", icon: Clock },
  APPROVED: { variant: "success" as const, label: "Validé", icon: CheckCircle2 },
  REJECTED: { variant: "destructive" as const, label: "Refusé", icon: XCircle },
  CANCELLED: { variant: "outline" as const, label: "Annulé", icon: XCircle },
};

export function ValidationPanel({
  fileId,
  currentVersionId,
  validations,
  members,
}: {
  fileId: string;
  currentVersionId: string | null;
  validations: Validation[];
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [, startTransition] = useTransition();

  async function submitRequest(formData: FormData) {
    const message = String(formData.get("message") ?? "");
    const mode = String(formData.get("mode") ?? "ALL") as "ANY" | "ALL" | "SEQUENTIAL";
    if (selected.length === 0) return;
    const res = await fetch(`/api/files/${fileId}/validations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ approverIds: selected, mode, message }),
    });
    if (res.ok) {
      setOpen(false);
      setSelected([]);
      startTransition(() => router.refresh());
    }
  }

  async function decide(stepId: string, decision: "APPROVED" | "REJECTED") {
    const comment = window.prompt(`Commentaire ${decision === "APPROVED" ? "(optionnel)" : "(motif)"} :`) ?? "";
    const res = await fetch(`/api/validations/${stepId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, comment }),
    });
    if (res.ok) startTransition(() => router.refresh());
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> Validation
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setOpen(!open)} disabled={!currentVersionId}>
          {open ? "Annuler" : "Demander"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {open && (
          <form action={submitRequest} className="space-y-2 border rounded p-3 bg-muted/30">
            <div>
              <Label className="text-xs">Valideurs</Label>
              <div className="space-y-1 max-h-32 overflow-auto mt-1">
                {members.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.includes(m.id)}
                      onChange={(e) =>
                        setSelected((s) =>
                          e.target.checked ? [...s, m.id] : s.filter((x) => x !== m.id),
                        )
                      }
                    />
                    {m.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Mode</Label>
              <select name="mode" className="w-full h-9 rounded-md border px-2 text-sm">
                <option value="ALL">Tous doivent approuver</option>
                <option value="ANY">Une approbation suffit</option>
                <option value="SEQUENTIAL">Séquentiel</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Message</Label>
              <Input name="message" placeholder="Optionnel" />
            </div>
            <Button type="submit" size="sm">Envoyer la demande</Button>
          </form>
        )}

        {validations.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucune demande de validation.</p>
        ) : (
          validations.map((v) => {
            const StatusIcon = statusBadge[v.status].icon;
            return (
              <div key={v.id} className="border rounded p-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span>par {v.requesterName}</span>
                  <Badge variant={statusBadge[v.status].variant} className="flex items-center gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {statusBadge[v.status].label}
                  </Badge>
                </div>
                {v.message && <p className="text-xs italic">{v.message}</p>}
                <ul className="space-y-1 mt-1">
                  {v.steps.map((s) => {
                    const SIcon = statusBadge[s.status].icon;
                    return (
                      <li key={s.id} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <SIcon className="h-3 w-3" />
                          {s.approverName}
                        </span>
                        {s.status === "PENDING" && v.status === "PENDING" ? (
                          <span className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2"
                              onClick={() => decide(s.id, "APPROVED")}>Approuver</Button>
                            <Button size="sm" variant="destructive" className="h-7 px-2"
                              onClick={() => decide(s.id, "REJECTED")}>Refuser</Button>
                          </span>
                        ) : (
                          <Badge variant={statusBadge[s.status].variant} className="text-xs">
                            {statusBadge[s.status].label}
                          </Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
