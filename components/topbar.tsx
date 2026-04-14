"use client";

import { Bell, LogOut, ChevronDown } from "lucide-react";
import { useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import { useTransition } from "react";

type Clinic = { id: string; name: string; slug: string };
type User = { name: string; email: string; role: string };

export function Topbar({ clinic, user }: { clinic: Clinic; user: User }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
    });
  }

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="h-14 bg-white border-b border-gray-100 px-6 flex items-center justify-between sticky top-0 z-10">
      {/* Clinic badge */}
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        <span className="text-sm font-semibold text-gray-800">{clinic.name}</span>
        <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
          {user.role === "ADMIN" ? "Administrador" : "Staff"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full" />
        </button>

        {/* User menu */}
        <div className="relative pl-2 border-l border-gray-100">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-emerald-700">{initials}</span>
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-semibold text-gray-800 leading-tight">
                {user.name}
              </p>
              <p className="text-xs text-gray-400 leading-tight truncate max-w-32">
                {user.email}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 w-52 py-1">
                <div className="px-4 py-2.5 border-b border-gray-50">
                  <p className="text-xs font-semibold text-gray-800">{user.name}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  disabled={isPending}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4" />
                  {isPending ? "Cerrando sesión…" : "Cerrar sesión"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
