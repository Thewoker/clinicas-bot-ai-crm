"use client";

import { useState, useActionState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, X, User, Stethoscope, Loader2 } from "lucide-react";
import { createAppointment, updateAppointment, cancelAppointment } from "@/app/actions/appointments";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = "day" | "week" | "month" | "year";
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
  startTime: string;
  endTime: string;
  status: string;
  notes?: string;
  doctorName: string;
  doctorColor: string;
};
type CreateState = { doctorId: string; doctorName: string; startTime: string };

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Programada",
  CONFIRMED: "Confirmada",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No asistió",
};

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);
const SLOT_HEIGHT = 64;

// ─── UTC-safe date helpers ────────────────────────────────────────────────────

function toClinicLocal(utcDate: Date, off: number): Date {
  return new Date(utcDate.getTime() + off * 60000);
}

/** "YYYY-MM-DD" from UTC fields — used to group appointments by clinic-local day */
function utcDateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

function aptDateKey(apt: Appointment, off: number): string {
  return utcDateStr(toClinicLocal(new Date(apt.startTime), off));
}

/** parseISO("2026-04-30") → UTC midnight; keep UTC fields as the date identity */
function dayKey(date: Date): string {
  return utcDateStr(date);
}

function isTodayUTC(date: Date, off: number): boolean {
  const now = toClinicLocal(new Date(), off);
  return utcDateStr(now) === utcDateStr(date);
}

// UTC-safe navigation
function addUTCDays(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
}
function addUTCWeeks(d: Date, n: number): Date {
  return addUTCDays(d, n * 7);
}
function addUTCMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}
function addUTCYears(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear() + n, d.getUTCMonth(), 1));
}

function getWeekDays(date: Date): Date[] {
  const dow = date.getUTCDay(); // 0=Sun
  const toMon = dow === 0 ? -6 : 1 - dow;
  return Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + toMon + i))
  );
}

function getMonthDays(date: Date): Date[] {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(y, m, i + 1)));
}

function getMonthFirstDow(date: Date): number {
  const dow = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).getUTCDay();
  return (dow + 6) % 7; // 0=Mon
}

function getYearMonths(date: Date): Date[] {
  const y = date.getUTCFullYear();
  return Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(y, i, 1)));
}

function toDatetimeLocal(iso: string, off: number): string {
  const d = toClinicLocal(new Date(iso), off);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

function add30min(dt: string): string {
  const d = new Date(dt);
  d.setMinutes(d.getMinutes() + 30);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function aptPos(apt: Appointment, off: number) {
  const start = toClinicLocal(new Date(apt.startTime), off);
  const dur = (new Date(apt.endTime).getTime() - new Date(apt.startTime).getTime()) / 60000;
  const top = ((start.getUTCHours() * 60 + start.getUTCMinutes() - HOURS[0] * 60) / 60) * SLOT_HEIGHT;
  return { top, height: Math.max((dur / 60) * SLOT_HEIGHT, 28) };
}

function useEsc(fn: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") fn(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [fn]);
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
  useEsc(onClose);
  useEffect(() => { if (result && "success" in result) setTimeout(onClose, 700); }, [result]);

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
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form action={action} className="px-6 py-5 space-y-4">
          <input type="hidden" name="doctorId" value={cs.doctorId} />
          <div className="bg-gray-50 rounded-xl px-3 py-2.5 flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-gray-400 shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Médico</p>
              <p className="text-sm font-semibold text-gray-800">{cs.doctorName}</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Paciente *</label>
            <select
              name="patientId"
              required
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
            >
              <option value="">Seleccionar paciente...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.phone}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Servicio *</label>
            <input
              name="service"
              required
              placeholder="Ej: Consulta general"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Inicio *</label>
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
              <label className="block text-xs font-medium text-gray-700 mb-1">Fin *</label>
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
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Precio</label>
            <input
              type="number"
              name="price"
              min="0"
              step="0.01"
              defaultValue="0"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              name="notes"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
            />
          </div>
          {result && "error" in result && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{result.error}</p>
          )}
          {result && "success" in result && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{result.success}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
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
  off,
  onClose,
}: {
  apt: Appointment;
  canNotifyWhatsapp: boolean;
  off: number;
  onClose: () => void;
}) {
  const [result, action, pending] = useActionState(updateAppointment, null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelWarning, setCancelWarning] = useState<string | null>(null);
  const [cancelPending, startCancel] = useTransition();
  const [startTime, setStartTime] = useState(toDatetimeLocal(apt.startTime, off));
  const [endTime, setEndTime] = useState(toDatetimeLocal(apt.endTime, off));
  const router = useRouter();
  useEsc(onClose);
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
    startCancel(async () => {
      const res = await cancelAppointment(null, fd);
      if ("error" in res) {
        setCancelError(res.error);
      } else {
        router.refresh();
        if (res.notifyFailed) setCancelWarning(`Turno cancelado · Notificación no enviada: ${res.notifyFailed}`);
        else onClose();
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
        <div
          className="flex items-center justify-between px-6 py-4 rounded-t-2xl"
          style={{ backgroundColor: `${apt.doctorColor}15` }}
        >
          <div>
            <p className="text-xs text-gray-500">Editar turno</p>
            <h3 className="text-base font-bold text-gray-900">{apt.patientName}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-black/5 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form action={action} className="px-6 py-5 space-y-4">
          <input type="hidden" name="id" value={apt.id} />
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
            <User className="w-4 h-4 text-gray-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-gray-800">{apt.patientName}</p>
              <p className="text-xs text-gray-500">{apt.patientPhone}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
            <Stethoscope className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: apt.doctorColor }} />
              <p className="text-xs font-semibold text-gray-800">{apt.doctorName}</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Servicio</label>
            <input
              name="service"
              required
              defaultValue={apt.service}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Inicio</label>
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
              <label className="block text-xs font-medium text-gray-700 mb-1">Fin</label>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Precio</label>
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
              <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
              <select
                name="status"
                defaultValue={apt.status}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
              >
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              name="notes"
              rows={2}
              defaultValue={apt.notes ?? ""}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
            />
          </div>
          {canNotifyWhatsapp && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="notifyPatient" value="true" className="rounded accent-emerald-500" />
              <span className="text-xs text-gray-600">Notificar al paciente por WhatsApp</span>
            </label>
          )}
          {result && "error" in result && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{result.error}</p>
          )}
          {result && "success" in result && (
            <div className="space-y-1.5">
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{result.success}</p>
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
              <p className="text-sm font-medium text-gray-800 mb-1">¿Cancelar este turno?</p>
              <p className="text-xs text-gray-400 mb-3">
                {canNotifyWhatsapp
                  ? "Se enviará una notificación al paciente por WhatsApp."
                  : "Esta acción no se puede deshacer."}
              </p>
              {cancelError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{cancelError}</p>
              )}
              {cancelWarning && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">{cancelWarning}</p>
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

// ─── Time Grid (Day / Week) ───────────────────────────────────────────────────

function TimeGrid({
  days,
  appointments,
  doctor,
  off,
  onSlotClick,
  onAptClick,
}: {
  days: Date[];
  appointments: Appointment[];
  doctor: Doctor;
  off: number;
  onSlotClick: (day: Date, hour: number, minute: number) => void;
  onAptClick: (apt: Appointment) => void;
}) {
  const isWeek = days.length > 1;

  return (
    <div className="min-h-0 flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-auto">
      <div className="min-w-max">
        {/* Header */}
        <div className="flex border-b border-gray-100 sticky top-0 bg-white z-10" style={{ paddingLeft: 56 }}>
          {days.map((day) => (
            <div
              key={dayKey(day)}
              className="flex-1 min-w-32 px-3 py-3 border-l border-gray-50 first:border-l-0 text-center"
            >
              <p
                className={`text-xs font-semibold capitalize ${
                  isTodayUTC(day, off) ? "text-emerald-600" : "text-gray-800"
                }`}
              >
                {isWeek
                  ? format(day, "EEE d", { locale: es })
                  : format(day, "EEEE d MMMM", { locale: es })}
              </p>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex">
          {/* Hour labels */}
          <div className="w-14 shrink-0 border-r border-gray-50">
            {HOURS.map((h) => (
              <div
                key={h}
                className="flex items-start justify-end pr-2 text-xs text-gray-300 font-medium"
                style={{ height: SLOT_HEIGHT }}
              >
                <span className="-mt-2">{String(h).padStart(2, "0")}:00</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const key = dayKey(day);
            const dayApts = appointments.filter((a) => aptDateKey(a, off) === key);

            return (
              <div
                key={key}
                className="flex-1 min-w-32 border-l border-gray-50 relative cursor-crosshair"
                style={{ height: SLOT_HEIGHT * HOURS.length }}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("[data-apt]")) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = Math.max(0, e.clientY - rect.top);
                  const totalMin = Math.floor((y / SLOT_HEIGHT) * 60);
                  const hour = Math.min(Math.floor(totalMin / 60) + HOURS[0], HOURS[HOURS.length - 1]);
                  const minute = Math.floor((totalMin % 60) / 30) * 30;
                  onSlotClick(day, hour, minute);
                }}
              >
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-gray-50"
                    style={{ top: (h - HOURS[0]) * SLOT_HEIGHT }}
                  />
                ))}
                {HOURS.map((h) => (
                  <div
                    key={`${h}-h`}
                    className="absolute left-0 right-0 border-t border-gray-100 border-dashed"
                    style={{ top: (h - HOURS[0]) * SLOT_HEIGHT + SLOT_HEIGHT / 2 }}
                  />
                ))}
                {dayApts.map((apt) => {
                  const { top, height } = aptPos(apt, off);
                  const startLocal = toClinicLocal(new Date(apt.startTime), off);
                  const p = (n: number) => String(n).padStart(2, "0");
                  const timeStr = `${p(startLocal.getUTCHours())}:${p(startLocal.getUTCMinutes())}`;
                  return (
                    <button
                      key={apt.id}
                      data-apt="true"
                      onClick={(e) => { e.stopPropagation(); onAptClick(apt); }}
                      className="absolute left-1 right-1 rounded-lg px-2 py-1 text-left overflow-hidden hover:opacity-90 active:scale-[0.98] transition-all shadow-sm border"
                      style={{ top, height, backgroundColor: `${doctor.color}18`, borderColor: `${doctor.color}40` }}
                    >
                      <p className="text-xs font-semibold truncate leading-tight" style={{ color: doctor.color }}>
                        {apt.patientName}
                      </p>
                      {height > 40 && (
                        <p className="text-xs text-gray-500 truncate leading-tight">
                          {timeStr} · {apt.service}
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
    </div>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({
  date,
  appointments,
  doctor,
  off,
  onAptClick,
  onDayClick,
}: {
  date: Date;
  appointments: Appointment[];
  doctor: Doctor;
  off: number;
  onAptClick: (apt: Appointment) => void;
  onDayClick: (day: Date) => void;
}) {
  const days = getMonthDays(date);
  const firstDow = getMonthFirstDow(date);

  return (
    <div className="min-h-0 flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-auto">
      <div className="grid grid-cols-7 border-b border-gray-100 shrink-0">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1">
        {Array.from({ length: firstDow }).map((_, i) => (
          <div key={`e-${i}`} className="border-b border-r border-gray-50 min-h-24 bg-gray-50/40" />
        ))}
        {days.map((day) => {
          const key = dayKey(day);
          const dayApts = appointments.filter((a) => aptDateKey(a, off) === key);
          const today = isTodayUTC(day, off);

          return (
            <div
              key={key}
              className="border-b border-r border-gray-50 min-h-24 p-1.5 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("[data-apt]")) return;
                onDayClick(day);
              }}
            >
              <span
                className={`inline-flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-full mb-1 ${
                  today ? "bg-emerald-500 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {day.getUTCDate()}
              </span>
              <div className="space-y-0.5">
                {dayApts.slice(0, 3).map((apt) => {
                  const sl = toClinicLocal(new Date(apt.startTime), off);
                  const p = (n: number) => String(n).padStart(2, "0");
                  return (
                    <button
                      key={apt.id}
                      data-apt="true"
                      onClick={(e) => { e.stopPropagation(); onAptClick(apt); }}
                      className="w-full text-left text-xs rounded px-1.5 py-0.5 truncate leading-tight"
                      style={{ backgroundColor: `${doctor.color}18`, color: doctor.color }}
                    >
                      {p(sl.getUTCHours())}:{p(sl.getUTCMinutes())} {apt.patientName}
                    </button>
                  );
                })}
                {dayApts.length > 3 && (
                  <p className="text-[10px] text-gray-400 pl-1">+{dayApts.length - 3} más</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Year View ────────────────────────────────────────────────────────────────

function YearView({
  date,
  appointments,
  doctor,
  off,
  onMonthClick,
}: {
  date: Date;
  appointments: Appointment[];
  doctor: Doctor;
  off: number;
  onMonthClick: (month: Date) => void;
}) {
  const months = getYearMonths(date);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
        {months.map((monthDate) => {
          const days = getMonthDays(monthDate);
          const firstDow = getMonthFirstDow(monthDate);
          const aptDays = new Set(
            appointments
              .filter((a) => {
                const d = toClinicLocal(new Date(a.startTime), off);
                return d.getUTCFullYear() === monthDate.getUTCFullYear() &&
                       d.getUTCMonth() === monthDate.getUTCMonth();
              })
              .map((a) => toClinicLocal(new Date(a.startTime), off).getUTCDate())
          );

          return (
            <div
              key={monthDate.toISOString()}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all"
              onClick={() => onMonthClick(monthDate)}
            >
              <p className="text-xs font-bold text-gray-700 mb-2 capitalize">
                {format(monthDate, "MMMM", { locale: es })}
              </p>
              <div className="grid grid-cols-7">
                {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
                  <div key={d} className="text-center text-[9px] text-gray-300 pb-0.5">{d}</div>
                ))}
                {Array.from({ length: firstDow }).map((_, i) => (
                  <div key={`e-${i}`} />
                ))}
                {days.map((day) => {
                  const hasApt = aptDays.has(day.getUTCDate());
                  const today = isTodayUTC(day, off);
                  return (
                    <div key={day.getUTCDate()} className="flex items-center justify-center py-0.5">
                      <span
                        className="text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-medium"
                        style={
                          today
                            ? { backgroundColor: "#10b981", color: "#fff" }
                            : hasApt
                            ? { backgroundColor: doctor.color, color: "#fff" }
                            : { color: "#9ca3af" }
                        }
                      >
                        {day.getUTCDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] text-gray-400">
                {aptDays.size === 0
                  ? "Sin turnos"
                  : `${aptDays.size} día${aptDays.size !== 1 ? "s" : ""} con turno${aptDays.size !== 1 ? "s" : ""}`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DoctorCalendar({
  doctors,
  appointments,
  patients,
  canNotifyWhatsapp,
  currentDate,
  clinicTzOffsetMin: off,
  initialMode,
  initialDoctorId,
}: {
  doctors: Doctor[];
  appointments: Appointment[];
  patients: Patient[];
  canNotifyWhatsapp: boolean;
  currentDate: string;
  clinicTzOffsetMin: number;
  initialMode: Mode;
  initialDoctorId: string | null;
}) {
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [creating, setCreating] = useState<CreateState | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const mode = (searchParams.get("mode") as Mode) ?? initialMode;
  const doctorId = searchParams.get("doctorId") ?? initialDoctorId ?? doctors[0]?.id ?? "";
  const dateStr = searchParams.get("date") ?? format(parseISO(currentDate), "yyyy-MM-dd");
  const date = parseISO(dateStr); // UTC midnight

  const doctor = doctors.find((d) => d.id === doctorId) ?? doctors[0] ?? null;
  const docApts = appointments.filter((a) => a.doctorId === (doctor?.id ?? ""));

  function nav(params: Record<string, string>) {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(params)) p.set(k, v);
    router.push(`/calendar?${p.toString()}`);
  }

  function navigateDate(delta: number) {
    let newDate: Date;
    switch (mode) {
      case "year":  newDate = addUTCYears(date, delta);  break;
      case "month": newDate = addUTCMonths(date, delta); break;
      case "week":  newDate = addUTCWeeks(date, delta);  break;
      default:      newDate = addUTCDays(date, delta);   break;
    }
    nav({ date: utcDateStr(newDate) });
  }

  function handleSlotClick(day: Date, hour: number, minute: number) {
    if (!doctor) return;
    const p = (n: number) => String(n).padStart(2, "0");
    nav({ mode: "day", date: dayKey(day) });
    setCreating({
      doctorId: doctor.id,
      doctorName: doctor.name,
      startTime: `${dayKey(day)}T${p(hour)}:${p(minute)}`,
    });
  }

  function handleDayClick(day: Date) {
    nav({ mode: "day", date: dayKey(day) });
  }

  function handleMonthClick(month: Date) {
    nav({ mode: "month", date: dayKey(month) });
  }

  // Date range label for nav bar
  let dateLabel = "";
  switch (mode) {
    case "year":
      dateLabel = String(date.getUTCFullYear());
      break;
    case "month":
      dateLabel = format(date, "MMMM yyyy", { locale: es });
      break;
    case "week": {
      const wd = getWeekDays(date);
      dateLabel = `${format(wd[0], "d MMM", { locale: es })} – ${format(wd[6], "d MMM yyyy", { locale: es })}`;
      break;
    }
    case "day":
      dateLabel = format(date, "EEEE, d MMMM yyyy", { locale: es });
      break;
  }

  const weekDays = getWeekDays(date);

  if (!doctor) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No hay médicos registrados para esta clínica.
      </div>
    );
  }

  return (
    <>
      {/* Controls */}
      <div className="shrink-0 flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
        {/* Doctor selector */}
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: doctor.color }} />
          <select
            value={doctorId}
            onChange={(e) => nav({ doctorId: e.target.value })}
            className="text-sm font-medium border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Mode tabs */}
        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
          {(["year", "month", "week", "day"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => nav({ mode: m })}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                mode === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {m === "year" ? "Año" : m === "month" ? "Mes" : m === "week" ? "Semana" : "Día"}
            </button>
          ))}
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => navigateDate(-1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-gray-800 text-center capitalize min-w-44">
            {dateLabel}
          </span>
          <button
            onClick={() => navigateDate(1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Appointment count */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: doctor.color }} />
          {docApts.length} cita{docApts.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Views */}
      {(mode === "day" || mode === "week") && (
        <TimeGrid
          days={mode === "week" ? weekDays : [date]}
          appointments={docApts}
          doctor={doctor}
          off={off}
          onSlotClick={handleSlotClick}
          onAptClick={setEditing}
        />
      )}

      {mode === "month" && (
        <MonthView
          date={date}
          appointments={docApts}
          doctor={doctor}
          off={off}
          onAptClick={setEditing}
          onDayClick={handleDayClick}
        />
      )}

      {mode === "year" && (
        <YearView
          date={date}
          appointments={docApts}
          doctor={doctor}
          off={off}
          onMonthClick={handleMonthClick}
        />
      )}

      {/* Modals */}
      {creating && (
        <CreateModal cs={creating} patients={patients} onClose={() => setCreating(null)} />
      )}
      {editing && (
        <EditModal
          apt={editing}
          canNotifyWhatsapp={canNotifyWhatsapp}
          off={off}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
