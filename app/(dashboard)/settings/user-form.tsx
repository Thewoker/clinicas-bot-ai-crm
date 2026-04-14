"use client";

import { useActionState } from "react";
import { updateUser } from "@/app/actions/settings";
import { Loader2, User, Mail } from "lucide-react";
import { StatusMessage } from "./status-message";

type Props = { defaultValues: { name: string; email: string } };

export function UserForm({ defaultValues }: Props) {
  const [state, action, pending] = useActionState(updateUser, null);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Nombre completo <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            name="name"
            required
            defaultValue={defaultValues.name}
            placeholder="Tu nombre"
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Correo electrónico <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            name="email"
            type="email"
            required
            defaultValue={defaultValues.email}
            placeholder="tu@email.com"
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
          />
        </div>
      </div>

      <StatusMessage state={state} />

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Guardar cambios
        </button>
      </div>
    </form>
  );
}
