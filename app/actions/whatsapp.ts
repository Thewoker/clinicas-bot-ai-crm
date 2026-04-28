"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { whatsappManager } from "@/lib/whatsapp/manager";

type ActionResult = { error: string } | { success: string };

/** Save bot name and welcome message */
export async function saveBotSettings(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const waBotName = (formData.get("waBotName") as string)?.trim() || null;
  const waBotWelcome = (formData.get("waBotWelcome") as string)?.trim() || null;

  await prisma.clinic.update({
    where: { id: session.clinicId },
    data: { waBotName, waBotWelcome },
  });

  revalidatePath("/settings");
  return { success: "Configuración del bot guardada" };
}

/** Toggle bot active/inactive */
export async function toggleBotActive(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const active = formData.get("active") === "true";

  await prisma.clinic.update({
    where: { id: session.clinicId },
    data: { waActive: active },
  });

  revalidatePath("/settings");
  return { success: active ? "Bot activado" : "Bot pausado" };
}

/**
 * Start a new Baileys connection for this clinic.
 * The socket is created and starts generating a QR code.
 * The frontend then polls /api/whatsapp/qr/[clinicId] to get the QR.
 */
export async function connectWhatsapp(
  _prev: ActionResult | null,
  _formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  try {
    await whatsappManager.connectClinic(session.clinicId);
    return { success: "Iniciando conexión..." };
  } catch (err) {
    console.error("[wa] connectWhatsapp error:", err);
    return { error: "No se pudo iniciar la conexión. Intentá de nuevo." };
  }
}

/** Disconnect WhatsApp — logs out, deletes session, clears DB fields */
export async function disconnectWhatsapp(
  _prev: ActionResult | null,
  _formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  await whatsappManager.disconnectClinic(session.clinicId);

  await prisma.clinic.update({
    where: { id: session.clinicId },
    data: { waPhoneNumberId: null, waActive: false },
  });

  revalidatePath("/settings");
  return { success: "WhatsApp desconectado" };
}
