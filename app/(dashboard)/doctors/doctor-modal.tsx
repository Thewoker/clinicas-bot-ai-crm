"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createDoctor,
  updateDoctor,
  deleteDoctor,
  saveAvailability,
  saveBreaks,
} from "@/app/actions/doctors";
import { Loader2, X, Stethoscope, Clock, Plus, Trash2 } from "lucide-react";

type Availability = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type Break = {
  id: string;
  dayOfWeek: number | null;
  startTime: string;
  duration: number;
};

type Doctor = {
  id: string;
  name: string;
  specialty: string;
  email: string;
  phone: string | null;
  color: string;
  availability: Availability[];
  breaks: Break[];
};

interface Props {
  doctor?: Doctor;
  onClose: () => void;
}

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#ef4444", "#f97316", "#06b6d4", "#84cc16",
];

// Mon–Sun display order
const DAYS = [
  { day: 1, label: "Lunes" },
  { day: 2, label: "Martes" },
  { day: 3, label: "Miércoles" },
  { day: 4, label: "Jueves" },
  { day: 5, label: "Viernes" },
  { day: 6, label: "Sábado" },
  { day: 0, label: "Domingo" },
];

const DAY_OPTIONS = [
  { value: "all", label: "Todos los días" },
  { value: "1", label: "Lunes" },
  { value: "2", label: "Martes" },
  { value: "3", label: "Miércoles" },
  { value: "4", label: "Jueves" },
  { value: "5", label: "Viernes" },
  { value: "6", label: "Sábado" },
  { value: "0", label: "Domingo" },
];

const DURATION_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 20, label: "20 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 hora" },
  { value: 90, label: "1 h 30 min" },
  { value: 120, label: "2 horas" },
];

// 00:00 → 23:30 in 30-min steps
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

type DayState = { enabled: boolean; startTime: string; endTime: string };
type BreakEntry = { dayOfWeek: string; startTime: string; duration: number };

function buildDayState(availability: Availability[]): Record<number, DayState> {
  const map: Record<number, DayState> = {};
  for (const d of [0, 1, 2, 3, 4, 5, 6]) {
    const found = availability.find((a) => a.dayOfWeek === d);
    map[d] = found
      ? { enabled: true, startTime: found.startTime, endTime: found.endTime }
      : { enabled: false, startTime: "09:00", endTime: "18:00" };
  }
  return map;
}

function buildBreakEntries(breaks: Break[]): BreakEntry[] {
  return breaks.map((b) => ({
    dayOfWeek: b.dayOfWeek === null ? "all" : String(b.dayOfWeek),
    startTime: b.startTime,
    duration: b.duration,
  }));
}

export function DoctorModal({ doctor, onClose }: Props) {
  const router = useRouter();
  const isEdit = !!doctor;
  const [tab, setTab] = useState<"info" | "horarios">("info");
  const [color, setColor] = useState(doctor?.color ?? COLORS[0]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dayState, setDayState] = useState<Record<number, DayState>>(
    () => buildDayState(doctor?.availability ?? [])
  );
  const [breakEntries, setBreakEntries] = useState<BreakEntry[]>(
    () => buildBreakEntries(doctor?.breaks ?? [])
  );

  const [createState, createAction, createPending] = useActionState(createDoctor, null);
  const [editState, editAction, editPending] = useActionState(updateDoctor, null);
  const [delState, delAction, delPending] = useActionState(deleteDoctor, null);
  const [availState, availAction, availPending] = useActionState(saveAvailability, null);
  const [breaksState, breaksAction, breaksPending] = useActionState(saveBreaks, null);

  const infoState = isEdit ? editState : createState;
  const infoAction = isEdit ? editAction : createAction;
  const infoPending = isEdit ? editPending : createPending;

  useEffect(() => {
    if (infoState && "success" in infoState) {
      router.refresh();
      setTimeout(onClose, 700);
    }
  }, [infoState]);

  useEffect(() => {
    if (delState && "success" in delState) {
      router.refresh();
      setTimeout(onClose, 700);
    }
  }, [delState]);

  useEffect(() => {
    if (availState && "success" in availState) router.refresh();
  }, [availState]);

  useEffect(() => {
    if (breaksState && "success" in breaksState) router.refresh();
  }, [breaksState]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const toggleDay = (day: number, enabled: boolean) =>
    setDayState((s) => ({ ...s, [day]: { ...s[day], enabled } }));

  const setTime = (day: number, field: "startTime" | "endTime", value: string) =>
    setDayState((s) => ({ ...s, [day]: { ...s[day], [field]: value } }));

  const addBreak = () =>
    setBreakEntries((prev) => [...prev, { dayOfWeek: "all", startTime: "12:00", duration: 30 }]);

  const removeBreak = (index: number) =>
    setBreakEntries((prev) => prev.filter((_, i) => i !== index));

  const updateBreak = (index: number, field: keyof BreakEntry, value: string | number) =>
    setBreakEntries((prev) =>
      prev.map((b, i) => (i === index ? { ...b, [field]: value } : b))
    );

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: color }}
            >
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-base font-bold text-gray-900">
              {isEdit ? doctor.name : "Nuevo médico"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3 shrink-0">
          <button
            type="button"
            onClick={() => setTab("info")}
            className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition-colors ${
              tab === "info"
                ? "bg-gray-100 text-gray-900"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Información
          </button>
          <button
            type="button"
            onClick={() => setTab("horarios")}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded-lg transition-colors ${
              tab === "horarios"
                ? "bg-gray-100 text-gray-900"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Horarios
          </button>
        </div>

        {/* Tab: Información */}
        {tab === "info" && (
          <>
            <form action={infoAction} className="p-6 space-y-4 overflow-y-auto">
              {isEdit && <input type="hidden" name="id" value={doctor.id} />}
              <input type="hidden" name="color" value={color} />

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Nombre completo <span className="text-red-400">*</span>
                </label>
                <input
                  name="name"
                  required
                  defaultValue={doctor?.name}
                  placeholder="Dra. María García"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Especialidad <span className="text-red-400">*</span>
                </label>
                <input
                  name="specialty"
                  required
                  defaultValue={doctor?.specialty}
                  placeholder="Medicina General"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    name="email"
                    type="email"
                    required
                    defaultValue={doctor?.email}
                    placeholder="dr@clinica.com"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
                  <input
                    name="phone"
                    defaultValue={doctor?.phone ?? ""}
                    placeholder="+34 91 000 00 00"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Color en el calendario
                </label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="w-7 h-7 rounded-full transition-transform hover:scale-110 shrink-0"
                      style={{
                        backgroundColor: c,
                        outline: color === c ? `3px solid ${c}` : "none",
                        outlineOffset: "2px",
                      }}
                    />
                  ))}
                </div>
              </div>

              {infoState && "error" in infoState && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {infoState.error}
                </p>
              )}
              {infoState && "success" in infoState && (
                <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  {infoState.success}
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
                  disabled={infoPending}
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
                >
                  {infoPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isEdit ? "Guardar cambios" : "Crear médico"}
                </button>
              </div>
            </form>

            {/* Delete — separate form, not nested */}
            {isEdit && (
              <div className="px-6 pb-5 border-t border-gray-100 pt-4 shrink-0">
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="text-sm text-red-400 hover:text-red-600 transition-colors"
                  >
                    Eliminar médico
                  </button>
                ) : (
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-sm text-gray-600">¿Confirmar eliminación?</p>
                    <form action={delAction}>
                      <input type="hidden" name="id" value={doctor.id} />
                      <button
                        type="submit"
                        disabled={delPending}
                        className="flex items-center gap-1.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                      >
                        {delPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Sí, eliminar
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="text-sm text-gray-400 hover:text-gray-600"
                    >
                      Cancelar
                    </button>
                    {delState && "error" in delState && (
                      <p className="text-sm text-red-600">{delState.error}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Tab: Horarios */}
        {tab === "horarios" && (
          <>
            {!isEdit ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                <Clock className="w-8 h-8 mx-auto mb-3 text-gray-200" />
                Crea el médico primero para poder configurar sus horarios.
              </div>
            ) : (
              <div className="overflow-y-auto">
                {/* Horarios de atención */}
                <form action={availAction} className="p-6 space-y-3">
                  <input type="hidden" name="doctorId" value={doctor.id} />

                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Horarios de atención
                  </p>
                  <p className="text-xs text-gray-400 mb-4">
                    Los turnos solo podrán agendarse dentro de estos horarios.
                  </p>

                  {DAYS.map(({ day, label }) => {
                    const ds = dayState[day];
                    return (
                      <div key={day} className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none w-28 shrink-0">
                          <div
                            className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                              ds.enabled ? "bg-emerald-500" : "bg-gray-200"
                            }`}
                            onClick={() => toggleDay(day, !ds.enabled)}
                          >
                            <div
                              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                ds.enabled ? "translate-x-4" : "translate-x-0.5"
                              }`}
                            />
                          </div>
                          <span className={`text-sm ${ds.enabled ? "text-gray-800 font-medium" : "text-gray-400"}`}>
                            {label}
                          </span>
                          {ds.enabled && (
                            <input type="hidden" name={`day_${day}`} value="on" />
                          )}
                        </label>

                        {ds.enabled ? (
                          <div className="flex items-center gap-2 flex-1">
                            <select
                              name={`start_${day}`}
                              value={ds.startTime}
                              onChange={(e) => setTime(day, "startTime", e.target.value)}
                              className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
                            >
                              {TIME_OPTIONS.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                            <span className="text-gray-400 text-sm shrink-0">—</span>
                            <select
                              name={`end_${day}`}
                              value={ds.endTime}
                              onChange={(e) => setTime(day, "endTime", e.target.value)}
                              className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
                            >
                              {TIME_OPTIONS.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300 italic">No disponible</span>
                        )}
                      </div>
                    );
                  })}

                  {availState && "error" in availState && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {availState.error}
                    </p>
                  )}
                  {availState && "success" in availState && (
                    <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      {availState.success}
                    </p>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={availPending}
                      className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
                    >
                      {availPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Guardar horarios
                    </button>
                  </div>
                </form>

                {/* Descansos */}
                <form action={breaksAction} className="px-6 pb-6 space-y-3 border-t border-gray-100 pt-5">
                  <input type="hidden" name="doctorId" value={doctor.id} />
                  <input type="hidden" name="breakCount" value={breakEntries.length} />

                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Descansos
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        En estos horarios no se pueden agendar turnos.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addBreak}
                      className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar
                    </button>
                  </div>

                  {breakEntries.length === 0 && (
                    <p className="text-xs text-gray-300 italic py-2">
                      Sin descansos configurados.
                    </p>
                  )}

                  {breakEntries.map((b, i) => (
                    <div key={i} className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                      <input type="hidden" name={`break_day_${i}`} value={b.dayOfWeek} />
                      <input type="hidden" name={`break_start_${i}`} value={b.startTime} />
                      <input type="hidden" name={`break_duration_${i}`} value={b.duration} />

                      {/* Día */}
                      <select
                        value={b.dayOfWeek}
                        onChange={(e) => updateBreak(i, "dayOfWeek", e.target.value)}
                        className="text-xs border border-amber-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 w-32 shrink-0"
                      >
                        {DAY_OPTIONS.map((d) => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>

                      {/* Hora de inicio */}
                      <select
                        value={b.startTime}
                        onChange={(e) => updateBreak(i, "startTime", e.target.value)}
                        className="text-xs border border-amber-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 flex-1"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>

                      {/* Duración */}
                      <select
                        value={b.duration}
                        onChange={(e) => updateBreak(i, "duration", parseInt(e.target.value, 10))}
                        className="text-xs border border-amber-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 w-24 shrink-0"
                      >
                        {DURATION_OPTIONS.map((d) => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => removeBreak(i)}
                        className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {breaksState && "error" in breaksState && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {breaksState.error}
                    </p>
                  )}
                  {breaksState && "success" in breaksState && (
                    <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      {breaksState.success}
                    </p>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={onClose}
                      className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      Cerrar
                    </button>
                    <button
                      type="submit"
                      disabled={breaksPending}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
                    >
                      {breaksPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Guardar descansos
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
