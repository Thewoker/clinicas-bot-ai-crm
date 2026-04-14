import { getDoctors, getAppointments, getPatients } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CalendarGrid } from "./calendar-grid";
import { format, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@/lib/prisma";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const dateParam = sp.date ? new Date(sp.date) : new Date();
  const from = startOfDay(dateParam);
  const to = endOfDay(dateParam);

  const [doctors, appointments, patients, clinic] = await Promise.all([
    getDoctors(session.clinicId),
    getAppointments(session.clinicId, from, to),
    getPatients(session.clinicId),
    prisma.clinic.findUnique({
      where: { id: session.clinicId },
      select: { waPhoneNumberId: true, waActive: true },
    }),
  ]);

  const canNotifyWhatsapp = !!(clinic?.waActive && clinic?.waPhoneNumberId);

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Calendario de Turnos</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {format(dateParam, "EEEE, d MMMM yyyy", { locale: es })} ·{" "}
          {session.clinicName}
        </p>
      </div>

      <CalendarGrid
        doctors={doctors.map((d) => ({
          id: d.id,
          name: d.name,
          specialty: d.specialty,
          color: d.color,
        }))}
        appointments={appointments
          .filter((a) => a.status !== "CANCELLED") // hide cancelled in grid
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
          }))}
        patients={patients.map((p) => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
        }))}
        canNotifyWhatsapp={canNotifyWhatsapp}
        currentDate={dateParam.toISOString()}
      />
    </div>
  );
}
