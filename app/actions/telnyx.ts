"use server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string } | { success: string };

const TELNYX_BASE = "https://api.telnyx.com/v2";

async function telnyxRequest(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`${TELNYX_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`[telnyx] ${method} ${path} → ${res.status}`, JSON.stringify(data));
  }
  return { ok: res.ok, status: res.status, data };
}

// ─── Save API Key ─────────────────────────────────────────────────────────────

export async function saveTelnyxApiKey(
  _: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const apiKey = (formData.get("telnyxApiKey") as string)?.trim();
  if (!apiKey) return { error: "La API key no puede estar vacía" };

  // Validate by listing phone numbers (empty list is OK, 401 means invalid)
  const { ok, status } = await telnyxRequest(apiKey, "GET", "/phone_numbers?page[size]=1");
  if (status === 401) return { error: "API key inválida. Verificá en telnyx.com/account/keys" };
  if (!ok) return { error: "No se pudo conectar con Telnyx. Intentá de nuevo." };

  await prisma.clinic.update({
    where: { id: session.clinicId },
    data: { telnyxApiKey: apiKey },
  });

  revalidatePath("/settings");
  return { success: "API key guardada correctamente" };
}

// ─── Configure number already purchased in Telnyx portal ─────────────────────

export async function setupTelnyx(
  _: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const phoneNumber = (formData.get("phoneNumber") as string)?.trim();
  if (!phoneNumber) return { error: "Ingresá el número en formato E.164 (ej: +34911234567)" };
  if (!phoneNumber.startsWith("+")) return { error: "El número debe incluir el prefijo internacional (ej: +34911234567)" };

  const clinic = await prisma.clinic.findUnique({ where: { id: session.clinicId } });
  if (!clinic?.telnyxApiKey) return { error: "Guardá la API key primero" };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const voiceUrl = `${appUrl}/api/webhook/telnyx/voice`;
  const respondUrl = `${appUrl}/api/webhook/telnyx/voice/respond`;

  // 1. Find the number in the account
  const { ok: findOk, data: findData } = await telnyxRequest(
    clinic.telnyxApiKey,
    "GET",
    `/phone_numbers?filter[phone_number]=${encodeURIComponent(phoneNumber)}`
  );

  if (!findOk || !findData) {
    return { error: "No se pudo verificar el número. Revisá tu API key." };
  }

  const numbers = (findData as { data: Array<{ id: string; phone_number: string }> }).data;
  const found = numbers?.[0];

  if (!found) {
    return { error: `El número ${phoneNumber} no se encontró en tu cuenta de Telnyx. Compralo primero en portal.telnyx.com.` };
  }

  // 2. Create TeXML application
  const { ok: appOk, data: appData } = await telnyxRequest(
    clinic.telnyxApiKey,
    "POST",
    "/texml_applications",
    {
      friendly_name: `Asistente de ${clinic.name}`,
      voice_url: voiceUrl,
      voice_method: "POST",
      voice_fallback_url: voiceUrl,
      status_callback_url: respondUrl,
    }
  );

  if (!appOk || !appData) {
    const errDetail = (appData as { errors?: Array<{ detail: string }> })?.errors?.[0]?.detail;
    return { error: errDetail ? `Telnyx: ${errDetail}` : "No se pudo crear la aplicación en Telnyx." };
  }

  const appId = (appData as { data: { id: string } }).data.id;

  // 3. Assign number to TeXML app
  const { ok: patchOk } = await telnyxRequest(
    clinic.telnyxApiKey,
    "PATCH",
    `/phone_numbers/${found.id}`,
    { connection_id: appId }
  );

  if (!patchOk) {
    await telnyxRequest(clinic.telnyxApiKey, "DELETE", `/texml_applications/${appId}`);
    return { error: "No se pudo asignar el número a la aplicación. Revisá los permisos de tu API key." };
  }

  await prisma.clinic.update({
    where: { id: clinic.id },
    data: {
      telnyxPhoneNumberId: found.id,
      telnyxPhoneNumber: found.phone_number,
      telnyxAppId: appId,
    },
  });

  revalidatePath("/settings");
  return {
    success: `Número ${found.phone_number} configurado. Las llamadas ya están activas.`,
  };
}

// ─── Disconnect Telnyx ────────────────────────────────────────────────────────

export async function disconnectTelnyx(
  _: ActionResult | null,
  _formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const clinic = await prisma.clinic.findUnique({ where: { id: session.clinicId } });
  if (!clinic?.telnyxApiKey) return { error: "No hay configuración de Telnyx" };

  if (clinic.telnyxPhoneNumberId) {
    await telnyxRequest(clinic.telnyxApiKey, "DELETE", `/phone_numbers/${clinic.telnyxPhoneNumberId}`);
  }
  if (clinic.telnyxAppId) {
    await telnyxRequest(clinic.telnyxApiKey, "DELETE", `/texml_applications/${clinic.telnyxAppId}`);
  }

  await prisma.clinic.update({
    where: { id: clinic.id },
    data: {
      telnyxPhoneNumberId: null,
      telnyxPhoneNumber: null,
      telnyxAppId: null,
    },
  });

  revalidatePath("/settings");
  return { success: "Número de Telnyx desconectado" };
}
