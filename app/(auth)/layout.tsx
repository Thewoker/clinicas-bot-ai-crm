import { Activity } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[440px] bg-emerald-600 flex-col justify-between p-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg">Clínica Natura</span>
        </div>

        <div>
          <blockquote className="text-white/90 text-xl font-medium leading-relaxed mb-6">
            "Gestiona tu clínica con inteligencia. Cada cita, cada paciente,
            cada decisión — en un solo lugar."
          </blockquote>
          <div className="space-y-3">
            {[
              "Multi-clínica e independiente por ecosistema",
              "Calendario de turnos en tiempo real",
              "Agente de IA configurable por clínica",
              "API para integración con WhatsApp y Voz",
            ].map((feat) => (
              <div key={feat} className="flex items-center gap-2 text-white/80 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 shrink-0" />
                {feat}
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/40 text-xs">
          © {new Date().getFullYear()} Clínica Natura CRM
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">Clínica Natura</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
