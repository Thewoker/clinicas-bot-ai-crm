import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function unauthorized(msg: string) {
  return NextResponse.json({ error: msg }, { status: 401 });
}
function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

async function resolveClinic(req: NextRequest) {
  const apiKey =
    req.headers.get("x-api-key") ?? req.headers.get("clinic-api-key");
  const clinicId = req.headers.get("x-clinic-id");
  if (!apiKey && !clinicId) return null;
  return prisma.clinic.findFirst({
    where: apiKey ? { apiKey } : { id: clinicId! },
  });
}

/**
 * GET /api/v1/availability?doctorId=xxx&date=2026-04-15&duration=30
 * Returns free time slots for a doctor on a given date.
 * duration: slot size in minutes (default 30)
 */
export async function GET(req: NextRequest) {
  const clinic = await resolveClinic(req);
  if (!clinic) return unauthorized("API key or Clinic-ID required");

  const { searchParams } = new URL(req.url);
  const doctorId = searchParams.get("doctorId");
  const dateParam = searchParams.get("date"); // YYYY-MM-DD
  const duration = parseInt(searchParams.get("duration") ?? "30", 10);

  if (!doctorId || !dateParam) {
    return badRequest("doctorId and date are required");
  }

  // Validate doctor belongs to this clinic
  const doctor = await prisma.doctor.findFirst({
    where: { id: doctorId, clinicId: clinic.id },
    include: { availability: true },
  });
  if (!doctor) return badRequest("Doctor not found in this clinic");

  // Parse date in local terms (treat as clinic's timezone — UTC for now)
  const [year, month, day] = dateParam.split("-").map(Number);
  const dayStart = new Date(year, month - 1, day, 0, 0, 0);
  const dayEnd = new Date(year, month - 1, day, 23, 59, 59);
  const dayOfWeek = dayStart.getDay(); // 0=Sun … 6=Sat

  // Get doctor's configured availability for this day of week
  const avail = doctor.availability.find((a) => a.dayOfWeek === dayOfWeek);
  if (!avail) {
    return NextResponse.json({
      date: dateParam,
      doctor: { id: doctor.id, name: doctor.name },
      available: false,
      reason: "El médico no trabaja ese día",
      slots: [],
    });
  }

  // Existing appointments that day (non-cancelled)
  const existing = await prisma.appointment.findMany({
    where: {
      clinicId: clinic.id,
      doctorId,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      startTime: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { startTime: "asc" },
    select: { startTime: true, endTime: true },
  });

  // Generate all slots in the availability window
  const [startH, startM] = avail.startTime.split(":").map(Number);
  const [endH, endM] = avail.endTime.split(":").map(Number);

  const windowStart = new Date(year, month - 1, day, startH, startM, 0);
  const windowEnd = new Date(year, month - 1, day, endH, endM, 0);

  const slots: { startTime: string; endTime: string; available: boolean }[] = [];
  let cursor = new Date(windowStart);

  while (cursor < windowEnd) {
    const slotEnd = new Date(cursor.getTime() + duration * 60 * 1000);
    if (slotEnd > windowEnd) break;

    // Check overlap with existing appointments
    const busy = existing.some(
      (apt) =>
        cursor < new Date(apt.endTime) && slotEnd > new Date(apt.startTime)
    );

    slots.push({
      startTime: cursor.toISOString(),
      endTime: slotEnd.toISOString(),
      available: !busy,
    });

    cursor = slotEnd;
  }

  const freeSlots = slots.filter((s) => s.available);

  return NextResponse.json({
    date: dateParam,
    doctor: { id: doctor.id, name: doctor.name, specialty: doctor.specialty },
    workingHours: { start: avail.startTime, end: avail.endTime },
    slotDuration: duration,
    totalSlots: slots.length,
    freeSlots: freeSlots.length,
    slots: freeSlots,
  });
}
