export const dynamic = "force-dynamic";

import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.superAdmin) redirect("/login");

  const user = { name: session.userName, email: session.userEmail };

  return <AdminShell user={user}>{children}</AdminShell>;
}
