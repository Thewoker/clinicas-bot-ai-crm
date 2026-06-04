"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  ShieldCheck,
  LogOut,
  X,
  Mic,
} from "lucide-react";
import clsx from "clsx";
import { useTransition } from "react";
import { logoutAction } from "@/app/actions/auth";

const navItems = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Usuarios", icon: Users, exact: false },
  { href: "/admin/clinics", label: "Clínicas", icon: Building2, exact: false },
  { href: "/admin/voice", label: "Voice AI", icon: Mic, exact: false },
];

interface AdminSidebarProps {
  user: { name: string; email: string };
  onClose?: () => void;
}

export function AdminSidebar({ user, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
    });
  }

  return (
    <aside className="flex flex-col w-64 h-full bg-slate-900 shrink-0">
      {/* Mobile close button */}
      <div className="flex justify-end px-3 pt-3 lg:hidden">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700/50">
        <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">Panel de Admin</p>
          <p className="text-xs text-slate-400">Administración Global</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-violet-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-slate-700/50">
        <div className="px-3 py-2 mb-2">
          <p className="text-xs font-semibold text-white truncate">{user.name}</p>
          <p className="text-xs text-slate-400 truncate">{user.email}</p>
        </div>
        <Link
          href="/dashboard"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors mb-1"
        >
          <Building2 className="w-4 h-4 shrink-0" />
          Ir a clínica
        </Link>
        <button
          onClick={handleLogout}
          disabled={isPending}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-red-900/30 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
