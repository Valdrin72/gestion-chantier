import { env } from "@/lib/env";
import { localStorage } from "./local";
import { s3Storage } from "./s3";

export interface StorageDriver {
  /** Stocke un buffer et retourne la clé d'objet */
  put(key: string, data: Buffer, opts: { contentType: string }): Promise<void>;
  /** Récupère un buffer */
  get(key: string): Promise<Buffer>;
  /** Supprime un objet */
  remove(key: string): Promise<void>;
  /**
   * Renvoie une URL pour accéder à l'objet.
   * En local : URL signée passant par /api/files/raw.
   * En S3 : URL pré-signée.
   */
  signedUrl(key: string, opts?: { expiresInSeconds?: number; download?: boolean; filename?: string }): Promise<string>;
}

export const storage: StorageDriver =
  env.STORAGE_DRIVER === "s3" ? s3Storage : localStorage;

export function buildStorageKey(parts: {
  organizationId: string;
  projectId: string;
  fileId: string;
  versionNumber: number;
  filename: string;
}) {
  const safe = parts.filename.replace(/[^\w.\-]+/g, "_");
  return `org/${parts.organizationId}/proj/${parts.projectId}/file/${parts.fileId}/v${parts.versionNumber}-${safe}`;
}
