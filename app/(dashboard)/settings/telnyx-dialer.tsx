"use client";

import { useState } from "react";
import { Phone, Loader2, PhoneCall, RotateCcw } from "lucide-react";

type CallState = "idle" | "calling" | "ringing" | "error";

export function TelnyxDialer() {
  const [state, setState] = useState<CallState>("idle");
  const [phone, setPhone] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  async function startCall() {
    const target = phone.trim();
    if (!target) return;
    setState("calling");
    setErrorMsg("");

    try {
      const res = await fetch("/api/telnyx/test-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPhone: target }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error ?? `Error HTTP ${res.status}`);
      }

      setState("ringing");
    } catch (err: unknown) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  function reset() {
    setState("idle");
    setErrorMsg("");
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
      <p className="text-xs font-medium text-gray-700">Probar bot desde el panel</p>

      {(state === "idle" || state === "error") && (
        <>
          <div className="flex gap-2">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+34611234567"
              className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white font-mono"
              onKeyDown={(e) => e.key === "Enter" && startCall()}
            />
            <button
              onClick={startCall}
              disabled={!phone.trim()}
              className="flex items-center gap-2 bg-violet-50 hover:bg-violet-100 disabled:opacity-50 text-violet-700 text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors border border-violet-200 shrink-0"
            >
              <Phone className="w-4 h-4" />
              Llamarme
            </button>
          </div>
          {state === "error" && errorMsg && (
            <p className="text-xs text-red-500">{errorMsg}</p>
          )}
          <p className="text-xs text-gray-400">
            Ingresá tu número y el bot te llamará para que puedas hablar con él.
          </p>
        </>
      )}

      {state === "calling" && (
        <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-lg px-4 py-3">
          <Loader2 className="w-4 h-4 text-violet-500 animate-spin shrink-0" />
          <span className="text-sm text-violet-700">Iniciando llamada...</span>
        </div>
      )}

      {state === "ringing" && (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-700">Llamada iniciada</p>
              <p className="text-xs text-emerald-600">Tu teléfono recibirá la llamada en unos segundos</p>
            </div>
          </div>
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-xs transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reiniciar
          </button>
        </div>
      )}
    </div>
  );
}
