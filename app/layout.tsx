import type { Metadata } from "next";
import { Marcellus, Poppins } from "next/font/google";
import "./globals.css";
import "./wow.css";
import { EnTete } from "./EnTete";
import { PiedDePage } from "./PiedDePage";

// Polices libres (licence OFL), servies par le site lui-même :
// Marcellus (proche de la police de l'interface WoW) pour les titres, Poppins (sans serif) pour le texte.
const marcellus = Marcellus({ subsets: ["latin"], weight: "400", variable: "--police-titre", display: "swap" });
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
    <html lang="fr" className={`${marcellus.variable} ${poppins.variable}`}>
      <body>
        <EnTete />
        {children}
        <PiedDePage />
      </body>
    </html>
  );
}
