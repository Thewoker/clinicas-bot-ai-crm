import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { runBot, BotMessage, ClinicContext } from "@/lib/claude-bot";

export const dynamic = "force-dynamic";

// ElevenLabs calls this endpoint as a Custom LLM (OpenAI-compatible streaming).
// It sends the conversation history and we respond with SSE tokens.

function makeChunk(delta: Record<string, unknown>, finishReason: string | null = null): string {
  const payload = {
    id: "chatcmpl-clinicbot",
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: "clinic-bot",
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function sseStream(text: string): Response {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    start(controller) {
      // Role chunk (OpenAI-required first chunk)
      controller.enqueue(encoder.encode(makeChunk({ role: "assistant", content: "" })));

      // Content chunks — word by word so ElevenLabs TTS starts immediately
      const words = text.split(/(\s+)/);
      for (const chunk of words) {
        if (chunk) controller.enqueue(encoder.encode(makeChunk({ content: chunk })));
      }

      // Stop chunk + DONE
      controller.enqueue(encoder.encode(makeChunk({}, "stop")));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return sseStream("Lo siento, ocurrió un error.");
  }

  // Log everything ElevenLabs sends so we can debug the structure
  console.log("[llm] incoming keys:", Object.keys(body).join(", "));
  console.log("[llm] agent_id:", body.agent_id, "| conversation_id:", body.conversation_id);

  const agentId = (body.agent_id as string) ?? "";
  const conversationId = (body.conversation_id as string) ?? `el_${Date.now()}`;

  // Identify clinic by their ElevenLabs agent ID
  const clinic = agentId
    ? await prisma.clinic.findFirst({ where: { elevenLabsAgentId: agentId } })
    : null;

  if (!clinic) {
    console.error("[llm] Unknown agent_id:", agentId, "— no matching clinic found");
    // Don't hang up — say something so the call doesn't just cut
    return sseStream("Lo siento, hay un problema de configuración. Por favor llamá directamente a la clínica.");
  }

  // Get the last user message from the conversation
  const messages = (body.messages as Array<{ role: string; content: string }>) ?? [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser?.content) {
    return sseStream("Hola, ¿en qué puedo ayudarte?");
  }

  // Load our internal conversation history (with tool calls) from DB
  const patientPhone = `elevenlabs:${conversationId}`;
  const conversation = await prisma.whatsappConversation.findUnique({
    where: { clinicId_patientPhone: { clinicId: clinic.id, patientPhone } },
  });
  const history = (conversation?.messages ?? []) as unknown as BotMessage[];

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

  const t0 = Date.now();
  let reply: string;
  let updatedHistory: BotMessage[];

  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 25000)
    );
    ({ reply, updatedHistory } = await Promise.race([
      runBot(clinicCtx, history, lastUser.content, patientPhone, true),
      timeout,
    ]));
    console.log(`[llm] conv:${conversationId} bot took ${Date.now() - t0}ms → "${reply.slice(0, 80)}"`);
  } catch (err) {
    console.error("[llm] runBot error:", err);
    return sseStream("Lo siento, tuve un problema al procesar tu mensaje. ¿Podés repetirlo?");
  }

  // Persist history so subsequent turns have full tool-call context
  if (conversation) {
    await prisma.whatsappConversation.update({
      where: { id: conversation.id },
      data: { messages: updatedHistory as unknown as never[] },
    });
  } else {
    await prisma.whatsappConversation.create({
      data: { clinicId: clinic.id, patientPhone, messages: updatedHistory as unknown as never[] },
    });
  }

  return sseStream(reply);
}
