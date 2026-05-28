import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const BASE = "https://api.telnyx.com/v2";

// Maps E.164 phone prefix to Telnyx whitelisted_destinations country ISO code
function phoneToCountryIso(phone: string): string | null {
  const prefixes: [string, string][] = [
    ["+1", "US"], ["+34", "ES"], ["+54", "AR"], ["+52", "MX"],
    ["+57", "CO"], ["+56", "CL"], ["+51", "PE"], ["+58", "VE"],
    ["+593", "EC"], ["+591", "BO"], ["+595", "PY"], ["+598", "UY"],
    ["+55", "BR"], ["+44", "GB"], ["+49", "DE"], ["+33", "FR"],
    ["+39", "IT"], ["+351", "PT"],
  ];
  // Sort by prefix length desc so "+593" matches before "+59"
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

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const clinic = await prisma.clinic.findUnique({ where: { id: session.clinicId } });
  if (!clinic?.telnyxApiKey || !clinic.telnyxPhoneNumber) {
    return NextResponse.json({ error: "Telnyx no está configurado" }, { status: 400 });
  }

  const key = clinic.telnyxApiKey;
  let connectionId = clinic.telnyxSipConnectionId;
  let credentialId = clinic.telnyxSipCredentialId;

  // ── 1. Credential Connection ────────────────────────────────────────────────
  if (!connectionId) {
    const { randomBytes } = await import("crypto");
    const res = await tReq(key, "POST", "/credential_connections", {
      connection_name: `webrtc-panel-${clinic.name}`,
      user_name: `panel${clinic.id.replace(/[^a-z0-9]/gi, "").slice(0, 10)}`,
      password: randomBytes(16).toString("hex"),
    });
    if (!res.ok) {
      console.error("[webrtc-token] create credential_connection:", await res.text());
      return NextResponse.json({ error: "No se pudo crear la conexión SIP en Telnyx" }, { status: 500 });
    }
    const { data } = await res.json();
    connectionId = data.id as string;
    await prisma.clinic.update({ where: { id: clinic.id }, data: { telnyxSipConnectionId: connectionId } });
    console.log("[webrtc-token] credential_connection created:", connectionId);
  }

  // ── 2. Outbound Voice Profile — verify and assign if missing ────────────────
  // Without an OVP the credential connection can't place outbound calls;
  // Telnyx rejects every call with an immediate hangup.
  const connRes = await tReq(key, "GET", `/credential_connections/${connectionId}`);
  if (connRes.ok) {
    const { data: conn } = await connRes.json();
    const ovpIdOnConn = (conn?.outbound?.outbound_voice_profile_id ?? "") as string;
    const hasOvp = !!ovpIdOnConn;
    console.log("[webrtc-token] connection OVP assigned:", hasOvp, ovpIdOnConn);

    // Always verify OVP allows the clinic's destination country
    if (hasOvp && ovpIdOnConn) {
      const ovpDetailRes = await tReq(key, "GET", `/outbound_voice_profiles/${ovpIdOnConn}`);
      if (ovpDetailRes.ok) {
        const { data: d } = await ovpDetailRes.json();
        const whitelist = (d.whitelisted_destinations ?? []) as string[];
        const clinicCountry = phoneToCountryIso(clinic.telnyxPhoneNumber!);
        console.log("[webrtc-token] OVP whitelist:", whitelist, "clinic country:", clinicCountry);

        if (clinicCountry && !whitelist.includes(clinicCountry)) {
          const updated = [...whitelist, clinicCountry];
          const patchOvp = await tReq(key, "PATCH", `/outbound_voice_profiles/${ovpIdOnConn}`, {
            whitelisted_destinations: updated,
          });
          if (patchOvp.ok) {
            console.log("[webrtc-token] added", clinicCountry, "to OVP whitelist:", updated);
          } else {
            console.error("[webrtc-token] failed to patch OVP whitelist:", await patchOvp.text());
          }
        }
      }
    }

    if (!hasOvp) {
      // Find the first outbound voice profile in the account, or create one
      let ovpId = "";
      const listRes = await tReq(key, "GET", "/outbound_voice_profiles?page[size]=1");
      if (listRes.ok) {
        const { data: ovps } = await listRes.json();
        ovpId = (ovps?.[0]?.id ?? "") as string;
        console.log("[webrtc-token] found existing OVP:", ovpId);
      }

      if (!ovpId) {
        const createRes = await tReq(key, "POST", "/outbound_voice_profiles", {
          name: `WebRTC Panel - ${clinic.name}`,
          traffic_type: "conversational",
          service_plan: "global",
          enabled: true,
        });
        if (createRes.ok) {
          const { data: newOvp } = await createRes.json();
          ovpId = newOvp.id as string;
          console.log("[webrtc-token] created new OVP:", ovpId, JSON.stringify(newOvp));
        } else {
          console.error("[webrtc-token] create OVP failed:", await createRes.text());
        }
      } else {
        // Log existing OVP details to inspect country/plan restrictions
        const ovpDetailRes = await tReq(key, "GET", `/outbound_voice_profiles/${ovpId}`);
        if (ovpDetailRes.ok) {
          const { data: ovpDetail } = await ovpDetailRes.json();
          console.log("[webrtc-token] existing OVP detail:", JSON.stringify(ovpDetail));
        }
      }

      if (ovpId) {
        // outbound_voice_profile_id is nested inside the "outbound" object
        const patchRes = await tReq(key, "PATCH", `/credential_connections/${connectionId}`, {
          outbound: { outbound_voice_profile_id: ovpId },
        });
        if (patchRes.ok) {
          console.log("[webrtc-token] OVP assigned to connection");
        } else {
          console.error("[webrtc-token] assign OVP failed:", await patchRes.text());
        }
      }
    }
  } else {
    console.error("[webrtc-token] could not fetch credential_connection:", connectionId);
  }

  // ── 3. Telephony Credential ─────────────────────────────────────────────────
  if (!credentialId) {
    const res = await tReq(key, "POST", "/telephony_credentials", {
      name: `webrtc-panel-${clinic.id}`,
      connection_id: connectionId,
    });
    if (!res.ok) {
      console.error("[webrtc-token] create telephony_credential:", await res.text());
      return NextResponse.json({ error: "No se pudo crear la credencial WebRTC" }, { status: 500 });
    }
    const { data } = await res.json();
    credentialId = data.id as string;
    await prisma.clinic.update({ where: { id: clinic.id }, data: { telnyxSipCredentialId: credentialId } });
    console.log("[webrtc-token] telephony_credential created:", credentialId);
  }

  // ── 4. Short-lived JWT token for the browser ────────────────────────────────
  const tokenRes = await tReq(key, "POST", `/telephony_credentials/${credentialId}/token`);
  if (!tokenRes.ok) {
    // Credential deleted externally — reset so next call re-provisions
    await prisma.clinic.update({ where: { id: clinic.id }, data: { telnyxSipCredentialId: null } });
    return NextResponse.json({ error: "Credencial inválida. Intentá de nuevo." }, { status: 500 });
  }

  const raw = await tokenRes.text();
  const token = raw.startsWith('"') ? JSON.parse(raw) : raw;

  // Provide both E.164 and SIP URI so the client can try on-net routing
  const e164 = clinic.telnyxPhoneNumber!;
  const sipUri = `sip:${e164.replace("+", "")}@sip.telnyx.com`;

  return NextResponse.json({ token, clinicPhone: e164, clinicSipUri: sipUri });
}
