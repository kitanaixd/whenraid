import { cookies, headers } from "next/headers";
import { dico, estLangue, type Langue } from "@/lib/i18n";

export const COOKIE_LANGUE = "langue";

/**
 * Langue de la page : celle choisie par le visiteur (cookie), sinon le français s'il
 * est situé en France (pays fourni par Vercel), sinon l'anglais.
 */
export async function langueCourante(): Promise<Langue> {
  const choisie = (await cookies()).get(COOKIE_LANGUE)?.value;
  if (estLangue(choisie)) return choisie;
  return (await headers()).get("x-vercel-ip-country") === "FR" ? "fr" : "en";
}

/** Le dictionnaire de la langue de la page. */
export async function dicoCourant() {
  return dico(await langueCourante());
}
