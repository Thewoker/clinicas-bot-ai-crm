"use client";

import { useState, useTransition } from "react";
import { updatePatientNote } from "@/app/actions/patient-notes";
import { Pencil, Check, X } from "lucide-react";

export function EditNoteButton({
  noteId,
  patientId,
  content,
}: {
  noteId: string;
  patientId: string;
  content: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(content);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updatePatientNote(noteId, patientId, value);
      if ("success" in result) setEditing(false);
    });
  }

  function handleCancel() {
    setValue(content);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        title="Editar nota"
        className="p-1.5 rounded-lg text-gray-300 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <div className="w-full mt-2 space-y-2">
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
  );
}
