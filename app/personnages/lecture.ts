import { Classe, Faction, Region, Role, Ruleset } from "@/generated/prisma/enums";
import { choix, choixMultiples, entier, ErreurFormulaire, lienWarcraftLogs, nomDePersonnage } from "@/lib/formulaire";

/** Lit et valide les champs d'un personnage (création comme modification). */
export function lirePersonnage(form: FormData) {
  const rolesJouables = choixMultiples(form, "rolesJouables", Role);
  if (rolesJouables.length === 0) throw new ErreurFormulaire("Coche au moins un rôle jouable.");
  return {
    nom: nomDePersonnage(form, "nom", "Prénom du personnage", { requis: true })!,
    nomDeFamille: nomDePersonnage(form, "nomDeFamille", "Nom du personnage"),
    lienLogs: lienWarcraftLogs(form, "lienLogs"),
    classe: choix(form, "classe", Classe),
    rolesJouables,
    faction: choix(form, "faction", Faction),
    ruleset: choix(form, "ruleset", Ruleset),
    region: choix(form, "region", Region),
    niveau: entier(form, "niveau", { min: 1, max: 60, requis: true })!,
  };
}
