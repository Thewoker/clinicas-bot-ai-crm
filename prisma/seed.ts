import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clean up
  await prisma.appointment.deleteMany();
  await prisma.knowledgeBase.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.user.deleteMany();
  await prisma.clinic.deleteMany();

  const hashedPassword = await bcrypt.hash("demo1234", 12);

  // --- Clínica Natura ---
  const clinicNatura = await prisma.clinic.create({
    data: {
      name: "Clínica Natura",
      slug: "natura",
      primaryColor: "#22c55e",
      apiKey: "key_natura_demo_001",
      phone: "+34 91 234 56 78",
      address: "Calle Gran Vía 42, Madrid",
      users: {
        create: {
          name: "Admin Natura",
          email: "admin@natura.demo",
          password: hashedPassword,
          role: "ADMIN",
        },
      },
    },
  });

  // --- Clínica Vitalia ---
  const clinicVitalia = await prisma.clinic.create({
    data: {
      name: "Clínica Vitalia",
      slug: "vitalia",
      primaryColor: "#3b82f6",
      apiKey: "key_vitalia_demo_002",
      phone: "+34 93 456 78 90",
      address: "Passeig de Gràcia 88, Barcelona",
      users: {
        create: {
          name: "Admin Vitalia",
          email: "admin@vitalia.demo",
          password: hashedPassword,
          role: "ADMIN",
        },
      },
    },
  });

  // --- Doctors Natura ---
  const doctorsMatura = await Promise.all([
    prisma.doctor.create({
      data: {
        clinicId: clinicNatura.id,
        name: "Dra. Ana García",
        specialty: "Medicina General",
        email: "ana.garcia@clinica-natura.es",
        phone: "+34 600 111 222",
        color: "#22c55e",
      },
    }),
    prisma.doctor.create({
      data: {
        clinicId: clinicNatura.id,
        name: "Dr. Carlos Ruiz",
        specialty: "Fisioterapia",
        email: "carlos.ruiz@clinica-natura.es",
        phone: "+34 600 333 444",
        color: "#f59e0b",
      },
    }),
    prisma.doctor.create({
      data: {
        clinicId: clinicNatura.id,
        name: "Dra. Laura Martín",
        specialty: "Nutrición",
        email: "laura.martin@clinica-natura.es",
        phone: "+34 600 555 666",
        color: "#8b5cf6",
      },
    }),
  ]);

  // --- Doctors Vitalia ---
  const doctorsVitalia = await Promise.all([
    prisma.doctor.create({
      data: {
        clinicId: clinicVitalia.id,
        name: "Dr. Jaume Puig",
        specialty: "Traumatología",
        email: "jaume.puig@clinica-vitalia.es",
        color: "#3b82f6",
      },
    }),
    prisma.doctor.create({
      data: {
        clinicId: clinicVitalia.id,
        name: "Dra. Marta Vidal",
        specialty: "Dermatología",
        email: "marta.vidal@clinica-vitalia.es",
        color: "#ec4899",
      },
    }),
  ]);

  // --- Patients Natura ---
  const patientsNatura = await Promise.all([
    prisma.patient.create({
      data: {
        clinicId: clinicNatura.id,
        name: "María López",
        email: "maria.lopez@email.com",
        phone: "+34 612 000 001",
        birthDate: new Date("1985-03-15"),
      },
    }),
    prisma.patient.create({
      data: {
        clinicId: clinicNatura.id,
        name: "Pedro Sánchez",
        email: "pedro.sanchez@email.com",
        phone: "+34 612 000 002",
        birthDate: new Date("1978-07-22"),
      },
    }),
    prisma.patient.create({
      data: {
        clinicId: clinicNatura.id,
        name: "Elena Morales",
        email: "elena.morales@email.com",
        phone: "+34 612 000 003",
        birthDate: new Date("1992-11-05"),
      },
    }),
    prisma.patient.create({
      data: {
        clinicId: clinicNatura.id,
        name: "Roberto Jiménez",
        phone: "+34 612 000 004",
        birthDate: new Date("1965-01-30"),
      },
    }),
    prisma.patient.create({
      data: {
        clinicId: clinicNatura.id,
        name: "Sofía Torres",
        email: "sofia.torres@email.com",
        phone: "+34 612 000 005",
      },
    }),
  ]);

  // --- Patients Vitalia ---
  const patientsVitalia = await Promise.all([
    prisma.patient.create({
      data: {
        clinicId: clinicVitalia.id,
        name: "Jordi Mas",
        phone: "+34 612 000 010",
      },
    }),
    prisma.patient.create({
      data: {
        clinicId: clinicVitalia.id,
        name: "Anna Ferrer",
        email: "anna.ferrer@email.com",
        phone: "+34 612 000 011",
      },
    }),
  ]);

  // --- Appointments Natura (today + surrounding days) ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const makeDate = (dayOffset: number, hour: number, minute = 0) => {
    const d = new Date(today);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  await Promise.all([
    prisma.appointment.create({
      data: {
        clinicId: clinicNatura.id,
        doctorId: doctorsMatura[0].id,
        patientId: patientsNatura[0].id,
        service: "Consulta General",
        price: 60,
        startTime: makeDate(0, 9, 0),
        endTime: makeDate(0, 9, 30),
        status: "CONFIRMED",
      },
    }),
    prisma.appointment.create({
      data: {
        clinicId: clinicNatura.id,
        doctorId: doctorsMatura[0].id,
        patientId: patientsNatura[1].id,
        service: "Revisión Analítica",
        price: 80,
        startTime: makeDate(0, 10, 0),
        endTime: makeDate(0, 10, 30),
        status: "SCHEDULED",
      },
    }),
    prisma.appointment.create({
      data: {
        clinicId: clinicNatura.id,
        doctorId: doctorsMatura[1].id,
        patientId: patientsNatura[2].id,
        service: "Sesión Fisioterapia",
        price: 55,
        startTime: makeDate(0, 9, 30),
        endTime: makeDate(0, 10, 30),
        status: "CONFIRMED",
      },
    }),
    prisma.appointment.create({
      data: {
        clinicId: clinicNatura.id,
        doctorId: doctorsMatura[1].id,
        patientId: patientsNatura[3].id,
        service: "Masaje Terapéutico",
        price: 45,
        startTime: makeDate(0, 11, 0),
        endTime: makeDate(0, 11, 45),
        status: "SCHEDULED",
      },
    }),
    prisma.appointment.create({
      data: {
        clinicId: clinicNatura.id,
        doctorId: doctorsMatura[2].id,
        patientId: patientsNatura[4].id,
        service: "Plan Nutricional",
        price: 90,
        startTime: makeDate(0, 10, 0),
        endTime: makeDate(0, 11, 0),
        status: "CONFIRMED",
      },
    }),
    prisma.appointment.create({
      data: {
        clinicId: clinicNatura.id,
        doctorId: doctorsMatura[0].id,
        patientId: patientsNatura[0].id,
        service: "Seguimiento",
        price: 40,
        startTime: makeDate(1, 9, 0),
        endTime: makeDate(1, 9, 30),
        status: "SCHEDULED",
      },
    }),
    prisma.appointment.create({
      data: {
        clinicId: clinicNatura.id,
        doctorId: doctorsMatura[2].id,
        patientId: patientsNatura[2].id,
        service: "Revisión Nutricional",
        price: 60,
        startTime: makeDate(-1, 11, 0),
        endTime: makeDate(-1, 12, 0),
        status: "COMPLETED",
      },
    }),
    prisma.appointment.create({
      data: {
        clinicId: clinicNatura.id,
        doctorId: doctorsMatura[0].id,
        patientId: patientsNatura[3].id,
        service: "Consulta General",
        price: 60,
        startTime: makeDate(-2, 10, 0),
        endTime: makeDate(-2, 10, 30),
        status: "COMPLETED",
      },
    }),
    // Vitalia
    prisma.appointment.create({
      data: {
        clinicId: clinicVitalia.id,
        doctorId: doctorsVitalia[0].id,
        patientId: patientsVitalia[0].id,
        service: "Consulta Traumatología",
        price: 120,
        startTime: makeDate(0, 9, 0),
        endTime: makeDate(0, 9, 45),
        status: "CONFIRMED",
      },
    }),
    prisma.appointment.create({
      data: {
        clinicId: clinicVitalia.id,
        doctorId: doctorsVitalia[1].id,
        patientId: patientsVitalia[1].id,
        service: "Dermatología Estética",
        price: 150,
        startTime: makeDate(0, 10, 0),
        endTime: makeDate(0, 11, 0),
        status: "SCHEDULED",
      },
    }),
  ]);

  // --- Knowledge Base Natura ---
  await Promise.all([
    prisma.knowledgeBase.create({
      data: {
        clinicId: clinicNatura.id,
        question: "¿Cuál es el horario de la clínica?",
        answer:
          "Nuestro horario es de lunes a viernes de 9:00 a 20:00h, y sábados de 9:00 a 14:00h.",
        category: "Horarios",
        order: 1,
      },
    }),
    prisma.knowledgeBase.create({
      data: {
        clinicId: clinicNatura.id,
        question: "¿Cómo puedo pedir cita?",
        answer:
          "Puedes pedir cita llamando al +34 91 234 56 78, por WhatsApp o a través de nuestra web.",
        category: "Citas",
        order: 2,
      },
    }),
    prisma.knowledgeBase.create({
      data: {
        clinicId: clinicNatura.id,
        question: "¿Qué servicios ofrecen?",
        answer:
          "Ofrecemos Medicina General, Fisioterapia, Nutrición, Osteopatía y Medicina Estética.",
        category: "Servicios",
        order: 3,
      },
    }),
    prisma.knowledgeBase.create({
      data: {
        clinicId: clinicNatura.id,
        question: "¿Cuánto cuesta una consulta?",
        answer:
          "La consulta general tiene un precio de 60€. La primera visita de fisioterapia es de 55€. Consulta nuestras tarifas completas en recepción.",
        category: "Precios",
        order: 4,
      },
    }),
    prisma.knowledgeBase.create({
      data: {
        clinicId: clinicNatura.id,
        question: "¿Aceptan seguros médicos?",
        answer:
          "Sí, trabajamos con Sanitas, Adeslas, Asisa y Mapfre Salud. Consulta con tu seguro para confirmar la cobertura.",
        category: "Seguros",
        order: 5,
      },
    }),
  ]);

  // --- Knowledge Base Vitalia ---
  await Promise.all([
    prisma.knowledgeBase.create({
      data: {
        clinicId: clinicVitalia.id,
        question: "¿Dónde están ubicados?",
        answer:
          "Estamos en el Passeig de Gràcia 88, Barcelona. Cerca de las estaciones de metro Passeig de Gràcia (L2, L3, L4).",
        category: "Ubicación",
        order: 1,
      },
    }),
    prisma.knowledgeBase.create({
      data: {
        clinicId: clinicVitalia.id,
        question: "¿Qué especialidades tienen?",
        answer:
          "Contamos con especialistas en Traumatología, Dermatología, Cirugía Menor y Medicina Deportiva.",
        category: "Servicios",
        order: 2,
      },
    }),
    prisma.knowledgeBase.create({
      data: {
        clinicId: clinicVitalia.id,
        question: "¿Tienen aparcamiento?",
        answer:
          "No disponemos de aparcamiento propio, pero hay varios parkings públicos a menos de 200m de la clínica.",
        category: "Ubicación",
        order: 3,
      },
    }),
  ]);

  console.log("✅ Seed completed successfully");
  console.log(`   Clínica Natura  → admin@natura.demo  / demo1234`);
  console.log(`   Clínica Vitalia → admin@vitalia.demo / demo1234`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
