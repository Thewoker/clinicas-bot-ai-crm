"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { DoctorModal } from "./doctor-modal";

type Availability = { dayOfWeek: number; startTime: string; endTime: string };

type Doctor = {
  id: string;
  name: string;
  specialty: string;
  email: string;
  phone: string | null;
  color: string;
  availability: Availability[];
};

export function DoctorActionButtons({ doctor }: { doctor?: Doctor }) {
  const [open, setOpen] = useState(false);

  if (doctor) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          title="Editar médico"
          className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        {open && <DoctorModal doctor={doctor} onClose={() => setOpen(false)} />}
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
      >
        <Plus className="w-4 h-4" />
        Nuevo médico
      </button>
      {open && <DoctorModal onClose={() => setOpen(false)} />}
    </>
  );
}
