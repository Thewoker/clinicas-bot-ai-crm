"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, Phone, ExternalLink } from "lucide-react";

interface Props {
  elevenLabsAgentId: string | null;
  elevenLabsPhoneNumberId: string | null;
  telnyxPhoneNumber: string | null;
}

export function ElevenLabsForm({ elevenLabsAgentId, elevenLabsPhoneNumberId, telnyxPhoneNumber }: Props) {
  const [phoneNumberId, setPhoneNumberId] = useState(elevenLabsPhoneNumberId ?? "");
  const [saving, setSaving] = useState(false);
  const [setupMsg, setSetupMsg] = useState<string | null>(null);
  const [setupErr, setSetupErr] = useState<string | null>(null);

  const [dialPhone, setDialPhone] = useState("");
  const [calling, setCalling] = useState(false);
  const [callMsg, setCallMsg] = useState<string | null>(null);
  const [callErr, setCallErr] = useState<string | null>(null);

  async function handleSetupAgent() {
    setSaving(true);
    setSetupMsg(null);
    setSetupErr(null);
    try {
      // Save phone number ID first
      if (phoneNumberId) {
        await fetch("/api/elevenlabs/save-phone-number-id", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumberId }),
        });
      }
      const res = await fetch("/api/elevenlabs/setup-agent", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSetupErr(data.error ?? "Error al configurar el agente");
      } else {
        setSetupMsg(`Agente creado/actualizado correctamente (ID: ${data.agentId})`);
      }
    } catch {
      setSetupErr("Error de red");
    } finally {
      setSaving(false);
    }
  }

  async function handleCall() {
    if (!dialPhone.trim()) return;
    setCalling(true);
    setCallMsg(null);
    setCallErr(null);
    try {
      const res = await fetch("/api/elevenlabs/outbound-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPhone: dialPhone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCallErr(data.error ?? "Error al iniciar la llamada");
      } else {
        setCallMsg("Llamada iniciada. Tu teléfono recibirá la llamada en unos segundos.");
      }
    } catch {
      setCallErr("Error de red");
    } finally {
      setCalling(false);
    }
  }

  const isReady = !!elevenLabsAgentId && !!elevenLabsPhoneNumberId;

  return (
    <div className="space-y-6">

      {/* Status */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
        isReady ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"
      }`}>
        {isReady ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
        ) : (
          <div className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />
        )}
        <div>
          <p className={`text-sm font-semibold ${isReady ? "text-emerald-700" : "text-gray-500"}`}>
            {isReady ? "Voice AI activo (ElevenLabs)" : "Sin configurar"}
          </p>
          {elevenLabsAgentId && (
            <p className="text-xs text-gray-400 font-mono mt-0.5">{elevenLabsAgentId}</p>
          )}
        </div>
      </div>

      {/* Setup guide */}
      <div className="space-y-3 text-xs text-gray-600 bg-gray-50 rounded-xl p-4 border border-gray-100">
        <p className="font-semibold text-gray-700">Pasos de configuración (una sola vez)</p>
        <ol className="space-y-2 list-decimal list-inside">
          <li>
            En Telnyx, creá una{" "}
            <a href="https://portal.telnyx.com/#/app/sip-trunking" target="_blank" rel="noopener noreferrer"
              className="text-violet-500 hover:underline inline-flex items-center gap-0.5">
              SIP Connection <ExternalLink className="w-3 h-3" />
            </a>
            {" "}con FQDN: <code className="bg-white px-1 rounded border">sip.rtc.elevenlabs.io</code>, guardá usuario y contraseña.
          </li>
          <li>
            En{" "}
            <a href="https://elevenlabs.io/app/conversational-ai/phone-numbers" target="_blank" rel="noopener noreferrer"
              className="text-violet-500 hover:underline inline-flex items-center gap-0.5">
              ElevenLabs → Phone Numbers <ExternalLink className="w-3 h-3" />
            </a>
            {" "}importá tu número{telnyxPhoneNumber ? ` (${telnyxPhoneNumber})` : ""} con las credenciales SIP de Telnyx.
          </li>
          <li>Copiá el <strong>Phone Number ID</strong> de ElevenLabs y pegalo abajo.</li>
          <li>Hacé clic en <strong>Crear agente</strong>.</li>
        </ol>
      </div>

      {/* Phone Number ID */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-700">Phone Number ID de ElevenLabs</p>
        <input
          type="text"
          value={phoneNumberId}
          onChange={(e) => setPhoneNumberId(e.target.value)}
          placeholder="Ej: PhHnSnFEFU2nTas..."
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white font-mono"
        />
      </div>

      {/* Create/update agent */}
      <button
        onClick={handleSetupAgent}
        disabled={saving}
        className="flex items-center gap-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
      >
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {elevenLabsAgentId ? "Actualizar agente" : "Crear agente"}
      </button>

      {setupMsg && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{setupMsg}</p>}
      {setupErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{setupErr}</p>}

      {/* Test call */}
      {isReady && (
        <div className="space-y-3 border-t border-gray-100 pt-5">
          <p className="text-xs font-medium text-gray-700">Probar el bot</p>
          <div className="flex gap-2">
            <input
              type="tel"
              value={dialPhone}
              onChange={(e) => setDialPhone(e.target.value)}
              placeholder="+34611222333"
              className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white font-mono"
            />
            <button
              onClick={handleCall}
              disabled={calling || !dialPhone.trim()}
              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors shrink-0"
            >
              {calling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5" />}
              {calling ? "Llamando..." : "Llamarme"}
            </button>
          </div>
          {callMsg && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{callMsg}</p>}
          {callErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{callErr}</p>}
        </div>
      )}
    </div>
  );
}
