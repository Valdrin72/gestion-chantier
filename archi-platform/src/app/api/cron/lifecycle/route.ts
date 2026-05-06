import { NextRequest, NextResponse } from "next/server";
import { evaluateLifecycleAlerts } from "@/server/lifecycle";

// Endpoint à appeler périodiquement (cron Vercel, GitHub Actions, etc.).
// Protégé par un token simple en header `x-cron-secret` = AUTH_SECRET (à durcir si besoin).
export async function POST(req: NextRequest) {
  if (req.headers.get("x-cron-secret") !== process.env.AUTH_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await evaluateLifecycleAlerts();
  return NextResponse.json({ ok: true });
}
