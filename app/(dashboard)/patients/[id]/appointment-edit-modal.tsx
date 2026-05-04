"use client";

import { useState, useEffect, useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, User, Stethoscope, Loader2 } from "lucide-react";
import { updateAppointment, cancelAppointment } from "@/app/actions/appointments";

export type AppointmentForEdit = {
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

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Programada",
  CONFIRMED: "Confirmada",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No asistió",
};

function toClinicLocal(utcDate: Date, clinicTzOffsetMin: number): Date {
  return new Date(utcDate.getTime() + clinicTzOffsetMin * 60000);
}

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

function useEscKey(onEsc: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onEsc(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onEsc]);
}

export function AppointmentEditModal({
  apt,
  canNotifyWhatsapp,
  clinicTzOffsetMin,
  onClose,
}: {
  apt: AppointmentForEdit;
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
              <input type="checkbox" name="notifyPatient" value="true" defaultChecked className="rounded accent-emerald-500" />
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
              <button type="button" onClick={() => setConfirmCancel(true)} className="text-sm text-red-400 hover:text-red-600 transition-colors">
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
                {canNotifyWhatsapp ? "Se enviará una notificación al paciente por WhatsApp." : "Esta acción no se puede deshacer."}
              </p>
              {cancelError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{cancelError}</p>
              )}
              {cancelWarning && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">{cancelWarning}</p>
              )}
              {cancelWarning ? (
                <button type="button" onClick={onClose} className="w-full border border-gray-200 text-sm text-gray-600 py-2 rounded-xl hover:bg-gray-50 transition-colors">
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
                    {cancelPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : canNotifyWhatsapp ? "Sí, cancelar y notificar" : "Sí, cancelar"}
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
