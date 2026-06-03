"use client";

import { useActionState, useState } from "react";
import {
  saveTelnyxApiKey,
  setupTelnyx,
  disconnectTelnyx,
} from "@/app/actions/telnyx";
import { Loader2, CheckCircle2, XCircle, Phone, Eye, EyeOff, ExternalLink, ChevronDown, ChevronUp, BookOpen } from "lucide-react";

interface Props {
  telnyxApiKey: string | null;
  telnyxPhoneNumber: string | null;
}

export function TelnyxForm({ telnyxApiKey, telnyxPhoneNumber }: Props) {
  const isConnected = !!telnyxPhoneNumber;
  const hasKey = !!telnyxApiKey;

  const [keyState, keyAction, keyPending] = useActionState(saveTelnyxApiKey, null);
  const [setupState, setupAction, setupPending] = useActionState(setupTelnyx, null);
  const [disconnectState, disconnectAction, disconnectPending] = useActionState(disconnectTelnyx, null);

  const [showKey, setShowKey] = useState(false);
  const [showGuide, setShowGuide] = useState(!hasKey);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  return (
    <div className="space-y-6">

      {/* Status */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
        isConnected ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"
      }`}>
        {isConnected ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 text-gray-400 shrink-0" />
        )}
        <div>
          <p className={`text-sm font-semibold ${isConnected ? "text-emerald-700" : "text-gray-500"}`}>
            {isConnected ? "Llamadas activas" : "Sin número configurado"}
          </p>
          {isConnected && (
            <p className="text-xs text-emerald-600 mt-0.5 font-mono">{telnyxPhoneNumber}</p>
          )}
        </div>
      </div>

      

      {/* API Key */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-700">API Key del agente de llamadas</p>

        <form action={keyAction} className="flex gap-2">
          <div className="relative flex-1">
            <input
              name="telnyxApiKey"
              type={showKey ? "text" : "password"}
              defaultValue={telnyxApiKey ?? ""}
              placeholder="KEY..."
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white pr-9 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            type="submit"
            disabled={keyPending}
            className="flex items-center gap-1.5 bg-violet-500 hover:bg-violet-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors shrink-0"
          >
            {keyPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Guardar
          </button>
        </form>

        {keyState && "error" in keyState && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {keyState.error}
          </p>
        )}
        {keyState && "success" in keyState && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            {keyState.success}
          </p>
        )}
      </div>

      {/* Configure number */}
      {hasKey && !isConnected && (
        <div className="space-y-3 border-t border-gray-100 pt-5">
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1">Asignar número de teléfono</p>
            <p className="text-xs text-gray-400">
              Comprá el número en{" "}
              <a
                href="https://portal.telnyx.com/#/app/numbers/buy-numbers"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-500 hover:underline inline-flex items-center gap-0.5"
              >
                portal.telnyx.com → Numbers
                <ExternalLink className="w-3 h-3" />
              </a>
              {" "}y pegalo acá. Configuramos el webhook automáticamente.
            </p>
          </div>

          <form action={setupAction} className="flex gap-2">
            <input
              name="phoneNumber"
              type="text"
              placeholder="+34911234567"
              className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white font-mono"
            />
            <button
              type="submit"
              disabled={setupPending}
              className="flex items-center gap-1.5 bg-violet-500 hover:bg-violet-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors shrink-0"
            >
              {setupPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Phone className="w-3.5 h-3.5" />
              )}
              {setupPending ? "Configurando..." : "Configurar"}
            </button>
          </form>

          {setupState && "error" in setupState && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {setupState.error}
            </p>
          )}
          {setupState && "success" in setupState && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {setupState.success}
            </p>
          )}
        </div>
      )}

      {/* In-app WebRTC dialer — desactivado mientras se usa ElevenLabs */}
      {/* {isConnected && <TelnyxDialer />} */}

      {/* Disconnect */}
      {isConnected && (
        <div className="border-t border-gray-100 pt-4">
          {!confirmDisconnect ? (
            <button
              type="button"
              onClick={() => setConfirmDisconnect(true)}
              className="text-sm text-red-400 hover:text-red-600 transition-colors"
            >
              Liberar número y desconectar
            </button>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm text-gray-600">
                ¿Confirmar? Se eliminará el número y la app en Telnyx.
              </p>
              <form action={disconnectAction}>
                <button
                  type="submit"
                  disabled={disconnectPending}
                  className="flex items-center gap-1.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                >
                  {disconnectPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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
