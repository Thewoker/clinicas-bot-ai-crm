import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { whatsappManager } from "@/lib/whatsapp/manager";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const conv = await prisma.whatsappConversation.findFirst({
    where: { id, clinicId: session.clinicId },
    include: { patient: { select: { id: true, name: true } } },
  });

  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(conv);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { message } = await req.json();

  if (!message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const conv = await prisma.whatsappConversation.findFirst({
    where: { id, clinicId: session.clinicId },
  });

  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const toNumber = conv.patientPhone.startsWith("+")
    ? conv.patientPhone
    : `+${conv.patientPhone}`;

  try {
    await whatsappManager.sendMessage(session.clinicId, toNumber, message.trim());
  } catch {
    return NextResponse.json(
      { error: "WhatsApp no está conectado para esta clínica" },
      { status: 503 }
    );
  }

  const messages = (conv.messages ?? []) as Array<{ role: string; content: string }>;
  messages.push({ role: "assistant", content: message.trim() });

  const updated = await prisma.whatsappConversation.update({
    where: { id: conv.id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { messages: messages as any },
    include: { patient: { select: { id: true, name: true } } },
  });

  return NextResponse.json(updated);
}
