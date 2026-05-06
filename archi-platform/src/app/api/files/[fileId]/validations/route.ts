import { NextRequest, NextResponse } from "next/server";
import { requestValidation } from "@/server/validations";
import type { ValidationMode } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const body = await req.json();
  const out = await requestValidation({
    fileId,
    approverIds: body.approverIds ?? [],
    mode: (body.mode ?? "ALL") as ValidationMode,
    message: body.message ?? null,
    dueDate: body.dueDate ? new Date(body.dueDate) : null,
  });
  return NextResponse.json(out);
}
