"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function uniqueSlugExcluding(name: string, excludeId: string): Promise<string> {
  let slug = slugify(name);
  let count = 0;
  while (true) {
    const existing = await prisma.clinic.findFirst({
      where: { slug, NOT: { id: excludeId } },
    });
    if (!existing) break;
    slug = `${slugify(name)}-${++count}`;
  }
  return slug;
}

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

export async function fixClinicSlugAction(clinicId: string): Promise<{ slug: string } | { error: string }> {
  await requireSuperAdmin();

  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
  if (!clinic) return { error: "Clínica no encontrada" };

  const newSlug = await uniqueSlugExcluding(clinic.name, clinicId);

  if (newSlug === clinic.slug) return { slug: clinic.slug };

  await prisma.clinic.update({ where: { id: clinicId }, data: { slug: newSlug } });

  revalidatePath("/admin/clinics");
  revalidatePath("/admin");

  return { slug: newSlug };
}
