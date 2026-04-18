/**
 * POST /api/webhook/whatsapp
 *
 * Single webhook that receives ALL incoming WhatsApp messages across
 * every connected clinic via Twilio. Routes each message to the right
 * clinic by matching the "To" phone number to the clinic's waPhoneNumberId.
 *
 * Twilio sends webhooks as application/x-www-form-urlencoded with fields:
 *   Body              — message text (empty for voice notes)
 *   From              — sender (patient), e.g. "whatsapp:+5491112345678"
 *   To                — receiving number (clinic), e.g. "whatsapp:+14155238886"
 *   NumMedia          — number of media attachments (0 for text, 1+ for media)
 *   MediaUrl0         — URL to the first media file (audio/ogg for voice notes)
 *   MediaContentType0 — MIME type of the first media file
 *
 * Flow:
 *  1. Parse Twilio form-urlencoded payload
 *  2. If audio message → transcribe with OpenAI Whisper
 *  3. Identify clinic via "To" phone number (waPhoneNumberId)
 *  4. Load / create conversation history
 *  5. Run Claude bot (tool use loop)
 *  6. Send reply via Twilio API
 *  7. Persist updated history
 *  8. Return empty TwiML <Response/>
 *
 * GET /api/webhook/whatsapp — simple health check
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage, parseWhatsAppNumber } from "@/lib/twilio";
import { runBot, BotMessage, ClinicContext } from "@/lib/claude-bot";
import { transcribeWhatsAppAudio } from "@/lib/transcription";

const TWIML_EMPTY = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

function twimlOk() {
  return new Response(TWIML_EMPTY, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

// ─── Health check ─────────────────────────────────────────────────────────────
export async function GET() {
  return new Response("OK", { status: 200 });
}

// ─── Incoming message handler ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let params: URLSearchParams;
  try {
    const text = await req.text();
    params = new URLSearchParams(text);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const from = params.get("From") ?? "";
  const to = params.get("To") ?? "";
  const numMedia = parseInt(params.get("NumMedia") ?? "0", 10);
  const mediaUrl = params.get("MediaUrl0") ?? "";
  const mediaContentType = params.get("MediaContentType0") ?? "";
  const rawBody = params.get("Body")?.trim() ?? "";

  const isAudio = numMedia > 0 && mediaContentType.startsWith("audio/");
  const hasContent = rawBody.length > 0 || isAudio;

  // Ignore status callbacks and messages with no content
  if (!from || !to || !hasContent) {
    return twimlOk();
  }

  const patientPhone = parseWhatsAppNumber(from);
  const clinicPhone = parseWhatsAppNumber(to);

  const clinic = await prisma.clinic.findFirst({
    where: { waPhoneNumberId: clinicPhone },
  });

  if (!clinic) {
    console.warn(`[webhook] Unknown WhatsApp number: ${clinicPhone}`);
    return twimlOk();
  }

  if (!clinic.waActive) {
    return twimlOk();
  }

  // Resolve the text to send to the bot
  let messageText = rawBody;

  if (isAudio) {
    try {
      const transcription = await transcribeWhatsAppAudio(mediaUrl, mediaContentType);
      console.log(`[webhook] Transcribed audio from ${patientPhone}: "${transcription}"`);
      messageText = transcription;
    } catch (err) {
      console.error(`[webhook] Audio transcription failed for ${patientPhone}:`, err);
      await sendWhatsAppMessage(
        clinic.waPhoneNumberId!,
        patientPhone,
        "Lo siento, no pude procesar tu mensaje de voz. ¿Podés escribirme lo que necesitás?"
      ).catch(() => {});
      return twimlOk();
    }
  }

  if (!messageText) {
    return twimlOk();
  }

  try {
    await handleMessage(clinic, patientPhone, messageText);
  } catch (err) {
    console.error(`[webhook] Error handling message from ${patientPhone}:`, err);
    await sendWhatsAppMessage(
      clinic.waPhoneNumberId!,
      patientPhone,
      "Lo siento, tuve un problema procesando tu mensaje. Por favor intentá de nuevo en unos momentos."
    ).catch(() => {});
  }

  return twimlOk();
}

// ─── Core message handler ─────────────────────────────────────────────────────
async function handleMessage(
  clinic: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    apiKey: string;
    timezone: string;
    waPhoneNumberId: string | null;
    waBotName: string | null;
    waBotWelcome: string | null;
  },
  patientPhone: string,
  text: string
) {
  let conversation = await prisma.whatsappConversation.findUnique({
    where: { clinicId_patientPhone: { clinicId: clinic.id, patientPhone } },
  });

  const isStale =
    conversation &&
    Date.now() - new Date(conversation.updatedAt).getTime() > 24 * 60 * 60 * 1000;

  if (!conversation) {
    conversation = await prisma.whatsappConversation.create({
      data: { clinicId: clinic.id, patientPhone, messages: [] },
    });
  } else if (isStale) {
    await prisma.whatsappConversation.update({
      where: { id: conversation.id },
      data: { messages: [] },
    });
    conversation.messages = [];
  }

  const history = (conversation.messages as unknown as BotMessage[]) ?? [];

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

  const { reply, updatedHistory } = await runBot(clinicCtx, history, text, patientPhone);

  await prisma.whatsappConversation.update({
    where: { id: conversation.id },
    data: { messages: updatedHistory as unknown as never[] },
  });

  await sendWhatsAppMessage(clinic.waPhoneNumberId!, patientPhone, reply);
}
