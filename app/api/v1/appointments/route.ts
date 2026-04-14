import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function unauthorized(msg: string) {
  return NextResponse.json({ error: msg }, { status: 401 });
}
function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}
function conflict(msg: string) {
  return NextResponse.json({ error: msg }, { status: 409 });
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

/** GET /api/v1/appointments
 * Returns appointments for the clinic identified by the API key.
 * Query params: date (YYYY-MM-DD), doctorId, status
 */
export async function GET(req: NextRequest) {
  const clinic = await resolveClinic(req);
  if (!clinic) return unauthorized("API key or Clinic-ID required");

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const doctorId = searchParams.get("doctorId");
  const status = searchParams.get("status");

  let from: Date | undefined;
  let to: Date | undefined;
  if (dateParam) {
    from = new Date(dateParam);
    from.setHours(0, 0, 0, 0);
    to = new Date(dateParam);
    to.setHours(23, 59, 59, 999);
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId: clinic.id,
      ...(doctorId ? { doctorId } : {}),
      ...(status ? { status: status as never } : {}),
      ...(from && to ? { startTime: { gte: from, lte: to } } : {}),
    },
    include: {
      doctor: { select: { id: true, name: true, specialty: true } },
      patient: { select: { id: true, name: true, phone: true, email: true } },
    },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json({
    clinic: { id: clinic.id, name: clinic.name, slug: clinic.slug },
    count: appointments.length,
    appointments: appointments.map((a) => ({
      id: a.id,
      service: a.service,
      price: Number(a.price),
      startTime: a.startTime.toISOString(),
      endTime: a.endTime.toISOString(),
      status: a.status,
      doctor: a.doctor,
      patient: a.patient,
    })),
  });
}

/** POST /api/v1/appointments
 * Creates a new appointment for the clinic identified by the API key.
 * Body: { doctorId, patientId, service, price, startTime, endTime, notes? }
 * If patientId is omitted but patientName + patientPhone are provided, a patient is auto-created.
 */
export async function POST(req: NextRequest) {
  const clinic = await resolveClinic(req);
  if (!clinic) return unauthorized("API key or Clinic-ID required");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const {
    doctorId,
    patientId,
    patientName,
    patientPhone,
    service,
    price,
    startTime: startRaw,
    endTime: endRaw,
    notes,
  } = body as Record<string, string | number | undefined>;

  if (!doctorId || !service || !startRaw || !endRaw) {
    return badRequest("doctorId, service, startTime and endTime are required");
  }

  // Validate doctor belongs to this clinic
  const doctor = await prisma.doctor.findFirst({
    where: { id: String(doctorId), clinicId: clinic.id },
  });
  if (!doctor) return badRequest("Doctor not found in this clinic");

  const startTime = new Date(String(startRaw));
  const endTime = new Date(String(endRaw));

  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
    return badRequest("Invalid startTime or endTime");
  }
  if (endTime <= startTime) {
    return badRequest("endTime must be after startTime");
  }

  // Check doctor availability for this day/time
  const dayOfWeek = startTime.getDay(); // 0=Sun … 6=Sat
  const availability = await prisma.doctorAvailability.findFirst({
    where: { doctorId: String(doctorId), dayOfWeek },
  });

  const toHHMM = (d: Date) =>
    `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;

  if (!availability) {
    const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    return badRequest(`El médico no tiene horario configurado para el ${dayNames[dayOfWeek]}`);
  }

  const startHHMM = toHHMM(startTime);
  const endHHMM = toHHMM(endTime);

  if (startHHMM < availability.startTime || endHHMM > availability.endTime) {
    return badRequest(
      `El médico solo atiende de ${availability.startTime} a ${availability.endTime} ese día`
    );
  }

  // Check for overlapping appointments for this doctor
  const overlap = await prisma.appointment.findFirst({
    where: {
      clinicId: clinic.id,
      doctorId: String(doctorId),
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      OR: [
        { startTime: { lt: endTime }, endTime: { gt: startTime } },
      ],
    },
  });
  if (overlap) {
    return conflict(
      `Doctor already has an appointment from ${overlap.startTime.toISOString()} to ${overlap.endTime.toISOString()}`
    );
  }

  // Resolve or create patient
  let resolvedPatientId = patientId ? String(patientId) : null;
  if (!resolvedPatientId) {
    if (!patientName || !patientPhone) {
      return badRequest("Either patientId or patientName+patientPhone are required");
    }
    const newPatient = await prisma.patient.create({
      data: {
        clinicId: clinic.id,
        name: String(patientName),
        phone: String(patientPhone),
      },
    });
    resolvedPatientId = newPatient.id;
  } else {
    const patient = await prisma.patient.findFirst({
      where: { id: resolvedPatientId, clinicId: clinic.id },
    });
    if (!patient) return badRequest("Patient not found in this clinic");
  }

  const appointment = await prisma.appointment.create({
    data: {
      clinicId: clinic.id,
      doctorId: String(doctorId),
      patientId: resolvedPatientId,
      service: String(service),
      price: Number(price ?? 0),
      startTime,
      endTime,
      notes: notes ? String(notes) : null,
      status: "SCHEDULED",
    },
    include: {
      doctor: { select: { id: true, name: true, specialty: true } },
      patient: { select: { id: true, name: true, phone: true } },
    },
  });

  return NextResponse.json(
    {
      success: true,
      appointment: {
        id: appointment.id,
        service: appointment.service,
        price: Number(appointment.price),
        startTime: appointment.startTime.toISOString(),
        endTime: appointment.endTime.toISOString(),
        status: appointment.status,
        doctor: appointment.doctor,
        patient: appointment.patient,
      },
    },
    { status: 201 }
  );
}
