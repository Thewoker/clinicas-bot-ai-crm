"use client";

import { useState, useActionState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, addDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  X,
  User,
  Stethoscope,
  Loader2,
} from "lucide-react";
import { createAppointment, updateAppointment, cancelAppointment } from "@/app/actions/appointments";

// ─── Types ────────────────────────────────────────────────────────────────────

type Doctor = { id: string; name: string; specialty: string; color: string };
type Patient = { id: string; name: string; phone: string };
type Appointment = {
  id: string;
  doctorId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  service: string;
  price: number;
  startTime: string; // ISO
  endTime: string;   // ISO
  status: string;
  notes?: string;
  doctorName: string;
  doctorColor: string;
};
type CreateState = {
  doctorId: string;
  doctorName: string;
  startTime: string; // "YYYY-MM-DDTHH:mm"
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Programada",
  CONFIRMED: "Confirmada",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No asistió",
};

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00–20:00
const SLOT_HEIGHT = 64; // px per hour

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Shift a UTC date by the clinic's UTC offset so that getUTC* fields
 * return the clinic-local time.
 * e.g. 11:00 UTC + clinicTzOffsetMin=+120 → fake Date whose getUTCHours()=13
 */
function toClinicLocal(utcDate: Date, clinicTzOffsetMin: number): Date {
  return new Date(utcDate.getTime() + clinicTzOffsetMin * 60000);
}

/** ISO → "YYYY-MM-DDTHH:mm" in clinic timezone (for datetime-local inputs) */
function toDatetimeLocal(isoStr: string, clinicTzOffsetMin: number): string {
  const d = toClinicLocal(new Date(isoStr), clinicTzOffsetMin);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function add30min(dtLocal: string): string {
  const d = new Date(dtLocal);
  d.setMinutes(d.getMinutes() + 30);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function aptStyle(apt: Appointment, clinicTzOffsetMin: number) {
  const start = toClinicLocal(new Date(apt.startTime), clinicTzOffsetMin);
  const end = new Date(apt.endTime);
  const startMinutes =
    start.getUTCHours() * 60 + start.getUTCMinutes() - HOURS[0] * 60;
  const durationMinutes = (end.getTime() - new Date(apt.startTime).getTime()) / 60000;
  return {
    top: (startMinutes / 60) * SLOT_HEIGHT,
    height: Math.max((durationMinutes / 60) * SLOT_HEIGHT, 28),
  };
}

function useEscKey(onEsc: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEsc();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onEsc]);
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateModal({
  cs,
  patients,
  onClose,
}: {
  cs: CreateState;
  patients: Patient[];
  onClose: () => void;
}) {
  const [result, action, pending] = useActionState(createAppointment, null);
  const [startTime, setStartTime] = useState(cs.startTime);
  const [endTime, setEndTime] = useState(add30min(cs.startTime));
  useEscKey(onClose);

  useEffect(() => {
    if (result && "success" in result) setTimeout(onClose, 700);
  }, [result]);

  function handleStartChange(val: string) {
    setStartTime(val);
    if (val >= endTime) setEndTime(add30min(val));
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">Nuevo turno</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form action={action} className="px-6 py-5 space-y-4">
          <input type="hidden" name="doctorId" value={cs.doctorId} />

          {/* Doctor (read-only) */}
          <div className="bg-gray-50 rounded-xl px-3 py-2.5 flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-gray-400 shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Médico</p>
              <p className="text-sm font-semibold text-gray-800">{cs.doctorName}</p>
            </div>
          </div>

          {/* Patient */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Paciente *
            </label>
            <select
              name="patientId"
              required
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
            >
              <option value="">Seleccionar paciente...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.phone}
                </option>
              ))}
            </select>
          </div>

          {/* Service */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Servicio *
            </label>
            <input
              name="service"
              required
              placeholder="Ej: Consulta general"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>

          {/* Start / End */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Inicio *
              </label>
              <input
                type="datetime-local"
                name="startTime"
                required
                value={startTime}
                onChange={(e) => handleStartChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Fin *
              </label>
              <input
                type="datetime-local"
                name="endTime"
                required
                min={startTime}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Precio
            </label>
            <input
              type="number"
              name="price"
              min="0"
              step="0.01"
              defaultValue="0"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Notas
            </label>
            <textarea
              name="notes"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
            />
          </div>

          {result && "error" in result && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {result.error}
            </p>
          )}
          {result && "success" in result && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {result.success}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Crear turno
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({
  apt,
  canNotifyWhatsapp,
  clinicTzOffsetMin,
  onClose,
}: {
  apt: Appointment;
  canNotifyWhatsapp: boolean;
  clinicTzOffsetMin: number;
  onClose: () => void;
}) {
  const [result, action, pending] = useActionState(updateAppointment, null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelWarning, setCancelWarning] = useState<string | null>(null);
  const [cancelPending, startCancelTransition] = useTransition();
  const [startTime, setStartTime] = useState(toDatetimeLocal(apt.startTime, clinicTzOffsetMin));
  const [endTime, setEndTime] = useState(toDatetimeLocal(apt.endTime, clinicTzOffsetMin));
  const router = useRouter();
  useEscKey(onClose);

  useEffect(() => {
    if (result && "success" in result && !result.notifyFailed) setTimeout(onClose, 700);
  }, [result]);

  function handleStartChange(val: string) {
    setStartTime(val);
    if (val >= endTime) setEndTime(add30min(val));
  }

  function handleCancel() {
    const fd = new FormData();
    fd.append("id", apt.id);
    if (canNotifyWhatsapp) fd.append("notifyPatient", "true");
    startCancelTransition(async () => {
      const res = await cancelAppointment(null, fd);
      if ("error" in res) {
        setCancelError(res.error);
      } else {
        router.refresh();
        if (res.notifyFailed) {
          setCancelWarning(`Turno cancelado · Notificación no enviada: ${res.notifyFailed}`);
        } else {
          onClose();
        }
      }
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 rounded-t-2xl"
          style={{ backgroundColor: `${apt.doctorColor}15` }}
        >
          <div>
            <p className="text-xs text-gray-500">Editar turno</p>
            <h3 className="text-base font-bold text-gray-900">{apt.patientName}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-black/5 text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Edit form */}
        <form action={action} className="px-6 py-5 space-y-4">
          <input type="hidden" name="id" value={apt.id} />

          {/* Patient (read-only) */}
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
            <User className="w-4 h-4 text-gray-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-gray-800">{apt.patientName}</p>
              <p className="text-xs text-gray-500">{apt.patientPhone}</p>
            </div>
          </div>

          {/* Doctor (read-only) */}
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
            <Stethoscope className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full inline-block shrink-0"
                style={{ backgroundColor: apt.doctorColor }}
              />
              <p className="text-xs font-semibold text-gray-800">{apt.doctorName}</p>
            </div>
          </div>

          {/* Service */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Servicio
            </label>
            <input
              name="service"
              required
              defaultValue={apt.service}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>

          {/* Start / End */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Inicio
              </label>
              <input
                type="datetime-local"
                name="startTime"
                required
                value={startTime}
                onChange={(e) => handleStartChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Fin
              </label>
              <input
                type="datetime-local"
                name="endTime"
                required
                min={startTime}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
          </div>

          {/* Price & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Precio
              </label>
              <input
                type="number"
                name="price"
                min="0"
                step="0.01"
                defaultValue={apt.price}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                name="status"
                defaultValue={apt.status}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
              >
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Notas
            </label>
            <textarea
              name="notes"
              rows={2}
              defaultValue={apt.notes ?? ""}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
            />
          </div>

          {/* Notify via WhatsApp */}
          {canNotifyWhatsapp && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="notifyPatient"
                value="true"
                className="rounded accent-emerald-500"
              />
              <span className="text-xs text-gray-600">
                Notificar al paciente por WhatsApp
              </span>
            </label>
          )}

          {result && "error" in result && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {result.error}
            </p>
          )}
          {result && "success" in result && (
            <div className="space-y-1.5">
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                {result.success}
              </p>
              {result.notifyFailed && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Notificación no enviada: {result.notifyFailed}
                </p>
              )}
            </div>
          )}

          {!confirmCancel ? (
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="text-sm text-red-400 hover:text-red-600 transition-colors"
              >
                Cancelar turno
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Guardar cambios
              </button>
            </div>
          ) : (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-800 mb-1">
                ¿Cancelar este turno?
              </p>
              <p className="text-xs text-gray-400 mb-3">
                {canNotifyWhatsapp
                  ? "Se enviará una notificación al paciente por WhatsApp."
                  : "Esta acción no se puede deshacer."}
              </p>
              {cancelError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                  {cancelError}
                </p>
              )}
              {cancelWarning && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                  {cancelWarning}
                </p>
              )}
              {cancelWarning ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full border border-gray-200 text-sm text-gray-600 py-2 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cerrar
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={cancelPending}
                    onClick={handleCancel}
                    className="flex-1 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2 rounded-xl transition-colors disabled:opacity-60"
                  >
                    {cancelPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : canNotifyWhatsapp ? (
                      "Sí, cancelar y notificar"
                    ) : (
                      "Sí, cancelar"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(false)}
                    className="flex-1 border border-gray-200 text-sm text-gray-600 py-2 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// ─── Calendar Grid ────────────────────────────────────────────────────────────

export function CalendarGrid({
  doctors,
  appointments,
  patients,
  canNotifyWhatsapp,
  currentDate,
  clinicTzOffsetMin,
}: {
  doctors: Doctor[];
  appointments: Appointment[];
  patients: Patient[];
  canNotifyWhatsapp: boolean;
  currentDate: string;
  clinicTzOffsetMin: number;
}) {
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [creating, setCreating] = useState<CreateState | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const displayDateStr =
    searchParams.get("date") ?? format(parseISO(currentDate), "yyyy-MM-dd");
  const date = parseISO(displayDateStr);

  function navigate(delta: number) {
    const newDate = addDays(date, delta);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", format(newDate, "yyyy-MM-dd"));
    router.push(`/calendar?${params.toString()}`);
  }

  function handleColumnClick(
    e: React.MouseEvent<HTMLDivElement>,
    doc: Doctor
  ) {
    // Don't trigger when clicking on an appointment
    if ((e.target as HTMLElement).closest("[data-apt]")) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = Math.max(0, e.clientY - rect.top);
    const totalMinutes = Math.floor((y / SLOT_HEIGHT) * 60);
    let hour = Math.floor(totalMinutes / 60) + HOURS[0];
    const minute = Math.floor((totalMinutes % 60) / 30) * 30;
    hour = Math.min(hour, HOURS[HOURS.length - 1]);

    const pad = (n: number) => String(n).padStart(2, "0");
    const startTime = `${displayDateStr}T${pad(hour)}:${pad(minute)}`;

    setCreating({ doctorId: doc.id, doctorName: doc.name, startTime });
  }

  return (
    <>
      {/* Date navigation */}
      <div className="shrink-0 flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-gray-800 min-w-52 text-center capitalize">
          {format(date, "EEEE, d MMMM yyyy", { locale: es })}
        </span>
        <button
          onClick={() => navigate(1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="ml-auto flex items-center gap-2 text-xs text-gray-400">
          <div className="w-2 h-2 bg-emerald-400 rounded-full" />
          {appointments.length} cita{appointments.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Grid — min-h-0 is critical for overflow-auto to work inside flex-1 */}
      <div className="min-h-0 flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-auto">
        {doctors.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
            No hay médicos registrados para esta clínica.
          </div>
        ) : (
          <div className="min-w-max">
            {/* Sticky header — doctor columns */}
            <div
              className="flex border-b border-gray-100 sticky top-0 bg-white z-10"
              style={{ paddingLeft: 56 }}
            >
              {doctors.map((doc) => (
                <div
                  key={doc.id}
                  className="flex-1 min-w-44 px-4 py-3 border-l border-gray-50 first:border-l-0"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: doc.color }}
                    />
                    <div>
                      <p className="text-xs font-semibold text-gray-800 truncate">
                        {doc.name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {doc.specialty}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Body */}
            <div className="flex">
              {/* Time column */}
              <div className="w-14 shrink-0 border-r border-gray-50">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="flex items-start justify-end pr-2 text-xs text-gray-300 font-medium"
                    style={{ height: SLOT_HEIGHT }}
                  >
                    <span className="-mt-2">
                      {String(h).padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
              </div>

              {/* Doctor columns */}
              {doctors.map((doc) => {
                const docApts = appointments.filter(
                  (a) => a.doctorId === doc.id
                );
                return (
                  <div
                    key={doc.id}
                    className="flex-1 min-w-44 border-l border-gray-50 relative cursor-crosshair"
                    style={{ height: SLOT_HEIGHT * HOURS.length }}
                    onClick={(e) => handleColumnClick(e, doc)}
                  >
                    {/* Hour lines */}
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        className="absolute left-0 right-0 border-t border-gray-50"
                        style={{ top: (h - HOURS[0]) * SLOT_HEIGHT }}
                      />
                    ))}
                    {/* Half-hour dashed lines */}
                    {HOURS.map((h) => (
                      <div
                        key={`${h}-half`}
                        className="absolute left-0 right-0 border-t border-gray-100 border-dashed"
                        style={{
                          top: (h - HOURS[0]) * SLOT_HEIGHT + SLOT_HEIGHT / 2,
                        }}
                      />
                    ))}

                    {/* Appointments */}
                    {docApts.map((apt) => {
                      const { top, height } = aptStyle(apt, clinicTzOffsetMin);
                      return (
                        <button
                          key={apt.id}
                          data-apt="true"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(apt);
                          }}
                          className="absolute left-1.5 right-1.5 rounded-lg px-2 py-1 text-left overflow-hidden hover:opacity-90 active:scale-[0.98] transition-all shadow-sm border"
                          style={{
                            top,
                            height,
                            backgroundColor: `${doc.color}18`,
                            borderColor: `${doc.color}40`,
                          }}
                        >
                          <p
                            className="text-xs font-semibold truncate leading-tight"
                            style={{ color: doc.color }}
                          >
                            {apt.patientName}
                          </p>
                          {height > 40 && (
                            <p className="text-xs text-gray-500 truncate leading-tight">
                              {apt.service}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {creating && (
        <CreateModal
          cs={creating}
          patients={patients}
          onClose={() => setCreating(null)}
        />
      )}
      {editing && (
        <EditModal
          apt={editing}
          canNotifyWhatsapp={canNotifyWhatsapp}
          clinicTzOffsetMin={clinicTzOffsetMin}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
