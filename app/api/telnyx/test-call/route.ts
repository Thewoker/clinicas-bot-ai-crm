import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const BASE = "https://api.telnyx.com/v2";

function phoneToCountryIso(phone: string): string | null {
  const prefixes: [string, string][] = [
    ["+1", "US"], ["+34", "ES"], ["+54", "AR"], ["+52", "MX"],
    ["+57", "CO"], ["+56", "CL"], ["+51", "PE"], ["+58", "VE"],
    ["+593", "EC"], ["+591", "BO"], ["+595", "PY"], ["+598", "UY"],
    ["+55", "BR"], ["+44", "GB"], ["+49", "DE"], ["+33", "FR"],
    ["+39", "IT"], ["+351", "PT"],
  ];
  const sorted = prefixes.sort((a, b) => b[0].length - a[0].length);
  for (const [prefix, iso] of sorted) {
    if (phone.startsWith(prefix)) return iso;
  }
  return null;
}

function tReq(apiKey: string, method: string, path: string, body?: unknown) {
  return fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function ensureOvpWhitelist(apiKey: string, ovpId: string, country: string): Promise<void> {
  const res = await tReq(apiKey, "GET", `/outbound_voice_profiles/${ovpId}`);
  if (!res.ok) return;
  const { data } = await res.json();
  const whitelist = (data?.whitelisted_destinations ?? []) as string[];
  if (whitelist.includes(country)) return;
  const updated = [...whitelist, country];
  await tReq(apiKey, "PATCH", `/outbound_voice_profiles/${ovpId}`, { whitelisted_destinations: updated });
  console.log("[test-call] added", country, "to OVP whitelist");
}

function getAppUrl(): string {
  let url = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (url && !url.startsWith("http")) url = `https://${url}`;
  return url;
}

async function ensureWebhookUrl(apiKey: string, appId: string): Promise<void> {
  const appUrl = getAppUrl();
  const expected = `${appUrl}/api/webhook/telnyx/voice`;
  const appRes = await tReq(apiKey, "GET", `/texml_applications/${appId}`);
  if (!appRes.ok) return;
  const { data: app } = await appRes.json();
  if (app?.voice_url === expected) return;
  console.log("[test-call] Fixing voice_url from", app?.voice_url, "to", expected);
  await tReq(apiKey, "PATCH", `/texml_applications/${appId}`, {
    voice_url: expected,
    voice_fallback_url: expected,
  });
}

async function ensureOvp(apiKey: string, appId: string, destPhone: string): Promise<void> {
  // Check if TeXML app already has an OVP
  const appRes = await tReq(apiKey, "GET", `/texml_applications/${appId}`);
  if (!appRes.ok) return;
  const { data: app } = await appRes.json();

  // Telnyx may nest OVP inside an "outbound" object (same as credential connections)
  const existingOvp = (app?.outbound_voice_profile_id || app?.outbound?.outbound_voice_profile_id) as string;
  if (existingOvp) {
    console.log("[test-call] TeXML app already has OVP:", existingOvp);
    const country = phoneToCountryIso(destPhone);
    if (country) await ensureOvpWhitelist(apiKey, existingOvp, country);
    return;
  }

  // Find or create an OVP
  let ovpId = "";
  const listRes = await tReq(apiKey, "GET", "/outbound_voice_profiles?page[size]=1");
  if (listRes.ok) {
    const { data: ovps } = await listRes.json();
    ovpId = (ovps?.[0]?.id ?? "") as string;
  }

  if (!ovpId) {
    const createRes = await tReq(apiKey, "POST", "/outbound_voice_profiles", {
      name: "WebRTC Panel Outbound",
      traffic_type: "conversational",
      service_plan: "global",
      enabled: true,
    });
    if (createRes.ok) {
      const { data } = await createRes.json();
      ovpId = data.id as string;
    }
  }

  if (!ovpId) return;

  const country = phoneToCountryIso(destPhone);
  if (country) await ensureOvpWhitelist(apiKey, ovpId, country);

  // Try both flat and nested field names
  const patchRes = await tReq(apiKey, "PATCH", `/texml_applications/${appId}`, {
    outbound_voice_profile_id: ovpId,
    outbound: { outbound_voice_profile_id: ovpId },
  });
  if (patchRes.ok) {
    console.log("[test-call] OVP assigned to TeXML app:", ovpId);
  } else {
    console.error("[test-call] failed to assign OVP:", await patchRes.text());
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let targetPhone: string;
  try {
    ({ targetPhone } = await req.json());
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!targetPhone?.trim()) {
    return NextResponse.json({ error: "Número destino requerido" }, { status: 400 });
  }

  const clinic = await prisma.clinic.findUnique({ where: { id: session.clinicId } });
  if (!clinic?.telnyxApiKey || !clinic.telnyxPhoneNumber || !clinic.telnyxAppId) {
    return NextResponse.json({ error: "Telnyx no está configurado completamente" }, { status: 400 });
  }

  await ensureWebhookUrl(clinic.telnyxApiKey, clinic.telnyxAppId);
  await ensureOvp(clinic.telnyxApiKey, clinic.telnyxAppId, targetPhone.trim());

  // TeXML applications require the TeXML-specific outbound call endpoint,
  // not the Call Control /calls endpoint which only accepts CC App IDs.
  const res = await fetch(`${BASE}/texml/calls/${clinic.telnyxAppId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clinic.telnyxApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      From: clinic.telnyxPhoneNumber,
      To: targetPhone.trim(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[test-call] Telnyx error:", text);
    return NextResponse.json({ error: "No se pudo iniciar la llamada. Verificá que el número sea correcto." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
