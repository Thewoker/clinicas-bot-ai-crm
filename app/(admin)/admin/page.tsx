import { prisma } from "@/lib/prisma";
import { Users, Building2, Clock, UserCheck, UserX, CalendarDays, Activity } from "lucide-react";
import Link from "next/link";

async function getAdminStats() {
  const [
    totalUsers,
    pendingUsers,
    authorizedUsers,
    suspendedUsers,
    totalClinics,
    authorizedClinics,
    totalPatients,
    totalAppointments,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { status: "AUTHORIZED" } }),
    prisma.user.count({ where: { status: "SUSPENDED" } }),
    prisma.clinic.count(),
    prisma.clinic.count({ where: { authorized: true } }),
    prisma.patient.count(),
    prisma.appointment.count(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        clinics: { include: { clinic: { select: { name: true } } }, take: 1 },
      },
    }),
  ]);

  return {
    totalUsers,
    pendingUsers,
    authorizedUsers,
    suspendedUsers,
    totalClinics,
    authorizedClinics,
    totalPatients,
    totalAppointments,
    recentUsers,
  };
}

export default async function AdminPage() {
  const stats = await getAdminStats();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Resumen General</h1>
        <p className="text-slate-500 mt-1">Vista global de todos los activos y clínicas de la plataforma.</p>
      </div>

      {/* Pending alert */}
      {stats.pendingUsers > 0 && (
        <Link href="/admin/users?status=PENDING" className="block mb-6">
          <div className="flex items-center gap-3 px-5 py-4 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors">
            <Clock className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {stats.pendingUsers} cuenta{stats.pendingUsers !== 1 ? "s" : ""} pendiente{stats.pendingUsers !== 1 ? "s" : ""} de autorización
              </p>
              <p className="text-xs text-amber-600">Haz clic para revisar y autorizar</p>
            </div>
          </div>
        </Link>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total usuarios"
          value={stats.totalUsers}
          icon={<Users className="w-5 h-5 text-violet-600" />}
          bg="bg-violet-50"
        />
        <StatCard
          label="Pendientes"
          value={stats.pendingUsers}
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          bg="bg-amber-50"
          highlight={stats.pendingUsers > 0}
        />
        <StatCard
          label="Autorizados"
          value={stats.authorizedUsers}
          icon={<UserCheck className="w-5 h-5 text-emerald-600" />}
          bg="bg-emerald-50"
        />
        <StatCard
          label="Suspendidos"
          value={stats.suspendedUsers}
          icon={<UserX className="w-5 h-5 text-red-500" />}
          bg="bg-red-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Total clínicas"
          value={stats.totalClinics}
          icon={<Building2 className="w-5 h-5 text-blue-600" />}
          bg="bg-blue-50"
          sub={`${stats.authorizedClinics} con API activa`}
        />
        <StatCard
          label="Pacientes registrados"
          value={stats.totalPatients}
          icon={<Users className="w-5 h-5 text-teal-600" />}
          bg="bg-teal-50"
        />
        <StatCard
          label="Citas totales"
          value={stats.totalAppointments}
          icon={<CalendarDays className="w-5 h-5 text-indigo-600" />}
          bg="bg-indigo-50"
        />
      </div>

      {/* Recent registrations */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">Últimos registros</h2>
          </div>
          <Link href="/admin/users" className="text-xs text-violet-600 hover:underline font-medium">
            Ver todos
          </Link>
        </div>
        <div className="divide-y divide-slate-50">
          {stats.recentUsers.map((u) => (
            <div key={u.id} className="flex items-center gap-4 px-6 py-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-slate-500">
                  {u.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{u.name}</p>
                <p className="text-xs text-slate-400 truncate">{u.email}</p>
              </div>
              <div className="text-right shrink-0">
                <StatusBadge status={u.status} />
                <p className="text-xs text-slate-400 mt-0.5">
                  {u.clinics[0]?.clinic.name ?? "Sin clínica"}
                </p>
              </div>
            </div>
          ))}
          {stats.recentUsers.length === 0 && (
            <p className="px-6 py-6 text-sm text-slate-400 text-center">Sin registros recientes.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  bg,
  sub,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  bg: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl border ${highlight ? "border-amber-300 bg-amber-50" : "border-slate-100 bg-white"} shadow-sm p-5`}>
      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; class: string }> = {
    PENDING: { label: "Pendiente", class: "bg-amber-100 text-amber-700" },
    AUTHORIZED: { label: "Autorizado", class: "bg-emerald-100 text-emerald-700" },
    SUSPENDED: { label: "Suspendido", class: "bg-red-100 text-red-700" },
  };
  const cfg = map[status] ?? { label: status, class: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cfg.class}`}>
      {cfg.label}
    </span>
  );
}
