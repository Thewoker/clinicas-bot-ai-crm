"use server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type ActionResult = { success: string } | { error: string };

export async function createPatientNote(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const patientId = formData.get("patientId") as string;
  const content = (formData.get("content") as string)?.trim();

  if (!content) return { error: "El contenido de la nota no puede estar vacío" };

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, clinicId: session.clinicId },
  });
  if (!patient) return { error: "Paciente no encontrado" };

  await prisma.patientNote.create({
    data: { patientId, clinicId: session.clinicId, content },
  });

  revalidatePath(`/patients/${patientId}`);
  return { success: "Nota registrada" };
}

export async function deletePatientNote(noteId: string, patientId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const note = await prisma.patientNote.findFirst({
    where: { id: noteId, clinicId: session.clinicId },
  });
  if (!note) return { error: "Nota no encontrada" };

  await prisma.patientNote.delete({ where: { id: noteId } });

  revalidatePath(`/patients/${patientId}`);
  return { success: "Nota eliminada" };
}
