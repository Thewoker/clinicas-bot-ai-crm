"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  saveBotSettings,
  toggleBotActive,
  disconnectWhatsapp,
  connectWhatsapp,
} from "@/app/actions/whatsapp";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Power,
  Smartphone,
  RefreshCw,
} from "lucide-react";

interface Props {
  clinicId: string;
  waActive: boolean;
  waPhoneNumberId: string | null;
  waBotName: string | null;
  waBotWelcome: string | null;
  clinicName: string;
}

type QrStatus = "idle" | "connecting" | "waiting" | "qr" | "connected";

export function WhatsappForm({
  clinicId,
  waActive,
  waPhoneNumberId,
  waBotName,
  waBotWelcome,
  clinicName,
}: Props) {
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
  const [connectState, connectAction, connectPending] = useActionState(
    connectWhatsapp,
    null
  );

  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [qrStatus, setQrStatus] = useState<QrStatus>("idle");
  const [qrImage, setQrImage] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reload after toggle/disconnect
  useEffect(() => {
    if (
      (toggleState && "success" in toggleState) ||
      (disconnectState && "success" in disconnectState)
    ) {
      setTimeout(() => window.location.reload(), 800);
    }
  }, [toggleState, disconnectState]);

  // When connect action succeeds, start polling for QR
  useEffect(() => {
    if (connectState && "success" in connectState) {
      setQrStatus("waiting");
    }
    if (connectState && "error" in connectState) {
      setQrStatus("idle");
    }
  }, [connectState]);

  // Poll for QR / connection status
  useEffect(() => {
    if (qrStatus !== "waiting" && qrStatus !== "qr" && qrStatus !== "connecting") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/whatsapp/qr/${clinicId}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "connected") {
          setQrStatus("connected");
          setQrImage(null);
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setTimeout(() => window.location.reload(), 1000);
        } else if (data.status === "qr") {
          setQrStatus("qr");
          setQrImage(data.qr);
        } else if (data.status === "waiting") {
          setQrStatus("waiting");
        }
      } catch {}
    };

    poll();
    pollRef.current = setInterval(poll, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [clinicId, qrStatus]);

  const showQrSection = !isConnected && qrStatus !== "idle";

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

      {/* Connect section (if not connected) */}
      {!isConnected && (
        <div className="space-y-4">
          {!showQrSection ? (
            /* Initial connect button */
            <div>
              <p className="text-xs text-gray-500 mb-3">
                Conectá el número de WhatsApp de la clínica escaneando un código QR
                con tu teléfono. No se requiere cuenta empresarial.
              </p>
              <form action={connectAction}>
                <button
                  type="submit"
                  disabled={connectPending}
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
                >
                  {connectPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Smartphone className="w-4 h-4" />
                  )}
                  Conectar WhatsApp
                </button>
              </form>
              {connectState && "error" in connectState && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
                  {connectState.error}
                </p>
              )}
            </div>
          ) : (
            /* QR polling section */
            <div className="flex flex-col items-center gap-4 py-4">
              {qrStatus === "connected" && (
                <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  ¡Conectado! Recargando...
                </div>
              )}

              {(qrStatus === "waiting" || qrStatus === "connecting") && (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                  <p className="text-sm text-gray-500">
                    Generando código QR...
                  </p>
                </div>
              )}

              {qrStatus === "qr" && qrImage && (
                <div className="flex flex-col items-center gap-3">
                  <div className="border-2 border-emerald-200 rounded-2xl p-3 bg-white shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrImage}
                      alt="Código QR de WhatsApp"
                      width={260}
                      height={260}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-gray-700">
                      Escaneá este código con tu WhatsApp
                    </p>
                    <p className="text-xs text-gray-400">
                      Abrí WhatsApp → Dispositivos vinculados → Vincular dispositivo
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setQrStatus("idle");
                      setQrImage(null);
                    }}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          )}
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
