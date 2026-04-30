import { getSession } from "@/lib/auth";
import { getPatient, getPatientNotes } from "@/lib/data";
import { redirect, notFound } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, CalendarDays, FileText, User } from "lucide-react";
import { NoteForm } from "./note-form";
import { DeleteNoteButton } from "./delete-note-button";

export default async function PatientNotesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const [patient, notes] = await Promise.all([
    getPatient(session.clinicId, id),
    getPatientNotes(session.clinicId, id),
  ]);

  if (!patient) notFound();

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back */}
      <Link
        href="/patients"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a pacientes
      </Link>

      {/* Patient card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-emerald-700">{patient.name.charAt(0)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900">{patient.name}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Paciente desde {format(new Date(patient.createdAt), "MMMM yyyy", { locale: es })}
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
              <span className="flex items-center gap-1.5 text-sm text-gray-600">
                <Phone className="w-3.5 h-3.5 text-gray-300" />
                {patient.phone}
              </span>
              {patient.email && (
                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                  <Mail className="w-3.5 h-3.5 text-gray-300" />
                  {patient.email}
                </span>
              )}
              {patient.birthDate && (
                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                  <CalendarDays className="w-3.5 h-3.5 text-gray-300" />
                  {format(new Date(patient.birthDate), "dd 'de' MMMM yyyy", { locale: es })}
                </span>
              )}
            </div>
          </div>
        </div>

        {patient.notes && (
          <div className="mt-4 pt-4 border-t border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Nota general</p>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{patient.notes}</p>
          </div>
        )}
      </div>

      {/* Notes section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
            Historial de notas
          </h2>
          <span className="ml-auto text-xs text-gray-400">{notes.length} {notes.length === 1 ? "registro" : "registros"}</span>
        </div>

        {/* Add note form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Nueva nota</p>
          <NoteForm patientId={patient.id} />
        </div>

        {/* Notes log */}
        {notes.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
            <User className="w-8 h-8 mx-auto mb-2 text-gray-200" />
            No hay notas registradas para este paciente.
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {note.content}
                    </p>
                  </div>
                  <DeleteNoteButton noteId={note.id} patientId={patient.id} />
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  {format(new Date(note.createdAt), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
