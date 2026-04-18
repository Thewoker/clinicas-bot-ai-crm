import { prisma } from "@/lib/prisma";

export type NotificationType =
  | "APPOINTMENT_CREATED"
  | "APPOINTMENT_CANCELLED"
  | "APPOINTMENT_RESCHEDULED"
  | "HUMAN_REQUESTED";

interface NotificationInput {
  clinicId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export async function createNotification(data: NotificationInput) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(prisma as any).notification) return;
  try {
    return await prisma.notification.create({
      data: {
        clinicId: data.clinicId,
        type: data.type,
        title: data.title,
        body: data.body,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: (data.metadata ?? {}) as any,
      },
    });
  } catch {
    // no-op until migration is applied
  }
}
