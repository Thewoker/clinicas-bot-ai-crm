"use client";

import { useState } from "react";
import { Users, Phone, Mail, CalendarDays, FileText, Search } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { NewPatientButton, EditPatientButton, DeletePatientButton } from "./patient-action-buttons";

interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  birthDate: Date | string | null;
  notes: string | null;
  createdAt: Date | string;
}

export function PatientList({
  patients,
  clinicName,
}: {
  patients: Patient[];
  clinicName: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? patients.filter((p) => {
        const q = query.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.phone.includes(q) ||
          p.email?.toLowerCase().includes(q)
        );
      })
    : patients;

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pacientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} paciente{filtered.length !== 1 ? "s" : ""}
            {query ? " encontrados" : ` en ${clinicName}`}
          </p>
        </div>
        <div className="flex items-center gap-3 sm:shrink-0">
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 text-sm font-medium px-4 py-2 rounded-xl">
            <Users className="w-4 h-4" />
            {patients.length} total
          </div>
          <NewPatientButton />
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <Search className="w-4 h-4 text-gray-400" />
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, teléfono o email…"
          className="w-full sm:w-72 pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Desktop table header */}
        <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 border-b border-gray-50 bg-gray-50/50">
          <div className="col-span-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Paciente</div>
          <div className="col-span-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Teléfono</div>
          <div className="col-span-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Email</div>
          <div className="col-span-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Nacimiento</div>
          <div className="col-span-2" />
        </div>

        <div className="divide-y divide-gray-50">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              {query ? (
                <>No se encontraron pacientes para <span className="font-medium text-gray-600">&ldquo;{query}&rdquo;</span>.</>
              ) : (
                <>No hay pacientes registrados.{" "}<span className="text-emerald-600 font-medium">Crea el primero.</span></>
              )}
            </div>
          ) : (
            filtered.map((patient) => (
              <div key={patient.id}>
                {/* Mobile card */}
                <div className="sm:hidden flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-emerald-700">
                      {patient.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{patient.name}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                      <Phone className="w-3 h-3 text-gray-300 shrink-0" />
                      {patient.phone}
                    </div>
                    {patient.email && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5 truncate">
                        <Mail className="w-3 h-3 text-gray-300 shrink-0" />
                        <span className="truncate">{patient.email}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link
                      href={`/patients/${patient.id}`}
                      title="Ver historial"
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
                    <DeletePatientButton patient={{ id: patient.id, name: patient.name }} />
                  </div>
                </div>

                {/* Desktop table row */}
                <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors items-center">
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
                    <DeletePatientButton patient={{ id: patient.id, name: patient.name }} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
