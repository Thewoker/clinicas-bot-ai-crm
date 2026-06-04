import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.superAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { clinicId, phoneNumberId } = await req.json();
  if (!clinicId || !phoneNumberId?.trim()) return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });

  await prisma.clinic.update({
    where: { id: clinicId },
    data: { elevenLabsPhoneNumberId: phoneNumberId.trim() },
  });

  return NextResponse.json({ ok: true });
}
