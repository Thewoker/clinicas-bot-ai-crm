import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.superAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { clinicId, targetPhone } = await req.json();
  if (!clinicId || !targetPhone?.trim()) return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });

  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
  if (!clinic?.elevenLabsAgentId || !clinic.elevenLabsPhoneNumberId) {
    return NextResponse.json({ error: "ElevenLabs no configurado para esta clínica" }, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY ?? "";
  if (!apiKey) return NextResponse.json({ error: "ELEVENLABS_API_KEY no configurado" }, { status: 500 });

  const res = await fetch("https://api.elevenlabs.io/v1/convai/sip-trunk/outbound-call", {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_id: clinic.elevenLabsAgentId,
      agent_phone_number_id: clinic.elevenLabsPhoneNumberId,
      to_number: targetPhone.trim(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[admin/outbound-call] error:", text);
    return NextResponse.json({ error: "No se pudo iniciar la llamada" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
