import { NextResponse, type NextRequest } from "next/server";

// Middleware minimal — l'auth est gérée dans les Server Components via requireUser().
// On utilise ce middleware pour des redirections futures éventuelles.
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api/auth|api/files/raw|share|favicon.ico|.*\\..*).*)"],
};
