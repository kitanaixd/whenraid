import type { Classe, Role, StatutInscription, StatutPlace } from "@/generated/prisma/enums";

// Une candidature « active » occupe le joueur sur ce raid.
export const STATUTS_ACTIFS = ["INSCRIT", "LISTE_ATTENTE", "CONFIRME"] as const satisfies StatutInscription[];

// Candidatures en attente d'une décision du RL.
export const STATUTS_EN_ATTENTE = ["INSCRIT", "LISTE_ATTENTE"] as const satisfies StatutInscription[];

export function estActive(statut: StatutInscription) {
  return (STATUTS_ACTIFS as readonly string[]).includes(statut);
}

export function estEnAttente(statut: StatutInscription) {
  return (STATUTS_EN_ATTENTE as readonly string[]).includes(statut);
}

/** Le raid atteint sa taille quand chaque place (non annulée) a été pourvue par le RL. */
export function estComplet(places: { statut: StatutPlace }[]) {
  const aPourvoir = places.filter((p) => p.statut !== "ANNULEE");
  return aPourvoir.length > 0 && aPourvoir.every((p) => p.statut === "POURVUE");
}

/** Compo actuelle = compo déclarée par le RL + joueurs confirmés, par classe et rôle. */
export function compoActuelle(
  composition: { classe: Classe; role: Role; nombre: number }[],
  confirmes: { classe: Classe; role: Role }[],
) {
  const lignes = new Map<string, { classe: Classe; role: Role; nombre: number }>();
  const ajouter = (classe: Classe, role: Role, nombre: number) => {
    const cle = `${classe}.${role}`;
    const ligne = lignes.get(cle) ?? { classe, role, nombre: 0 };
    ligne.nombre += nombre;
    lignes.set(cle, ligne);
  };
  for (const c of composition) ajouter(c.classe, c.role, c.nombre);
  for (const c of confirmes) ajouter(c.classe, c.role, 1);
  const total = [...lignes.values()].reduce((t, l) => t + l.nombre, 0);
  return { lignes: [...lignes.values()], total };
}

/** Un raid accepte des candidatures tant qu'il est publié ou complet et pas commencé. */
export function accepteCandidatures(annonce: { statut: string; debutUtc: Date }) {
  return ["PUBLIEE", "COMPLETE"].includes(annonce.statut) && annonce.debutUtc.getTime() > Date.now();
}

/** Feuille de présence : ouverte dès le début du raid, validable après sa fin prévue. */
export function etatPresences(annonce: {
  statut: string;
  debutUtc: Date;
  dureeEstimee: number | null;
  presencesValideesLe: Date | null;
}) {
  const maintenant = Date.now();
  const actif = ["PUBLIEE", "COMPLETE"].includes(annonce.statut) && !annonce.presencesValideesLe;
  const fin = annonce.debutUtc.getTime() + (annonce.dureeEstimee ?? 180) * 60_000;
  return {
    visible: annonce.statut === "CLOTUREE" || (actif && maintenant >= annonce.debutUtc.getTime()),
    modifiable: actif && maintenant >= annonce.debutUtc.getTime(),
    validable: actif && maintenant >= fin,
  };
}

/** Le RL garde la main (candidats, remplaçants, invitations) jusqu'à la fin prévue du raid. */
export function rlPeutAgir(annonce: { statut: string; debutUtc: Date; dureeEstimee: number | null }) {
  const fin = annonce.debutUtc.getTime() + (annonce.dureeEstimee ?? 180) * 60_000;
  return ["PUBLIEE", "COMPLETE"].includes(annonce.statut) && Date.now() < fin;
}

/** Compo regroupée par rôle, pour l'affichage « tanks / soigneurs / DPS ». */
export function compoParRole(lignes: { role: string; nombre: number }[]) {
  const total = (roles: string[]) => lignes.filter((l) => roles.includes(l.role)).reduce((t, l) => t + l.nombre, 0);
  return { tanks: total(["TANK"]), soigneurs: total(["SOIGNEUR"]), dps: total(["DPS"]) };
}
