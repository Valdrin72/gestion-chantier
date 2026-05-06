"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link2, Copy, Trash } from "lucide-react";

type Link = {
  id: string;
  token: string;
  expiresAt: Date | null;
  allowDownload: boolean;
  hasPassword: boolean;
  createdByName: string;
  accessCount: number;
};

export function ShareLinkPanel({ fileId, links }: { fileId: string; links: Link[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const router = useRouter();

  async function create(formData: FormData) {
    const expiresInDays = Number(formData.get("expiresInDays") ?? 0);
    const password = String(formData.get("password") ?? "") || null;
    const allowDownload = formData.get("allowDownload") === "on";
    const res = await fetch("/api/files/" + fileId + "/share", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expiresInDays, password, allowDownload }),
    });
    if (res.ok) {
      const data = await res.json();
      setCreatedUrl(data.url);
      startTransition(() => router.refresh());
    }
  }

  async function revoke(id: string) {
    const res = await fetch("/api/files/" + fileId + "/share/" + id, { method: "DELETE" });
    if (res.ok) startTransition(() => router.refresh());
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><Link2 className="h-4 w-4"/>Liens de partage</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>
          {open ? "Annuler" : "Nouveau"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {open && (
          <form
            action={(fd) => create(fd)}
            className="space-y-2 border rounded p-3 bg-muted/30"
          >
            <div className="space-y-1">
              <Label className="text-xs">Expiration (jours, 0 = jamais)</Label>
              <Input type="number" name="expiresInDays" defaultValue={7} min={0} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mot de passe (optionnel)</Label>
              <Input type="password" name="password" placeholder="—" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="allowDownload" defaultChecked /> Autoriser le téléchargement
            </label>
            <Button type="submit" size="sm" disabled={pending}>Générer le lien</Button>
          </form>
        )}

        {createdUrl && (
          <div className="rounded bg-green-50 border border-green-200 p-2 text-xs">
            <div className="font-semibold mb-1">Lien créé :</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate">{createdUrl}</code>
              <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(createdUrl!)}>
                <Copy className="h-3 w-3"/>
              </Button>
            </div>
          </div>
        )}

        {links.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun lien actif.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {links.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  /share/{l.token.slice(0, 8)}…
                  {l.hasPassword && <span className="text-xs text-muted-foreground"> · 🔒</span>}
                  {l.expiresAt && <span className="text-xs text-muted-foreground"> · expire {new Date(l.expiresAt).toLocaleDateString()}</span>}
                  <span className="text-xs text-muted-foreground"> · {l.accessCount} vue(s)</span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => revoke(l.id)}><Trash className="h-3 w-3"/></Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
