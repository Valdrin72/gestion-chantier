import type { ProjectRole, OrgRole } from "@prisma/client";

// Capacités unitaires sur un projet — surchargeables via ProjectMember.permissions (JSON)
export type ProjectCapability =
  | "project.read"
  | "project.update"
  | "file.read"
  | "file.upload"
  | "file.update"
  | "file.delete"
  | "file.share"
  | "validation.request"
  | "validation.approve"
  | "comment.write"
  | "estimate.read"
  | "estimate.write"
  | "asset.read"
  | "asset.write";

const ROLE_CAPS: Record<ProjectRole, ProjectCapability[]> = {
  OWNER: [
    "project.read",
    "file.read",
    "comment.write",
    "estimate.read",
    "asset.read",
    "asset.write",
  ],
  ARCHITECT: [
    "project.read",
    "project.update",
    "file.read",
    "file.upload",
    "file.update",
    "file.delete",
    "file.share",
    "validation.request",
    "validation.approve",
    "comment.write",
    "estimate.read",
    "estimate.write",
    "asset.read",
    "asset.write",
  ],
  ENGINEER: [
    "project.read",
    "file.read",
    "file.upload",
    "file.update",
    "file.share",
    "validation.request",
    "validation.approve",
    "comment.write",
    "estimate.read",
    "estimate.write",
    "asset.read",
  ],
  CONTRACTOR: [
    "project.read",
    "file.read",
    "file.upload",
    "comment.write",
    "estimate.read",
  ],
  REVIEWER: [
    "project.read",
    "file.read",
    "validation.approve",
    "comment.write",
    "estimate.read",
  ],
  VIEWER: ["project.read", "file.read"],
};

export function hasCapability(
  role: ProjectRole,
  capability: ProjectCapability,
  overrides?: Record<string, boolean> | null,
): boolean {
  if (overrides && capability in overrides) return Boolean(overrides[capability]);
  return ROLE_CAPS[role].includes(capability);
}

export function isOrgAdmin(role: OrgRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}
