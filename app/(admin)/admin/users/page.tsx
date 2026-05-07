import { prisma } from "@/lib/prisma";
import { UserCheck, UserX, Clock } from "lucide-react";
import { UserActions } from "./user-actions";

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

async function getUsers(statusFilter?: string) {
  return prisma.user.findMany({
    where: statusFilter ? { status: statusFilter as never } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      clinics: {
        include: { clinic: { select: { id: true, name: true } } },
      },
    },
  });
}

const statusOptions = [
  { value: "", label: "Todos" },
  { value: "PENDING", label: "Pendientes" },
  { value: "AUTHORIZED", label: "Autorizados" },
  { value: "SUSPENDED", label: "Suspendidos" },
];

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const users = await getUsers(status);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Usuarios</h1>
        <p className="text-slate-500 mt-1">Gestiona las cuentas y sus autorizaciones.</p>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {statusOptions.map((opt) => (
          <a
            key={opt.value}
            href={opt.value ? `/admin/users?status=${opt.value}` : "/admin/users"}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              (status ?? "") === opt.value
                ? "bg-violet-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {opt.label}
          </a>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Usuario</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Clínicas</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Registrado</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-slate-500">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">
                        {user.name}
                        {user.superAdmin && (
                          <span className="ml-2 text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-medium">
                            Super Admin
                          </span>
                        )}
                      </p>
                      <p className="text-slate-400 text-xs">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {user.clinics.length === 0 ? (
                    <span className="text-slate-400 text-xs">Sin clínicas</span>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {user.clinics.map((uc) => (
                        <span key={uc.clinicId} className="text-xs text-slate-600">
                          {uc.clinic.name}
                          <span className="ml-1 text-slate-400 capitalize">({uc.role.toLowerCase()})</span>
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={user.status} />
                </td>
                <td className="px-6 py-4 text-xs text-slate-400">
                  {user.createdAt.toLocaleDateString("es-AR", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </td>
                <td className="px-6 py-4">
                  {!user.superAdmin && (
                    <UserActions userId={user.id} status={user.status} />
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">
                  No hay usuarios con este estado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: React.ReactNode; class: string }> = {
    PENDING: {
      label: "Pendiente",
      icon: <Clock className="w-3 h-3" />,
      class: "bg-amber-100 text-amber-700",
    },
    AUTHORIZED: {
      label: "Autorizado",
      icon: <UserCheck className="w-3 h-3" />,
      class: "bg-emerald-100 text-emerald-700",
    },
    SUSPENDED: {
      label: "Suspendido",
      icon: <UserX className="w-3 h-3" />,
      class: "bg-red-100 text-red-700",
    },
  };
  const cfg = map[status] ?? { label: status, icon: null, class: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.class}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}
