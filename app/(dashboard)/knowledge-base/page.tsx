import { getKnowledgeBase } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { KnowledgeBaseClient } from "./knowledge-base-client";

export default async function KnowledgeBasePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const faqs = await getKnowledgeBase(session.clinicId);

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Configuración de IA</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Base de conocimiento para el agente de {session.clinicName}. Esta información
          es exclusiva de esta clínica.
        </p>
      </div>
      <KnowledgeBaseClient
        clinicId={session.clinicId}
        initialFaqs={faqs.map((f) => ({
          id: f.id,
          question: f.question,
          answer: f.answer,
          category: f.category ?? "",
          active: f.active,
          order: f.order,
        }))}
      />
    </div>
  );
}
