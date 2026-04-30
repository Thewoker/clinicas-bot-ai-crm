"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Stethoscope,
  BookOpen,
  HelpCircle,
  Settings,
  Activity,
  MessageSquare,
  ChevronsUpDown,
  Check,
  Building2,
  Plus,
} from "lucide-react";
import clsx from "clsx";
import { switchClinicAction } from "@/app/actions/clinic-select";
import { NewClinicModal } from "@/components/new-clinic-modal";

type Clinic = { id: string; name: string; slug: string; role: string };

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendario", icon: Calendar },
  { href: "/patients", label: "Pacientes", icon: Users },
  { href: "/doctors", label: "Médicos", icon: Stethoscope },
  { href: "/conversations", label: "Conversaciones", icon: MessageSquare },
  { href: "/knowledge-base", label: "Base de IA", icon: BookOpen },
];

interface SidebarProps {
  currentClinic: { id: string; name: string; slug: string };
  clinics: Clinic[];
}

export function Sidebar({ currentClinic, clinics }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showNewClinic, setShowNewClinic] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSwitch(clinicId: string) {
    if (clinicId === currentClinic.id) { setOpen(false); return; }
    setOpen(false);
    startTransition(async () => {
      await switchClinicAction(clinicId);
      router.refresh();
    });
  }

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-white border-r border-gray-100 shadow-sm shrink-0">
      {/* Clinic header / switcher */}
      <div className="relative border-b border-gray-100">
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={isPending}
          className="w-full flex items-center gap-3 px-6 py-5 text-left hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{currentClinic.name}</p>
            <p className="text-xs text-gray-400">CRM Médico</p>
          </div>
          <ChevronsUpDown className="w-4 h-4 text-gray-300 shrink-0" />
        </button>

        {/* Dropdown */}
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute top-full left-3 right-3 z-20 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              <p className="px-3 pt-2.5 pb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Tus clínicas
              </p>
              {clinics.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSwitch(c.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-md bg-emerald-100 flex items-center justify-center shrink-0">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{c.role.toLowerCase()}</p>
                  </div>
                  {c.id === currentClinic.id && (
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  )}
                </button>
              ))}
              <div className="border-t border-gray-100 mt-1 pt-1 pb-1">
                <button
                  onClick={() => { setOpen(false); setShowNewClinic(true); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-emerald-50 transition-colors text-left rounded-lg"
                >
                  <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                    <Plus className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-600">Nueva clínica</p>
                </button>
              </div>
            </div>
          </>
        )}
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

      {showNewClinic && <NewClinicModal onClose={() => setShowNewClinic(false)} />}

      {/* Support box */}
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="rounded-xl bg-emerald-50 p-4 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <HelpCircle className="w-4 h-4 text-emerald-600" />
            <p className="text-xs font-semibold text-emerald-800">Soporte</p>
          </div>
          <p className="text-xs text-emerald-700 mb-2">
            ¿Necesitas ayuda con {currentClinic.name}?
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
