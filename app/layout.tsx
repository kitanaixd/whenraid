import type { Metadata } from "next";
import { Cinzel, Poppins } from "next/font/google";
import "./globals.css";
import { EnTete } from "./EnTete";
import { PiedDePage } from "./PiedDePage";

// Polices libres (licence OFL), servies par le site lui-même :
// Cinzel (capitales romaines gravées) pour les titres, Poppins (sans serif) pour le texte.
const cinzel = Cinzel({ subsets: ["latin"], variable: "--police-titre", display: "swap" });
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--police-texte",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WhenRaid",
  description: "Trouve un raid qui cherche ta classe sur World of Warcraft Forever.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${cinzel.variable} ${poppins.variable}`}>
      <body>
        <EnTete />
        {children}
        <PiedDePage />
      </body>
    </html>
  );
}
