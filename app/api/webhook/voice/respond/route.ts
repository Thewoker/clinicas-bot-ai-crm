/**
 * POST /api/webhook/voice/respond
 *
 * Called by Twilio after each <Record> completes.
 * Downloads the recording, transcribes with Groq Whisper,
 * runs the Claude bot, and responds with <Say> + next <Record>.
 *
 * Twilio sends (among others):
 *   CallSid        — unique call identifier
 *   RecordingUrl   — URL to the audio file (mp3 / wav)
 *   RecordingDuration — seconds of audio recorded
 *   To             — clinic's phone number
 *   From           — caller's phone number
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { transcribeWhatsAppAudio } from "@/lib/transcription";
import { runBot, BotMessage, ClinicContext } from "@/lib/claude-bot";

export const dynamic = "force-dynamic";

const MAX_TURNS = 15;

// Farewell phrases — when detected we hang up after speaking
const FAREWELL_RE =
  /hasta luego|adiós|hasta pronto|que tengas|buenas noches|buen día|hasta mañana|chau|bye|nos vemos|un placer/i;

function twiml(body: string): Response {
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
    <Say voice="alice" language="es-MX">${safe}</Say>
    <Record
      action="${respondUrl}"
      maxLength="30"
      timeout="5"
      trim="trim-silence"
      playBeep="false"
    />
    <Say voice="alice" language="es-MX">No escuché ninguna respuesta. Hasta luego.</Say>
    <Hangup/>
  `;
}

export async function POST(req: NextRequest) {
  const text = await req.text();
  const params = new URLSearchParams(text);

  const callSid = params.get("CallSid") ?? "";
  const recordingUrl = params.get("RecordingUrl") ?? "";
  const recordingDuration = parseInt(params.get("RecordingDuration") ?? "0", 10);
  const to = params.get("To") ?? "";

  const clinicPhone = to.replace(/^whatsapp:/, "");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const respondUrl = `${baseUrl}/api/webhook/voice/respond`;

  // Find clinic
  const clinic = await prisma.clinic.findFirst({
    where: { waPhoneNumberId: clinicPhone },
  });

  if (!clinic) {
    return twiml(
      `<Say voice="alice" language="es-MX">Ocurrió un error. Hasta luego.</Say><Hangup/>`
    );
  }

  // Load call conversation
  const conversation = await prisma.whatsappConversation.findUnique({
    where: {
      clinicId_patientPhone: {
        clinicId: clinic.id,
        patientPhone: `call:${callSid}`,
      },
    },
  });

  const history = ((conversation?.messages ?? []) as unknown as BotMessage[]);

  // Enforce max turns
  const assistantTurns = history.filter((m) => m.role === "assistant").length;
  if (assistantTurns >= MAX_TURNS) {
    return twiml(
      `<Say voice="alice" language="es-MX">Hemos llegado al límite de la conversación. Por favor llamá nuevamente si necesitás más ayuda. Hasta luego.</Say><Hangup/>`
    );
  }

  // Handle silence / very short recordings
  if (!recordingUrl || recordingDuration < 1) {
    return twiml(
      sayAndRecord(
        "No escuché tu respuesta. ¿Podés repetirlo?",
        respondUrl
      )
    );
  }

  // Transcribe the recording
  let userText: string;
  try {
    // Twilio recording URLs are WAV by default; append .mp3 for smaller files
    const audioUrl = recordingUrl.endsWith(".mp3")
      ? recordingUrl
      : `${recordingUrl}.mp3`;

    userText = await transcribeWhatsAppAudio(audioUrl, "audio/mpeg");
  } catch (err) {
    console.error(`[voice] Transcription failed for call ${callSid}:`, err);
    return twiml(
      sayAndRecord(
        "Tuve un problema procesando tu mensaje. ¿Podés repetirlo?",
        respondUrl
      )
    );
  }

  if (!userText) {
    return twiml(
      sayAndRecord("No pude entender lo que dijiste. ¿Podés repetirlo?", respondUrl)
    );
  }

  console.log(`[voice] ${callSid} → "${userText}"`);

  // Run the bot
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
    userText,
    `call:${callSid}`
  );

  // Persist updated history
  if (conversation) {
    await prisma.whatsappConversation.update({
      where: { id: conversation.id },
      data: { messages: updatedHistory as unknown as never[] },
    });
  }

  // Detect farewell → hang up after speaking
  if (FAREWELL_RE.test(reply)) {
    return twiml(
      `<Say voice="alice" language="es-MX">${escapeXml(reply)}</Say><Hangup/>`
    );
  }

  return twiml(sayAndRecord(reply, respondUrl));
}
