import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

function cookieKey(token: string) {
  return `share_unlocked_${token}`;
}

async function unlockAction(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const link = await db.shareLink.findUnique({ where: { token } });
  if (!link?.passwordHash) return;
  const ok = await bcrypt.compare(password, link.passwordHash);
  if (ok) {
    const c = await cookies();
    c.set(cookieKey(token), "1", { httpOnly: true, secure: true, maxAge: 60 * 60 });
    revalidatePath(`/share/${token}`);
  }
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await db.shareLink.findUnique({
    where: { token },
    include: {
      file: { include: { currentVersion: true, project: true } },
    },
  });

  if (!link || link.revokedAt) notFound();
  if (link.expiresAt && link.expiresAt < new Date()) {
    return <SharePageMessage title="Lien expiré" />;
  }

  if (link.passwordHash) {
    const c = await cookies();
    if (c.get(cookieKey(token))?.value !== "1") {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Accès protégé</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={unlockAction} className="space-y-3">
                <input type="hidden" name="token" value={token} />
                <div className="space-y-1">
                  <Label>Mot de passe</Label>
                  <Input type="password" name="password" required />
                </div>
                <Button type="submit">Accéder</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  const version = link.pinnedVersionId
    ? await db.fileVersion.findUnique({ where: { id: link.pinnedVersionId } })
    : link.file.currentVersion;

  if (!version) return <SharePageMessage title="Aucune version disponible" />;

  await db.shareLink.update({
    where: { id: link.id },
    data: { accessCount: { increment: 1 }, lastAccessedAt: new Date() },
  });

  const url = await storage.signedUrl(version.storageKey, {
    expiresInSeconds: 600,
    download: link.allowDownload,
    filename: link.file.name,
  });

  const isPdf = version.mimeType === "application/pdf";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container py-3 flex justify-between items-center">
          <div>
            <div className="font-semibold">{link.file.name}</div>
            <div className="text-xs text-muted-foreground">{link.file.project.name} · v{version.versionNumber}</div>
          </div>
          {link.allowDownload && (
            <a href={url} download={link.file.name}>
              <Button variant="outline">Télécharger</Button>
            </a>
          )}
        </div>
      </header>
      <main className="flex-1">
        {isPdf ? (
          <iframe src={url} className="w-full h-[calc(100vh-65px)]" title="document" />
        ) : version.mimeType.startsWith("image/") ? (
          <div className="flex justify-center p-4">
            <img src={url} alt="" className="max-h-[calc(100vh-100px)]" />
          </div>
        ) : (
          <div className="container py-20 text-center">
            <p className="mb-4 text-muted-foreground">Aperçu non disponible.</p>
            {link.allowDownload && (
              <a href={url} download={link.file.name}>
                <Button>Télécharger</Button>
              </a>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function SharePageMessage({ title }: { title: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader></Card>
    </div>
  );
}
