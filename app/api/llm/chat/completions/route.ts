import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { runBot, BotMessage, ClinicContext } from "@/lib/claude-bot";

export const dynamic = "force-dynamic";

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
      controller.enqueue(encoder.encode(makeChunk({ role: "assistant", content: "" })));
      const words = text.split(/(\s+)/);
      for (const chunk of words) {
        if (chunk) controller.enqueue(encoder.encode(makeChunk({ content: chunk })));
      }
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
  console.log("[llm/completions] request received");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    console.error("[llm/completions] failed to parse body");
    return sseStream("Lo siento, ocurrió un error.");
  }

  console.log("[llm/completions] keys:", Object.keys(body).join(", "));
  console.log("[llm/completions] agent_id:", body.agent_id, "| conv_id:", body.conversation_id);

  const agentId = (body.agent_id as string) ?? "";
  const conversationId = (body.conversation_id as string) ?? `el_${Date.now()}`;

  const clinic = agentId
    ? await prisma.clinic.findFirst({ where: { elevenLabsAgentId: agentId } })
    : null;

  if (!clinic) {
    console.error("[llm/completions] Unknown agent_id:", agentId);
    return sseStream("Lo siento, hay un problema de configuración. Por favor llamá directamente a la clínica.");
  }

  const messages = (body.messages as Array<{ role: string; content: string }>) ?? [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser?.content) {
    return sseStream("Hola, ¿en qué puedo ayudarte?");
  }

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
    console.log(`[llm/completions] bot took ${Date.now() - t0}ms → "${reply.slice(0, 80)}"`);
  } catch (err) {
    console.error("[llm/completions] runBot error:", err);
    return sseStream("Lo siento, tuve un problema al procesar tu mensaje. ¿Podés repetirlo?");
  }

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
