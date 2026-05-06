import { NextRequest, NextResponse } from "next/server";
import { revokeShareLink } from "@/server/files";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await revokeShareLink({ id });
  return NextResponse.json({ ok: true });
}
