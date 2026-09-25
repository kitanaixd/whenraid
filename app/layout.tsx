import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
// Thème actif. Autre version gardée de côté : "./fantasy.css" (heroic fantasy moderne,
// avec les polices Cinzel pour les titres et Poppins pour le texte).
import "./moderne.css";
import { EnTete } from "./EnTete";
import { PiedDePage } from "./PiedDePage";
import { FournisseurLangue } from "./Langue";
import { dicoCourant, langueCourante } from "@/lib/langue";
import { URL_SITE } from "@/lib/site";

// Police libre (licence OFL), servie par le site lui-même : Geist pour les titres et le texte.
const titre = Geist({ subsets: ["latin"], variable: "--police-titre", display: "swap" });
const texte = Geist({ subsets: ["latin"], variable: "--police-texte", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const d = await dicoCourant();
  return {
    metadataBase: new URL(URL_SITE),
    title: "WhenRaid",
    description: d.meta.description,
    // Aperçu des liens partagés (Discord, réseaux) : grande image (opengraph-image.tsx).
    openGraph: {
      siteName: "WhenRaid",
      type: "website",
      title: "WhenRaid — WoW Forever raid finder",
      description: d.meta.descriptionPartage,
    },
    twitter: { card: "summary_large_image" },
  };
}

// Couleur de la barre des cartes Discord (et de la barre du navigateur sur mobile).
export const viewport: Viewport = { themeColor: "#e2bd6f" };

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
