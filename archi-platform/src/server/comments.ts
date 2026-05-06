"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireProjectAccess } from "@/lib/auth-helpers";
import { email } from "@/lib/email";
import { emailTemplates } from "@/lib/email/templates";
import { env } from "@/lib/env";
import type { CommentTargetType } from "@prisma/client";

const MENTION_RE = /@\[([^\]]+)\]\(([^)]+)\)/g; // @[Nom](userId)

function extractMentions(body: string): string[] {
  const ids = new Set<string>();
  let m;
  while ((m = MENTION_RE.exec(body))) ids.add(m[2]);
  return [...ids];
}

export async function createComment(args: {
  fileId: string;
  body: string;
  targetType?: CommentTargetType;
  pdfPageNumber?: number | null;
  pdfRect?: { x: number; y: number; w: number; h: number } | null;
  parentId?: string | null;
}) {
  const file = await db.fileEntry.findUniqueOrThrow({
    where: { id: args.fileId },
    include: { project: true },
  });
  const { userId } = await requireProjectAccess(file.projectId, "comment.write");
  const author = await db.user.findUniqueOrThrow({ where: { id: userId } });

  const mentions = extractMentions(args.body);

  const comment = await db.comment.create({
    data: {
      fileId: file.id,
      authorId: userId,
      body: args.body,
      targetType: args.targetType ?? "FILE",
      pdfPageNumber: args.pdfPageNumber ?? null,
      pdfRect: args.pdfRect ?? undefined,
      parentId: args.parentId ?? null,
      mentions: {
        create: mentions.map((uid) => ({ userId: uid })),
      },
    },
    include: { mentions: { include: { user: true } } },
  });

  // Notifications de mention
  const url = `${env.APP_URL}/projects/${file.projectId}/files/${file.id}`;
  for (const m of comment.mentions) {
    if (m.userId === userId) continue;
    const t = emailTemplates.mention({
      authorName: author.name ?? author.email,
      fileName: file.name,
      excerpt: args.body.slice(0, 200),
      fileUrl: url,
    });
    await email.send({ to: m.user.email, subject: t.subject, html: t.html });
    await db.notification.create({
      data: {
        userId: m.userId,
        type: "COMMENT_MENTION",
        payload: { fileId: file.id, commentId: comment.id, projectId: file.projectId },
        emailSentAt: new Date(),
      },
    });
  }

  revalidatePath(`/projects/${file.projectId}/files/${file.id}`);
  return { id: comment.id };
}

export async function markMentionResponded(args: { commentId: string }) {
  const file = await db.comment.findUniqueOrThrow({
    where: { id: args.commentId },
    include: { file: true },
  });
  const { userId } = await requireProjectAccess(file.file.projectId, "comment.write");
  await db.commentMention.updateMany({
    where: { commentId: args.commentId, userId },
    data: { awaitingResponse: false, respondedAt: new Date() },
  });
  revalidatePath(`/projects/${file.file.projectId}/files/${file.file.id}`);
}
