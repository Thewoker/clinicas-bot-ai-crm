/**
 * POST /api/webhook/telnyx/voice
 *
 * Entry point for incoming Telnyx voice calls (TeXML).
 * Configure this URL as the Voice URL in your Telnyx TeXML application.
 *
 * Flow:
 *  1. Identify clinic by the "To" number (telnyxPhoneNumber)
 *  2. Create a fresh call conversation in DB
 *  3. Greet the caller with <Say>
 *  4. <Record> to capture speech → sent to /api/webhook/telnyx/voice/respond
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

export async function POST(req: NextRequest) {
  const text = await req.text();
  const params = new URLSearchParams(text);

  const to = params.get("To") ?? "";
  const from = params.get("From") ?? "";
  const callSid = params.get("CallSid") ?? "";

  console.log("[voice] webhook params:", { to, from, callSid, direction: params.get("Direction") });

  // Inbound: To = clinic phone. Outbound (test call): From = clinic phone.
  // Normalize: ensure E.164 with leading +
  const normalize = (n: string) => n.startsWith("+") ? n : `+${n}`;
  const clinic = await prisma.clinic.findFirst({
    where: { telnyxPhoneNumber: normalize(to) },
  }) ?? await prisma.clinic.findFirst({
    where: { telnyxPhoneNumber: normalize(from) },
  });

  console.log("[voice] clinic found:", clinic?.id ?? "NOT FOUND", "| to:", to, "| from:", from);

  if (!clinic) {
    return texml(
      `<Say language="es-MX">Lo siento, este número no se encuentra disponible.</Say><Hangup/>`
    );
  }

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

  let baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (baseUrl && !baseUrl.startsWith("http")) baseUrl = `https://${baseUrl}`;
  const respondUrl = `${baseUrl}/api/webhook/telnyx/voice/respond`;

  return texml(`
    <Pause length="1"/>
    <Say voice="Polly.Lupe-Neural" language="es-MX">${welcome}</Say>
    <Record
      action="${respondUrl}"
      maxLength="60"
      timeout="3"
      trim="trim-silence"
      playBeep="false"
    />
    <Say voice="Polly.Lupe-Neural" language="es-MX">No escuché ninguna respuesta. Hasta luego.</Say>
    <Hangup/>
  `);
}
