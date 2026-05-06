"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireProjectAccess } from "@/lib/auth-helpers";
import { email } from "@/lib/email";
import { emailTemplates } from "@/lib/email/templates";
import { env } from "@/lib/env";

// Remise du projet : transforme les EstimateLine "trackables" en Assets
export async function handoverProject(args: { projectId: string; ownerUserId?: string }) {
  await requireProjectAccess(args.projectId, "project.update");

  const inventory = await db.assetInventory.upsert({
    where: { projectId: args.projectId },
    create: {
      projectId: args.projectId,
      ownerUserId: args.ownerUserId ?? null,
      handedOverAt: new Date(),
    },
    update: { ownerUserId: args.ownerUserId ?? null, handedOverAt: new Date() },
  });

  const lines = await db.estimateLine.findMany({
    where: {
      sheet: { estimate: { projectId: args.projectId } },
      asset: null,
      OR: [
        { elementType: { trackable: true } },
        { elementTypeId: null, expectedLifespanMonths: { not: null } },
      ],
    },
    include: { elementType: true },
  });

  for (const l of lines) {
    const lifespan = l.expectedLifespanMonths ?? l.elementType?.defaultLifespanMonths ?? null;
    const installDate = l.installDate ?? new Date();
    const endOfLife =
      lifespan != null
        ? new Date(installDate.getTime() + lifespan * 30 * 86400_000)
        : null;
    const warrantyEnd = l.warrantyMonths
      ? new Date(installDate.getTime() + l.warrantyMonths * 30 * 86400_000)
      : null;

    await db.asset.create({
      data: {
        inventoryId: inventory.id,
        estimateLineId: l.id,
        elementTypeId: l.elementTypeId,
        label: l.label,
        reference: l.reference,
        location: l.location,
        attributes: l.attributes ?? undefined,
        installDate,
        expectedLifespanMonths: lifespan,
        warrantyMonths: l.warrantyMonths,
        warrantyEndDate: warrantyEnd,
        endOfLifeDate: endOfLife,
      },
    });
  }

  await db.project.update({
    where: { id: args.projectId },
    data: { status: "HANDED_OVER" },
  });

  revalidatePath(`/projects/${args.projectId}/assets`);
}

/**
 * Calcule et crée les alertes pour les assets dont l'échéance approche.
 * À appeler périodiquement (cron / API route protégée).
 */
export async function evaluateLifecycleAlerts() {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400_000);
  const in90 = new Date(now.getTime() + 90 * 86400_000);

  const assets = await db.asset.findMany({
    where: {
      status: { in: ["OPERATIONAL", "NEEDS_INSPECTION", "NEEDS_MAINTENANCE"] },
      OR: [{ endOfLifeDate: { lte: in90 } }, { warrantyEndDate: { lte: in30 } }],
    },
    include: {
      alerts: { where: { resolvedAt: null } },
      inventory: { include: { project: { include: { members: true } } } },
    },
  });

  for (const a of assets) {
    if (a.endOfLifeDate && a.endOfLifeDate <= in30 && a.alerts.length === 0) {
      const alert = await db.lifecycleAlert.create({
        data: {
          assetId: a.id,
          severity: a.endOfLifeDate <= now ? "CRITICAL" : "WARNING",
          title: "Fin de vie imminente",
          message: `${a.label} arrive en fin de vie estimée le ${a.endOfLifeDate.toLocaleDateString()}.`,
          triggerAt: now,
        },
      });
      // Email aux owners du projet
      const owners = a.inventory.project.members.filter((m) => m.role === "OWNER");
      const projectId = a.inventory.projectId;
      const url = `${env.APP_URL}/projects/${projectId}/assets`;
      for (const o of owners) {
        const u = await db.user.findUnique({ where: { id: o.userId } });
        if (!u) continue;
        const t = emailTemplates.lifecycleAlert({
          assetName: a.label,
          severity: alert.severity,
          message: alert.message ?? "",
          assetUrl: url,
        });
        await email.send({ to: u.email, subject: t.subject, html: t.html });
        await db.notification.create({
          data: {
            userId: u.id,
            type: "ASSET_LIFECYCLE_ALERT",
            payload: { assetId: a.id, alertId: alert.id, projectId },
            emailSentAt: new Date(),
          },
        });
      }
    }
  }
}
