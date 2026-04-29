import { getDoctors, getAppointments, getPatients } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CalendarGrid } from "./calendar-grid";
import { DoctorCalendar } from "./doctor-calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

type Mode = "day" | "week" | "month" | "year";

/** UTC offset in minutes for an IANA timezone at the current moment */
function clinicTzOffset(tz: string): number {
  const at = new Date();
  const utc = at.toLocaleString("en-US", { timeZone: "UTC" });
  const local = at.toLocaleString("en-US", { timeZone: tz });
  return (new Date(local).getTime() - new Date(utc).getTime()) / 60000;
}

/** UTC-safe date range for a given mode, starting from a UTC-midnight anchor date */
function getDateRange(anchor: Date, view: "clinic" | "doctor", mode: Mode) {
  const y = anchor.getUTCFullYear();
  const mo = anchor.getUTCMonth();
  const d = anchor.getUTCDate();

  if (view === "clinic") {
    return {
      from: new Date(Date.UTC(y, mo, d, 0, 0, 0)),
      to: new Date(Date.UTC(y, mo, d, 23, 59, 59, 999)),
    };
  }

  switch (mode) {
    case "day":
      return {
        from: new Date(Date.UTC(y, mo, d, 0, 0, 0)),
        to: new Date(Date.UTC(y, mo, d, 23, 59, 59, 999)),
      };
    case "week": {
      const dow = anchor.getUTCDay();
      const toMon = dow === 0 ? -6 : 1 - dow;
      return {
        from: new Date(Date.UTC(y, mo, d + toMon, 0, 0, 0)),
        to: new Date(Date.UTC(y, mo, d + toMon + 6, 23, 59, 59, 999)),
      };
    }
    case "month":
      return {
        from: new Date(Date.UTC(y, mo, 1, 0, 0, 0)),
        to: new Date(Date.UTC(y, mo + 1, 0, 23, 59, 59, 999)),
      };
    case "year":
      return {
        from: new Date(Date.UTC(y, 0, 1, 0, 0, 0)),
        to: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)),
      };
  }
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const view: "clinic" | "doctor" = sp.view === "doctor" ? "doctor" : "clinic";
  const mode: Mode = (["day", "week", "month", "year"] as Mode[]).includes(sp.mode as Mode)
    ? (sp.mode as Mode)
    : "month";

  // Anchor date: parse as UTC midnight so getUTC* gives the right date parts
  const anchor = sp.date ? new Date(`${sp.date}T00:00:00Z`) : new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
  );

  const { from, to } = getDateRange(anchor, view, mode);

  const [doctors, appointments, patients, clinic] = await Promise.all([
    getDoctors(session.clinicId),
    getAppointments(session.clinicId, from, to),
    getPatients(session.clinicId),
    prisma.clinic.findUnique({
      where: { id: session.clinicId },
      select: { waPhoneNumberId: true, waActive: true, timezone: true } as const,
    }),
  ]);

  const canNotifyWhatsapp = !!(clinic?.waActive && clinic?.waPhoneNumberId);
  const tzOffsetMin = clinicTzOffset(clinic?.timezone ?? "Europe/Madrid");

  const dateStr = sp.date ?? format(anchor, "yyyy-MM-dd");
  const displayDate = anchor;

  const mappedDoctors = doctors.map((d) => ({
    id: d.id,
    name: d.name,
    specialty: d.specialty,
    color: d.color,
  }));

  const mappedAppointments = appointments
    .filter((a) => a.status !== "CANCELLED")
    .map((a) => ({
      id: a.id,
      doctorId: a.doctorId,
      patientId: a.patientId,
      patientName: a.patient.name,
      patientPhone: a.patient.phone,
      service: a.service,
      price: Number(a.price),
      startTime: a.startTime.toISOString(),
      endTime: a.endTime.toISOString(),
      status: a.status,
      notes: a.notes ?? undefined,
      doctorName: a.doctor.name,
      doctorColor: a.doctor.color,
    }));

  const mappedPatients = patients.map((p) => ({
    id: p.id,
    name: p.name,
    phone: p.phone,
  }));

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Calendario de Turnos</h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">
            {format(displayDate, "EEEE, d MMMM yyyy", { locale: es })} · {session.clinicName}
          </p>
        </div>

        {/* View switcher */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1 shrink-0">
          <Link
            href={`/calendar?view=clinic&date=${dateStr}`}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              view === "clinic"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Clínica
          </Link>
          <Link
            href={`/calendar?view=doctor&mode=${mode}&date=${dateStr}`}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              view === "doctor"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Mi Agenda
          </Link>
        </div>
      </div>

      {view === "clinic" ? (
        <CalendarGrid
          doctors={mappedDoctors}
          appointments={mappedAppointments}
          patients={mappedPatients}
          canNotifyWhatsapp={canNotifyWhatsapp}
          currentDate={displayDate.toISOString()}
          clinicTzOffsetMin={tzOffsetMin}
        />
      ) : (
        <DoctorCalendar
          doctors={mappedDoctors}
          appointments={mappedAppointments}
          patients={mappedPatients}
          canNotifyWhatsapp={canNotifyWhatsapp}
          currentDate={displayDate.toISOString()}
          clinicTzOffsetMin={tzOffsetMin}
          initialMode={mode}
          initialDoctorId={sp.doctorId ?? null}
        />
      )}
    </div>
  );
}
