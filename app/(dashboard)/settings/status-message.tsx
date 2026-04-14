"use client";

import { CheckCircle, AlertCircle } from "lucide-react";

type State = { error: string } | { success: string } | null;

export function StatusMessage({ state }: { state: State }) {
  if (!state) return null;

  if ("error" in state) {
    return (
      <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        {state.error}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700">
      <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
      {state.success}
    </div>
  );
}
