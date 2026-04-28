import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ClinicForm } from "./clinic-form";
import { UserForm } from "./user-form";
import { PasswordForm } from "./password-form";
import { CopyButton } from "./copy-button";
import { WhatsappForm } from "./whatsapp-form";
import { Building2, User, Lock, MessageCircle } from "lucide-react";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [clinic, user] = await Promise.all([
    prisma.clinic.findUnique({ where: { id: session.clinicId } }),
    prisma.user.findUnique({ where: { id: session.userId } }),
  ]);

  if (!clinic || !user) redirect("/login");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Gestiona los datos de tu clínica y tu cuenta de acceso.
        </p>
      </div>

      {/* Clinic section */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Datos de la clínica</h2>
            <p className="text-xs text-gray-400">Información pública de tu centro médico</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-5">
          <ClinicForm
            defaultValues={{
              name: clinic.name,
              phone: clinic.phone ?? "",
              address: clinic.address ?? "",
              timezone: clinic.timezone,
            }}
          />

          {/* API Key — read only */}
          <div className="border-t border-gray-50 pt-5">
            <p className="text-xs font-medium text-gray-500 mb-2">API Key de IA</p>
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <code className="text-xs text-gray-700 font-mono flex-1 truncate">
                {clinic.apiKey}
              </code>
              <CopyButton text={clinic.apiKey} />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Usa esta clave en el header{" "}
              <code className="bg-gray-100 px-1 rounded">X-Api-Key</code> para
              conectar tu agente de IA externo.
            </p>
          </div>
        </div>
      </section>

      {/* User section */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Datos de usuario</h2>
            <p className="text-xs text-gray-400">Tu nombre y correo de acceso al CRM</p>
          </div>
        </div>
        <div className="px-6 py-5">
          <UserForm defaultValues={{ name: user.name, email: user.email }} />
        </div>
      </section>

      {/* WhatsApp Bot section */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Bot de WhatsApp</h2>
            <p className="text-xs text-gray-400">
              Asistente con IA para gestionar turnos por WhatsApp
            </p>
          </div>
        </div>
        <div className="px-6 py-5">
          <WhatsappForm
            clinicId={clinic.id}
            waActive={clinic.waActive}
            waPhoneNumberId={clinic.waPhoneNumberId}
            waBotName={clinic.waBotName}
            waBotWelcome={clinic.waBotWelcome}
            clinicName={clinic.name}
          />
        </div>
      </section>

      {/* Password section */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50">
          <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
            <Lock className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Cambiar contraseña</h2>
            <p className="text-xs text-gray-400">Mínimo 8 caracteres</p>
          </div>
        </div>
        <div className="px-6 py-5">
          <PasswordForm />
        </div>
      </section>
    </div>
  );
}
