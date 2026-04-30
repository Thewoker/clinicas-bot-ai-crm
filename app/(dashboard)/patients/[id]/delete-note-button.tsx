"use client";

import { useTransition } from "react";
import { deletePatientNote } from "@/app/actions/patient-notes";
import { Trash2 } from "lucide-react";

export function DeleteNoteButton({ noteId, patientId }: { noteId: string; patientId: string }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("¿Eliminar esta nota? Esta acción no se puede deshacer.")) return;
    startTransition(async () => { await deletePatientNote(noteId, patientId); });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      title="Eliminar nota"
      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}
