import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import { localResolve, verifyLocalSignature } from "@/lib/storage/local";
import { env } from "@/lib/env";

// Sert les fichiers pour le storage local via URL signée HMAC.
export async function GET(req: NextRequest) {
  if (env.STORAGE_DRIVER !== "local") {
    return new Response("Not available with this storage driver", { status: 404 });
  }
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  const expires = Number(searchParams.get("expires"));
  const sig = searchParams.get("sig");
  const download = searchParams.get("download") === "1";
  const filename = searchParams.get("filename") ?? "file";

  if (!key || !sig || !expires || !verifyLocalSignature(key, expires, sig, download)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const buf = await fs.readFile(localResolve(key));
    const headers: Record<string, string> = {
      "content-type": "application/octet-stream",
    };
    if (download) headers["content-disposition"] = `attachment; filename="${filename}"`;
    return new Response(buf, { status: 200, headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
