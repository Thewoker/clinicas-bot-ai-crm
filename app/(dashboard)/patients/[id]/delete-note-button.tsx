"use client";

import { useState, useTransition } from "react";
import { deletePatientNote } from "@/app/actions/patient-notes";
import { Trash2 } from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";

export function DeleteNoteButton({ noteId, patientId }: { noteId: string; patientId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => { await deletePatientNote(noteId, patientId); });
  }

  return (
    <>
      <ConfirmModal
        open={open}
        title="Eliminar nota"
        message="Esta acción no se puede deshacer. ¿Querés eliminar esta nota?"
        onConfirm={handleDelete}
        onClose={() => setOpen(false)}
      />
      <button
        onClick={() => setOpen(true)}
        disabled={pending}
        title="Eliminar nota"
        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </>
  );
}
