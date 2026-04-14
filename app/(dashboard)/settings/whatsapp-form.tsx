"use client";

import { useActionState, useEffect, useState } from "react";
import {
  saveBotSettings,
  toggleBotActive,
  disconnectWhatsapp,
  saveWhatsappNumber,
} from "@/app/actions/whatsapp";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Power,
  Copy,
  Check,
} from "lucide-react";

interface Props {
  waActive: boolean;
  waPhoneNumberId: string | null;
  waBotName: string | null;
  waBotWelcome: string | null;
  clinicName: string;
  appUrl: string;
}

export function WhatsappForm({
  waActive,
  waPhoneNumberId,
  waBotName,
  waBotWelcome,
  clinicName,
  appUrl,
}: Props) {
  const webhookUrl = `${appUrl}/api/webhook/whatsapp`;
  const isConnected = !!waPhoneNumberId;

  const [settingsState, settingsAction, settingsPending] = useActionState(
    saveBotSettings,
    null
  );
  const [toggleState, toggleAction, togglePending] = useActionState(
    toggleBotActive,
    null
  );
  const [disconnectState, disconnectAction, disconnectPending] =
    useActionState(disconnectWhatsapp, null);
  const [numberState, numberAction, numberPending] = useActionState(
    saveWhatsappNumber,
    null
  );

  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reload after toggle/disconnect so the server component re-fetches DB state
  useEffect(() => {
    if (
      (toggleState && "success" in toggleState) ||
      (disconnectState && "success" in disconnectState) ||
      (numberState && "success" in numberState)
    ) {
      setTimeout(() => window.location.reload(), 800);
    }
  }, [toggleState, disconnectState, numberState]);

  function copyWebhook() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-6">
      {/* Connection status */}
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
          isConnected
            ? "bg-emerald-50 border-emerald-200"
            : "bg-gray-50 border-gray-200"
        }`}
      >
        {isConnected ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 text-gray-400 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-semibold ${
              isConnected ? "text-emerald-700" : "text-gray-500"
            }`}
          >
            {isConnected ? "WhatsApp conectado" : "WhatsApp no conectado"}
          </p>
          {isConnected && (
            <p className="text-xs text-emerald-600 mt-0.5 font-mono">
              {waPhoneNumberId} · Bot{" "}
              {waActive ? "activo · recibiendo mensajes" : "pausado"}
            </p>
          )}
        </div>

        {/* Toggle active/inactive */}
        {isConnected && (
          <form action={toggleAction}>
            <input
              type="hidden"
              name="active"
              value={waActive ? "false" : "true"}
            />
            <button
              type="submit"
              disabled={togglePending}
              title={waActive ? "Pausar bot" : "Activar bot"}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                waActive
                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
              }`}
            >
              {togglePending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Power className="w-3.5 h-3.5" />
              )}
              {waActive ? "Pausar" : "Activar"}
            </button>
          </form>
        )}
      </div>

      {/* Connect form (if not connected) */}
      {!isConnected && (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-3">
              Configuración de Twilio
            </p>

            {/* Step 1 — Webhook URL */}
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-600 mb-1">
                1. Copiá esta URL y configurala como webhook en la consola de Twilio
              </p>
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                <code className="text-xs text-gray-700 font-mono flex-1 truncate">
                  {webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={copyWebhook}
                  className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                  title="Copiar URL"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                En Twilio: Messaging → Senders → WhatsApp → tu número → Webhook URL (HTTP POST)
              </p>
            </div>

            {/* Step 2 — Enter phone number */}
            <p className="text-xs font-medium text-gray-600 mb-1">
              2. Ingresá el número de WhatsApp de Twilio asignado a esta clínica
            </p>
            <form action={numberAction} className="flex gap-2">
              <input
                name="waPhoneNumber"
                placeholder="+14155238886"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white font-mono"
              />
              <button
                type="submit"
                disabled={numberPending}
                className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {numberPending && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Guardar
              </button>
            </form>
            {numberState && "error" in numberState && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
                {numberState.error}
              </p>
            )}
            {numberState && "success" in numberState && (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mt-2">
                {numberState.success}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Bot personality settings */}
      <form action={settingsAction} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Nombre del asistente
          </label>
          <input
            name="waBotName"
            defaultValue={waBotName ?? `Asistente de ${clinicName}`}
            placeholder={`Asistente de ${clinicName}`}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
          />
          <p className="text-xs text-gray-400 mt-1">
            Así se presentará el bot al comenzar cada conversación.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Mensaje de bienvenida
          </label>
          <textarea
            name="waBotWelcome"
            defaultValue={
              waBotWelcome ??
              `¡Hola! Soy la asistente de ${clinicName}. ¿En qué puedo ayudarte hoy?`
            }
            rows={3}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white resize-none"
          />
        </div>

        {settingsState && "error" in settingsState && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {settingsState.error}
          </p>
        )}
        {settingsState && "success" in settingsState && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            {settingsState.success}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={settingsPending}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            {settingsPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Guardar
          </button>
        </div>
      </form>

      {/* Disconnect */}
      {isConnected && (
        <div className="border-t border-gray-100 pt-4">
          {!confirmDisconnect ? (
            <button
              type="button"
              onClick={() => setConfirmDisconnect(true)}
              className="text-sm text-red-400 hover:text-red-600 transition-colors"
            >
              Desconectar WhatsApp
            </button>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm text-gray-600">
                ¿Confirmar desconexión? El bot dejará de funcionar.
              </p>
              <form action={disconnectAction}>
                <button
                  type="submit"
                  disabled={disconnectPending}
                  className="flex items-center gap-1.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                >
                  {disconnectPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  Sí, desconectar
                </button>
              </form>
              <button
                type="button"
                onClick={() => setConfirmDisconnect(false)}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                Cancelar
              </button>
            </div>
          )}
          {disconnectState && "error" in disconnectState && (
            <p className="text-sm text-red-600 mt-2">{disconnectState.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
