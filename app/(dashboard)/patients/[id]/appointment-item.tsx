"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Clock, User2 } from "lucide-react";
import { AppointmentEditModal, type AppointmentForEdit } from "./appointment-edit-modal";

interface Appointment {
  id: string;
  doctorId: string;
  patientId: string;
  service: string;
  price: number;
  startTime: Date | string;
  endTime: Date | string;
  status: string;
  notes: string | null;
  doctor: { name: string; color: string };
}

const statusConfig: Record<string, { label: string; className: string }> = {
  SCHEDULED: { label: "Programada",  className: "bg-blue-50 text-blue-600" },
  CONFIRMED: { label: "Confirmada",  className: "bg-emerald-50 text-emerald-600" },
  COMPLETED: { label: "Completada",  className: "bg-gray-100 text-gray-500" },
  CANCELLED: { label: "Cancelada",   className: "bg-red-50 text-red-500" },
  NO_SHOW:   { label: "Ausente",     className: "bg-orange-50 text-orange-500" },
};

export function AppointmentItem({
  appointment,
  patientName,
  patientPhone,
  canNotifyWhatsapp,
  clinicTzOffsetMin,
}: {
  appointment: Appointment;
  patientName: string;
  patientPhone: string;
  canNotifyWhatsapp: boolean;
  clinicTzOffsetMin: number;
}) {
  const [editing, setEditing] = useState(false);
  const status = statusConfig[appointment.status];

  const aptForEdit: AppointmentForEdit = {
    id: appointment.id,
    doctorId: appointment.doctorId,
    patientId: appointment.patientId,
    patientName,
    patientPhone,
    service: appointment.service,
    price: Number(appointment.price),
    startTime: new Date(appointment.startTime).toISOString(),
    endTime: new Date(appointment.endTime).toISOString(),
    status: appointment.status,
    notes: appointment.notes ?? undefined,
    doctorName: appointment.doctor.name,
    doctorColor: appointment.doctor.color,
  };

  return (
    <>
      {editing && (
        <AppointmentEditModal
          apt={aptForEdit}
          canNotifyWhatsapp={canNotifyWhatsapp}
          clinicTzOffsetMin={clinicTzOffsetMin}
          onClose={() => setEditing(false)}
        />
      )}
      <div
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 cursor-pointer hover:border-emerald-200 hover:shadow-md transition-all"
        onClick={() => setEditing(true)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm font-semibold text-gray-800">{appointment.service}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <User2 className="w-3 h-3" />
                {appointment.doctor.name}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(appointment.startTime), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
              </span>
            </div>
            {appointment.notes && (
              <p className="text-xs text-gray-400 italic mt-1">{appointment.notes}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.className}`}>
              {status.label}
            </span>
            <span className="text-sm font-semibold text-gray-700">
              €{Number(appointment.price).toLocaleString("es-AR")}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
