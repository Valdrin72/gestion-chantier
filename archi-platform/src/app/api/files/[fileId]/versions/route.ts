import { NextRequest, NextResponse } from "next/server";
import { uploadNewVersion } from "@/server/files";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const out = await uploadNewVersion({
    fileId,
    changeNote: (form.get("changeNote") as string | null) || null,
    file: {
      buffer,
      mimeType: file.type || "application/octet-stream",
      size: buffer.byteLength,
      filename: file.name,
    },
  });
  return NextResponse.json(out);
}
