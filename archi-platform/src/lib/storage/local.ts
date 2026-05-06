import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { env } from "@/lib/env";
import type { StorageDriver } from "./index";

const root = path.resolve(process.cwd(), env.STORAGE_LOCAL_PATH);

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

function resolveSafe(key: string) {
  const target = path.resolve(root, key);
  if (!target.startsWith(root)) throw new Error("Invalid storage key");
  return target;
}

export const localStorage: StorageDriver = {
  async put(key, data) {
    const target = resolveSafe(key);
    await ensureDir(path.dirname(target));
    await fs.writeFile(target, data);
  },
  async get(key) {
    return fs.readFile(resolveSafe(key));
  },
  async remove(key) {
    await fs.rm(resolveSafe(key), { force: true });
  },
  async signedUrl(key, opts) {
    const expires = Date.now() + (opts?.expiresInSeconds ?? 600) * 1000;
    const payload = `${key}|${expires}|${opts?.download ? "1" : "0"}`;
    const sig = crypto.createHmac("sha256", env.AUTH_SECRET).update(payload).digest("hex");
    const params = new URLSearchParams({
      key,
      expires: String(expires),
      sig,
      ...(opts?.download ? { download: "1" } : {}),
      ...(opts?.filename ? { filename: opts.filename } : {}),
    });
    return `/api/files/raw?${params.toString()}`;
  },
};

export function verifyLocalSignature(key: string, expires: number, sig: string, download: boolean) {
  if (Date.now() > expires) return false;
  const payload = `${key}|${expires}|${download ? "1" : "0"}`;
  const expected = crypto.createHmac("sha256", env.AUTH_SECRET).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

export function localResolve(key: string) {
  return resolveSafe(key);
}
