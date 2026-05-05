/**
 * POST /api/webhook/vapi/llm?clinicId=CLINIC_ID
 *
 * Custom LLM endpoint for Vapi.ai voice calls.
 * Configure this URL in each clinic's Vapi assistant as the "Custom LLM URL".
 *
 * Vapi handles STT + TTS. We handle the business logic via Claude + tools.
 *
 * Flow per turn:
 *  1. Vapi sends POST with { messages, call: { id } }
 *  2. We extract the latest user message
 *  3. We load conversation history from DB (keyed by call ID)
 *  4. We run runBot() with the user message + history
 *  5. We persist updated history and return OpenAI-format response
 *  6. Vapi speaks the reply and waits for next user turn
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { runBot, BotMessage, ClinicContext } from "@/lib/claude-bot";

export const dynamic = "force-dynamic";

interface VapiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

interface VapiLLMRequest {
  messages: VapiMessage[];
  call: {
    id: string;
    phoneNumber?: { id: string; number: string };
    customer?: { number: string };
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function openAIReply(content: string) {
  return {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
  };
}

export async function POST(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get("clinicId");
  if (!clinicId) {
    return json({ error: "Missing clinicId query param" }, 400);
  }

  let body: VapiLLMRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const callId = body.call?.id;
  if (!callId) {
    return json({ error: "Missing call.id" }, 400);
  }

  // Extract only the latest user message — history comes from our DB
  const latestUserMsg = [...(body.messages ?? [])]
    .reverse()
    .find((m) => m.role === "user");

  if (!latestUserMsg) {
    return json({ error: "No user message found" }, 400);
  }

  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
  });

  if (!clinic) {
    return json(
      openAIReply("Lo siento, este servicio no está disponible en este momento."),
      200
    );
  }

  const callKey = `call:${callId}`;

  // Load conversation for this call, creating a fresh one if first turn
  const conversation = await prisma.whatsappConversation.upsert({
    where: {
      clinicId_patientPhone: { clinicId: clinic.id, patientPhone: callKey },
    },
    create: { clinicId: clinic.id, patientPhone: callKey, messages: [] },
    update: {},
  });

  const history = (conversation.messages ?? []) as unknown as BotMessage[];

  const clinicCtx: ClinicContext = {
    id: clinic.id,
    name: clinic.name,
    phone: clinic.phone,
    address: clinic.address,
    apiKey: clinic.apiKey,
    waBotName: clinic.waBotName,
    waBotWelcome: clinic.waBotWelcome,
    timezone: clinic.timezone,
  };

  const { reply, updatedHistory } = await runBot(
    clinicCtx,
    history,
    latestUserMsg.content,
    callKey
  );

  await prisma.whatsappConversation.update({
    where: { id: conversation.id },
    data: { messages: updatedHistory as unknown as never[] },
  });

  console.log(`[vapi] ${callId} → "${latestUserMsg.content}" | reply: "${reply.slice(0, 80)}..."`);

  return json(openAIReply(reply));
}
