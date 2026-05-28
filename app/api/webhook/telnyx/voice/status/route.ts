import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const text = await req.text();
  const params = new URLSearchParams(text);
  console.log("[voice/status] callback ignored:", params.get("RecordingSource") ?? params.get("CallStatus") ?? "unknown");
  return new Response("OK", { status: 200 });
}
