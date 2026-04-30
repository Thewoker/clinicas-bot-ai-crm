import { getPendingSession, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { selectClinicAction } from "@/app/actions/clinic-select";
import { Building2, ChevronRight } from "lucide-react";

export default async function SelectClinicPage() {
  // Already has a full session → go to dashboard
  const session = await getSession();
  if (session) redirect("/dashboard");

  // Needs a pending session to be here
  const pending = await getPendingSession();
  if (!pending) redirect("/login");

  const userClinics = await prisma.userClinic.findMany({
    where: { userId: pending.userId },
    include: { clinic: { select: { id: true, name: true, slug: true, address: true } } },
    orderBy: { clinic: { name: "asc" } },
  });

  if (userClinics.length === 0) redirect("/login");

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Seleccioná tu clínica</h1>
      <p className="text-sm text-gray-500 mb-8">
        Hola, <span className="font-medium text-gray-700">{pending.userName}</span>. ¿Con qué clínica querés trabajar hoy?
      </p>

      <div className="space-y-3">
        {userClinics.map(({ clinic, role }) => (
          <form key={clinic.id} action={selectClinicAction}>
            <input type="hidden" name="clinicId" value={clinic.id} />
            <button
              type="submit"
              className="w-full flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50/50 transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-200 transition-colors">
                <Building2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{clinic.name}</p>
                {clinic.address && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">{clinic.address}</p>
                )}
                <p className="text-xs text-emerald-600 font-medium mt-0.5 capitalize">{role.toLowerCase()}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 shrink-0 transition-colors" />
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
