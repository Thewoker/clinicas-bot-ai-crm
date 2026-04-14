"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import Link from "next/link";
import { Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, null);
  const [showPass, setShowPass] = useState(false);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Bienvenido de nuevo</h1>
      <p className="text-sm text-gray-500 mb-8">
        Ingresa tus datos para acceder al panel de tu clínica.
      </p>

      <form action={action} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Correo electrónico
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="admin@tuclínica.com"
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Contraseña
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              name="password"
              type={showPass ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="Tu contraseña"
              className="w-full pl-9 pr-10 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Error */}
        {state && "error" in state && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {pending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Iniciando sesión…
            </>
          ) : (
            "Iniciar sesión"
          )}
        </button>

        <p className="text-center text-sm text-gray-500">
          ¿No tienes cuenta?{" "}
          <Link
            href="/register"
            className="text-emerald-600 font-medium hover:underline"
          >
            Registra tu clínica
          </Link>
        </p>
      </form>
    </div>
  );
}
