export const dynamic = "force-dynamic";

import { getSession } from "@/lib/auth";
import { getUserClinics } from "@/lib/data";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const clinics = await getUserClinics(session.userId);

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
    <DashboardShell
      currentClinic={clinic}
      clinics={clinics}
      superAdmin={session.superAdmin}
      topbarClinic={clinic}
      topbarUser={user}
    >
      {children}
    </DashboardShell>
  );
}
