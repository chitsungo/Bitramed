import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AuthGate } from "@/components/auth-gate";
import { AdminShell } from "@/components/admin-shell";

export const metadata: Metadata = {
  title: "Bitramed Admin",
  description:
    "A focused control room for Bitramed learner access and performance.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <AuthGate>
            <AdminShell>{children}</AdminShell>
          </AuthGate>
        </Providers>
      </body>
    </html>
  );
}
