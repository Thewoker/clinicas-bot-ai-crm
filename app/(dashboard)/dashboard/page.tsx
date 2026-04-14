import { getDashboardStats, getAppointments } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Calendar, Users, Stethoscope, TrendingUp, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import clsx from "clsx";

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  SCHEDULED: { label: "Programada", class: "bg-blue-50 text-blue-700" },
  CONFIRMED: { label: "Confirmada", class: "bg-emerald-50 text-emerald-700" },
  COMPLETED: { label: "Completada", class: "bg-gray-100 text-gray-600" },
  CANCELLED: { label: "Cancelada", class: "bg-red-50 text-red-600" },
  NO_SHOW: { label: "No asistió", class: "bg-orange-50 text-orange-600" },
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { clinicId, clinicName, clinicSlug } = session;
  const stats = await getDashboardStats(clinicId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);
  const todayAppointments = await getAppointments(clinicId, today, todayEnd);

  const kpis = [
    { label: "Citas este mes", value: stats.monthAppointments, icon: Calendar, color: "text-emerald-600", bg: "bg-emerald-50", suffix: "" },
    { label: "Pacientes totales", value: stats.totalPatients, icon: Users, color: "text-blue-600", bg: "bg-blue-50", suffix: "" },
    { label: "Médicos activos", value: stats.totalDoctors, icon: Stethoscope, color: "text-violet-600", bg: "bg-violet-50", suffix: "" },
    { label: "Ingresos del mes", value: stats.monthRevenue.toFixed(0), icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-50", suffix: "€" },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{clinicName}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {format(new Date(), "EEEE, d MMMM yyyy", { locale: es })}
        </p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, bg, suffix }) => (
          <div key={label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {value}<span className="text-base font-semibold text-gray-400 ml-0.5">{suffix}</span>
                </p>
              </div>
              <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center", bg)}>
                <Icon className={clsx("w-4 h-4", color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
            <Clock className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-800">Citas de hoy</h2>
            <span className="ml-1 text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-medium">
              {todayAppointments.length}
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {todayAppointments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No hay citas programadas para hoy.</p>
            ) : (
              todayAppointments.map((apt) => {
                const status = STATUS_LABELS[apt.status] ?? STATUS_LABELS.SCHEDULED;
                return (
                  <div key={apt.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: apt.doctor.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{apt.patient.name}</p>
                      <p className="text-xs text-gray-500">{apt.service} · {apt.doctor.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-gray-700">{format(new Date(apt.startTime), "HH:mm")}</p>
                      <span className={clsx("text-xs font-medium px-2 py-0.5 rounded-full", status.class)}>{status.label}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-700 w-14 text-right shrink-0">
                      {Number(apt.price).toFixed(0)}€
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-semibold text-gray-800">Resumen del mes</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Citas totales</span>
                <span className="text-sm font-semibold text-gray-800">{stats.monthAppointments}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Confirmadas / Completadas</span>
                <span className="text-sm font-semibold text-emerald-600">{stats.confirmedAppointments}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Ingresos</span>
                <span className="text-sm font-bold text-gray-900">{stats.monthRevenue.toFixed(2)} €</span>
              </div>
              {stats.monthAppointments > 0 && (
                <div className="pt-2">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Tasa de confirmación</span>
                    <span>{Math.round((stats.confirmedAppointments / stats.monthAppointments) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.round((stats.confirmedAppointments / stats.monthAppointments) * 100))}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white">
            <p className="text-xs font-medium text-emerald-100 mb-1">API Key de IA</p>
            <p className="text-xs font-mono bg-emerald-600/50 rounded-lg px-3 py-2 mt-2 break-all">{clinicSlug}</p>
            <p className="text-xs text-emerald-200 mt-2">
              Usa tu API Key para conectar tu agente de WhatsApp / Voz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
