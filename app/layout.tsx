import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
// Thème actif. Autre version gardée de côté : "./fantasy.css" (heroic fantasy moderne,
// avec les polices Cinzel pour les titres et Poppins pour le texte).
import "./moderne.css";
import { EnTete } from "./EnTete";
import { PiedDePage } from "./PiedDePage";

// Police libre (licence OFL), servie par le site lui-même : Geist pour les titres et le texte.
const titre = Geist({ subsets: ["latin"], variable: "--police-titre", display: "swap" });
const texte = Geist({ subsets: ["latin"], variable: "--police-texte", display: "swap" });

export const metadata: Metadata = {
  title: "WhenRaid",
  description: "Trouve un raid qui cherche ta classe sur World of Warcraft Forever.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${titre.variable} ${texte.variable}`}>
      <body>
        <EnTete />
        {children}
        <PiedDePage />
      </body>
    </html>
  );
}
