"use server";

import { prisma } from "@/lib/prisma";
import { signSession, setSessionCookie, clearSessionCookie } from "@/lib/auth";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  let count = 0;
  while (await prisma.clinic.findUnique({ where: { slug } })) {
    count++;
    slug = `${slugify(base)}-${count}`;
  }
  return slug;
}

export type AuthResult = { error: string } | { success: true };

export async function registerAction(
  _prev: AuthResult | null,
  formData: FormData
): Promise<AuthResult> {
  const clinicName = (formData.get("clinicName") as string)?.trim();
  const userName = (formData.get("userName") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const address = (formData.get("address") as string)?.trim() || null;

  if (!clinicName || !userName || !email || !password) {
    return { error: "Todos los campos obligatorios son requeridos." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Ya existe una cuenta con ese correo electrónico." };
  }

  const hashed = await bcrypt.hash(password, 12);
  const slug = await uniqueSlug(clinicName);

  const clinic = await prisma.clinic.create({
    data: {
      name: clinicName,
      slug,
      phone,
      address,
      users: {
        create: {
          name: userName,
          email,
          password: hashed,
          role: "ADMIN",
        },
      },
    },
    include: { users: true },
  });

  const user = clinic.users[0];
  const token = await signSession({
    userId: user.id,
    clinicId: clinic.id,
    clinicName: clinic.name,
    clinicSlug: clinic.slug,
    userName: user.name,
    userEmail: user.email,
    role: user.role,
  });

  await setSessionCookie(token);
  redirect("/dashboard");
}

export async function loginAction(
  _prev: AuthResult | null,
  formData: FormData
): Promise<AuthResult> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email y contraseña son requeridos." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { clinic: true },
  });

  if (!user) {
    return { error: "Credenciales incorrectas." };
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return { error: "Credenciales incorrectas." };
  }

  const token = await signSession({
    userId: user.id,
    clinicId: user.clinicId,
    clinicName: user.clinic.name,
    clinicSlug: user.clinic.slug,
    userName: user.name,
    userEmail: user.email,
    role: user.role,
  });

  await setSessionCookie(token);
  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
