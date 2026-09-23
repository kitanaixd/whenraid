import { db } from "@/lib/db";
import { STATUTS_ACTIFS } from "@/lib/annonces";
import { creneau } from "@/lib/jeu";
import { includeLigneRaid } from "@/lib/ligneRaid";

/** Les raids pas encore terminés d'un joueur : convocations, candidatures, raids organisés. */
export async function chargerMesRaids(utilisateurId: string) {
  const maintenant = Date.now();
  const pasTermine = (a: { debutUtc: Date; dureeEstimee: number | null }) => creneau(a).fin > maintenant;
  // Un raid commencé il y a moins de 24 h peut être encore en cours.
  const depuis = new Date(maintenant - 24 * 3600_000);
  const actif = { statut: { in: ["PUBLIEE" as const, "COMPLETE" as const] }, debutUtc: { gt: depuis } };

  const inscriptions = (
    await db.inscription.findMany({
      where: { utilisateurId, statut: { in: [...STATUTS_ACTIFS] }, place: { annonce: actif } },
      include: { personnage: true, place: { include: { annonce: { include: includeLigneRaid } } } },
      orderBy: { place: { annonce: { debutUtc: "asc" } } },
    })
  ).filter((i) => pasTermine(i.place.annonce));

  const organises = (
    await db.annonce.findMany({
      where: { createurId: utilisateurId, ...actif },
      orderBy: { debutUtc: "asc" },
      include: includeLigneRaid,
    })
  ).filter(pasTermine);

  return {
    convocations: inscriptions.filter((i) => i.statut === "CONFIRME"),
    candidatures: inscriptions.filter((i) => i.statut !== "CONFIRME"),
    organises,
  };
}
