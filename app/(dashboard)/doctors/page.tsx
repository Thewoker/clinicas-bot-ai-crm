import { getDoctors, getAppointments } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Stethoscope, Phone, Mail, Clock } from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";
import { DoctorActionButtons } from "./doctor-action-buttons";

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon first

type Availability = { dayOfWeek: number; startTime: string; endTime: string };

function availabilitySummary(availability: Availability[]): string {
  if (availability.length === 0) return "Sin horario";
  const sorted = [...availability].sort(
    (a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek)
  );
  const days = sorted.map((a) => DAY_NAMES[a.dayOfWeek]).join(", ");
  const uniqueTimes = [...new Set(sorted.map((a) => `${a.startTime}–${a.endTime}`))];
  return uniqueTimes.length === 1 ? `${days} · ${uniqueTimes[0]}` : days;
}

export default async function DoctorsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const now = new Date();
  const [doctors, monthApts] = await Promise.all([
    getDoctors(session.clinicId),
    getAppointments(session.clinicId, startOfMonth(now), endOfMonth(now)),
  ]);

  const aptsByDoctor = monthApts.reduce<Record<string, number>>((acc, apt) => {
    acc[apt.doctorId] = (acc[apt.doctorId] ?? 0) + 1;
    return acc;
  }, {});

  const revenueByDoctor = monthApts.reduce<Record<string, number>>((acc, apt) => {
    if (apt.status === "CONFIRMED" || apt.status === "COMPLETED") {
      acc[apt.doctorId] = (acc[apt.doctorId] ?? 0) + Number(apt.price);
    }
    return acc;
  }, {});

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Médicos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {doctors.length} médico{doctors.length !== 1 ? "s" : ""} en {session.clinicName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-violet-50 text-violet-700 text-sm font-medium px-4 py-2 rounded-xl">
            <Stethoscope className="w-4 h-4" />
            {doctors.length} activos
          </div>
          <DoctorActionButtons />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {doctors.length === 0 ? (
          <div className="col-span-3 text-center py-16 bg-white rounded-2xl border border-gray-100 text-gray-400 text-sm">
            No hay médicos registrados.{" "}
            <span className="text-emerald-600 font-medium">Crea el primero.</span>
          </div>
        ) : (
          doctors.map((doctor) => {
            const summary = availabilitySummary(doctor.availability);
            const hasAvailability = doctor.availability.length > 0;

            return (
              <div
                key={doctor.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white text-base font-bold"
                    style={{ backgroundColor: doctor.color }}
                  >
                    {doctor.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-gray-900 truncate">{doctor.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{doctor.specialty}</p>
                  </div>
                  <DoctorActionButtons doctor={doctor} />
                </div>

                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Mail className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    <span className="truncate">{doctor.email}</span>
                  </div>
                  {doctor.phone && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Phone className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      {doctor.phone}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs">
                    <Clock className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    <span className={hasAvailability ? "text-gray-600" : "text-amber-500"}>
                      {summary}
                    </span>
                  </div>
                </div>

                <div className="border-t border-gray-50 pt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-400">Citas este mes</p>
                    <p className="text-lg font-bold text-gray-900 mt-0.5">
                      {aptsByDoctor[doctor.id] ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Ingresos</p>
                    <p className="text-lg font-bold text-emerald-600 mt-0.5">
                      {(revenueByDoctor[doctor.id] ?? 0).toFixed(0)}€
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
