import { Suspense } from "react";
import { AuthPage } from "@/components/auth/auth-page";

export default function LandingPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-black" />}>
      <AuthPage />
    </Suspense>
  );
}
