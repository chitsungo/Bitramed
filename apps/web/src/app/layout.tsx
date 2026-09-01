import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: { default: "Bitramed", template: "%s | Bitramed" },
  description:
    "Medical revision, quizzes, and past papers for Bitramed learners.",
  icons: {
    icon: "https://frlujqujvpqwvtavofdq.supabase.co/storage/v1/object/public/Site%20Images/favicon.png",
    shortcut:
      "https://frlujqujvpqwvtavofdq.supabase.co/storage/v1/object/public/Site%20Images/favicon.png",
    apple:
      "https://frlujqujvpqwvtavofdq.supabase.co/storage/v1/object/public/Site%20Images/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
