import { Classe, Faction, Region, Role, Ruleset } from "@/generated/prisma/enums";
import { rolePossible } from "@/lib/jeu";
import { choix, choixMultiples, ErreurFormulaire, lienWarcraftLogs, nomDePersonnage } from "@/lib/formulaire";

/** Lit et valide les champs d'un personnage (création comme modification). */
export function lirePersonnage(form: FormData) {
  const classe = choix(form, "classe", Classe, "classe");
  // Seuls les rôles possibles pour la classe (pas de chasseur tank, par exemple).
  const rolesJouables = choixMultiples(form, "rolesJouables", Role, "role").filter((r) => rolePossible(classe, r));
  if (rolesJouables.length === 0) throw new ErreurFormulaire((d) => d.erreur.unRoleJouable);
  return {
    nom: nomDePersonnage(form, "nom", "prenom", { requis: true })!,
    nomDeFamille: nomDePersonnage(form, "nomDeFamille", "nom"),
    lienLogs: lienWarcraftLogs(form, "lienLogs"),
    classe,
    rolesJouables,
    faction: choix(form, "faction", Faction, "faction"),
    ruleset: choix(form, "ruleset", Ruleset, "ruleset"),
    region: choix(form, "region", Region, "region"),
    // Tous les personnages sont niveau 60 (WoW Forever).
    niveau: 60,
  };
}
