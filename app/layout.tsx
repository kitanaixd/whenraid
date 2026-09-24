import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
// Thème actif. Autre version gardée de côté : "./fantasy.css" (heroic fantasy moderne,
// avec les polices Cinzel pour les titres et Poppins pour le texte).
import "./moderne.css";
import { EnTete } from "./EnTete";
import { PiedDePage } from "./PiedDePage";
import { FournisseurLangue } from "./Langue";
import { dicoCourant, langueCourante } from "@/lib/langue";

// Police libre (licence OFL), servie par le site lui-même : Geist pour les titres et le texte.
const titre = Geist({ subsets: ["latin"], variable: "--police-titre", display: "swap" });
const texte = Geist({ subsets: ["latin"], variable: "--police-texte", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const d = await dicoCourant();
  return { title: "WhenRaid", description: d.meta.description };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Anglais par défaut, français pour les visiteurs situés en France ou qui l'ont choisi.
  const langue = await langueCourante();
  return (
    <html lang={langue} className={`${titre.variable} ${texte.variable}`}>
      <body>
        <FournisseurLangue langue={langue}>
          <EnTete />
          {children}
          <PiedDePage />
        </FournisseurLangue>
      </body>
    </html>
  );
}
