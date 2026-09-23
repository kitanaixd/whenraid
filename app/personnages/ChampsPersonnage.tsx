import type { Personnage } from "@/generated/prisma/client";
import type { Region, Ruleset } from "@/generated/prisma/enums";
import { DRAPEAUX, ICONES_RULESET } from "@/app/ClasseIcone";
import { MenuDeroulant } from "@/app/MenuDeroulant";
import { NOM_MAX } from "@/lib/formulaire";
import { libelleClasse, libelleFaction, libelleRegion, libelleRole, libelleRuleset, options } from "@/lib/libelles";

const TITRE_NOM = `Lettres uniquement, ${NOM_MAX} maximum`;

/** Champs d'un personnage, vides (création) ou pré-remplis (modification). */
export function ChampsPersonnage({ perso }: { perso?: Personnage }) {
  return (
    <>
      <div className="rangee">
        <div className="champ">
          Faction
          <MenuDeroulant
            name="faction"
            etiquette="Faction"
            valeurInitiale={perso?.faction}
            options={options(libelleFaction).map(([v, l]) => ({ valeur: v, libelle: l, faction: v }))}
          />
        </div>
        <div className="champ">
          Ruleset
          <MenuDeroulant
            name="ruleset"
            etiquette="Ruleset"
            valeurInitiale={perso?.ruleset}
            options={options(libelleRuleset).map(([v, l]) => ({
              valeur: v,
              libelle: l,
              image: ICONES_RULESET[v as Ruleset],
            }))}
          />
        </div>
        <div className="champ">
          Région
          <MenuDeroulant
            name="region"
            etiquette="Région"
            valeurInitiale={perso?.region}
            options={options(libelleRegion).map(([v, l]) => ({ valeur: v, libelle: l, image: DRAPEAUX[v as Region] }))}
          />
        </div>
      </div>
      <div className="rangee">
        <label className="champ">
          Prénom du personnage
          <input
            name="nom"
            required
            maxLength={NOM_MAX}
            pattern="\p{L}+"
            title={TITRE_NOM}
            autoComplete="off"
            defaultValue={perso?.nom}
          />
        </label>
        <label className="champ">
          Nom du personnage
          <input
            name="nomDeFamille"
            maxLength={NOM_MAX}
            pattern="\p{L}+"
            title={TITRE_NOM}
            autoComplete="off"
            defaultValue={perso?.nomDeFamille ?? ""}
          />
        </label>
      </div>
      <div className="rangee">
        <label className="champ">
          Logs <small className="fuseau">(facultatif, Warcraft Logs uniquement)</small>
          <input
            name="lienLogs"
            type="url"
            placeholder="https://fresh.warcraftlogs.com/character/…"
            defaultValue={perso?.lienLogs ?? ""}
          />
        </label>
      </div>
      <div className="rangee">
        <div className="champ">
          Classe
          <MenuDeroulant
            name="classe"
            etiquette="Classe"
            valeurInitiale={perso?.classe}
            options={options(libelleClasse).map(([v, l]) => ({ valeur: v, libelle: l, classe: v }))}
          />
        </div>
        <label className="champ">
          Niveau
          <input name="niveau" type="number" min={1} max={60} defaultValue={perso?.niveau ?? 60} required />
        </label>
      </div>
      <fieldset>
        <legend>Rôles jouables</legend>
        <div className="cases">
          {options(libelleRole).map(([v, l]) => (
            <label key={v}>
              <input
                type="checkbox"
                name="rolesJouables"
                value={v}
                defaultChecked={perso?.rolesJouables.includes(v)}
              />{" "}
              {l}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
