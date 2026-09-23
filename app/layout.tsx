import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WhenRaid",
  description: "Trouve un raid qui cherche ta classe sur World of Warcraft Forever.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
