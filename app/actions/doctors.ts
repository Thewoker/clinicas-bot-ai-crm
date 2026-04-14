"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

type ActionResult = { error: string } | { success: string };

export async function createDoctor(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const name = (formData.get("name") as string)?.trim();
  const specialty = (formData.get("specialty") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim() || null;
  const color = (formData.get("color") as string) || "#6366f1";

  if (!name || !specialty || !email) {
    return { error: "Nombre, especialidad y email son obligatorios" };
  }

  await prisma.doctor.create({
    data: { clinicId: session.clinicId, name, specialty, email, phone, color },
  });

  revalidatePath("/doctors");
  return { success: "Médico creado correctamente" };
}

export async function updateDoctor(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const specialty = (formData.get("specialty") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim() || null;
  const color = (formData.get("color") as string) || "#6366f1";

  if (!id || !name || !specialty || !email) {
    return { error: "Datos incompletos" };
  }

  const doctor = await prisma.doctor.findFirst({
    where: { id, clinicId: session.clinicId },
  });
  if (!doctor) return { error: "Médico no encontrado" };

  await prisma.doctor.update({
    where: { id },
    data: { name, specialty, email, phone, color },
  });

  revalidatePath("/doctors");
  return { success: "Médico actualizado correctamente" };
}

export async function deleteDoctor(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const id = formData.get("id") as string;
  if (!id) return { error: "ID requerido" };

  const doctor = await prisma.doctor.findFirst({
    where: { id, clinicId: session.clinicId },
  });
  if (!doctor) return { error: "Médico no encontrado" };

  await prisma.doctor.delete({ where: { id } });

  revalidatePath("/doctors");
  return { success: "Médico eliminado" };
}

export async function saveAvailability(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const doctorId = formData.get("doctorId") as string;
  if (!doctorId) return { error: "Médico no especificado" };

  const doctor = await prisma.doctor.findFirst({
    where: { id: doctorId, clinicId: session.clinicId },
  });
  if (!doctor) return { error: "Médico no encontrado" };

  const toSave: { dayOfWeek: number; startTime: string; endTime: string }[] = [];

  for (const day of ALL_DAYS) {
    const active = formData.get(`day_${day}`) === "on";
    const startTime = (formData.get(`start_${day}`) as string) || "09:00";
    const endTime = (formData.get(`end_${day}`) as string) || "18:00";

    if (active) {
      if (startTime >= endTime) {
        return { error: "La hora de inicio debe ser anterior a la hora de fin" };
      }
      toSave.push({ dayOfWeek: day, startTime, endTime });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.doctorAvailability.deleteMany({ where: { doctorId } });
    if (toSave.length > 0) {
      await tx.doctorAvailability.createMany({
        data: toSave.map((a) => ({
          doctorId,
          clinicId: session.clinicId,
          dayOfWeek: a.dayOfWeek,
          startTime: a.startTime,
          endTime: a.endTime,
        })),
      });
    }
  });

  revalidatePath("/doctors");
  return { success: "Horarios guardados correctamente" };
}
