"use client";

import { useState, useTransition } from "react";
import { updatePatientNote, deletePatientNote } from "@/app/actions/patient-notes";
import { Pencil, Check, X, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ConfirmModal } from "@/components/confirm-modal";

type Note = {
  id: string;
  content: string;
  createdAt: Date;
};

export function NoteItem({ note, patientId }: { note: Note; patientId: string }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [value, setValue] = useState(note.content);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updatePatientNote(note.id, patientId, value);
      if ("success" in result) setEditing(false);
    });
  }

  function handleCancel() {
    setValue(note.content);
    setEditing(false);
  }

  function handleDelete() {
    startTransition(async () => { await deletePatientNote(note.id, patientId); });
  }

  return (
    <>
    <ConfirmModal
      open={confirmDelete}
      title="Eliminar nota"
      message="Esta acción no se puede deshacer. ¿Querés eliminar esta nota?"
      onConfirm={handleDelete}
      onClose={() => setConfirmDelete(false)}
    />
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 group">
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
            rows={4}
            className="w-full text-sm text-gray-800 rounded-xl border border-emerald-200 bg-emerald-50/30 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:opacity-50"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleCancel}
              disabled={pending}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              <X className="w-3 h-3" />
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={pending || !value.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-40"
            >
              <Check className="w-3 h-3" />
              {pending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {note.content}
            </p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => setEditing(true)}
              disabled={pending}
              title="Editar nota"
              className="p-1.5 rounded-lg text-gray-300 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={pending}
              title="Eliminar nota"
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
      <p className="text-xs text-gray-400 mt-3">
        {format(new Date(note.createdAt), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
      </p>
    </div>
    </>
  );
}
