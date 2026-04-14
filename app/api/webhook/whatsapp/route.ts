/**
 * POST /api/webhook/whatsapp
 *
 * Single webhook that receives ALL incoming WhatsApp messages across
 * every connected clinic via Twilio. Routes each message to the right
 * clinic by matching the "To" phone number to the clinic's waPhoneNumberId.
 *
 * Twilio sends webhooks as application/x-www-form-urlencoded with fields:
 *   Body  — message text
 *   From  — sender (patient), e.g. "whatsapp:+5491112345678"
 *   To    — receiving number (clinic), e.g. "whatsapp:+14155238886"
 *
 * Flow:
 *  1. Parse Twilio form-urlencoded payload
 *  2. Identify clinic via "To" phone number (waPhoneNumberId)
 *  3. Load / create conversation history
 *  4. Run Claude bot (tool use loop)
 *  5. Send reply via Twilio API
 *  6. Persist updated history
 *  7. Return empty TwiML <Response/>
 *
 * GET /api/webhook/whatsapp — simple health check
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage, parseWhatsAppNumber } from "@/lib/twilio";
import { runBot, BotMessage, ClinicContext } from "@/lib/claude-bot";

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
  // Twilio sends form-urlencoded, not JSON
  let params: URLSearchParams;
  try {
    const text = await req.text();
    params = new URLSearchParams(text);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const messageBody = params.get("Body")?.trim() ?? "";
  const from = params.get("From") ?? ""; // "whatsapp:+5491112345678"
  const to = params.get("To") ?? "";     // "whatsapp:+14155238886"

  // Ignore status callbacks and empty messages
  if (!from || !to || !messageBody) {
    return twimlOk();
  }

  const patientPhone = parseWhatsAppNumber(from); // "+5491112345678"
  const clinicPhone = parseWhatsAppNumber(to);    // "+14155238886"

  // Find the clinic that owns this WhatsApp number
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

  try {
    await handleMessage(clinic, patientPhone, messageBody);
  } catch (err) {
    console.error(`[webhook] Error handling message from ${patientPhone}:`, err);
    await sendWhatsAppMessage(
      clinic.waPhoneNumberId!,
      patientPhone,
      "Lo siento, tuve un problema procesando tu mensaje. Por favor intentá de nuevo en unos momentos."
    ).catch(() => {});
  }

  // Always return 200 so Twilio doesn't retry
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
    waPhoneNumberId: string | null;
    waBotName: string | null;
    waBotWelcome: string | null;
  },
  patientPhone: string,
  text: string
) {
  // Load or create conversation record
  let conversation = await prisma.whatsappConversation.findUnique({
    where: {
      clinicId_patientPhone: { clinicId: clinic.id, patientPhone },
    },
  });

  // Reset conversation history if stale (24h without activity)
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
  };

  const { reply, updatedHistory } = await runBot(clinicCtx, history, text);

  // Persist updated history
  await prisma.whatsappConversation.update({
    where: { id: conversation.id },
    data: { messages: updatedHistory as unknown as never[] },
  });

  // Send reply via Twilio API (not TwiML — allows async processing pattern)
  await sendWhatsAppMessage(clinic.waPhoneNumberId!, patientPhone, reply);
}
