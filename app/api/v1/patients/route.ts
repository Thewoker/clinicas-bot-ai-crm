import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function unauthorized(msg: string) {
  return NextResponse.json({ error: msg }, { status: 401 });
}
function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}
function notFound(msg: string) {
  return NextResponse.json({ error: msg }, { status: 404 });
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

/** GET /api/v1/patients
 * Returns all patients for the clinic.
 * Query params: search (name/phone/email substring)
 */
export async function GET(req: NextRequest) {
  const clinic = await resolveClinic(req);
  if (!clinic) return unauthorized("API key or Clinic-ID required");

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim();

  const patients = await prisma.patient.findMany({
    where: {
      clinicId: clinic.id,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      birthDate: true,
      notes: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    clinic: { id: clinic.id, name: clinic.name },
    count: patients.length,
    patients: patients.map((p) => ({
      ...p,
      birthDate: p.birthDate ? p.birthDate.toISOString().split("T")[0] : null,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}

/** POST /api/v1/patients
 * Creates a new patient. Designed for AI agent use.
 * Body: { name, phone, email?, birthDate?, notes? }
 * Returns: { success, patient }
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

  const { name, phone, email, birthDate, notes } = body as Record<string, string | undefined>;

  if (!name?.trim() || !phone?.trim()) {
    return badRequest("name and phone are required");
  }

  const patient = await prisma.patient.create({
    data: {
      clinicId: clinic.id,
      name: name.trim(),
      phone: phone.trim(),
      email: email?.trim() || null,
      birthDate: birthDate ? new Date(birthDate) : null,
      notes: notes?.trim() || null,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      birthDate: true,
      notes: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    {
      success: true,
      patient: {
        ...patient,
        birthDate: patient.birthDate ? patient.birthDate.toISOString().split("T")[0] : null,
        createdAt: patient.createdAt.toISOString(),
      },
    },
    { status: 201 }
  );
}

/** PATCH /api/v1/patients/:id
 * Updates an existing patient. Useful for AI to fill in missing data.
 * Body: { name?, phone?, email?, birthDate?, notes? }
 */
export async function PATCH(req: NextRequest) {
  const clinic = await resolveClinic(req);
  if (!clinic) return unauthorized("API key or Clinic-ID required");

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return badRequest("id query param is required");

  const patient = await prisma.patient.findFirst({
    where: { id, clinicId: clinic.id },
  });
  if (!patient) return notFound("Patient not found in this clinic");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const { name, phone, email, birthDate, notes } = body as Record<string, string | undefined>;

  const updated = await prisma.patient.update({
    where: { id },
    data: {
      ...(name?.trim() ? { name: name.trim() } : {}),
      ...(phone?.trim() ? { phone: phone.trim() } : {}),
      ...(email !== undefined ? { email: email?.trim() || null } : {}),
      ...(birthDate !== undefined ? { birthDate: birthDate ? new Date(birthDate) : null } : {}),
      ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      birthDate: true,
      notes: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    success: true,
    patient: {
      ...updated,
      birthDate: updated.birthDate ? updated.birthDate.toISOString().split("T")[0] : null,
      createdAt: updated.createdAt.toISOString(),
    },
  });
}
