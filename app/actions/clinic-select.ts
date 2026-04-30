"use server";

import { prisma } from "@/lib/prisma";
import {
  getPendingSession,
  getSession,
  signSession,
  setSessionCookie,
  clearPendingCookie,
} from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

type ActionResult = { success: string } | { error: string };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  let count = 0;
  while (await prisma.clinic.findUnique({ where: { slug } })) {
    slug = `${slugify(base)}-${++count}`;
  }
  return slug;
}

// Called from dashboard: creates a new clinic and switches to it
export async function createClinicAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const name = (formData.get("name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim() || null;
  const address = (formData.get("address") as string)?.trim() || null;

  if (!name) return { error: "El nombre de la clínica es requerido." };

  const slug = await uniqueSlug(name);

  const { clinic } = await prisma.$transaction(async (tx) => {
    const clinic = await tx.clinic.create({ data: { name, slug, phone, address } });
    await tx.userClinic.create({
      data: { userId: session.userId, clinicId: clinic.id, role: "ADMIN" },
    });
    return { clinic };
  });

  const token = await signSession({
    userId: session.userId,
    clinicId: clinic.id,
    clinicName: clinic.name,
    clinicSlug: clinic.slug,
    userName: session.userName,
    userEmail: session.userEmail,
    role: "ADMIN",
  });

  await setSessionCookie(token);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// Called from /select-clinic: finalizes login by choosing a clinic
export async function selectClinicAction(formData: FormData) {
  const pending = await getPendingSession();
  if (!pending) redirect("/login");

  const clinicId = formData.get("clinicId") as string;

  const userClinic = await prisma.userClinic.findUnique({
    where: { userId_clinicId: { userId: pending.userId, clinicId } },
    include: { clinic: true },
  });
  if (!userClinic) redirect("/select-clinic");

  const token = await signSession({
    userId: pending.userId,
    clinicId: userClinic.clinic.id,
    clinicName: userClinic.clinic.name,
    clinicSlug: userClinic.clinic.slug,
    userName: pending.userName,
    userEmail: pending.userEmail,
    role: userClinic.role,
  });

  await setSessionCookie(token);
  await clearPendingCookie();
  redirect("/dashboard");
}

// Called from sidebar: switches active clinic for an already logged-in user
export async function switchClinicAction(clinicId: string) {
  const session = await getSession();
  if (!session) redirect("/login");

  const userClinic = await prisma.userClinic.findUnique({
    where: { userId_clinicId: { userId: session.userId, clinicId } },
    include: { clinic: true },
  });
  if (!userClinic) return;

  const token = await signSession({
    userId: session.userId,
    clinicId: userClinic.clinic.id,
    clinicName: userClinic.clinic.name,
    clinicSlug: userClinic.clinic.slug,
    userName: session.userName,
    userEmail: session.userEmail,
    role: userClinic.role,
  });

  await setSessionCookie(token);
  redirect("/dashboard");
}
