"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { PatientModal } from "./patient-modal";

type Patient = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  birthDate: Date | string | null;
  notes: string | null;
};

export function NewPatientButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
      >
        <Plus className="w-4 h-4" />
        Nuevo paciente
      </button>
      {open && <PatientModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function EditPatientButton({ patient }: { patient: Patient }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Editar paciente"
        className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      {open && <PatientModal patient={patient} onClose={() => setOpen(false)} />}
    </>
  );
}
