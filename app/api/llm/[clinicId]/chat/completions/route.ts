import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { runBot, BotMessage, ClinicContext } from "@/lib/claude-bot";

export const dynamic = "force-dynamic";

function makeChunk(delta: Record<string, unknown>, finishReason: string | null = null): string {
  return `data: ${JSON.stringify({
    id: "chatcmpl-clinicbot",
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: "clinic-bot",
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  })}\n\n`;
}

function sseStream(text: string): Response {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(makeChunk({ role: "assistant", content: "" })));
      for (const chunk of text.split(/(\s+)/)) {
        if (chunk) controller.enqueue(encoder.encode(makeChunk({ content: chunk })));
      }
      controller.enqueue(encoder.encode(makeChunk({}, "stop")));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(readable, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clinicId: string }> }
) {
  const { clinicId } = await params;
  console.log("[llm] POST clinicId:", clinicId);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return sseStream("Lo siento, ocurrió un error.");
  }

  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
  if (!clinic) {
    console.error("[llm] Clinic not found:", clinicId);
    return sseStream("Lo siento, hay un error de configuración.");
  }

  // ElevenLabs sends full conversation history — extract last user message
  const messages = (body.messages as Array<{ role: string; content: string }>) ?? [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser?.content) {
    return sseStream("Hola, ¿en qué puedo ayudarte?");
  }

  // Build history from ElevenLabs messages (text-only, no tool calls)
  const history: BotMessage[] = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
    .slice(0, -1) // exclude last user message — runBot will add it
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

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

  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 25000)
    );
    ({ reply } = await Promise.race([
      runBot(clinicCtx, history, lastUser.content, `elevenlabs:${clinicId}`, true),
      timeout,
    ]));
    console.log(`[llm] ${clinic.name} took ${Date.now() - t0}ms → "${reply.slice(0, 80)}"`);
  } catch (err) {
    console.error("[llm] runBot error:", err);
    return sseStream("Lo siento, tuve un problema. ¿Podés repetirlo?");
  }

  return sseStream(reply);
}
