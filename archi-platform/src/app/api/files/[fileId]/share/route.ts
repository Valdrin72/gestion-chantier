import { NextRequest, NextResponse } from "next/server";
import { createShareLink } from "@/server/files";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const body = await req.json();
  const expiresAt =
    body.expiresInDays && body.expiresInDays > 0
      ? new Date(Date.now() + Number(body.expiresInDays) * 86400_000)
      : null;
  const out = await createShareLink({
    fileId,
    expiresAt,
    password: body.password || null,
    allowDownload: Boolean(body.allowDownload),
  });
  return NextResponse.json(out);
}
