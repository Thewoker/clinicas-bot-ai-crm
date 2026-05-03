import { getPatients } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PatientList } from "./patient-list";

export default async function PatientsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const patients = await getPatients(session.clinicId);

  return <PatientList patients={patients} clinicName={session.clinicName} />;
}
