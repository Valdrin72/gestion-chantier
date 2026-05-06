import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

async function registerAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const orgName = String(formData.get("orgName") ?? "").trim();

  if (!email || password.length < 8 || !name || !orgName) {
    throw new Error("Champs invalides");
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw new Error("Cet email est déjà utilisé");

  const slug = orgName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) + "-" + Math.random().toString(36).slice(2, 6);

  const passwordHash = await bcrypt.hash(password, 10);

  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, name, passwordHash },
    });
    const org = await tx.organization.create({
      data: { name: orgName, slug },
    });
    await tx.organizationMember.create({
      data: { organizationId: org.id, userId: user.id, role: "OWNER" },
    });
  });

  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  redirect("/dashboard");
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Créer un compte</CardTitle>
          <CardDescription>Créez votre cabinet et démarrez votre premier projet</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={registerAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom complet</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgName">Nom du cabinet / société</Label>
              <Input id="orgName" name="orgName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe (8+ caractères)</Label>
              <Input id="password" name="password" type="password" minLength={8} required />
            </div>
            <Button type="submit" className="w-full">Créer le compte</Button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            Déjà inscrit ? <Link href="/login" className="underline">Se connecter</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
