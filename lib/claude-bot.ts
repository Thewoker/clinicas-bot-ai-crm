/**
 * Claude-powered WhatsApp bot
 *
 * Uses Anthropic tool use to understand patient intent and execute
 * actions (create appointments, query availability, cancel, etc.)
 * against the clinic's data — all in natural Spanish.
 *
 * Env vars required:
 *   ANTHROPIC_API_KEY
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { sendAppointmentInvite } from "@/lib/ical-email";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClinicContext {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  apiKey: string;
  waBotName: string | null;
  waBotWelcome: string | null;
  timezone: string;
  knowledgeBase?: Array<{ question: string; answer: string; category: string | null }>;
}

// ─── Timezone utilities (no extra deps — uses built-in Intl) ──────────────────

/** UTC offset in minutes for an IANA timezone at a given moment (handles DST) */
function tzOffsetMin(tz: string, at = new Date()): number {
  const utc = at.toLocaleString("en-US", { timeZone: "UTC" });
  const local = at.toLocaleString("en-US", { timeZone: tz });
  return (new Date(local).getTime() - new Date(utc).getTime()) / 60000;
}

/** "+HH:MM" / "-HH:MM" string for a given offset in minutes */
function fmtTzOffset(offsetMin: number): string {
  const sign = offsetMin >= 0 ? "+" : "-";
  const h = String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, "0");
  const m = String(Math.abs(offsetMin) % 60).padStart(2, "0");
  return `${sign}${h}:${m}`;
}

/**
 * Returns a "fake UTC" Date whose UTC fields equal the local fields in `tz`.
 * E.g. for a UTC Date of 11:00 UTC and tz=Europe/Madrid (+2):
 *   result.getUTCHours() === 13  (Madrid local time)
 */
function toTzDate(utcDate: Date, tz: string): Date {
  return new Date(utcDate.getTime() + tzOffsetMin(tz, utcDate) * 60000);
}

/** UTC midnight of the clinic-local date `dateStr` (YYYY-MM-DD) */
function tzMidnightUTC(dateStr: string, tz: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  // Start with UTC midnight of that date, then subtract the tz offset
  const utcMidnight = Date.UTC(y, m - 1, d, 0, 0, 0);
  const probe = new Date(utcMidnight);
  return new Date(utcMidnight - tzOffsetMin(tz, probe) * 60000);
}

export interface BotMessage {
  role: "user" | "assistant";
  content: Anthropic.MessageParam["content"];
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "buscar_paciente",
    description:
      "Busca un paciente existente en el sistema por nombre o número de teléfono. Usalo antes de crear uno nuevo.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Nombre completo o número de teléfono del paciente",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "crear_paciente",
    description:
      "Registra un nuevo paciente en el sistema. Solo usar si buscar_paciente no encontró resultados.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Nombre completo" },
        phone: { type: "string", description: "Número de teléfono con código de país" },
        email: { type: "string", description: "Email (opcional)" },
        birthDate: { type: "string", description: "Fecha de nacimiento en formato YYYY-MM-DD (opcional, solo si el paciente la proporciona)" },
      },
      required: ["name", "phone"],
    },
  },
  {
    name: "actualizar_paciente",
    description:
      "Actualiza datos de un paciente ya existente. Usalo cuando el paciente proporcione información como su fecha de nacimiento durante la conversación y el paciente ya esté registrado.",
    input_schema: {
      type: "object" as const,
      properties: {
        patientId: { type: "string", description: "ID del paciente a actualizar" },
        birthDate: { type: "string", description: "Fecha de nacimiento en formato YYYY-MM-DD" },
      },
      required: ["patientId"],
    },
  },
  {
    name: "listar_medicos",
    description:
      "Lista TODOS los médicos disponibles en la clínica con sus especialidades. No filtrés por especialidad — siempre traé la lista completa y luego identificá cuál corresponde a lo que pide el paciente.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "verificar_disponibilidad",
    description:
      "Consulta los horarios libres de un médico en una fecha específica. Devuelve los slots disponibles.",
    input_schema: {
      type: "object" as const,
      properties: {
        doctorId: { type: "string", description: "ID del médico" },
        date: {
          type: "string",
          description: "Fecha en formato YYYY-MM-DD",
        },
      },
      required: ["doctorId", "date"],
    },
  },
  {
    name: "crear_turno",
    description:
      "Reserva un turno para un paciente con un médico. Confirmar siempre los datos con el paciente antes de ejecutar.",
    input_schema: {
      type: "object" as const,
      properties: {
        patientId: { type: "string" },
        doctorId: { type: "string" },
        service: { type: "string", description: "Nombre del servicio o consulta" },
        startTime: { type: "string", description: "ISO 8601, ej: 2026-04-15T14:00:00" },
        endTime: { type: "string", description: "ISO 8601, ej: 2026-04-15T14:30:00" },
      },
      required: ["patientId", "doctorId", "service", "startTime", "endTime"],
    },
  },
  {
    name: "listar_turnos_paciente",
    description: "Muestra los próximos turnos agendados de un paciente.",
    input_schema: {
      type: "object" as const,
      properties: {
        patientId: { type: "string" },
      },
      required: ["patientId"],
    },
  },
  {
    name: "cancelar_turno",
    description:
      "Cancela un turno existente. Pedir confirmación al paciente antes de ejecutar.",
    input_schema: {
      type: "object" as const,
      properties: {
        appointmentId: { type: "string" },
      },
      required: ["appointmentId"],
    },
  },
  {
    name: "reagendar_turno",
    description:
      "Cambia la fecha/hora de un turno existente a un nuevo horario. Cancela el turno original y crea uno nuevo automáticamente. Usá esta herramienta (NO crear_turno + cancelar_turno por separado) cuando el paciente quiere cambiar el horario de un turno ya agendado.",
    input_schema: {
      type: "object" as const,
      properties: {
        appointmentId: {
          type: "string",
          description: "ID del turno a reagendar (obtenelo con listar_turnos_paciente)",
        },
        startTime: {
          type: "string",
          description: "Nuevo inicio en ISO 8601 con offset de zona horaria, ej: 2026-04-17T16:30:00-03:00",
        },
        endTime: {
          type: "string",
          description: "Nuevo fin en ISO 8601 con offset de zona horaria (siempre 30 min después del inicio)",
        },
      },
      required: ["appointmentId", "startTime", "endTime"],
    },
  },
  {
    name: "buscar_proxima_disponibilidad",
    description:
      "Busca los próximos días con turnos libres para un médico. Usalo cuando el paciente pregunta cuándo hay disponibilidad o cuando verificar_disponibilidad no encuentra slots en una fecha.",
    input_schema: {
      type: "object" as const,
      properties: {
        doctorId: { type: "string", description: "ID del médico" },
        diasAdelante: {
          type: "number",
          description: "Cuántos días hacia adelante buscar (default 14)",
        },
      },
      required: ["doctorId"],
    },
  },
  {
    name: "solicitar_atencion_humana",
    description:
      "Notifica al equipo de la clínica que el paciente quiere hablar con una persona real. Usá esta herramienta cuando el paciente exprese explícitamente que quiere hablar con un humano, un representante, o el equipo de la clínica.",
    input_schema: {
      type: "object" as const,
      properties: {
        motivo: {
          type: "string",
          description: "Breve descripción de por qué el paciente quiere atención humana",
        },
      },
      required: ["motivo"],
    },
  },
];

// Herramientas exclusivas para llamadas de voz
const VOICE_ONLY_TOOLS: Anthropic.Tool[] = [
  {
    name: "terminar_llamada",
    description:
      "Cuelga la llamada telefónica. Úsala cuando: (1) el paciente se despide y la gestión ha concluido, (2) has completado lo que pedía el paciente y no necesita nada más, (3) la conversación ha llegado a su fin natural. SIEMPRE di una frase de despedida ANTES de llamar a esta herramienta — ella corta la línea inmediatamente.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];

// ─── Tool execution ───────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  input: Record<string, string>,
  clinic: ClinicContext,
  patientPhone: string = ""
): Promise<unknown> {
  const clinicId = clinic.id;
  const tz = clinic.timezone;
  switch (name) {
    case "buscar_paciente": {
      const patients = await prisma.patient.findMany({
        where: {
          clinicId,
          OR: [
            { name: { contains: input.query, mode: "insensitive" } },
            { phone: { contains: input.query } },
            { email: { contains: input.query, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, phone: true, email: true },
        take: 5,
      });
      return patients.length > 0
        ? { found: true, patients }
        : { found: false, message: "No se encontró ningún paciente con esos datos" };
    }

    case "crear_paciente": {
      const patient = await prisma.patient.create({
        data: {
          clinicId,
          name: input.name,
          phone: input.phone,
          email: input.email || null,
          birthDate: input.birthDate ? new Date(input.birthDate) : null,
        },
        select: { id: true, name: true, phone: true },
      });
      return { success: true, patient };
    }

    case "actualizar_paciente": {
      const updated = await prisma.patient.update({
        where: { id: input.patientId },
        data: {
          ...(input.birthDate ? { birthDate: new Date(input.birthDate) } : {}),
        },
        select: { id: true, name: true, birthDate: true },
      });
      return { success: true, patient: updated };
    }

    case "listar_medicos": {
      const doctors = await prisma.doctor.findMany({
        where: { clinicId },
        include: { availability: { orderBy: { dayOfWeek: "asc" } } },
        orderBy: { name: "asc" },
      });

      const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
      return doctors.map((d) => ({
        id: d.id,
        name: d.name,
        specialty: d.specialty,
        workingDays: d.availability.map(
          (a) => `${dayNames[a.dayOfWeek]} ${a.startTime}–${a.endTime}`
        ),
      }));
    }

    case "verificar_disponibilidad": {
      // All date operations use the clinic timezone
      const dayStart = tzMidnightUTC(input.date, tz);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
      const dayOfWeek = toTzDate(dayStart, tz).getUTCDay();

      const doctor = await prisma.doctor.findFirst({
        where: { id: input.doctorId, clinicId },
        include: { availability: true, breaks: true },
      });
      if (!doctor) return { available: false, reason: "Médico no encontrado" };

      const avail = doctor.availability.find((a) => a.dayOfWeek === dayOfWeek);
      if (!avail)
        return {
          available: false,
          reason: `${doctor.name} no trabaja ese día`,
        };

      const existing = await prisma.appointment.findMany({
        where: {
          clinicId,
          doctorId: input.doctorId,
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          startTime: { gte: dayStart, lte: dayEnd },
        },
        select: { startTime: true, endTime: true },
      });

      const dayBreaks = doctor.breaks.filter(
        (b) => b.dayOfWeek === null || b.dayOfWeek === dayOfWeek
      );

      const [startH, startM] = avail.startTime.split(":").map(Number);
      const [endH, endM] = avail.endTime.split(":").map(Number);
      // windowStart/End are UTC times corresponding to clinic-local working hours
      const windowStart = new Date(dayStart.getTime() + (startH * 60 + startM) * 60000);
      const windowEnd = new Date(dayStart.getTime() + (endH * 60 + endM) * 60000);

      const freeSlots: string[] = [];
      let cursor = new Date(windowStart);

      while (cursor < windowEnd) {
        const slotEnd = new Date(cursor.getTime() + 30 * 60 * 1000);
        if (slotEnd > windowEnd) break;

        const busy = existing.some(
          (apt) =>
            cursor < new Date(apt.endTime) && slotEnd > new Date(apt.startTime)
        );

        const breakBusy = dayBreaks.some((b) => {
          const [bh, bm] = b.startTime.split(":").map(Number);
          const breakStart = new Date(dayStart.getTime() + (bh * 60 + bm) * 60000);
          const breakEnd = new Date(breakStart.getTime() + b.duration * 60000);
          return cursor < breakEnd && slotEnd > breakStart;
        });

        if (!busy && !breakBusy) {
          // Display time in clinic timezone
          const local = toTzDate(cursor, tz);
          freeSlots.push(
            `${local.getUTCHours().toString().padStart(2, "0")}:${local
              .getUTCMinutes()
              .toString()
              .padStart(2, "0")}`
          );
        }
        cursor = slotEnd;
      }

      const [wEndH, wEndM] = avail.endTime.split(":").map(Number);
      const lastSlotTotal = wEndH * 60 + wEndM - 30;
      const lastSlotHHMM = `${String(Math.floor(lastSlotTotal / 60)).padStart(2, "0")}:${String(lastSlotTotal % 60).padStart(2, "0")}`;

      return {
        available: freeSlots.length > 0,
        doctor: doctor.name,
        date: input.date,
        dayName: format(toTzDate(dayStart, tz), "EEEE d 'de' MMMM", { locale: es }),
        workingHours: `${avail.startTime}–${avail.endTime}`,
        lastBookingStartTime: lastSlotHHMM,
        freeSlots,
      };
    }

    case "crear_turno": {
      const startTime = new Date(input.startTime);
      const endTime = new Date(input.endTime);

      // Convert to clinic timezone for day-of-week and time validation
      const startLocal = toTzDate(startTime, tz);

      // Verify doctor availability
      const avail = await prisma.doctorAvailability.findFirst({
        where: { doctorId: input.doctorId, dayOfWeek: startLocal.getUTCDay() },
      });

      if (!avail) {
        return { success: false, error: "El médico no trabaja ese día" };
      }

      // Compare times in clinic timezone using UTC fields of the shifted date
      const toHHMM = (d: Date) => {
        const local = toTzDate(d, tz);
        return `${local.getUTCHours().toString().padStart(2, "0")}:${local.getUTCMinutes().toString().padStart(2, "0")}`;
      };

      const [endHr, endMn] = avail.endTime.split(":").map(Number);
      const lastStartTotal = endHr * 60 + endMn - 30;
      const lastStartHHMM = `${String(Math.floor(lastStartTotal / 60)).padStart(2, "0")}:${String(lastStartTotal % 60).padStart(2, "0")}`;

      if (
        toHHMM(startTime) < avail.startTime ||
        toHHMM(startTime) >= avail.endTime ||
        toHHMM(endTime) > avail.endTime
      ) {
        return {
          success: false,
          error: `El médico solo atiende de ${avail.startTime} a ${avail.endTime}. El último turno disponible comienza a las ${lastStartHHMM}.`,
        };
      }

      // Check doctor breaks (compare in clinic-local HH:MM minutes)
      const aptBreaks = await prisma.doctorBreak.findMany({
        where: {
          doctorId: input.doctorId,
          OR: [{ dayOfWeek: startLocal.getUTCDay() }, { dayOfWeek: null }],
        },
      });
      const aptEndLocal = toTzDate(endTime, tz);
      const aptStartMins = startLocal.getUTCHours() * 60 + startLocal.getUTCMinutes();
      const aptEndMins = aptEndLocal.getUTCHours() * 60 + aptEndLocal.getUTCMinutes();
      for (const b of aptBreaks) {
        const [bh, bm] = b.startTime.split(":").map(Number);
        const breakStartMins = bh * 60 + bm;
        const breakEndMins = breakStartMins + b.duration;
        if (aptStartMins < breakEndMins && aptEndMins > breakStartMins) {
          return {
            success: false,
            error: `El médico tiene un descanso de ${b.duration} minutos a las ${b.startTime}. Por favor elegí otro horario.`,
          };
        }
      }

      // Check overlap
      const overlap = await prisma.appointment.findFirst({
        where: {
          clinicId,
          doctorId: input.doctorId,
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          OR: [{ startTime: { lt: endTime }, endTime: { gt: startTime } }],
        },
      });
      if (overlap) {
        return { success: false, error: "Ese horario ya está ocupado" };
      }

      const appointment = await prisma.appointment.create({
        data: {
          clinicId,
          doctorId: input.doctorId,
          patientId: input.patientId,
          service: input.service,
          price: 0,
          startTime,
          endTime,
          status: "SCHEDULED",
        },
        include: {
          doctor: { select: { name: true, email: true } },
          patient: { select: { name: true, email: true } },
        },
      });

      const appointmentLocal = toTzDate(appointment.startTime, tz);
      const dateStr = format(appointmentLocal, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es });

      createNotification({
        clinicId,
        type: "APPOINTMENT_CREATED",
        title: "Nuevo turno agendado",
        body: `${appointment.patient.name} reservó un turno con ${appointment.doctor.name} el ${dateStr}`,
        metadata: { appointmentId: appointment.id, patientPhone },
      }).catch(console.error);

      sendAppointmentInvite({
        id: appointment.id,
        service: appointment.service,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        doctor: { name: appointment.doctor.name, email: appointment.doctor.email },
        patient: { name: appointment.patient.name, email: appointment.patient.email },
        clinic: { name: clinic.name, address: clinic.address, timezone: tz },
      });

      return {
        success: true,
        appointment: {
          id: appointment.id,
          doctor: appointment.doctor.name,
          patient: appointment.patient.name,
          service: appointment.service,
          dateStr,
          startTime: appointment.startTime.toISOString(),
          endTime: appointment.endTime.toISOString(),
        },
      };
    }

    case "listar_turnos_paciente": {
      const now = new Date();
      const appointments = await prisma.appointment.findMany({
        where: {
          clinicId,
          patientId: input.patientId,
          startTime: { gte: now },
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
        },
        include: { doctor: { select: { name: true, specialty: true } } },
        orderBy: { startTime: "asc" },
        take: 5,
      });

      if (appointments.length === 0) {
        return { found: false, message: "No tenés turnos próximos agendados" };
      }

      return {
        found: true,
        appointments: appointments.map((a) => ({
          id: a.id,
          doctor: a.doctor.name,
          specialty: a.doctor.specialty,
          service: a.service,
          date: format(toTzDate(a.startTime, tz), "EEEE d 'de' MMMM", { locale: es }),
          time: format(toTzDate(a.startTime, tz), "HH:mm"),
          status: a.status,
        })),
      };
    }

    case "cancelar_turno": {
      const appointment = await prisma.appointment.findFirst({
        where: { id: input.appointmentId, clinicId },
        include: {
          doctor: { select: { name: true } },
          patient: { select: { name: true } },
        },
      });
      if (!appointment) return { success: false, error: "Turno no encontrado" };

      await prisma.appointment.update({
        where: { id: input.appointmentId },
        data: { status: "CANCELLED" },
      });

      const cancelDateStr = format(
        toTzDate(appointment.startTime, tz),
        "EEEE d 'de' MMMM 'a las' HH:mm",
        { locale: es }
      );
      createNotification({
        clinicId,
        type: "APPOINTMENT_CANCELLED",
        title: "Turno cancelado",
        body: `${appointment.patient.name} canceló su turno con ${appointment.doctor.name} del ${cancelDateStr}`,
        metadata: { appointmentId: input.appointmentId, patientPhone },
      }).catch(console.error);

      return { success: true, message: "Turno cancelado correctamente" };
    }

    case "reagendar_turno": {
      const newStart = new Date(input.startTime);
      const newEnd = new Date(input.endTime);

      // Fetch the original appointment
      const original = await prisma.appointment.findFirst({
        where: { id: input.appointmentId, clinicId },
        include: {
          doctor: { select: { name: true } },
          patient: { select: { name: true } },
        },
      });
      if (!original) return { success: false, error: "Turno original no encontrado" };
      if (original.status === "CANCELLED") return { success: false, error: "El turno ya estaba cancelado" };

      // Validate doctor availability for the new day/time
      const newStartLocal = toTzDate(newStart, tz);
      const avail = await prisma.doctorAvailability.findFirst({
        where: { doctorId: original.doctorId, dayOfWeek: newStartLocal.getUTCDay() },
      });
      if (!avail) return { success: false, error: "El médico no trabaja ese día" };

      const toHHMM = (d: Date) => {
        const local = toTzDate(d, tz);
        return `${local.getUTCHours().toString().padStart(2, "0")}:${local.getUTCMinutes().toString().padStart(2, "0")}`;
      };
      const [endHr, endMn] = avail.endTime.split(":").map(Number);
      const lastStartTotal = endHr * 60 + endMn - 30;
      const lastStartHHMM = `${String(Math.floor(lastStartTotal / 60)).padStart(2, "0")}:${String(lastStartTotal % 60).padStart(2, "0")}`;

      if (
        toHHMM(newStart) < avail.startTime ||
        toHHMM(newStart) >= avail.endTime ||
        toHHMM(newEnd) > avail.endTime
      ) {
        return {
          success: false,
          error: `El médico solo atiende de ${avail.startTime} a ${avail.endTime}. El último turno disponible comienza a las ${lastStartHHMM}.`,
        };
      }

      // Check overlap — exclude the appointment being rescheduled
      const overlap = await prisma.appointment.findFirst({
        where: {
          clinicId,
          doctorId: original.doctorId,
          id: { not: input.appointmentId },
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          OR: [{ startTime: { lt: newEnd }, endTime: { gt: newStart } }],
        },
      });
      if (overlap) return { success: false, error: "Ese horario ya está ocupado" };

      // Atomic: cancel old, create new
      const [, newAppointment] = await prisma.$transaction([
        prisma.appointment.update({
          where: { id: input.appointmentId },
          data: { status: "CANCELLED" },
        }),
        prisma.appointment.create({
          data: {
            clinicId,
            doctorId: original.doctorId,
            patientId: original.patientId,
            service: original.service,
            price: original.price,
            startTime: newStart,
            endTime: newEnd,
            status: "SCHEDULED",
          },
        }),
      ]);

      const newDateStr = format(
        toTzDate(newAppointment.startTime, tz),
        "EEEE d 'de' MMMM 'a las' HH:mm",
        { locale: es }
      );
      createNotification({
        clinicId,
        type: "APPOINTMENT_RESCHEDULED",
        title: "Turno reagendado",
        body: `${original.patient.name} reprogramó su turno con ${original.doctor.name} para el ${newDateStr}`,
        metadata: { appointmentId: newAppointment.id, patientPhone },
      }).catch(console.error);

      return {
        success: true,
        message: "Turno reagendado correctamente",
        newAppointment: {
          id: newAppointment.id,
          doctor: original.doctor.name,
          patient: original.patient.name,
          service: original.service,
          dateStr: newDateStr,
          startTime: newAppointment.startTime.toISOString(),
          endTime: newAppointment.endTime.toISOString(),
        },
      };
    }

    case "buscar_proxima_disponibilidad": {
      const dias = Math.min(Number(input.diasAdelante) || 14, 30);

      const doctor = await prisma.doctor.findFirst({
        where: { id: input.doctorId, clinicId },
        include: { availability: true },
      });
      if (!doctor) return { error: "Médico no encontrado" };

      if (doctor.availability.length === 0) {
        return { available: false, reason: `${doctor.name} no tiene horarios configurados` };
      }

      const availableDays = doctor.availability.map((a) => a.dayOfWeek);
      const results: Array<{ date: string; dayName: string; freeSlots: string[] }> = [];

      for (let i = 1; i <= dias; i++) {
        const nowUtc = new Date();
        const futureDateStr = format(addDays(toTzDate(nowUtc, tz), i), "yyyy-MM-dd");
        const dayStart = tzMidnightUTC(futureDateStr, tz);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
        const dayOfWeek = toTzDate(dayStart, tz).getUTCDay();
        if (!availableDays.includes(dayOfWeek)) continue;

        const avail = doctor.availability.find((a) => a.dayOfWeek === dayOfWeek)!;
        const [startH, startM] = avail.startTime.split(":").map(Number);
        const [endH, endM] = avail.endTime.split(":").map(Number);
        const windowStart = new Date(dayStart.getTime() + (startH * 60 + startM) * 60000);
        const windowEnd = new Date(dayStart.getTime() + (endH * 60 + endM) * 60000);

        const existing = await prisma.appointment.findMany({
          where: {
            clinicId,
            doctorId: input.doctorId,
            status: { notIn: ["CANCELLED", "NO_SHOW"] },
            startTime: { gte: dayStart, lte: dayEnd },
          },
          select: { startTime: true, endTime: true },
        });

        const freeSlots: string[] = [];
        let cursor = new Date(windowStart);
        while (cursor < windowEnd) {
          const slotEnd = new Date(cursor.getTime() + 30 * 60 * 1000);
          if (slotEnd > windowEnd) break;
          const busy = existing.some(
            (apt) => cursor < new Date(apt.endTime) && slotEnd > new Date(apt.startTime)
          );
          if (!busy) {
            const local = toTzDate(cursor, tz);
            freeSlots.push(
              `${local.getUTCHours().toString().padStart(2, "0")}:${local.getUTCMinutes().toString().padStart(2, "0")}`
            );
          }
          cursor = slotEnd;
        }

        if (freeSlots.length > 0) {
          results.push({
            date: futureDateStr,
            dayName: format(toTzDate(dayStart, tz), "EEEE d 'de' MMMM", { locale: es }),
            freeSlots,
          });
          if (results.length >= 3) break; // devolver los primeros 3 días con disponibilidad
        }
      }

      if (results.length === 0) {
        return {
          available: false,
          reason: `${doctor.name} no tiene turnos libres en los próximos ${dias} días`,
        };
      }

      return { available: true, doctor: doctor.name, nextAvailableDays: results };
    }

    case "terminar_llamada": {
      return { hangUp: true };
    }

    case "solicitar_atencion_humana": {
      createNotification({
        clinicId,
        type: "HUMAN_REQUESTED",
        title: "Atención humana solicitada",
        body: `Un paciente solicita hablar con un representante${input.motivo ? `: ${input.motivo}` : ""}`,
        metadata: { patientPhone, motivo: input.motivo ?? "" },
      }).catch(console.error);

      return {
        success: true,
        message: "Hemos notificado al equipo. Un representante se pondrá en contacto contigo en breve.",
      };
    }

    default:
      return { error: `Herramienta desconocida: ${name}` };
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(clinic: ClinicContext, patientPhone = ""): string {
  const botName = clinic.waBotName ?? `Asistente de ${clinic.name}`;
  const offsetMin = tzOffsetMin(clinic.timezone);
  const tzStr = fmtTzOffset(offsetMin);
  // "now" in the clinic's local timezone
  const nowLocal = toTzDate(new Date(), clinic.timezone);
  const now = format(nowLocal, "EEEE d 'de' MMMM 'de' yyyy, HH:mm", {
    locale: es,
  });

  return `Eres ${botName}, la asistente virtual de ${clinic.name}.
Respondes en español de España, de manera cálida, natural y concisa — como una recepcionista española, nunca como un bot. Usa jerga y expresiones cotidianas del español peninsular: "venga", "vale", "a ver", "oye", "mira", "claro que sí", "fenomenal", "estupendo", "marchando", "¿para qué más te puedo ayudar?", "no te preocupes", "para lo que necesites". Tutea siempre. Evita totalmente el voseo y los modismos latinoamericanos — nunca uses "acá", "allá", "vos", "dale", "che", "ta bien", "re bien", "¿cachai?".

INFORMACIÓN DE LA CLÍNICA:
- Nombre: ${clinic.name}
${clinic.address ? `- Dirección: ${clinic.address}` : ""}
${clinic.phone ? `- Teléfono: ${clinic.phone}` : ""}
- Fecha y hora actual: ${now} (zona horaria del servidor: UTC${tzStr})

REGLAS DE COMPORTAMIENTO:
- Nunca muestres menús numerados ni listas de opciones tipo "1. Pedir cita, 2. Cancelar cita"
- Responde de forma conversacional y natural
- Si necesitas información del paciente, pídela de una cosa a la vez
- Antes de crear una cita, confirma el médico, día, hora y servicio con el paciente
- Antes de cancelar una cita, pide confirmación explícita
- Al confirmar que un turno ha sido creado o reagendado, incluye siempre la dirección de la clínica en el mensaje de confirmación (ej: "📍 Dirección: [dirección]")
- Si hay ambigüedad en la fecha (ej: "el viernes"), asume el próximo que venga
- IDENTIFICACIÓN DEL PACIENTE — SECUENCIA OBLIGATORIA ANTES DE CREAR CUALQUIER CITA O REGISTRO:
  1. Pide el número de teléfono PRIMERO: "Para buscarte en el sistema, ¿me puedes dar tu número de teléfono?"
  2. Llama a buscar_paciente con ese número
  3. Si hay coincidencia, confirma: "¿Eres [Nombre]?" — si confirma, usa ese perfil existente
  4. Solo si NO hay coincidencia, pide el nombre completo y crea un nuevo paciente con el teléfono ya recogido${patientPhone && !patientPhone.startsWith("elevenlabs:") && !patientPhone.startsWith("call:") ? `\n  El número desde el que contacta este paciente es: ${patientPhone} — úsalo directamente en el paso 2 sin pedírselo` : ""}
  NUNCA crees un paciente nuevo sin haber buscado antes por teléfono — esto evita duplicados en el sistema
- Si el paciente ya está registrado, salúdale por su nombre y no le pidas datos que ya tienes
- Responde mensajes cortos con respuestas cortas, no seas verboso
- En caso de errores técnicos, discúlpate y sugiere contactar a la clínica directamente
- Si el paciente pide hablar con una persona real, un representante o el equipo de la clínica, usa la herramienta solicitar_atencion_humana e infórmale que el equipo le contactará pronto

REGLAS ESTRICTAS DE USO DE HERRAMIENTAS — NUNCA ADIVINES, SIEMPRE CONSULTA:
- CRÍTICO: NUNCA calcules ni deduzcas el nombre del día de la semana a partir de una fecha — los modelos de lenguaje cometen errores en este cálculo. Usa SIEMPRE el campo "dayName" que devuelven las herramientas (buscar_proxima_disponibilidad y verificar_disponibilidad). Si una herramienta devuelve dayName: "lunes 4 de mayo", di exactamente "lunes 4 de mayo" al paciente, sin reinterpretarlo
- NUNCA digas que un médico "no trabaja" un día sin antes llamar a verificar_disponibilidad para esa fecha exacta
- Cuando el paciente sugiere una fecha/hora, SIEMPRE llama a verificar_disponibilidad antes de responder si hay o no citas disponibles
- Si verificar_disponibilidad devuelve freeSlots vacío para una fecha, inmediatamente llama a buscar_proxima_disponibilidad para ofrecer alternativas reales
- Cuando el paciente pregunta "¿qué días trabaja?" o "¿cuándo tiene disponibilidad?", llama a buscar_proxima_disponibilidad y muestra las fechas reales con los horarios libres
- Los workingDays que devuelve listar_medicos son los días configurados, pero puede haber citas ocupadas — siempre verifica con verificar_disponibilidad o buscar_proxima_disponibilidad antes de confirmar disponibilidad
- Cuando listes médicos, muestra su especialidad y sus días de trabajo (workingDays del resultado)
- Cuando el paciente pida un especialista (ej: "ginecólogo", "cardiólogo"), SIEMPRE llama a listar_medicos sin filtro, lee la lista completa y busca el médico cuya especialidad coincida semánticamente — las especialidades en la BD están en español y en forma sustantiva (ej: "Ginecologia"), nunca rechaces sin antes consultar la lista completa
- Para crear una cita: el endTime es siempre 30 minutos después del startTime
- El horario de cierre del médico indica cuándo TERMINA de atender, no cuándo puede EMPEZAR una cita. La última cita posible comienza 30 minutos ANTES del cierre. Ejemplo: si trabaja hasta las 18:00, la última cita es a las 17:30. NUNCA ofrezcas ni aceptes el horario de cierre como inicio de cita
- SIEMPRE incluye la zona horaria del servidor en los ISO 8601 de startTime y endTime, ej: 2026-04-15T14:00:00${tzStr}. NUNCA omitas el offset de zona horaria
- Cuando el paciente quiera cambiar el horario de una cita existente: 1) listar_turnos_paciente para obtener el ID, 2) verificar_disponibilidad del nuevo horario, 3) reagendar_turno con el ID de la cita original. NUNCA uses crear_turno + cancelar_turno por separado para reagendar
- Si el paciente menciona su fecha de nacimiento en cualquier momento de la conversación (ej: "nací el 15 de marzo de 1990", "mi fecha de nacimiento es..."), conviértela al formato YYYY-MM-DD y: si el paciente aún no está registrado inclúyela en crear_paciente; si ya está registrado usa actualizar_paciente con su ID para guardarla. No solicites la fecha de nacimiento de forma proactiva, solo regístrala si el paciente la proporciona voluntariamente

${
  clinic.knowledgeBase && clinic.knowledgeBase.length > 0
    ? `INFORMACIÓN DE LA CLÍNICA (respondé estas preguntas directamente sin derivar al teléfono):
${clinic.knowledgeBase
  .map((kb) => `- ${kb.question}: ${kb.answer}`)
  .join("\n")}`
    : ""
}`;
}

// ─── Main bot runner ──────────────────────────────────────────────────────────

export async function runBot(
  clinic: ClinicContext,
  history: BotMessage[],
  newUserMessage: string,
  patientPhone: string = "",
  voiceMode: boolean = false
): Promise<{ reply: string; updatedHistory: BotMessage[]; shouldHangUp: boolean }> {
  // Load knowledge base if not already provided
  if (!clinic.knowledgeBase) {
    const kb = await prisma.knowledgeBase.findMany({
      where: { clinicId: clinic.id, active: true },
      select: { question: true, answer: true, category: true },
      orderBy: [{ category: "asc" }, { order: "asc" }],
    });
    clinic = { ...clinic, knowledgeBase: kb };
  }

  const messages: BotMessage[] = [
    ...history,
    { role: "user", content: newUserMessage },
  ];

  // Keep last 30 messages to avoid token limits.
  // After slicing, advance past any leading orphaned tool_result messages —
  // these appear when the slice cuts out the preceding assistant tool_use block,
  // which causes Anthropic to reject the request with a 400.
  const raw = messages.slice(-30);
  let startAt = 0;
  while (startAt < raw.length) {
    const m = raw[startAt];
    if (m.role === "user") {
      const c = m.content;
      const isToolResult =
        Array.isArray(c) && c.length > 0 && (c as { type: string }[])[0].type === "tool_result";
      if (!isToolResult) break;
    }
    startAt++;
  }
  const trimmed = raw.slice(startAt);

  let current = [...trimmed];
  let shouldHangUp = false;

  const activeTools = voiceMode ? [...TOOLS, ...VOICE_ONLY_TOOLS] : TOOLS;

  const systemPrompt = buildSystemPrompt(clinic, patientPhone) + (voiceMode
    ? "\n\nMODO VOZ ACTIVO: Estás en una llamada telefónica. Responde SIEMPRE en 1 o 2 frases cortas y naturales, como una recepcionista española por teléfono. NUNCA uses listas, guiones, asteriscos, numeraciones ni formatos de texto — solo texto hablado. Sé directa y concisa.\n- Cuando el paciente se despida o la gestión esté completada y no necesite nada más, di una frase de despedida natural (ej: 'Venga, hasta luego, que vaya bien.') y llama inmediatamente a terminar_llamada para colgar. No esperes más turnos si el paciente ya se ha despedido."
    : "");

  // Tool use loop — runs until Claude returns end_turn with text
  for (let iterations = 0; iterations < 12; iterations++) {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001", // fast + cheap for chatbot
      max_tokens: voiceMode ? 300 : 1024,
      system: systemPrompt,
      tools: activeTools,
      messages: current as Anthropic.MessageParam[],
    });

    if (response.stop_reason === "end_turn") {
      const text =
        response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("") || "No pude procesar tu mensaje. Intentá de nuevo.";

      current.push({ role: "assistant", content: response.content });

      return { reply: text, updatedHistory: current, shouldHangUp };
    }

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      // Add assistant message with tool calls to history
      current.push({ role: "assistant", content: response.content });

      // Execute all tool calls and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          console.log(`[bot] tool_call: ${block.name}`, JSON.stringify(block.input));
          const result = await executeTool(
            block.name,
            block.input as Record<string, string>,
            clinic,
            patientPhone
          );
          console.log(`[bot] tool_result: ${block.name}`, JSON.stringify(result));
          if (typeof result === "object" && result !== null && (result as { hangUp?: boolean }).hangUp) {
            shouldHangUp = true;
          }
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: JSON.stringify(result),
          };
        })
      );

      current.push({ role: "user", content: toolResults });
      continue;
    }

    // Unexpected stop reason
    break;
  }

  return {
    reply: "Lo siento, no pude procesar tu mensaje. Por favor contacta a la clínica directamente.",
    updatedHistory: current,
    shouldHangUp: false,
  };
}
