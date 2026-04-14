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
  knowledgeBase?: Array<{ question: string; answer: string; category: string | null }>;
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
      },
      required: ["name", "phone"],
    },
  },
  {
    name: "listar_medicos",
    description:
      "Lista los médicos disponibles en la clínica con sus especialidades.",
    input_schema: {
      type: "object" as const,
      properties: {
        specialty: {
          type: "string",
          description: "Filtrar por especialidad (opcional)",
        },
      },
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
];

// ─── Tool execution ───────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  input: Record<string, string>,
  clinicId: string
): Promise<unknown> {
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
        },
        select: { id: true, name: true, phone: true },
      });
      return { success: true, patient };
    }

    case "listar_medicos": {
      const doctors = await prisma.doctor.findMany({
        where: {
          clinicId,
          ...(input.specialty
            ? { specialty: { contains: input.specialty, mode: "insensitive" } }
            : {}),
        },
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
      const [year, month, day] = input.date.split("-").map(Number);
      const dayStart = new Date(year, month - 1, day, 0, 0, 0);
      const dayEnd = new Date(year, month - 1, day, 23, 59, 59);
      const dayOfWeek = dayStart.getDay();

      const doctor = await prisma.doctor.findFirst({
        where: { id: input.doctorId, clinicId },
        include: { availability: true },
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

      const [startH, startM] = avail.startTime.split(":").map(Number);
      const [endH, endM] = avail.endTime.split(":").map(Number);
      const windowStart = new Date(year, month - 1, day, startH, startM);
      const windowEnd = new Date(year, month - 1, day, endH, endM);

      const freeSlots: string[] = [];
      let cursor = new Date(windowStart);

      while (cursor < windowEnd) {
        const slotEnd = new Date(cursor.getTime() + 30 * 60 * 1000);
        if (slotEnd > windowEnd) break;

        const busy = existing.some(
          (apt) =>
            cursor < new Date(apt.endTime) && slotEnd > new Date(apt.startTime)
        );

        if (!busy) {
          freeSlots.push(
            `${cursor.getHours().toString().padStart(2, "0")}:${cursor
              .getMinutes()
              .toString()
              .padStart(2, "0")}`
          );
        }
        cursor = slotEnd;
      }

      return {
        available: freeSlots.length > 0,
        doctor: doctor.name,
        date: input.date,
        workingHours: `${avail.startTime}–${avail.endTime}`,
        freeSlots,
      };
    }

    case "crear_turno": {
      const startTime = new Date(input.startTime);
      const endTime = new Date(input.endTime);

      // Verify doctor availability
      const avail = await prisma.doctorAvailability.findFirst({
        where: { doctorId: input.doctorId, dayOfWeek: startTime.getDay() },
      });

      if (!avail) {
        return { success: false, error: "El médico no trabaja ese día" };
      }

      const toHHMM = (d: Date) =>
        `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;

      if (toHHMM(startTime) < avail.startTime || toHHMM(endTime) > avail.endTime) {
        return {
          success: false,
          error: `El médico solo atiende de ${avail.startTime} a ${avail.endTime}`,
        };
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
          doctor: { select: { name: true } },
          patient: { select: { name: true } },
        },
      });

      return {
        success: true,
        appointment: {
          id: appointment.id,
          doctor: appointment.doctor.name,
          patient: appointment.patient.name,
          service: appointment.service,
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
          date: format(new Date(a.startTime), "EEEE d 'de' MMMM", { locale: es }),
          time: format(new Date(a.startTime), "HH:mm"),
          status: a.status,
        })),
      };
    }

    case "cancelar_turno": {
      const appointment = await prisma.appointment.findFirst({
        where: { id: input.appointmentId, clinicId },
      });
      if (!appointment) return { success: false, error: "Turno no encontrado" };

      await prisma.appointment.update({
        where: { id: input.appointmentId },
        data: { status: "CANCELLED" },
      });

      return { success: true, message: "Turno cancelado correctamente" };
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
        const date = addDays(new Date(), i);
        const dayOfWeek = date.getDay();
        if (!availableDays.includes(dayOfWeek)) continue;

        const avail = doctor.availability.find((a) => a.dayOfWeek === dayOfWeek)!;
        const [startH, startM] = avail.startTime.split(":").map(Number);
        const [endH, endM] = avail.endTime.split(":").map(Number);

        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();
        const windowStart = new Date(year, month, day, startH, startM);
        const windowEnd = new Date(year, month, day, endH, endM);
        const dayStart = new Date(year, month, day, 0, 0, 0);
        const dayEnd = new Date(year, month, day, 23, 59, 59);

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
            freeSlots.push(
              `${cursor.getHours().toString().padStart(2, "0")}:${cursor.getMinutes().toString().padStart(2, "0")}`
            );
          }
          cursor = slotEnd;
        }

        if (freeSlots.length > 0) {
          results.push({
            date: format(date, "yyyy-MM-dd"),
            dayName: format(date, "EEEE d 'de' MMMM", { locale: es }),
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

    default:
      return { error: `Herramienta desconocida: ${name}` };
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(clinic: ClinicContext): string {
  const botName = clinic.waBotName ?? `Asistente de ${clinic.name}`;
  const now = format(new Date(), "EEEE d 'de' MMMM 'de' yyyy, HH:mm", {
    locale: es,
  });

  return `Sos ${botName}, la asistente virtual de ${clinic.name}.
Respondés en español de manera cálida, natural y concisa — como una recepcionista humana, nunca como un bot.

INFORMACIÓN DE LA CLÍNICA:
- Nombre: ${clinic.name}
${clinic.address ? `- Dirección: ${clinic.address}` : ""}
${clinic.phone ? `- Teléfono: ${clinic.phone}` : ""}
- Fecha y hora actual: ${now}

REGLAS DE COMPORTAMIENTO:
- Nunca mostrés menús numerados ni listas de opciones tipo "1. Sacar turno, 2. Cancelar turno"
- Respondé de forma conversacional y natural
- Si necesitás información del paciente, pedila de a una cosa a la vez
- Antes de crear un turno, confirmá el médico, día, hora y servicio con el paciente
- Antes de cancelar un turno, pedí confirmación explícita
- Si hay ambigüedad en la fecha (ej: "el viernes"), asumí el próximo que venga
- Cuando el paciente da su nombre, buscalo en el sistema antes de pedirle más datos
- Si el paciente ya está registrado, saludalo por su nombre
- Respondé mensajes cortos con respuestas cortas, no seas verboso
- En caso de errores técnicos, disculpate y sugerí contactar a la clínica directamente

REGLAS ESTRICTAS DE USO DE HERRAMIENTAS — NUNCA ADIVINES, SIEMPRE CONSULTÁ:
- NUNCA digas que un médico "no trabaja" un día sin antes llamar a verificar_disponibilidad para esa fecha exacta
- Cuando el paciente sugiere una fecha/hora, SIEMPRE llamá verificar_disponibilidad antes de responder si hay o no turnos
- Si verificar_disponibilidad devuelve freeSlots vacío para una fecha, inmediatamente llamá buscar_proxima_disponibilidad para ofrecer alternativas reales
- Cuando el paciente pregunta "¿qué días trabaja?" o "¿cuándo tiene disponibilidad?", llamá buscar_proxima_disponibilidad y mostrá las fechas reales con los horarios libres
- Los workingDays que devuelve listar_medicos son los días configurados, pero puede haber turnos ocupados — siempre verificá con verificar_disponibilidad o buscar_proxima_disponibilidad antes de confirmar disponibilidad
- Cuando listés médicos, mostrá su especialidad y sus días de trabajo (workingDays del resultado)
- Para crear un turno: el endTime es siempre 30 minutos después del startTime

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
  newUserMessage: string
): Promise<{ reply: string; updatedHistory: BotMessage[] }> {
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

  // Keep last 30 messages to avoid token limits
  const trimmed = messages.slice(-30);

  let current = [...trimmed];

  // Tool use loop — runs until Claude returns end_turn with text
  for (let iterations = 0; iterations < 12; iterations++) {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001", // fast + cheap for chatbot
      max_tokens: 1024,
      system: buildSystemPrompt(clinic),
      tools: TOOLS,
      messages: current as Anthropic.MessageParam[],
    });

    if (response.stop_reason === "end_turn") {
      const text =
        response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("") || "No pude procesar tu mensaje. Intentá de nuevo.";

      current.push({ role: "assistant", content: response.content });

      return { reply: text, updatedHistory: current };
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
          const result = await executeTool(
            block.name,
            block.input as Record<string, string>,
            clinic.id
          );
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
    reply: "Lo siento, no pude procesar tu mensaje. Por favor contactá a la clínica directamente.",
    updatedHistory: current,
  };
}
