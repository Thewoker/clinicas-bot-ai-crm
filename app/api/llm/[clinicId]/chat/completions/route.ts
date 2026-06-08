import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { runBot, BotMessage, ClinicContext } from "@/lib/claude-bot";

export const dynamic = "force-dynamic";

// After this many assistant turns, force a polite closing to prevent infinite calls
const MAX_VOICE_TURNS = 15;

// Detect farewell phrases as a backup trigger for hanging up
const FAREWELL_RE = /\b(hasta luego|hasta pronto|hasta otra|adiós|adios|venga[,\s]+(adiós|adios|hasta)|que (vaya|pase|tenga)|no dudes en llamar|quedamos así|un saludo$|cuidat[eo] mucho)\b/i;

function makeChunk(delta: Record<string, unknown>, finishReason: string | null = null): string {
  return `data: ${JSON.stringify({
    id: "chatcmpl-clinicbot",
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: "clinic-bot",
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  })}\n\n`;
}

// Emits an end_call function call in the SSE stream so ElevenLabs hangs up
async function writeEndCall(writer: WritableStreamDefaultWriter<Uint8Array>, encoder: TextEncoder) {
  const ts = Math.floor(Date.now() / 1000);
  const callId = `call_end_${Date.now()}`;
  const base = { id: "chatcmpl-clinicbot", object: "chat.completion.chunk", created: ts, model: "clinic-bot" };
  await writer.write(encoder.encode(
    `data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: callId, type: "function", function: { name: "end_call", arguments: "" } }] }, finish_reason: null }] })}\n\n`
  ));
  await writer.write(encoder.encode(
    `data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: "{}" } }] }, finish_reason: null }] })}\n\n`
  ));
  await writer.write(encoder.encode(makeChunk({}, "tool_calls")));
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

  // Derive a stable conversation key from the first user message + clinicId
  const firstUserContent = messages.find((m) => m.role === "user")?.content ?? lastUser.content;
  const convKey = createHash("md5").update(`${clinicId}:${firstUserContent.slice(0, 120)}`).digest("hex").slice(0, 20);
  const patientPhone = `elevenlabs:${convKey}`;

  // Load internal history (with tool calls) from DB
  const conversation = await prisma.whatsappConversation.findUnique({
    where: { clinicId_patientPhone: { clinicId: clinic.id, patientPhone } },
  });
  const history = (conversation?.messages ?? []) as unknown as BotMessage[];

  // Force closing if too many turns have elapsed (prevents infinite calls)
  const assistantTurns = history.filter((m) => m.role === "assistant").length;
  if (assistantTurns >= MAX_VOICE_TURNS) {
    return sseStream("Ha pasado bastante tiempo en la llamada. Si necesitas algo más, llámanos de nuevo. ¡Hasta luego!");
  }

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

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  // Send role chunk IMMEDIATELY so ElevenLabs doesn't time out waiting for first token
  writer.write(encoder.encode(makeChunk({ role: "assistant", content: "" })));

  const t0 = Date.now();

  // Process bot in background — stream reply once ready
  (async () => {
    let reply = "Lo siento, tuve un problema. ¿Puedes repetirlo?";
    let hangUp = false;
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 25000)
      );
      let updatedHistory: BotMessage[];
      let shouldHangUp: boolean;
      ({ reply, updatedHistory, shouldHangUp } = await Promise.race([
        runBot(clinicCtx, history, lastUser.content, patientPhone, true),
        timeout,
      ]));
      hangUp = shouldHangUp || FAREWELL_RE.test(reply);
      console.log(`[llm] ${clinic.name} took ${Date.now() - t0}ms hangUp:${hangUp} → "${reply.slice(0, 80)}"`);

      // Save history with tool calls for next turn
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
    } catch (err) {
      console.error("[llm] runBot error:", err);
    }

    for (const chunk of reply.split(/(\s+)/)) {
      if (chunk) await writer.write(encoder.encode(makeChunk({ content: chunk })));
    }

    if (hangUp) {
      await writeEndCall(writer, encoder);
    } else {
      await writer.write(encoder.encode(makeChunk({}, "stop")));
    }
    await writer.write(encoder.encode("data: [DONE]\n\n"));
    await writer.close();
  })();

  return new Response(readable, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
