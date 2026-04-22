import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevMatch — Find Your Developer Tribe",
  description:
    "AI-powered developer friendship app. Match with compatible coders, share story cards, and grow together.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
