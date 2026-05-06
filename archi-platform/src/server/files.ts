"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireProjectAccess, requireUser } from "@/lib/auth-helpers";
import { storage, buildStorageKey } from "@/lib/storage";
import { email } from "@/lib/email";
import { emailTemplates } from "@/lib/email/templates";
import { env } from "@/lib/env";

// ---------- Upload (création de FileEntry + 1ère version) ----------
export async function uploadFile(args: {
  projectId: string;
  folderId?: string | null;
  name: string;
  description?: string | null;
  file: { buffer: Buffer; mimeType: string; size: number; filename: string };
  notifyMembers?: boolean;
}) {
  const { userId } = await requireProjectAccess(args.projectId, "file.upload");
  const project = await db.project.findUniqueOrThrow({
    where: { id: args.projectId },
    select: { id: true, organizationId: true, name: true },
  });

  const fileId = "f_" + nanoid(16);
  const versionNumber = 1;
  const storageKey = buildStorageKey({
    organizationId: project.organizationId,
    projectId: project.id,
    fileId,
    versionNumber,
    filename: args.file.filename,
  });

  await storage.put(storageKey, args.file.buffer, { contentType: args.file.mimeType });
  const checksum = crypto.createHash("sha256").update(args.file.buffer).digest("hex");

  const result = await db.$transaction(async (tx) => {
    const entry = await tx.fileEntry.create({
      data: {
        id: fileId,
        projectId: args.projectId,
        folderId: args.folderId ?? null,
        name: args.name,
        description: args.description ?? null,
        uploadedById: userId,
      },
    });
    const version = await tx.fileVersion.create({
      data: {
        fileId: entry.id,
        versionNumber,
        storageKey,
        mimeType: args.file.mimeType,
        sizeBytes: BigInt(args.file.size),
        checksum,
        uploadedById: userId,
      },
    });
    await tx.fileEntry.update({
      where: { id: entry.id },
      data: { currentVersionId: version.id },
    });
    return { entry, version };
  });

  if (args.notifyMembers) {
    const members = await db.projectMember.findMany({
      where: { projectId: args.projectId, userId: { not: userId } },
      include: { user: true },
    });
    const uploader = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const url = `${env.APP_URL}/projects/${args.projectId}/files/${result.entry.id}`;
    for (const m of members) {
      const t = emailTemplates.fileAdded({
        uploaderName: uploader.name ?? uploader.email,
        fileName: args.name,
        projectName: project.name,
        fileUrl: url,
      });
      await email.send({ to: m.user.email, subject: t.subject, html: t.html });
      await db.notification.create({
        data: {
          userId: m.userId,
          type: "FILE_ADDED",
          payload: { fileId: result.entry.id, projectId: args.projectId },
          emailSentAt: new Date(),
        },
      });
    }
  }

  revalidatePath(`/projects/${args.projectId}`);
  return { fileId: result.entry.id };
}

// ---------- Ajout d'une nouvelle version ----------
export async function uploadNewVersion(args: {
  fileId: string;
  changeNote?: string | null;
  file: { buffer: Buffer; mimeType: string; size: number; filename: string };
}) {
  const fileEntry = await db.fileEntry.findUniqueOrThrow({
    where: { id: args.fileId },
    include: {
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      project: { select: { id: true, organizationId: true } },
    },
  });
  const { userId } = await requireProjectAccess(fileEntry.projectId, "file.update");

  const versionNumber = (fileEntry.versions[0]?.versionNumber ?? 0) + 1;
  const storageKey = buildStorageKey({
    organizationId: fileEntry.project.organizationId,
    projectId: fileEntry.project.id,
    fileId: fileEntry.id,
    versionNumber,
    filename: args.file.filename,
  });

  await storage.put(storageKey, args.file.buffer, { contentType: args.file.mimeType });
  const checksum = crypto.createHash("sha256").update(args.file.buffer).digest("hex");

  const version = await db.$transaction(async (tx) => {
    const v = await tx.fileVersion.create({
      data: {
        fileId: fileEntry.id,
        versionNumber,
        storageKey,
        mimeType: args.file.mimeType,
        sizeBytes: BigInt(args.file.size),
        checksum,
        uploadedById: userId,
        changeNote: args.changeNote ?? null,
      },
    });
    await tx.fileEntry.update({
      where: { id: fileEntry.id },
      data: { currentVersionId: v.id },
    });
    return v;
  });

  revalidatePath(`/projects/${fileEntry.projectId}/files/${fileEntry.id}`);
  return { versionId: version.id, versionNumber };
}

// ---------- Création d'un lien de partage ----------
export async function createShareLink(args: {
  fileId: string;
  expiresAt?: Date | null;
  password?: string | null;
  allowDownload?: boolean;
  pinnedVersionId?: string | null;
}) {
  const fileEntry = await db.fileEntry.findUniqueOrThrow({ where: { id: args.fileId } });
  const { userId } = await requireProjectAccess(fileEntry.projectId, "file.share");

  const link = await db.shareLink.create({
    data: {
      fileId: fileEntry.id,
      token: nanoid(20),
      createdById: userId,
      expiresAt: args.expiresAt ?? null,
      passwordHash: args.password ? await bcrypt.hash(args.password, 10) : null,
      allowDownload: args.allowDownload ?? true,
      pinnedVersionId: args.pinnedVersionId ?? null,
    },
  });
  return { url: `${env.APP_URL}/share/${link.token}`, token: link.token };
}

export async function revokeShareLink(args: { id: string }) {
  await requireUser();
  const link = await db.shareLink.findUniqueOrThrow({
    where: { id: args.id },
    include: { file: true },
  });
  await requireProjectAccess(link.file.projectId, "file.share");
  await db.shareLink.update({
    where: { id: args.id },
    data: { revokedAt: new Date() },
  });
  revalidatePath(`/projects/${link.file.projectId}/files/${link.file.id}`);
}
