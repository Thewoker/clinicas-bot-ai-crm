"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

type Clinic = { id: string; name: string; slug: string; role: string };

interface DashboardShellProps {
  currentClinic: { id: string; name: string; slug: string };
  clinics: Clinic[];
  superAdmin?: boolean;
  topbarClinic: { id: string; name: string; slug: string };
  topbarUser: { name: string; email: string; role: string };
  children: React.ReactNode;
}

export function DashboardShell({
  currentClinic,
  clinics,
  superAdmin,
  topbarClinic,
  topbarUser,
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
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
        <Sidebar
          currentClinic={currentClinic}
          clinics={clinics}
          superAdmin={superAdmin}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          clinic={topbarClinic}
          user={topbarUser}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
