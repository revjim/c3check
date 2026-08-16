import { NextResponse } from "next/server";

// Always run at request time so the response reflects the live deployment.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    // Vercel injects these; locally they are undefined.
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? "local",
    env: process.env.VERCEL_ENV ?? "development",
    time: new Date().toISOString(),
  });
}
