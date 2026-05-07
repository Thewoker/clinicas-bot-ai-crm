"use client";

import { useTransition } from "react";
import { toggleClinicAuthorizationAction } from "@/app/actions/admin";
import { Loader2 } from "lucide-react";

interface ClinicToggleProps {
  clinicId: string;
  authorized: boolean;
}

export function ClinicToggle({ clinicId, authorized }: ClinicToggleProps) {
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await toggleClinicAuthorizationAction(clinicId, !authorized);
    });
  }

  if (isPending) {
    return <Loader2 className="w-4 h-4 animate-spin text-slate-400" />;
  }

  return (
    <button
      onClick={toggle}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
        authorized ? "bg-emerald-500" : "bg-slate-200"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          authorized ? "translate-x-[18px]" : "translate-x-1"
        }`}
      />
    </button>
  );
}
