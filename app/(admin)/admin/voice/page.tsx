import { prisma } from "@/lib/prisma";
import { Mic } from "lucide-react";
import { VoiceAdminForm } from "./voice-admin-form";

export default async function VoiceAdminPage() {
  const clinics = await prisma.clinic.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      elevenLabsAgentId: true,
      elevenLabsPhoneNumberId: true,
    },
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
          <Mic className="w-5 h-5 text-orange-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Voice AI</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Configuración de ElevenLabs por clínica.</p>
        </div>
      </div>

      <div className="grid gap-4 max-w-2xl">
        {clinics.map((clinic) => (
          <VoiceAdminForm
            key={clinic.id}
            clinicId={clinic.id}
            clinicName={clinic.name}
            elevenLabsAgentId={clinic.elevenLabsAgentId ?? null}
            elevenLabsPhoneNumberId={clinic.elevenLabsPhoneNumberId ?? null}
          />
        ))}
      </div>
    </div>
  );
}
