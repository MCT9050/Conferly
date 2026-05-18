import { NextResponse } from "next/server";
import { validateEnv, getEnvInfo } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  // Validate environment
  validateEnv();
  
  const envInfo = getEnvInfo();
  
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: {
      supabase: envInfo.supabase ? "configured" : "demo mode",
      livekit: envInfo.livekit ? "configured" : "not configured",
      nodeEnv: envInfo.nodeEnv,
    },
  });
}
