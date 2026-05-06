import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function SettingsPage() {
  const { userId } = await requireUser();
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: { memberships: { include: { organization: true } } },
  });

  return (
    <div className="container py-6 space-y-6 max-w-3xl">
      <Card>
        <CardHeader><CardTitle>Profil</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">Nom :</span> {user.name ?? "—"}</div>
          <div><span className="text-muted-foreground">Email :</span> {user.email}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Organisations</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y">
            {user.memberships.map((m) => (
              <li key={m.id} className="py-2 flex items-center justify-between">
                <span>{m.organization.name}</span>
                <Badge variant="outline">{m.role}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
