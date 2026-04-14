"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Stethoscope,
  BookOpen,
  HelpCircle,
  Settings,
  Activity,
} from "lucide-react";
import clsx from "clsx";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendario", icon: Calendar },
  { href: "/patients", label: "Pacientes", icon: Users },
  { href: "/doctors", label: "Médicos", icon: Stethoscope },
  { href: "/knowledge-base", label: "Base de IA", icon: BookOpen },
];

export function Sidebar({ clinicName }: { clinicName: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-white border-r border-gray-100 shadow-sm shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
          <Activity className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{clinicName}</p>
          <p className="text-xs text-gray-400">CRM Médico</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon
                className={clsx(
                  "w-4 h-4 shrink-0",
                  active ? "text-emerald-600" : "text-gray-400"
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Support box */}
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="rounded-xl bg-emerald-50 p-4 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <HelpCircle className="w-4 h-4 text-emerald-600" />
            <p className="text-xs font-semibold text-emerald-800">Soporte</p>
          </div>
          <p className="text-xs text-emerald-700 mb-2">
            ¿Necesitas ayuda con {clinicName}?
          </p>
          <a
            href="mailto:soporte@clinica-natura.es"
            className="text-xs font-medium text-emerald-700 underline"
          >
            soporte@clinica-natura.es
          </a>
        </div>
        <Link
          href="/settings"
          className={clsx(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
            pathname === "/settings"
              ? "bg-emerald-50 text-emerald-700"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
          )}
        >
          <Settings className={clsx("w-4 h-4 shrink-0", pathname === "/settings" ? "text-emerald-600" : "")} />
          Configuración
        </Link>
      </div>
    </aside>
  );
}
