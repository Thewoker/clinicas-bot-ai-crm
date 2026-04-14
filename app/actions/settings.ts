"use server";

import { prisma } from "@/lib/prisma";
import { getSession, signSession, setSessionCookie } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

export type SettingsResult = { error: string } | { success: string };

export async function updateClinic(
  _prev: SettingsResult | null,
  formData: FormData
): Promise<SettingsResult> {
  const session = await getSession();
  if (!session) redirect("/login");

  const name = (formData.get("name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim() || null;
  const address = (formData.get("address") as string)?.trim() || null;

  if (!name) return { error: "El nombre de la clínica es obligatorio." };

  await prisma.clinic.update({
    where: { id: session.clinicId },
    data: { name, phone, address },
  });

  // Refresh session cookie with updated clinic name
  const newToken = await signSession({ ...session, clinicName: name });
  await setSessionCookie(newToken);

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: "Datos de la clínica actualizados." };
}

export async function updateUser(
  _prev: SettingsResult | null,
  formData: FormData
): Promise<SettingsResult> {
  const session = await getSession();
  if (!session) redirect("/login");

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();

  if (!name || !email) return { error: "Nombre y email son obligatorios." };

  // Check email uniqueness if it changed
  if (email !== session.userEmail) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "Ese correo ya está en uso por otra cuenta." };
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { name, email },
  });

  // Refresh session with updated user data
  const newToken = await signSession({ ...session, userName: name, userEmail: email });
  await setSessionCookie(newToken);

  revalidatePath("/settings");
  return { success: "Datos de usuario actualizados." };
}

export async function updatePassword(
  _prev: SettingsResult | null,
  formData: FormData
): Promise<SettingsResult> {
  const session = await getSession();
  if (!session) redirect("/login");

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Todos los campos de contraseña son obligatorios." };
  }
  if (newPassword.length < 8) {
    return { error: "La nueva contraseña debe tener al menos 8 caracteres." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Las contraseñas nuevas no coinciden." };
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return { error: "Usuario no encontrado." };

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) return { error: "La contraseña actual es incorrecta." };

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: session.userId },
    data: { password: hashed },
  });

  return { success: "Contraseña actualizada correctamente." };
}
