import { NextRequest, NextResponse } from "next/server";
import { createComment } from "@/server/comments";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const body = await req.json();
  const out = await createComment({
    fileId,
    body: String(body.body ?? "").trim(),
    targetType: body.targetType ?? "FILE",
    pdfPageNumber: body.pdfPageNumber ?? null,
    pdfRect: body.pdfRect ?? null,
    parentId: body.parentId ?? null,
  });
  return NextResponse.json(out);
}
