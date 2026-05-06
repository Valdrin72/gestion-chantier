import { NextRequest, NextResponse } from "next/server";
import { decideValidation } from "@/server/validations";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ stepId: string }> },
) {
  const { stepId } = await params;
  const body = await req.json();
  await decideValidation({
    stepId,
    decision: body.decision,
    comment: body.comment ?? null,
  });
  return NextResponse.json({ ok: true });
}
