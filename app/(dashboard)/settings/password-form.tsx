"use client";

import { useActionState, useState } from "react";
import { updatePassword } from "@/app/actions/settings";
import { Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { StatusMessage } from "./status-message";

export function PasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, null);
  const [show, setShow] = useState({ current: false, next: false, confirm: false });

  const toggle = (field: keyof typeof show) =>
    setShow((s) => ({ ...s, [field]: !s[field] }));

  const fields = [
    { name: "currentPassword", label: "Contraseña actual", key: "current" as const },
    { name: "newPassword",     label: "Nueva contraseña",  key: "next" as const },
    { name: "confirmPassword", label: "Confirmar nueva contraseña", key: "confirm" as const },
  ];

  return (
    <form action={action} className="space-y-4">
      {fields.map(({ name, label, key }) => (
        <div key={name}>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {label} <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              name={name}
              type={show[key] ? "text" : "password"}
              required
              minLength={name === "newPassword" ? 8 : undefined}
              placeholder={name === "newPassword" ? "Mínimo 8 caracteres" : "••••••••"}
              className="w-full pl-9 pr-10 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
            />
            <button
              type="button"
              onClick={() => toggle(key)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {show[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      ))}

      <StatusMessage state={state} />

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Cambiar contraseña
        </button>
      </div>
    </form>
  );
}
