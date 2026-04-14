"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string } | { success: string };

export async function createPatient(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const name = (formData.get("name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const email = (formData.get("email") as string)?.trim() || null;
  const birthDate = (formData.get("birthDate") as string) || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!name || !phone) {
    return { error: "Nombre y teléfono son obligatorios" };
  }

  await prisma.patient.create({
    data: {
      clinicId: session.clinicId,
      name,
      phone,
      email,
      birthDate: birthDate ? new Date(birthDate) : null,
      notes,
    },
  });

  revalidatePath("/patients");
  return { success: "Paciente creado correctamente" };
}

export async function updatePatient(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const email = (formData.get("email") as string)?.trim() || null;
  const birthDate = (formData.get("birthDate") as string) || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!id || !name || !phone) {
    return { error: "Nombre y teléfono son obligatorios" };
  }

  const patient = await prisma.patient.findFirst({
    where: { id, clinicId: session.clinicId },
  });
  if (!patient) return { error: "Paciente no encontrado" };

  await prisma.patient.update({
    where: { id },
    data: {
      name,
      phone,
      email,
      birthDate: birthDate ? new Date(birthDate) : null,
      notes,
    },
  });

  revalidatePath("/patients");
  return { success: "Paciente actualizado correctamente" };
}
