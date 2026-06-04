"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, Phone, Unlink } from "lucide-react";

interface Props {
  clinicId: string;
  clinicName: string;
  elevenLabsAgentId: string | null;
  elevenLabsPhoneNumberId: string | null;
}

export function VoiceAdminForm({ clinicId, clinicName, elevenLabsAgentId, elevenLabsPhoneNumberId }: Props) {
  const [phoneNumberId, setPhoneNumberId] = useState(elevenLabsPhoneNumberId ?? "");
  const [agentId, setAgentId] = useState(elevenLabsAgentId ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [unlinking, setUnlinking] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const [dialPhone, setDialPhone] = useState("");
  const [calling, setCalling] = useState(false);
  const [callMsg, setCallMsg] = useState<string | null>(null);
  const [callErr, setCallErr] = useState<string | null>(null);

  async function handleSetup() {
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      if (phoneNumberId.trim()) {
        await fetch("/api/admin/elevenlabs/save-phone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clinicId, phoneNumberId: phoneNumberId.trim() }),
        });
      }
      const res = await fetch("/api/admin/elevenlabs/setup-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Error");
      } else {
        setAgentId(data.agentId);
        setMsg(`Agente configurado: ${data.agentId}`);
      }
    } catch {
      setErr("Error de red");
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlink() {
    setUnlinking(true);
    try {
      const res = await fetch("/api/admin/elevenlabs/unlink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId }),
      });
      if (res.ok) {
        setAgentId("");
        setPhoneNumberId("");
        setConfirmUnlink(false);
      } else {
        const d = await res.json();
        setErr(d.error ?? "Error al desvincular");
      }
    } catch {
      setErr("Error de red");
    } finally {
      setUnlinking(false);
    }
  }

  async function handleCall() {
    if (!dialPhone.trim()) return;
    setCalling(true);
    setCallMsg(null);
    setCallErr(null);
    try {
      const res = await fetch("/api/admin/elevenlabs/outbound-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, targetPhone: dialPhone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) setCallErr(data.error ?? "Error");
      else setCallMsg("Llamada iniciada — tu teléfono recibirá la llamada en unos segundos.");
    } catch {
      setCallErr("Error de red");
    } finally {
      setCalling(false);
    }
  }

  const isReady = !!agentId && !!phoneNumberId;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{clinicName}</h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">{clinicId}</p>
        </div>
        {isReady ? (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <CheckCircle2 className="w-4 h-4" /> Voice AI activo
          </span>
        ) : (
          <span className="text-xs text-slate-400">Sin configurar</span>
        )}
      </div>

      {agentId && (
        <p className="text-xs text-slate-400 font-mono bg-slate-50 px-3 py-2 rounded-lg">
          Agent: {agentId}
        </p>
      )}

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Phone Number ID de ElevenLabs</label>
          <input
            type="text"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="phnum_..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
        </div>

        <button
          onClick={handleSetup}
          disabled={saving}
          className="flex items-center gap-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {agentId ? "Actualizar agente" : "Crear agente"}
        </button>

        {msg && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{msg}</p>}
        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

        {isReady && (
          <div className="pt-1">
            {!confirmUnlink ? (
              <button
                type="button"
                onClick={() => setConfirmUnlink(true)}
                className="text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                Desvincular agente y número
              </button>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-xs text-slate-600">¿Confirmar desvinculación?</p>
                <button
                  onClick={handleUnlink}
                  disabled={unlinking}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                >
                  {unlinking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
                  Sí, desvincular
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmUnlink(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {isReady && (
        <div className="border-t border-slate-100 pt-4 space-y-2">
          <label className="text-xs font-medium text-slate-600 block">Prueba de llamada</label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={dialPhone}
              onChange={(e) => setDialPhone(e.target.value)}
              placeholder="+34611222333"
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
            <button
              onClick={handleCall}
              disabled={calling || !dialPhone.trim()}
              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
            >
              {calling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5" />}
              {calling ? "Llamando..." : "Llamar"}
            </button>
          </div>
          {callMsg && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{callMsg}</p>}
          {callErr && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{callErr}</p>}
        </div>
      )}
    </div>
  );
}
