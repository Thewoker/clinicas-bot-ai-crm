"use client";

import { useTransition } from "react";
import { UserCheck, UserX, Trash2, RotateCcw, Loader2 } from "lucide-react";
import {
  authorizeUserAction,
  suspendUserAction,
  reactivateUserAction,
  deleteUserAction,
} from "@/app/actions/admin";

interface UserActionsProps {
  userId: string;
  status: string;
}

export function UserActions({ userId, status }: UserActionsProps) {
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    startTransition(async () => { await action(); });
  }

  if (isPending) {
    return <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-auto" />;
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {status === "PENDING" && (
        <button
          onClick={() => run(() => authorizeUserAction(userId))}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-colors"
        >
          <UserCheck className="w-3.5 h-3.5" />
          Autorizar
        </button>
      )}
      {status === "AUTHORIZED" && (
        <button
          onClick={() => run(() => suspendUserAction(userId))}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-600 hover:bg-amber-50 transition-colors"
        >
          <UserX className="w-3.5 h-3.5" />
          Suspender
        </button>
      )}
      {status === "SUSPENDED" && (
        <button
          onClick={() => run(() => reactivateUserAction(userId))}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reactivar
        </button>
      )}
      <button
        onClick={() => {
          if (confirm("¿Eliminar este usuario? Esta acción es irreversible.")) {
            run(() => deleteUserAction(userId));
          }
        }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-50 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Eliminar
      </button>
    </div>
  );
}
