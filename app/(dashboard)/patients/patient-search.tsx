"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition, useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";

export function PatientSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, pathname, router, searchParams]);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
        {isPending ? (
          <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
        ) : (
          <Search className="w-4 h-4 text-gray-400" />
        )}
      </div>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar por nombre, teléfono o email…"
        className="w-72 pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition"
      />
    </div>
  );
}
