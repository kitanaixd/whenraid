import type { Metadata } from "next";
import "./globals.css";
import { Cloche } from "./Cloche";

export const metadata: Metadata = {
  title: "WhenRaid",
  description: "Trouve un raid qui cherche ta classe sur World of Warcraft Forever.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr">
      <body>
        <Cloche />
        {children}
      </body>
    </html>
  );
}
