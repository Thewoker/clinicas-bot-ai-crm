"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPatient, updatePatient } from "@/app/actions/patients";
import { Loader2, X, User } from "lucide-react";

type Patient = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  birthDate: Date | string | null;
  notes: string | null;
};

interface Props {
  patient?: Patient;
  onClose: () => void;
}

export function PatientModal({ patient, onClose }: Props) {
  const router = useRouter();
  const isEdit = !!patient;

  const [createState, createAction, createPending] = useActionState(createPatient, null);
  const [editState, editAction, editPending] = useActionState(updatePatient, null);

  const state = isEdit ? editState : createState;
  const formAction = isEdit ? editAction : createAction;
  const pending = isEdit ? editPending : createPending;

  // Format birthDate for <input type="date"> (expects yyyy-MM-dd)
  const defaultBirthDate = patient?.birthDate
    ? new Date(patient.birthDate).toISOString().split("T")[0]
    : "";

  useEffect(() => {
    if (state && "success" in state) {
      router.refresh();
      setTimeout(onClose, 700);
    }
  }, [state]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <User className="w-4 h-4 text-emerald-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900">
              {isEdit ? "Editar paciente" : "Nuevo paciente"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form action={formAction} className="p-6 space-y-4">
          {isEdit && <input type="hidden" name="id" value={patient.id} />}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Nombre completo <span className="text-red-400">*</span>
            </label>
            <input
              name="name"
              required
              defaultValue={patient?.name}
              placeholder="Ana Martínez"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Teléfono <span className="text-red-400">*</span>
              </label>
              <input
                name="phone"
                required
                defaultValue={patient?.phone}
                placeholder="+34 600 000 000"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input
                name="email"
                type="email"
                defaultValue={patient?.email ?? ""}
                placeholder="ana@email.com"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Fecha de nacimiento
            </label>
            <input
              name="birthDate"
              type="date"
              defaultValue={defaultBirthDate}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Notas internas
            </label>
            <textarea
              name="notes"
              defaultValue={patient?.notes ?? ""}
              placeholder="Alergias, observaciones, historial relevante…"
              rows={3}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white resize-none"
            />
          </div>

          {state && "error" in state && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}
          {state && "success" in state && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {state.success}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
            >
              {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear paciente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
