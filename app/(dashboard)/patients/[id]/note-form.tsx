"use client";

import { useActionState, useEffect, useRef } from "react";
import { createPatientNote } from "@/app/actions/patient-notes";
import { Loader2, Plus } from "lucide-react";

export function NoteForm({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState(createPatientNote, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "success" in state) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="patientId" value={patientId} />
      <textarea
        name="content"
        required
        placeholder="Escribe una nota clínica, observación o registro…"
        rows={3}
        className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white resize-none placeholder:text-gray-400"
      />
      {state && "error" in state && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Agregar nota
        </button>
      </div>
    </form>
  );
}
