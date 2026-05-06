import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Archi Platform",
  description:
    "Gestion documentaire, validation, chiffrage et cycle de vie pour architectes et professionnels du bâtiment",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
