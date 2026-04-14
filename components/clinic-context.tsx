"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type Clinic = { id: string; name: string; slug: string; primaryColor: string };

type ClinicContextType = {
  clinic: Clinic;
  setClinic: (c: Clinic) => void;
};

const ClinicContext = createContext<ClinicContextType | null>(null);

export function ClinicProvider({
  children,
  clinics,
  defaultSlug,
}: {
  children: ReactNode;
  clinics: Clinic[];
  defaultSlug: string;
}) {
  const initial = clinics.find((c) => c.slug === defaultSlug) ?? clinics[0];
  const [clinic, setClinic] = useState<Clinic>(initial);
  return (
    <ClinicContext.Provider value={{ clinic, setClinic }}>
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinic() {
  const ctx = useContext(ClinicContext);
  if (!ctx) throw new Error("useClinic must be used inside ClinicProvider");
  return ctx;
}
