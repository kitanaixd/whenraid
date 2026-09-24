import { Classe, Faction, Region, Role, Ruleset } from "@/generated/prisma/enums";
import { choix, choixMultiples, entier, ErreurFormulaire, lienWarcraftLogs, nomDePersonnage } from "@/lib/formulaire";

/** Lit et valide les champs d'un personnage (création comme modification). */
export function lirePersonnage(form: FormData) {
  const rolesJouables = choixMultiples(form, "rolesJouables", Role, "role");
  if (rolesJouables.length === 0) throw new ErreurFormulaire((d) => d.erreur.unRoleJouable);
  return {
    nom: nomDePersonnage(form, "nom", "prenom", { requis: true })!,
    nomDeFamille: nomDePersonnage(form, "nomDeFamille", "nom"),
    lienLogs: lienWarcraftLogs(form, "lienLogs"),
    classe: choix(form, "classe", Classe, "classe"),
    rolesJouables,
    faction: choix(form, "faction", Faction, "faction"),
    ruleset: choix(form, "ruleset", Ruleset, "ruleset"),
    region: choix(form, "region", Region, "region"),
    niveau: entier(form, "niveau", { min: 1, max: 60, requis: true, champ: "niveau" })!,
  };
}
