"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function requireSuperAdmin() {
  const session = await getSession();
  if (!session?.superAdmin) throw new Error("Acceso denegado");
  return session;
}

export async function authorizeUserAction(userId: string) {
  await requireSuperAdmin();

  await prisma.user.update({
    where: { id: userId },
    data: { status: "AUTHORIZED" },
  });

  // Authorize all clinics where this user is ADMIN
  const userClinics = await prisma.userClinic.findMany({
    where: { userId, role: "ADMIN" },
  });
  if (userClinics.length > 0) {
    await prisma.clinic.updateMany({
      where: { id: { in: userClinics.map((uc) => uc.clinicId) } },
      data: { authorized: true },
    });
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/clinics");
  revalidatePath("/admin");
}

export async function suspendUserAction(userId: string) {
  await requireSuperAdmin();

  await prisma.user.update({
    where: { id: userId },
    data: { status: "SUSPENDED" },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export async function reactivateUserAction(userId: string) {
  await requireSuperAdmin();

  await prisma.user.update({
    where: { id: userId },
    data: { status: "AUTHORIZED" },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export async function deleteUserAction(userId: string) {
  await requireSuperAdmin();

  await prisma.user.delete({ where: { id: userId } });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export async function toggleClinicAuthorizationAction(clinicId: string, authorized: boolean) {
  await requireSuperAdmin();

  await prisma.clinic.update({
    where: { id: clinicId },
    data: { authorized },
  });

  revalidatePath("/admin/clinics");
  revalidatePath("/admin");
}
