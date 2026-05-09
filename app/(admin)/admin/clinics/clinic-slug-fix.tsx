"use client";

import { useTransition } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { fixClinicSlugAction } from "@/app/actions/admin";

interface Props {
  clinicId: string;
  currentSlug: string;
}

export function ClinicSlugFix({ clinicId, currentSlug }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleFix() {
    if (!confirm(`¿Regenerar el slug de esta clínica? El slug actual es "${currentSlug}".`)) return;
    startTransition(async () => {
      const result = await fixClinicSlugAction(clinicId);
      if ("error" in result) {
        alert(`Error: ${result.error}`);
      } else if (result.slug !== currentSlug) {
        alert(`Slug corregido: ${result.slug}`);
      } else {
        alert("El slug ya era único, no se realizaron cambios.");
      }
    });
  }

  return (
    <button
      onClick={handleFix}
      disabled={isPending}
      title="Regenerar slug único desde el nombre de la clínica"
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-violet-600 hover:bg-violet-50 transition-colors disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <RefreshCw className="w-3.5 h-3.5" />
      )}
      Fix slug
    </button>
  );
}
