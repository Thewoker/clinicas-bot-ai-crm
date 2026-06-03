import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const data = (body.data ?? body) as Record<string, unknown>;
  const agentId = (data.agent_id as string) ?? "";
  const conversationId = (data.conversation_id as string) ?? "";
  const durationSecs = (data.metadata as Record<string, unknown>)?.call_duration_secs as number | undefined;

  console.log(`[elevenlabs/post-call] agent:${agentId} conv:${conversationId} duration:${durationSecs}s`);

  // Delete the in-call conversation state from DB (call is over)
  if (agentId && conversationId) {
    const clinic = await prisma.clinic.findFirst({ where: { elevenLabsAgentId: agentId } });
    if (clinic) {
      await prisma.whatsappConversation.deleteMany({
        where: { clinicId: clinic.id, patientPhone: `elevenlabs:${conversationId}` },
      }).catch(() => null);
    }
  }

  return new Response("OK", { status: 200 });
}
