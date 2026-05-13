"use client";

import { useState } from "react";
import { AdminSidebar } from "@/components/admin-sidebar";
import { Menu, ShieldCheck } from "lucide-react";

interface AdminShellProps {
  user: { name: string; email: string };
  children: React.ReactNode;
}

export function AdminShell({ user, children }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={[
          "fixed inset-y-0 left-0 z-30 transition-transform duration-300",
          "lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <AdminSidebar user={user} onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div className="h-12 bg-slate-900 border-b border-slate-700/50 flex items-center px-4 lg:hidden shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 ml-3">
            <ShieldCheck className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold text-white">Panel de Admin</span>
          </div>
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
