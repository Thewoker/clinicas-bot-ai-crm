import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const notification = await prisma.notification.findFirst({
      where: { id, clinicId: session.clinicId },
    });
    if (!notification) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ ok: true });
  }
}
