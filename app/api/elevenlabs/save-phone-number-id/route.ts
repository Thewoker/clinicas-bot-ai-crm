import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { phoneNumberId } = await req.json();
  if (!phoneNumberId?.trim()) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await prisma.clinic.update({
    where: { id: session.clinicId },
    data: { elevenLabsPhoneNumberId: phoneNumberId.trim() },
  });

  return NextResponse.json({ ok: true });
}
