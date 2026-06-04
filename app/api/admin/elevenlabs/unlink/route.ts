import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.superAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { clinicId } = await req.json();
  if (!clinicId) return NextResponse.json({ error: "clinicId requerido" }, { status: 400 });

  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
  if (!clinic) return NextResponse.json({ error: "Clínica no encontrada" }, { status: 404 });

  // Unassign agent from phone number in ElevenLabs
  const apiKey = process.env.ELEVENLABS_API_KEY ?? "";
  if (apiKey && clinic.elevenLabsPhoneNumberId) {
    try {
      const el = new ElevenLabsClient({ apiKey });
      await el.conversationalAi.phoneNumbers.update(clinic.elevenLabsPhoneNumberId, { agentId: "" });
    } catch (err) {
      console.warn("[unlink] Could not unassign agent in ElevenLabs:", err);
    }
  }

  await prisma.clinic.update({
    where: { id: clinicId },
    data: { elevenLabsAgentId: null, elevenLabsPhoneNumberId: null },
  });

  console.log("[unlink] Unlinked ElevenLabs from clinic:", clinic.name);
  return NextResponse.json({ ok: true });
}
