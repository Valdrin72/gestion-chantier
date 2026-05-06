"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireProjectAccess, requireUser } from "@/lib/auth-helpers";
import { email } from "@/lib/email";
import { emailTemplates } from "@/lib/email/templates";
import { env } from "@/lib/env";
import type { ValidationMode } from "@prisma/client";

export async function requestValidation(args: {
  fileId: string;
  approverIds: string[];
  mode: ValidationMode;
  message?: string | null;
  dueDate?: Date | null;
}) {
  const file = await db.fileEntry.findUniqueOrThrow({
    where: { id: args.fileId },
    include: { currentVersion: true, project: true },
  });
  if (!file.currentVersionId) throw new Error("Aucune version courante");

  const { userId } = await requireProjectAccess(file.projectId, "validation.request");
  const requester = await db.user.findUniqueOrThrow({ where: { id: userId } });

  const request = await db.validationRequest.create({
    data: {
      fileId: file.id,
      versionId: file.currentVersionId,
      requestedById: userId,
      mode: args.mode,
      message: args.message ?? null,
      dueDate: args.dueDate ?? null,
      steps: {
        create: args.approverIds.map((approverId, idx) => ({
          approverId,
          order: idx,
        })),
      },
    },
    include: { steps: { include: { approver: true } } },
  });

  const url = `${env.APP_URL}/projects/${file.projectId}/files/${file.id}`;
  for (const step of request.steps) {
    const t = emailTemplates.validationRequested({
      requesterName: requester.name ?? requester.email,
      fileName: file.name,
      projectName: file.project.name,
      fileUrl: url,
      message: args.message ?? undefined,
    });
    await email.send({ to: step.approver.email, subject: t.subject, html: t.html });
    await db.notification.create({
      data: {
        userId: step.approverId,
        type: "VALIDATION_REQUESTED",
        payload: { fileId: file.id, projectId: file.projectId, requestId: request.id },
        emailSentAt: new Date(),
      },
    });
  }

  revalidatePath(`/projects/${file.projectId}/files/${file.id}`);
  return { id: request.id };
}

export async function decideValidation(args: {
  stepId: string;
  decision: "APPROVED" | "REJECTED";
  comment?: string | null;
}) {
  const { userId } = await requireUser();
  const step = await db.validationStep.findUniqueOrThrow({
    where: { id: args.stepId },
    include: {
      request: {
        include: {
          file: { include: { project: true } },
          steps: true,
        },
      },
    },
  });
  if (step.approverId !== userId) throw new Error("Forbidden");
  if (step.status !== "PENDING") throw new Error("Already decided");

  await db.validationStep.update({
    where: { id: args.stepId },
    data: {
      status: args.decision,
      comment: args.comment ?? null,
      decidedAt: new Date(),
    },
  });

  // Recalcul de l'état de la requête
  const updated = await db.validationStep.findMany({ where: { requestId: step.requestId } });
  const mode = step.request.mode;
  let newStatus: "PENDING" | "APPROVED" | "REJECTED" = "PENDING";
  if (updated.some((s) => s.status === "REJECTED")) newStatus = "REJECTED";
  else if (mode === "ANY" && updated.some((s) => s.status === "APPROVED")) newStatus = "APPROVED";
  else if ((mode === "ALL" || mode === "SEQUENTIAL") && updated.every((s) => s.status === "APPROVED"))
    newStatus = "APPROVED";

  if (newStatus !== "PENDING") {
    await db.validationRequest.update({
      where: { id: step.requestId },
      data: { status: newStatus, resolvedAt: new Date() },
    });
    const reviewer = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const url = `${env.APP_URL}/projects/${step.request.file.projectId}/files/${step.request.fileId}`;
    const t = emailTemplates.validationDecided({
      fileName: step.request.file.name,
      decision: newStatus as "APPROVED" | "REJECTED",
      reviewerName: reviewer.name ?? reviewer.email,
      fileUrl: url,
      comment: args.comment ?? undefined,
    });
    const requester = await db.user.findUniqueOrThrow({
      where: { id: step.request.requestedById },
    });
    await email.send({ to: requester.email, subject: t.subject, html: t.html });
    await db.notification.create({
      data: {
        userId: step.request.requestedById,
        type: newStatus === "APPROVED" ? "VALIDATION_APPROVED" : "VALIDATION_REJECTED",
        payload: { fileId: step.request.fileId, requestId: step.requestId },
        emailSentAt: new Date(),
      },
    });
  }

  revalidatePath(`/projects/${step.request.file.projectId}/files/${step.request.fileId}`);
}
