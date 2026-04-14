export const dynamic = "force-dynamic";

import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { Suspense } from "react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const clinic = {
    id: session.clinicId,
    name: session.clinicName,
    slug: session.clinicSlug,
  };

  const user = {
    name: session.userName,
    email: session.userEmail,
    role: session.role,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Suspense fallback={<div className="w-64 shrink-0 bg-white border-r border-gray-100" />}>
        <Sidebar clinicName={clinic.name} />
      </Suspense>
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Suspense fallback={<div className="h-14 bg-white border-b border-gray-100" />}>
          <Topbar clinic={clinic} user={user} />
        </Suspense>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
