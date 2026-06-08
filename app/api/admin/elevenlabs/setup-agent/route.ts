import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

function getAppUrl(): string {
  let url = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (url && !url.startsWith("http")) url = `https://${url}`;
  return url;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.superAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { clinicId } = await req.json();
  if (!clinicId) return NextResponse.json({ error: "clinicId requerido" }, { status: 400 });

  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
  if (!clinic) return NextResponse.json({ error: "Clínica no encontrada" }, { status: 404 });

  const apiKey = process.env.ELEVENLABS_API_KEY ?? "";
  if (!apiKey) return NextResponse.json({ error: "ELEVENLABS_API_KEY no configurado" }, { status: 500 });

  const el = new ElevenLabsClient({ apiKey });
  const appUrl = getAppUrl();
  const llmUrl = `${appUrl}/api/llm/${clinic.id}`;
  const botName = clinic.waBotName ?? `Asistente de ${clinic.name}`;
  const firstMessage = clinic.waBotWelcome ?? `Hola, soy ${botName}. ¿En qué puedo ayudarte?`;

  try {
    let agentId = clinic.elevenLabsAgentId ?? "";

    const agentConfig = {
      name: `${clinic.name} — Voice Bot`,
      conversationConfig: {
        tts: { modelId: "eleven_flash_v2_5" as const },
        stt: { provider: "elevenlabs" as const },
        agent: {
          language: "es",
          firstMessage,
          prompt: {
            prompt: `Eres ${botName}, asistente de voz de ${clinic.name}. Eres amable y concisa.`,
            llm: "custom-llm" as const,
            customLlm: { url: llmUrl, modelId: "clinic-bot" },
            temperature: 0.5,
          },
        },
        turn: { turnTimeout: 8 },
        conversation: { maxDurationSeconds: 600 },
      },
    };

    if (agentId) {
      await el.conversationalAi.agents.update(agentId, agentConfig);
    } else {
      const created = await el.conversationalAi.agents.create(agentConfig);
      agentId = created.agentId;
    }

    await prisma.clinic.update({ where: { id: clinic.id }, data: { elevenLabsAgentId: agentId } });

    if (clinic.elevenLabsPhoneNumberId) {
      await el.conversationalAi.phoneNumbers.update(clinic.elevenLabsPhoneNumberId, { agentId });
    }

    console.log("[admin/setup-agent] clinic:", clinic.name, "agent:", agentId);
    return NextResponse.json({ ok: true, agentId });
  } catch (err) {
    console.error("[admin/setup-agent] error:", err);
    return NextResponse.json({ error: "Error ElevenLabs", detail: String(err) }, { status: 500 });
  }
}
