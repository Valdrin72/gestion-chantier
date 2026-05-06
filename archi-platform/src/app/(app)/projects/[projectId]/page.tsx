import Link from "next/link";
import { requireProjectAccess } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/utils";
import { FileUpload } from "@/components/file-upload";
import { FileText } from "lucide-react";

export default async function ProjectFilesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const access = await requireProjectAccess(projectId);

  const files = await db.fileEntry.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    include: {
      currentVersion: true,
      uploadedBy: { select: { name: true, email: true } },
      _count: { select: { versions: true, validations: true, comments: true } },
    },
  });

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Documents</h2>
          <p className="text-sm text-muted-foreground">{files.length} fichier(s)</p>
        </div>
        <FileUpload projectId={projectId} />
      </div>

      {files.length === 0 ? (
        <div className="border rounded-md p-10 text-center text-muted-foreground">
          Aucun document. Téléversez votre premier plan.
        </div>
      ) : (
        <div className="border rounded-md divide-y">
          {files.map((f) => (
            <Link
              key={f.id}
              href={`/projects/${projectId}/files/${f.id}`}
              className="flex items-center gap-3 p-3 hover:bg-accent"
            >
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{f.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  par {f.uploadedBy.name ?? f.uploadedBy.email} ·{" "}
                  {f.currentVersion ? formatBytes(f.currentVersion.sizeBytes) : "—"}
                </div>
              </div>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">v{f.currentVersion?.versionNumber ?? "?"}</Badge>
                {f._count.versions > 1 && <span>{f._count.versions} versions</span>}
                {f._count.validations > 0 && <span>{f._count.validations} validations</span>}
                {f._count.comments > 0 && <span>{f._count.comments} commentaires</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
