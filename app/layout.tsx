import type { Metadata } from "next";
import { Cinzel, EB_Garamond } from "next/font/google";
import "./globals.css";
import { EnTete } from "./EnTete";
import { PiedDePage } from "./PiedDePage";

// Polices libres (licence OFL), servies par le site lui-même :
// Cinzel (capitales romaines gravées) pour les titres, EB Garamond pour le texte.
const cinzel = Cinzel({ subsets: ["latin"], variable: "--police-titre", display: "swap" });
const garamond = EB_Garamond({ subsets: ["latin"], variable: "--police-texte", display: "swap" });

export const metadata: Metadata = {
  title: "WhenRaid",
  description: "Trouve un raid qui cherche ta classe sur World of Warcraft Forever.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${cinzel.variable} ${garamond.variable}`}>
      <body>
        <EnTete />
        {children}
        <PiedDePage />
      </body>
    </html>
  );
}
