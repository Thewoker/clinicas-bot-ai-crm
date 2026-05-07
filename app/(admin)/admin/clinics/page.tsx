import { prisma } from "@/lib/prisma";
import { Building2, Users, CalendarDays, Wifi, WifiOff } from "lucide-react";
import { ClinicToggle } from "./clinic-toggle";

async function getClinics() {
  return prisma.clinic.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      userClinics: {
        include: { user: { select: { id: true, name: true, email: true, status: true } } },
      },
      _count: {
        select: { patients: true, appointments: true, doctors: true },
      },
    },
  });
}

export default async function AdminClinicsPage() {
  const clinics = await getClinics();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Clínicas</h1>
        <p className="text-slate-500 mt-1">Vista global de todas las clínicas registradas en la plataforma.</p>
      </div>

      <div className="grid gap-4">
        {clinics.map((clinic) => {
          return (
            <div
              key={clinic.id}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-semibold text-slate-900">{clinic.name}</h2>
                      <span className="text-xs text-slate-400 font-mono">/{clinic.slug}</span>
                    </div>
                    {clinic.address && (
                      <p className="text-xs text-slate-400 mt-0.5">{clinic.address}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5">
                      Creada el{" "}
                      {clinic.createdAt.toLocaleDateString("es-AR", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                {/* API Authorization toggle */}
                <div className="flex items-center gap-2 shrink-0">
                  {clinic.authorized ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <Wifi className="w-3.5 h-3.5" /> API activa
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <WifiOff className="w-3.5 h-3.5" /> API inactiva
                    </span>
                  )}
                  <ClinicToggle clinicId={clinic.id} authorized={clinic.authorized} />
                </div>
              </div>

              {/* Stats row */}
              <div className="flex gap-6 mt-4 pt-4 border-t border-slate-50">
                <StatChip
                  icon={<Users className="w-3.5 h-3.5 text-slate-400" />}
                  label={`${clinic._count.patients} pacientes`}
                />
                <StatChip
                  icon={<CalendarDays className="w-3.5 h-3.5 text-slate-400" />}
                  label={`${clinic._count.appointments} citas`}
                />
                <StatChip
                  icon={<Users className="w-3.5 h-3.5 text-slate-400" />}
                  label={`${clinic._count.doctors} médicos`}
                />
              </div>

              {/* Users */}
              {clinic.userClinics.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {clinic.userClinics.map((uc) => (
                    <div
                      key={uc.userId}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-100"
                    >
                      <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                        <span className="text-[8px] font-bold text-slate-500">
                          {uc.user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs text-slate-700">{uc.user.name}</span>
                      <span className="text-xs text-slate-400 capitalize">({uc.role.toLowerCase()})</span>
                      <UserStatusDot status={uc.user.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {clinics.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center text-slate-400">
            No hay clínicas registradas.
          </div>
        )}
      </div>
    </div>
  );
}

function StatChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

function UserStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    AUTHORIZED: "bg-emerald-400",
    PENDING: "bg-amber-400",
    SUSPENDED: "bg-red-400",
  };
  return (
    <span
      className={`w-1.5 h-1.5 rounded-full ${colors[status] ?? "bg-slate-300"}`}
      title={status}
    />
  );
}
