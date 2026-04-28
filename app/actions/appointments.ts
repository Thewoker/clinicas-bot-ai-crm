"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string } | { success: string; notifyFailed?: string };

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createAppointment(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const doctorId = formData.get("doctorId") as string;
  const patientId = formData.get("patientId") as string;
  const service = (formData.get("service") as string)?.trim();
  const price = parseFloat(formData.get("price") as string) || 0;
  const startTime = new Date(formData.get("startTime") as string);
  const endTime = new Date(formData.get("endTime") as string);
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!doctorId || !patientId || !service || isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
    return { error: "Completá todos los campos requeridos" };
  }
  if (endTime <= startTime) {
    return { error: "La hora de fin debe ser posterior al inicio" };
  }

  // Verify doctor belongs to this clinic
  const doctor = await prisma.doctor.findFirst({
    where: { id: doctorId, clinicId: session.clinicId },
  });
  if (!doctor) return { error: "Médico no encontrado" };

  // Check overlap
  const overlap = await prisma.appointment.findFirst({
    where: {
      clinicId: session.clinicId,
      doctorId,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      OR: [{ startTime: { lt: endTime }, endTime: { gt: startTime } }],
    },
  });
  if (overlap) {
    return { error: "El médico ya tiene un turno en ese horario" };
  }

  await prisma.appointment.create({
    data: {
      clinicId: session.clinicId,
      doctorId,
      patientId,
      service,
      price,
      startTime,
      endTime,
      notes,
      status: "SCHEDULED",
    },
  });

  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: "Turno creado correctamente" };
}

// ─── Update (with optional WhatsApp notification) ─────────────────────────────

export async function updateAppointment(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const id = formData.get("id") as string;
  const service = (formData.get("service") as string)?.trim();
  const startTime = new Date(formData.get("startTime") as string);
  const endTime = new Date(formData.get("endTime") as string);
  const price = parseFloat(formData.get("price") as string) || 0;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const status = formData.get("status") as string;
  const notifyPatient = formData.get("notifyPatient") === "true";

  if (!id || !service || isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
    return { error: "Datos incompletos" };
  }
  if (endTime <= startTime) return { error: "La hora de fin debe ser posterior al inicio" };

  const existing = await prisma.appointment.findFirst({
    where: { id, clinicId: session.clinicId },
    include: {
      patient: { select: { name: true, phone: true } },
      doctor: { select: { name: true } },
    },
  });
  if (!existing) return { error: "Turno no encontrado" };

  // Overlap check (exclude this appointment)
  if (!["CANCELLED", "NO_SHOW"].includes(status)) {
    const overlap = await prisma.appointment.findFirst({
      where: {
        clinicId: session.clinicId,
        doctorId: existing.doctorId,
        id: { not: id },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        OR: [{ startTime: { lt: endTime }, endTime: { gt: startTime } }],
      },
    });
    if (overlap) return { error: "Ese horario ya está ocupado por otro turno" };
  }

  await prisma.appointment.update({
    where: { id },
    data: { service, startTime, endTime, price, notes, status: status as never },
  });

  // Optional WhatsApp notification to patient
  let notifyFailed: string | undefined;
  if (notifyPatient) {
    if (!existing.patient.phone) {
      notifyFailed = "El paciente no tiene teléfono registrado";
    } else {
      try {
        const clinic = await prisma.clinic.findUnique({
          where: { id: session.clinicId },
          select: { waPhoneNumberId: true, waActive: true },
        });

        if (!clinic?.waActive || !clinic.waPhoneNumberId) {
          notifyFailed = "WhatsApp no está configurado en la clínica";
        } else {
          const { whatsappManager } = await import("@/lib/whatsapp/manager");
          const { format } = await import("date-fns");
          const { es } = await import("date-fns/locale");

          const dateStr = format(
            startTime,
            "EEEE d 'de' MMMM 'a las' HH:mm",
            { locale: es }
          );

          const msg =
            status === "CANCELLED"
              ? `Hola ${existing.patient.name} 👋 Tu turno con ${existing.doctor.name} del ${dateStr} fue cancelado por la clínica. Si querés reprogramarlo, escribinos y te buscamos un nuevo horario.`
              : `Hola ${existing.patient.name} 👋 Tu turno fue modificado:\n\n📅 ${dateStr}\n👨‍⚕️ ${existing.doctor.name}\n\n¿Confirmás el nuevo horario? Respondé "Sí" o escribinos si necesitás otro día.`;

          await whatsappManager.sendMessage(
            session.clinicId,
            existing.patient.phone,
            msg
          );
        }
      } catch (err) {
        console.error("[appointments] WhatsApp notification failed:", err);
        notifyFailed = "No se pudo enviar la notificación por WhatsApp";
      }
    }
  }

  revalidatePath("/calendar");
  revalidatePath("/");
  return {
    success: status === "CANCELLED" ? "Turno cancelado" : "Turno actualizado",
    notifyFailed,
  };
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

export async function cancelAppointment(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const id = formData.get("id") as string;
  const notifyPatient = formData.get("notifyPatient") === "true";

  if (!id) return { error: "ID requerido" };

  const existing = await prisma.appointment.findFirst({
    where: { id, clinicId: session.clinicId },
    include: {
      patient: { select: { name: true, phone: true } },
      doctor: { select: { name: true } },
    },
  });
  if (!existing) return { error: "Turno no encontrado" };

  await prisma.appointment.update({
    where: { id },
    data: { status: "CANCELLED" as never },
  });

  let notifyFailed: string | undefined;
  if (notifyPatient) {
    if (!existing.patient.phone) {
      notifyFailed = "El paciente no tiene teléfono registrado";
    } else {
      try {
        const clinic = await prisma.clinic.findUnique({
          where: { id: session.clinicId },
          select: { waPhoneNumberId: true, waActive: true },
        });
        if (!clinic?.waActive || !clinic.waPhoneNumberId) {
          notifyFailed = "WhatsApp no está configurado en la clínica";
        } else {
          const { whatsappManager } = await import("@/lib/whatsapp/manager");
          const { format } = await import("date-fns");
          const { es } = await import("date-fns/locale");
          const dateStr = format(existing.startTime, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es });
          await whatsappManager.sendMessage(
            session.clinicId,
            existing.patient.phone,
            `Hola ${existing.patient.name} 👋 Tu turno con ${existing.doctor.name} del ${dateStr} fue cancelado por la clínica. Si querés reprogramarlo, escribinos y te buscamos un nuevo horario.`
          );
        }
      } catch (err) {
        console.error("[appointments] WhatsApp notification failed:", err);
        notifyFailed = "No se pudo enviar la notificación por WhatsApp";
      }
    }
  }

  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: "Turno cancelado", notifyFailed };
}

// ─── Simple status update (legacy, kept for compatibility) ────────────────────

export async function updateAppointmentStatus(
  appointmentId: string,
  clinicId: string,
  status: string
) {
  const apt = await prisma.appointment.findFirst({
    where: { id: appointmentId, clinicId },
  });
  if (!apt) throw new Error("Cita no encontrada");

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: status as never },
  });

  revalidatePath("/calendar");
  revalidatePath("/");
}
