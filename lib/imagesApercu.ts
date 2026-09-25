// Outils pour les images d'aperçu des liens partagés (opengraph-image.tsx).
// Le moteur de rendu (Satori) ne lit pas le WebP : les illustrations sont copiées en PNG/JPEG
// dans assets/og (et incluses dans le serveur, voir next.config.ts).
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Classe } from "@/generated/prisma/enums";

export const TAILLE_APERCU = { width: 1200, height: 630 };

/** Une image de assets/og, prête à mettre dans <img src>. */
export async function imageApercu(nom: string) {
  const donnees = await readFile(join(process.cwd(), "assets/og", nom));
  const type = nom.endsWith(".png") ? "image/png" : "image/jpeg";
  return `data:${type};base64,${donnees.toString("base64")}`;
}

// Mêmes couleurs que le site (globals.css / moderne.css).
export const OR = "#e2bd6f";
export const FOND = "#09090b";
export const COULEUR_CLASSE: Record<Classe, string> = {
  GUERRIER: "#c69b6d",
  PALADIN: "#f48cba",
  CHASSEUR: "#aad372",
  VOLEUR: "#fff468",
  PRETRE: "#ffffff",
  CHAMAN: "#2b8fff",
  MAGE: "#3fc7eb",
  DEMONISTE: "#8788ee",
  DRUIDE: "#ff7c0a",
};
export const COULEUR_ROLE = { TANK: "#7aa7ff", SOIGNEUR: "#4ade80", DPS: "#f87171" };
