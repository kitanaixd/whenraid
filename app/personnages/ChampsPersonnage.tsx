import type { Personnage } from "@/generated/prisma/client";
import type { Region, Ruleset } from "@/generated/prisma/enums";
import { DRAPEAUX, ICONES_RULESET } from "@/lib/icones";
import { MenuDeroulant } from "@/app/MenuDeroulant";
import { NOM_MAX } from "@/lib/formulaire";
import type { Dico } from "@/lib/i18n";
import { options, optionsTriees } from "@/lib/libelles";

/** Champs d'un personnage, vides (création) ou pré-remplis (modification). */
export function ChampsPersonnage({ perso, d }: { perso?: Personnage; d: Dico }) {
  const titreNom = d.personnages.lettresSeulement(NOM_MAX);
  return (
    <>
      <div className="rangee">
        <div className="champ">
          {d.champ.faction}
          <MenuDeroulant
            name="faction"
            etiquette={d.champ.faction}
            valeurInitiale={perso?.faction}
            options={options(d.faction).map(([v, l]) => ({ valeur: v, libelle: l, faction: v }))}
          />
        </div>
        <div className="champ">
          {d.champ.ruleset}
          <MenuDeroulant
            name="ruleset"
            etiquette={d.champ.ruleset}
            valeurInitiale={perso?.ruleset}
            options={options(d.ruleset).map(([v, l]) => ({
              valeur: v,
              libelle: l,
              image: ICONES_RULESET[v as Ruleset],
            }))}
          />
        </div>
        <div className="champ">
          {d.champ.region}
          <MenuDeroulant
            name="region"
            etiquette={d.champ.region}
            valeurInitiale={perso?.region}
            options={options(d.region).map(([v, l]) => ({ valeur: v, libelle: l, image: DRAPEAUX[v as Region] }))}
          />
        </div>
      </div>
      <div className="rangee">
        <label className="champ">
          {d.champ.prenom}
          <input
            name="nom"
            required
            maxLength={NOM_MAX}
            pattern="\p{L}+"
            title={titreNom}
            autoComplete="off"
            defaultValue={perso?.nom}
          />
        </label>
        <label className="champ">
          {d.champ.nom}
          <input
            name="nomDeFamille"
            maxLength={NOM_MAX}
            pattern="\p{L}+"
            title={titreNom}
            autoComplete="off"
            defaultValue={perso?.nomDeFamille ?? ""}
          />
        </label>
      </div>
      <div className="rangee">
        <label className="champ">
          {d.personnages.logs} <small className="fuseau">{d.personnages.logsAide}</small>
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
          {d.champ.classe}
          <MenuDeroulant
            name="classe"
            etiquette={d.champ.classe}
            valeurInitiale={perso?.classe}
            options={optionsTriees(d.classe).map(([v, l]) => ({ valeur: v, libelle: l, classe: v }))}
          />
        </div>
        <label className="champ">
          {d.champ.niveau}
          <input name="niveau" type="number" min={1} max={60} defaultValue={perso?.niveau ?? 60} required />
        </label>
      </div>
      <fieldset>
        <legend>{d.personnages.rolesJouables}</legend>
        <div className="cases">
          {options(d.role).map(([v, l]) => (
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
