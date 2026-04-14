"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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
 * Save (or clear) the clinic's Twilio WhatsApp number.
 * The number must be in E.164 format: +14155238886
 * Saving a number automatically activates the bot.
 * Sending an empty value disconnects WhatsApp.
 */
export async function saveWhatsappNumber(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const raw = (formData.get("waPhoneNumber") as string)?.trim() ?? "";

  if (!raw) {
    await prisma.clinic.update({
      where: { id: session.clinicId },
      data: { waPhoneNumberId: null, waActive: false },
    });
    revalidatePath("/settings");
    return { success: "Número eliminado" };
  }

  if (!/^\+\d{7,15}$/.test(raw)) {
    return {
      error: "Formato inválido. Ingresá el número con código de país, ej: +14155238886",
    };
  }

  await prisma.clinic.update({
    where: { id: session.clinicId },
    data: { waPhoneNumberId: raw, waActive: true },
  });

  revalidatePath("/settings");
  return {
    success:
      "Número guardado y bot activado. Asegurate de configurar el webhook en la consola de Twilio.",
  };
}

/** Disconnect WhatsApp — clears phone number and deactivates bot */
export async function disconnectWhatsapp(
  _prev: ActionResult | null,
  _formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  await prisma.clinic.update({
    where: { id: session.clinicId },
    data: {
      waPhoneNumberId: null,
      waActive: false,
    },
  });

  revalidatePath("/settings");
  return { success: "WhatsApp desconectado" };
}
