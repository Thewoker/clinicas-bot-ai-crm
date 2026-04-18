import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RawBlock = { type?: string; text?: string };
type RawMessage = { role: string; content: string | RawBlock[] };

function extractText(content: string | RawBlock[]): string | null {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    for (const b of content) {
      if (b.type === "text" && typeof b.text === "string") return b.text;
    }
  }
  return null;
}

function lastTextMessage(messages: RawMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const text = extractText(messages[i].content);
    if (text) return text;
  }
  return null;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const convs = await prisma.whatsappConversation.findMany({
    where: { clinicId: session.clinicId },
    include: { patient: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(
    convs.map((c) => {
      const messages = (c.messages ?? []) as RawMessage[];
      return {
        id: c.id,
        patientPhone: c.patientPhone,
        patientName: c.patient?.name ?? null,
        lastMessage: lastTextMessage(messages),
        updatedAt: c.updatedAt,
        messageCount: messages.length,
      };
    })
  );
}
