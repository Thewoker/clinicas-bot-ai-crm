import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const notifications = await prisma.notification.findMany({
      where: { clinicId: session.clinicId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json(notifications);
  } catch {
    return NextResponse.json([]);
  }
}

export async function PATCH() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await prisma.notification.updateMany({
      where: { clinicId: session.clinicId, read: false },
      data: { read: true },
    });
  } catch {
    // table may not exist yet
  }

  return NextResponse.json({ ok: true });
}
