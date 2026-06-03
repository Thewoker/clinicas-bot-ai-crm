import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export const dynamic = "force-dynamic";

function getClient() {
  const apiKey = process.env.ELEVENLABS_API_KEY ?? "";
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY no está configurado");
  return new ElevenLabsClient({ apiKey });
}

function getAppUrl(): string {
  let url = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (url && !url.startsWith("http")) url = `https://${url}`;
  return url;
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const clinic = await prisma.clinic.findUnique({ where: { id: session.clinicId } });
  if (!clinic) return NextResponse.json({ error: "Clínica no encontrada" }, { status: 404 });

  const appUrl = getAppUrl();
  const llmUrl = `${appUrl}/api/llm`;
  const botName = clinic.waBotName ?? `Asistente de ${clinic.name}`;
  const firstMessage = clinic.waBotWelcome ?? `Hola, soy ${botName}. ¿En qué puedo ayudarte?`;

  let el: ElevenLabsClient;
  try {
    el = getClient();
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  try {
    let agentId = clinic.elevenLabsAgentId ?? "";

    const agentConfig = {
      name: `${clinic.name} — Voice Bot`,
      conversationConfig: {
        tts: {
          modelId: "eleven_flash_v2_5" as const,
        },
        stt: {
          provider: "elevenlabs" as const,
        },
        agent: {
          language: "es",
          firstMessage,
          prompt: {
            prompt: `Eres ${botName}, asistente de voz de ${clinic.name}. Eres amable y concisa. Solo hablas de temas relacionados con la clínica.`,
            llm: "custom-llm" as const,
            customLlm: {
              url: llmUrl,
              modelId: "clinic-bot",
            },
            temperature: 0.5,
          },
        },
        turn: {
          turnTimeout: 8,
        },
      },
    };

    if (agentId) {
      await el.conversationalAi.agents.update(agentId, agentConfig);
      console.log("[setup-agent] Updated agent:", agentId);
    } else {
      const created = await el.conversationalAi.agents.create(agentConfig);
      agentId = created.agentId;
      console.log("[setup-agent] Created agent:", agentId);
    }

    await prisma.clinic.update({
      where: { id: clinic.id },
      data: { elevenLabsAgentId: agentId },
    });

    // Assign agent to phone number if configured
    const phoneNumberId = clinic.elevenLabsPhoneNumberId;
    if (phoneNumberId) {
      await el.conversationalAi.phoneNumbers.update(phoneNumberId, { agentId });
      console.log("[setup-agent] Assigned agent", agentId, "to phone number", phoneNumberId);
    }

    return NextResponse.json({ ok: true, agentId });
  } catch (err) {
    console.error("[setup-agent] Error:", err);
    return NextResponse.json({ error: "Error al configurar el agente en ElevenLabs", detail: String(err) }, { status: 500 });
  }
}
