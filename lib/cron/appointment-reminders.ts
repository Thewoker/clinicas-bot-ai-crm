import cron from "node-cron";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const WINDOWS = [
  { hours: 48, field: "reminder48SentAt" as const },
  { hours: 24, field: "reminder24SentAt" as const },
  { hours: 4,  field: "reminder4SentAt"  as const },
] as const;

// Half the cron interval (30 min) so each appointment falls in exactly one window.
const WINDOW_HALF_MS = 15 * 60 * 1000;

async function sendReminders() {
  const now = new Date();

  for (const { hours, field } of WINDOWS) {
    const target      = now.getTime() + hours * 60 * 60 * 1000;
    const windowStart = new Date(target - WINDOW_HALF_MS);
    const windowEnd   = new Date(target + WINDOW_HALF_MS);

    const appointments = await prisma.appointment.findMany({
      where: {
        status: { in: ["SCHEDULED", "CONFIRMED"] },
        startTime: { gte: windowStart, lte: windowEnd },
        [field]: null,
      },
      include: {
        patient: { select: { name: true, phone: true } },
        doctor:  { select: { name: true, phone: true } },
        clinic:  { select: { id: true, waActive: true, waPhoneNumberId: true } },
      },
    });

    if (appointments.length === 0) continue;

    const { whatsappManager } = await import("@/lib/whatsapp/manager");

    for (const apt of appointments) {
      if (!apt.clinic.waActive || !apt.clinic.waPhoneNumberId) continue;

      const dateStr = format(apt.startTime, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es });
      const label   = hours === 4 ? "en 4 horas" : `en ${hours} horas`;

      // Notify patient
      if (apt.patient.phone) {
        try {
          await whatsappManager.sendMessage(
            apt.clinic.id,
            apt.patient.phone,
            `Hola ${apt.patient.name} 👋 Te recordamos que tenés un turno *${label}*:\n\n📅 ${dateStr}\n👨‍⚕️ ${apt.doctor.name}\n\nSi necesitás cancelar o reprogramar, escribinos con tiempo.`
          );
        } catch (err) {
          console.error(`[reminders] Patient notify failed (${apt.patient.phone}):`, err);
        }
      }

      // Notify doctor
      if (apt.doctor.phone) {
        try {
          await whatsappManager.sendMessage(
            apt.clinic.id,
            apt.doctor.phone,
            `📅 Recordatorio de turno *${label}*:\n👤 Paciente: ${apt.patient.name}\n🗓 ${dateStr}\n🏥 ${apt.service}`
          );
        } catch (err) {
          console.error(`[reminders] Doctor notify failed (${apt.doctor.phone}):`, err);
        }
      }

      await prisma.appointment.update({
        where: { id: apt.id },
        data: { [field]: now },
      });
    }
  }
}

export function startReminderCron() {
  // Runs every 30 minutes. The ±15 min window ensures each appointment
  // falls in exactly one firing per reminder type.
  cron.schedule("*/30 * * * *", () => {
    sendReminders().catch((err) =>
      console.error("[reminders] Cron error:", err)
    );
  });
  console.log("[reminders] Appointment reminder cron started (every 30 min)");
}
