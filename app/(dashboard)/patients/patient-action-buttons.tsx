"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, AlertTriangle, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { PatientModal } from "./patient-modal";
import { deletePatient } from "@/app/actions/patients";

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

export function DeletePatientButton({ patient }: { patient: { id: string; name: string } }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deletePatient(patient.id);
      if ("error" in result) {
        setError(result.error);
      } else {
        router.refresh();
        setOpen(false);
      }
    });
  }

  return (
    <>
      <button
        onClick={() => { setError(null); setOpen(true); }}
        title="Eliminar paciente"
        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Eliminar paciente</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                disabled={pending}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100 disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-700">
                ¿Estás seguro de que deseas eliminar a{" "}
                <span className="font-semibold text-gray-900">{patient.name}</span>?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-1.5">
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">
                  Se eliminarán permanentemente:
                </p>
                <ul className="text-sm text-red-600 space-y-1">
                  <li>• Todos los turnos del paciente</li>
                  <li>• Todas las notas clínicas</li>
                  <li>• El historial de conversaciones de WhatsApp</li>
                </ul>
              </div>
              <p className="text-xs text-gray-400">Esta acción no se puede deshacer.</p>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 px-6 pb-5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
              >
                {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Eliminar paciente
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
