import { NextRequest, NextResponse } from "next/server";
import { uploadFile } from "@/server/files";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const name = String(form.get("name") ?? file.name);
  const folderId = (form.get("folderId") as string | null) || null;
  const description = (form.get("description") as string | null) || null;
  const notifyMembers = form.get("notifyMembers") === "1";

  const out = await uploadFile({
    projectId,
    folderId,
    name,
    description,
    file: {
      buffer,
      mimeType: file.type || "application/octet-stream",
      size: buffer.byteLength,
      filename: file.name,
    },
    notifyMembers,
  });
  return NextResponse.json(out);
}
