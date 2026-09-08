import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Liveness/readiness probe target. Intentionally does not touch the database so
// the pod stays "live" during transient DB blips; DB reachability is covered by
// the app's own startup and the migrate hook.
export function GET() {
  return NextResponse.json({ status: "ok" });
}
