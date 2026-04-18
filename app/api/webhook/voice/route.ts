/**
 * POST /api/webhook/voice
 *
 * Entry point for incoming Twilio voice calls.
 * Configure this URL as the "A call comes in" webhook in your Twilio number.
 *
 * Flow:
 *  1. Identify clinic by the "To" number (same waPhoneNumberId)
 *  2. Create a call conversation record in the DB
 *  3. Greet the caller with <Say>
 *  4. <Record> to capture their speech → sent to /api/webhook/voice/respond
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

export async function POST(req: NextRequest) {
  const text = await req.text();
  const params = new URLSearchParams(text);

  const to = params.get("To") ?? "";
  const callSid = params.get("CallSid") ?? "";

  // Normalize: remove whatsapp: prefix if present, keep E.164
  const clinicPhone = to.replace(/^whatsapp:/, "");

  const clinic = await prisma.clinic.findFirst({
    where: { waPhoneNumberId: clinicPhone },
  });

  if (!clinic || !clinic.waActive) {
    return twiml(
      `<Say voice="alice" language="es-MX">Lo siento, este número no se encuentra disponible en este momento.</Say><Hangup/>`
    );
  }

  // Create a fresh conversation for this call using the CallSid as identifier
  await prisma.whatsappConversation.upsert({
    where: {
      clinicId_patientPhone: {
        clinicId: clinic.id,
        patientPhone: `call:${callSid}`,
      },
    },
    create: {
      clinicId: clinic.id,
      patientPhone: `call:${callSid}`,
      messages: [],
    },
    update: { messages: [] },
  });

  const welcome = escapeXml(
    clinic.waBotWelcome ?? `Hola, hablas con el asistente de ${clinic.name}. ¿En qué puedo ayudarte?`
  );

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const respondUrl = `${baseUrl}/api/webhook/voice/respond`;

  return twiml(`
    <Say voice="alice" language="es-MX">${welcome}</Say>
    <Record
      action="${respondUrl}"
      maxLength="30"
      timeout="5"
      trim="trim-silence"
      playBeep="false"
    />
    <Say voice="alice" language="es-MX">No escuché ninguna respuesta. Hasta luego.</Say>
    <Hangup/>
  `);
}
