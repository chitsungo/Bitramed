import { Suspense } from "react";
import { PasswordResetPage } from "@/components/auth/password-reset-page";

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-background" />}>
      <PasswordResetPage />
    </Suspense>
  );
}
