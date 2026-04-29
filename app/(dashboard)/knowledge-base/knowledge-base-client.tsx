"use client";

import { useState, useTransition } from "react";
import { createFaq, updateFaq, deleteFaq, toggleFaq } from "@/app/actions/knowledge-base";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, Bot, ToggleLeft, ToggleRight } from "lucide-react";
import clsx from "clsx";

type Faq = {
  id: string;
  question: string;
  answer: string;
  category: string;
  active: boolean;
  order: number;
};

export function KnowledgeBaseClient({
  clinicId,
  initialFaqs,
}: {
  clinicId: string;
  initialFaqs: Faq[];
}) {
  const [faqs, setFaqs] = useState(initialFaqs);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Faq | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const categories = Array.from(new Set(faqs.map((f) => f.category).filter(Boolean)));

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const created = await createFaq(formData);
      setFaqs((prev) => [...prev, { ...created, category: created.category ?? "" }]);
      setShowForm(false);
    });
  }

  function handleUpdate(formData: FormData) {
    startTransition(async () => {
      const updated = await updateFaq(formData);
      setFaqs((prev) =>
        prev.map((f) => (f.id === updated.id ? { ...updated, category: updated.category ?? "" } : f))
      );
      setEditing(null);
    });
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta entrada de la base de conocimiento?")) return;
    startTransition(async () => {
      await deleteFaq(id);
      setFaqs((prev) => prev.filter((f) => f.id !== id));
    });
  }

  function handleToggle(id: string, active: boolean) {
    startTransition(async () => {
      await toggleFaq(id, !active);
      setFaqs((prev) => prev.map((f) => (f.id === id ? { ...f, active: !active } : f)));
    });
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Bot className="w-4 h-4 text-emerald-500" />
          <span>
            <strong className="text-gray-800">{faqs.filter((f) => f.active).length}</strong> entradas activas de{" "}
            <strong className="text-gray-800">{faqs.length}</strong> totales
          </span>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); }}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva entrada
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <FaqForm
          clinicId={clinicId}
          categories={categories}
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          isPending={isPending}
        />
      )}

      {/* FAQ list */}
      <div className="space-y-2">
        {faqs.length === 0 && !showForm && (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Bot className="w-8 h-8 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">
              No hay entradas configuradas todavía.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-sm text-emerald-600 font-medium hover:underline"
            >
              Añadir la primera entrada
            </button>
          </div>
        )}

        {faqs.map((faq) => (
          <div
            key={faq.id}
            className={clsx(
              "bg-white rounded-xl border transition-colors",
              faq.active ? "border-gray-100" : "border-gray-100 opacity-60"
            )}
          >
            {editing?.id === faq.id ? (
              <div className="p-4">
                <FaqForm
                  clinicId={clinicId}
                  faq={faq}
                  categories={categories}
                  onSubmit={handleUpdate}
                  onCancel={() => setEditing(null)}
                  isPending={isPending}
                />
              </div>
            ) : (
              <>
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer"
                  onClick={() => setExpanded(expanded === faq.id ? null : faq.id)}
                >
                  <div className="flex-1 min-w-0">
                    {faq.category && (
                      <span className="inline-block text-xs bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5 font-medium mb-1">
                        {faq.category}
                      </span>
                    )}
                    <p className="text-sm font-semibold text-gray-800">
                      {faq.question}
                    </p>
                    {expanded === faq.id && (
                      <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                        {faq.answer}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggle(faq.id, faq.active); }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                      title={faq.active ? "Desactivar" : "Activar"}
                    >
                      {faq.active ? (
                        <ToggleRight className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditing(faq); }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(faq.id); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {expanded === faq.id ? (
                      <ChevronUp className="w-4 h-4 text-gray-300" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-300" />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FaqForm({
  clinicId,
  faq,
  categories,
  onSubmit,
  onCancel,
  isPending,
}: {
  clinicId: string;
  faq?: Faq;
  categories: string[];
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <form action={onSubmit} className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100">
      <input type="hidden" name="clinicId" value={clinicId} />
      {faq && <input type="hidden" name="id" value={faq.id} />}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Pregunta del cliente <span className="text-red-400">*</span>
          </label>
          <input
            name="question"
            defaultValue={faq?.question}
            required
            placeholder="Ej: ¿Cuál es el horario de la clínica?"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Respuesta de la IA <span className="text-red-400">*</span>
          </label>
          <textarea
            name="answer"
            defaultValue={faq?.answer}
            required
            rows={3}
            placeholder="Ej: Nuestro horario es de lunes a viernes de 9:00 a 20:00h."
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Categoría (opcional)
          </label>
          <input
            name="category"
            defaultValue={faq?.category}
            placeholder="Ej: Horarios, Precios…"
            list="categories-list"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
          />
          <datalist id="categories-list">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          {isPending ? "Guardando…" : faq ? "Guardar cambios" : "Crear entrada"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
