import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { transcribeUrlWithAuth } from "@/lib/transcription";
import { runBot, BotMessage, ClinicContext } from "@/lib/claude-bot";

export const dynamic = "force-dynamic";

const MAX_TURNS = 15;

const FAREWELL_RE =
  /hasta luego|adiós|hasta pronto|que tengas|buenas noches|buen día|hasta mañana|chau|bye|nos vemos|un placer/i;

function texml(body: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`,
    { status: 200, headers: { "Content-Type": "text/xml" } }
  );
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sayAndRecord(text: string, respondUrl: string): string {
  const safe = escapeXml(text);
  return `
    <Say voice="Polly.Lupe" language="es-MX">${safe}</Say>
    <Record
      action="${respondUrl}"
      maxLength="10"
      timeout="1"
      trim="trim-silence"
      playBeep="false"
    />
    <Say voice="Polly.Lupe" language="es-MX">No escuché ninguna respuesta. Hasta luego.</Say>
    <Hangup/>
  `;
}

const VOICE_TIMEOUT_MS = 25000;

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const text = await req.text();
  const params = new URLSearchParams(text);

  const callSid = params.get("CallSid") ?? "";
  const recordingUrl = params.get("RecordingUrl") ?? "";
  const recordingDuration = parseInt(params.get("RecordingDuration") ?? "0", 10);
  const to = params.get("To") ?? "";
  const from = params.get("From") ?? "";

  let baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (baseUrl && !baseUrl.startsWith("http")) baseUrl = `https://${baseUrl}`;
  const respondUrl = `${baseUrl}/api/webhook/telnyx/voice/respond`;

  const allParams: Record<string, string> = {};
  params.forEach((v, k) => { allParams[k] = v; });
  console.log("[voice/respond] ALL params:", JSON.stringify(allParams));

  const normalize = (n: string) => n.startsWith("+") ? n : `+${n}`;
  const clinic = await prisma.clinic.findFirst({
    where: { telnyxPhoneNumber: normalize(to) },
  }) ?? await prisma.clinic.findFirst({
    where: { telnyxPhoneNumber: normalize(from) },
  });

  if (!clinic) {
    return texml(`<Say voice="Polly.Lupe" language="es-MX">Ocurrió un error. Hasta luego.</Say><Hangup/>`);
  }

  const conversation = await prisma.whatsappConversation.findUnique({
    where: { clinicId_patientPhone: { clinicId: clinic.id, patientPhone: `call:${callSid}` } },
  });

  const history = ((conversation?.messages ?? []) as unknown as BotMessage[]);

  const assistantTurns = history.filter((m) => m.role === "assistant").length;
  if (assistantTurns >= MAX_TURNS) {
    return texml(
      `<Say voice="Polly.Lupe" language="es-MX">Hemos llegado al límite de la conversación. Hasta luego.</Say><Hangup/>`
    );
  }

  if (!recordingUrl || recordingDuration < 1) {
    return texml(sayAndRecord("No escuché tu respuesta. ¿Podés repetirlo?", respondUrl));
  }

  const telnyxApiKey = clinic.telnyxApiKey ?? "";
  let userText: string;
  try {
    const tStt0 = Date.now();
    userText = await transcribeUrlWithAuth(recordingUrl, "audio/mpeg", `Bearer ${telnyxApiKey}`);
    console.log(`[voice/respond] STT took ${Date.now() - tStt0}ms → "${userText}"`);
  } catch (err) {
    console.error(`[telnyx/voice] Transcription failed for call ${callSid}:`, err);
    return texml(sayAndRecord("Tuve un problema procesando tu mensaje. ¿Podés repetirlo?", respondUrl));
  }

  if (!userText) {
    return texml(sayAndRecord("No pude entender lo que dijiste. ¿Podés repetirlo?", respondUrl));
  }

  console.log(`[telnyx/voice] ${callSid} → "${userText}"`);

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

  let reply: string;
  let updatedHistory: BotMessage[];

  try {
    const tBot0 = Date.now();
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("bot_timeout")), VOICE_TIMEOUT_MS)
    );
    ({ reply, updatedHistory } = await Promise.race([
      runBot(clinicCtx, history, userText, `call:${callSid}`, true),
      timeout,
    ]));
    console.log(`[voice/respond] bot took ${Date.now() - tBot0}ms | total ${Date.now() - t0}ms`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[voice/respond] bot error (${msg}) after ${Date.now() - t0}ms`);
    return texml(sayAndRecord("Tuve un problema al responder. ¿Podés repetirlo?", respondUrl));
  }

  if (conversation) {
    await prisma.whatsappConversation.update({
      where: { id: conversation.id },
      data: { messages: updatedHistory as unknown as never[] },
    });
  }

  if (FAREWELL_RE.test(reply)) {
    return texml(`<Say voice="Polly.Lupe" language="es-MX">${escapeXml(reply)}</Say><Hangup/>`);
  }

  return texml(sayAndRecord(reply, respondUrl));
}
