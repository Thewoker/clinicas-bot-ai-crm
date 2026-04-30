import { getPatients } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Users, Phone, Mail, CalendarDays, FileText } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { NewPatientButton, EditPatientButton } from "./patient-action-buttons";
import { PatientSearch } from "./patient-search";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { q } = await searchParams;
  const query = typeof q === "string" ? q : undefined;

  const patients = await getPatients(session.clinicId, query);

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pacientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {patients.length} paciente{patients.length !== 1 ? "s" : ""}{query ? " encontrados" : ` en ${session.clinicName}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 text-sm font-medium px-4 py-2 rounded-xl">
            <Users className="w-4 h-4" />
            {patients.length} total
          </div>
          <NewPatientButton />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <PatientSearch />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-gray-50 bg-gray-50/50">
          <div className="col-span-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Paciente</div>
          <div className="col-span-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Teléfono</div>
          <div className="col-span-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Email</div>
          <div className="col-span-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Nacimiento</div>
          <div className="col-span-2" />
        </div>
        <div className="divide-y divide-gray-50">
          {patients.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              {query ? (
                <>No se encontraron pacientes para <span className="font-medium text-gray-600">&ldquo;{query}&rdquo;</span>.</>
              ) : (
                <>No hay pacientes registrados.{" "}<span className="text-emerald-600 font-medium">Crea el primero.</span></>
              )}
            </div>
          ) : (
            patients.map((patient) => (
              <div
                key={patient.id}
                className="grid grid-cols-12 gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors items-center"
              >
                <div className="col-span-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-emerald-700">
                      {patient.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{patient.name}</p>
                    <p className="text-xs text-gray-400">
                      Desde {format(new Date(patient.createdAt), "MMM yyyy", { locale: es })}
                    </p>
                  </div>
                </div>
                <div className="col-span-3 flex items-center gap-1.5 text-sm text-gray-600">
                  <Phone className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                  {patient.phone}
                </div>
                <div className="col-span-3 flex items-center gap-1.5 text-sm text-gray-500 truncate">
                  {patient.email ? (
                    <>
                      <Mail className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      <span className="truncate">{patient.email}</span>
                    </>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </div>
                <div className="col-span-1 flex items-center gap-1.5 text-sm text-gray-500">
                  {patient.birthDate ? (
                    <>
                      <CalendarDays className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      <span className="text-xs">{format(new Date(patient.birthDate), "dd/MM/yy")}</span>
                    </>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </div>
                <div className="col-span-2 flex justify-end items-center gap-1">
                  <Link
                    href={`/patients/${patient.id}`}
                    title="Ver historial de notas"
                    className="p-1.5 rounded-lg text-gray-300 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </Link>
                  <EditPatientButton
                    patient={{
                      id: patient.id,
                      name: patient.name,
                      phone: patient.phone,
                      email: patient.email,
                      birthDate: patient.birthDate,
                      notes: patient.notes,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
