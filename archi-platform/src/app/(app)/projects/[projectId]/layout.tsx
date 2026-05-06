import Link from "next/link";
import { requireProjectAccess } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireProjectAccess(projectId);
  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { id: true, name: true, status: true },
  });

  const tabs = [
    { href: `/projects/${projectId}`, label: "Documents" },
    { href: `/projects/${projectId}/estimates`, label: "Chiffrage" },
    { href: `/projects/${projectId}/assets`, label: "Cycle de vie" },
    { href: `/projects/${projectId}/members`, label: "Membres" },
  ];

  return (
    <div>
      <div className="border-b">
        <div className="container py-4">
          <div className="text-sm text-muted-foreground">
            <Link href="/projects" className="hover:underline">Projets</Link> / {project.name}
          </div>
          <h1 className="text-2xl font-bold mt-1">{project.name}</h1>
        </div>
        <nav className="container flex gap-1">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="px-3 py-2 text-sm border-b-2 border-transparent hover:border-foreground"
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
