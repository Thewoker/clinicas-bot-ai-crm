import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const clinic = await prisma.clinic.findUnique({ where: { id: session.clinicId } });
  if (!clinic?.telnyxApiKey || !clinic.telnyxAppId) {
    return NextResponse.json({ error: "Telnyx no configurado" }, { status: 400 });
  }

  let appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (appUrl && !appUrl.startsWith("http")) appUrl = `https://${appUrl}`;
  const voiceUrl = `${appUrl}/api/webhook/telnyx/voice`;
  const statusUrl = `${appUrl}/api/webhook/telnyx/voice/status`;

  const res = await fetch(`https://api.telnyx.com/v2/texml_applications/${clinic.telnyxAppId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${clinic.telnyxApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ voice_url: voiceUrl, voice_fallback_url: voiceUrl, status_callback_url: statusUrl }),
  });

  const data = await res.json();
  const saved = (data as { data?: { voice_url?: string } })?.data?.voice_url;
  console.log("[fix-webhook-url] updated to:", saved, "| NEXT_PUBLIC_APP_URL:", appUrl);

  if (!res.ok) return NextResponse.json({ error: "Fallo Telnyx", detail: data }, { status: 500 });

  return NextResponse.json({ ok: true, voice_url: saved, appUrl });
}
