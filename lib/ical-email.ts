import { Resend } from "resend";
import { createEvent } from "ics";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const resend = new Resend(process.env.RESEND_API_KEY);

export interface AppointmentEmailData {
  id: string;
  service: string;
  startTime: Date;
  endTime: Date;
  notes?: string | null;
  doctor: { name: string; email: string };
  patient: { name: string; email?: string | null };
  clinic: { name: string; address?: string | null; timezone: string };
}

type ICalMethod = "REQUEST" | "CANCEL";

function toDateArray(d: Date): [number, number, number, number, number] {
  return [
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
  ];
}

async function sendCalendarEmail(
  data: AppointmentEmailData,
  method: ICalMethod,
  sequence: number
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const dateStr = format(data.startTime, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es });

  const descriptionLines = [
    `Paciente: ${data.patient.name}`,
    `Servicio: ${data.service}`,
    `Médico: ${data.doctor.name}`,
    `Clínica: ${data.clinic.name}`,
    data.notes ? `Notas: ${data.notes}` : null,
  ]
    .filter(Boolean)
    .join("\\n");

  const { error, value } = createEvent({
    uid: `${data.id}@clinic-app`,
    sequence,
    method,
    start: toDateArray(data.startTime),
    startInputType: "utc",
    end: toDateArray(data.endTime),
    endInputType: "utc",
    title: `${data.service} — ${data.patient.name}`,
    description: descriptionLines,
    location: data.clinic.address ?? undefined,
    status: method === "CANCEL" ? "CANCELLED" : "CONFIRMED",
    organizer: { name: data.clinic.name, email: fromEmail },
    attendees: [
      {
        name: data.doctor.name,
        email: data.doctor.email,
        rsvp: true,
        role: "REQ-PARTICIPANT",
        partstat: "NEEDS-ACTION",
      },
      ...(data.patient.email
        ? [
            {
              name: data.patient.name,
              email: data.patient.email,
              rsvp: false,
              role: "NON-PARTICIPANT" as const,
              partstat: "ACCEPTED" as const,
            },
          ]
        : []),
    ],
  });

  if (error || !value) {
    console.error("[ical-email] iCal generation failed:", error);
    return;
  }

  const isCancel = method === "CANCEL";
  const isUpdate = sequence > 0 && !isCancel;

  const subject = isCancel
    ? `Turno cancelado: ${data.service} — ${dateStr}`
    : isUpdate
    ? `Turno modificado: ${data.service} — ${dateStr}`
    : `Nuevo turno: ${data.service} — ${dateStr}`;

  const bodyHtml = isCancel
    ? `<p>El turno del <strong>${dateStr}</strong> con <strong>${data.doctor.name}</strong> en <strong>${data.clinic.name}</strong> ha sido <strong>cancelado</strong>.</p>`
    : `<p>${isUpdate ? "Tu turno ha sido <strong>modificado</strong>." : "Se ha agendado un <strong>nuevo turno</strong>."}</p>
<ul>
  <li>📅 <strong>${dateStr}</strong></li>
  <li>👨‍⚕️ ${data.doctor.name}</li>
  <li>🏥 ${data.clinic.name}</li>
  ${data.clinic.address ? `<li>📍 ${data.clinic.address}</li>` : ""}
  <li>🩺 Servicio: ${data.service}</li>
</ul>
<p><em>Abrí el archivo adjunto para agregar el evento a tu calendario (Google Calendar, Outlook, Apple Calendar).</em></p>`;

  const to = [data.doctor.email];
  if (data.patient.email) to.push(data.patient.email);

  await resend.emails.send({
    from: fromEmail,
    to,
    subject,
    html: bodyHtml,
    attachments: [
      {
        filename: "turno.ics",
        content: Buffer.from(value).toString("base64"),
        contentType: `text/calendar; method=${method}`,
      },
    ],
  });
}

export function sendAppointmentInvite(data: AppointmentEmailData) {
  return sendCalendarEmail(data, "REQUEST", 0).catch((err) =>
    console.error("[ical-email] invite failed:", err)
  );
}

export function sendAppointmentUpdate(data: AppointmentEmailData) {
  return sendCalendarEmail(data, "REQUEST", 1).catch((err) =>
    console.error("[ical-email] update failed:", err)
  );
}

export function sendAppointmentCancellation(data: AppointmentEmailData) {
  return sendCalendarEmail(data, "CANCEL", 2).catch((err) =>
    console.error("[ical-email] cancellation failed:", err)
  );
}

export interface ReminderEmailData {
  service: string;
  startTime: Date;
  patientName: string;
  patientEmail: string;
  doctorName: string;
  clinicName: string;
  clinicAddress?: string | null;
  hoursUntil: number;
}

export async function sendAppointmentReminderEmail(data: ReminderEmailData): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const resendClient = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const dateStr = format(data.startTime, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es });
  const label = data.hoursUntil === 4 ? "en 4 horas" : `en ${data.hoursUntil} horas`;

  const html = `
<p>Hola <strong>${data.patientName}</strong> 👋</p>
<p>Te recordamos que tenés un turno <strong>${label}</strong>:</p>
<ul>
  <li>📅 <strong>${dateStr}</strong></li>
  <li>👨‍⚕️ ${data.doctorName}</li>
  <li>🏥 ${data.clinicName}</li>
  ${data.clinicAddress ? `<li>📍 ${data.clinicAddress}</li>` : ""}
  <li>🩺 Servicio: ${data.service}</li>
</ul>
<p>Si necesitás cancelar o reprogramar, comunicate con la clínica con tiempo.</p>`;

  await resendClient.emails.send({
    from: fromEmail,
    to: data.patientEmail,
    subject: `Recordatorio de turno ${label} — ${data.clinicName}`,
    html,
  });
}
