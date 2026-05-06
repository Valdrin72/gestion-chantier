import Link from "next/link";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FolderKanban, Settings, LogOut } from "lucide-react";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export function AppShell({
  user,
  children,
}: {
  user: { name?: string | null; email: string };
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 border-r bg-muted/40 flex flex-col">
        <div className="p-4 border-b">
          <Link href="/dashboard" className="font-semibold">Archi Platform</Link>
        </div>
        <nav className="flex-1 p-2 space-y-1 text-sm">
          <NavItem href="/dashboard" icon={<LayoutDashboard className="h-4 w-4"/>}>Tableau de bord</NavItem>
          <NavItem href="/projects" icon={<FolderKanban className="h-4 w-4"/>}>Projets</NavItem>
          <NavItem href="/settings" icon={<Settings className="h-4 w-4"/>}>Paramètres</NavItem>
        </nav>
        <div className="p-3 border-t">
          <div className="text-xs text-muted-foreground mb-2 truncate">{user.name ?? user.email}</div>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
              <LogOut className="h-4 w-4"/> Se déconnecter
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

function NavItem({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-accent"
    >
      {icon}
      {children}
    </Link>
  );
}
