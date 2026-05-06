import Link from "next/link";
import { requireProjectAccess } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { FileViewer } from "@/components/file-viewer";
import { ShareLinkPanel } from "@/components/share-link-panel";
import { ValidationPanel } from "@/components/validation-panel";
import { CommentsPanel } from "@/components/comments-panel";
import { NewVersionButton } from "@/components/new-version-button";

export default async function FileDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; fileId: string }>;
}) {
  const { projectId, fileId } = await params;
  const access = await requireProjectAccess(projectId);

  const file = await db.fileEntry.findUniqueOrThrow({
    where: { id: fileId },
    include: {
      project: true,
      currentVersion: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        include: { uploadedBy: { select: { name: true, email: true } } },
      },
      shareLinks: { where: { revokedAt: null }, include: { createdBy: true } },
      validations: {
        orderBy: { createdAt: "desc" },
        include: {
          requestedBy: { select: { name: true, email: true } },
          steps: {
            include: { approver: { select: { id: true, name: true, email: true } } },
            orderBy: { order: "asc" },
          },
        },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true, email: true, image: true } },
          mentions: { include: { user: true } },
        },
      },
    },
  });

  const projectMembers = await db.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  let viewUrl: string | null = null;
  if (file.currentVersion) {
    viewUrl = await storage.signedUrl(file.currentVersion.storageKey, {
      expiresInSeconds: 3600,
      filename: file.name,
    });
  }

  const isPdf = file.currentVersion?.mimeType === "application/pdf";

  return (
    <div className="container py-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/projects/${projectId}`} className="text-sm text-muted-foreground hover:underline">
            ← Documents
          </Link>
          <h2 className="text-xl font-bold mt-1">{file.name}</h2>
          <div className="text-sm text-muted-foreground">
            v{file.currentVersion?.versionNumber} ·{" "}
            {file.currentVersion ? formatBytes(file.currentVersion.sizeBytes) : "—"} ·{" "}
            {file.currentVersion?.mimeType}
          </div>
        </div>
        <NewVersionButton fileId={file.id} />
      </div>

      <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
        <div className="space-y-4">
          <FileViewer url={viewUrl} mimeType={file.currentVersion?.mimeType ?? null} isPdf={isPdf} />

          <section className="border rounded-md">
            <header className="px-4 py-2 border-b font-semibold text-sm">Historique des versions</header>
            <ul className="divide-y">
              {file.versions.map((v) => (
                <li key={v.id} className="px-4 py-2 text-sm flex justify-between">
                  <span>
                    <Badge variant={v.id === file.currentVersionId ? "default" : "outline"} className="mr-2">
                      v{v.versionNumber}
                    </Badge>
                    {v.changeNote ?? "—"}
                  </span>
                  <span className="text-muted-foreground">
                    {v.uploadedBy.name ?? v.uploadedBy.email} ·{" "}
                    {format(v.createdAt, "d MMM yyyy HH:mm", { locale: fr })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-4">
          <ValidationPanel
            fileId={file.id}
            currentVersionId={file.currentVersionId}
            validations={file.validations.map((v) => ({
              id: v.id,
              status: v.status,
              mode: v.mode,
              message: v.message,
              createdAt: v.createdAt,
              requesterName: v.requestedBy.name ?? v.requestedBy.email,
              steps: v.steps.map((s) => ({
                id: s.id,
                status: s.status,
                approverName: s.approver.name ?? s.approver.email,
                approverId: s.approver.id,
                comment: s.comment,
              })),
            }))}
            members={projectMembers.map((m) => ({
              id: m.user.id,
              name: m.user.name ?? m.user.email,
            }))}
          />

          <ShareLinkPanel
            fileId={file.id}
            links={file.shareLinks.map((l) => ({
              id: l.id,
              token: l.token,
              expiresAt: l.expiresAt,
              allowDownload: l.allowDownload,
              hasPassword: Boolean(l.passwordHash),
              createdByName: l.createdBy.name ?? l.createdBy.email,
              accessCount: l.accessCount,
            }))}
          />

          <CommentsPanel
            fileId={file.id}
            comments={file.comments.map((c) => ({
              id: c.id,
              body: c.body,
              createdAt: c.createdAt,
              author: {
                id: c.author.id,
                name: c.author.name ?? c.author.email,
                image: c.author.image,
              },
              targetType: c.targetType,
              pdfPageNumber: c.pdfPageNumber,
              pdfRect: c.pdfRect as { x: number; y: number; w: number; h: number } | null,
              mentions: c.mentions.map((m) => ({
                userId: m.userId,
                userName: m.user.name ?? m.user.email,
                awaitingResponse: m.awaitingResponse,
              })),
              parentId: c.parentId,
            }))}
            members={projectMembers.map((m) => ({
              id: m.user.id,
              name: m.user.name ?? m.user.email,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
