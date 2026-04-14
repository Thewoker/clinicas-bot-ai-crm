import { prisma } from "./prisma";

export async function getClinics() {
  return prisma.clinic.findMany({ orderBy: { name: "asc" } });
}

export async function getClinic(slug: string) {
  return prisma.clinic.findUnique({ where: { slug } });
}

export async function getDoctors(clinicId: string) {
  return prisma.doctor.findMany({
    where: { clinicId },
    orderBy: { name: "asc" },
    include: {
      availability: { orderBy: { dayOfWeek: "asc" } },
    },
  });
}

export async function getPatients(clinicId: string) {
  return prisma.patient.findMany({
    where: { clinicId },
    orderBy: { name: "asc" },
  });
}

export async function getAppointments(
  clinicId: string,
  from?: Date,
  to?: Date
) {
  return prisma.appointment.findMany({
    where: {
      clinicId,
      ...(from && to ? { startTime: { gte: from, lte: to } } : {}),
    },
    include: {
      doctor: true,
      patient: true,
    },
    orderBy: { startTime: "asc" },
  });
}

export async function getKnowledgeBase(clinicId: string) {
  return prisma.knowledgeBase.findMany({
    where: { clinicId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
}

export async function getDashboardStats(clinicId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [
    totalAppointments,
    monthAppointments,
    confirmedAppointments,
    totalPatients,
    totalDoctors,
    monthRevenue,
  ] = await Promise.all([
    prisma.appointment.count({ where: { clinicId } }),
    prisma.appointment.count({
      where: { clinicId, startTime: { gte: startOfMonth, lte: endOfMonth } },
    }),
    prisma.appointment.count({
      where: { clinicId, status: { in: ["CONFIRMED", "COMPLETED"] } },
    }),
    prisma.patient.count({ where: { clinicId } }),
    prisma.doctor.count({ where: { clinicId } }),
    prisma.appointment.aggregate({
      where: {
        clinicId,
        startTime: { gte: startOfMonth, lte: endOfMonth },
        status: { in: ["CONFIRMED", "COMPLETED"] },
      },
      _sum: { price: true },
    }),
  ]);

  return {
    totalAppointments,
    monthAppointments,
    confirmedAppointments,
    totalPatients,
    totalDoctors,
    monthRevenue: Number(monthRevenue._sum.price ?? 0),
  };
}
