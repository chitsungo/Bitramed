import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { AuthGate } from "@/components/auth-gate";

export const metadata: Metadata = {
  title: "Admin",
  description: "Bitramed learner access and performance control room.",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <AdminShell>{children}</AdminShell>
    </AuthGate>
  );
}
