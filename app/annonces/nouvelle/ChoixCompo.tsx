"use client";

import { useState } from "react";
import type { Classe, Contenu, Role } from "@/generated/prisma/enums";
import { MAX_EXIGENCES, rolesParClasse } from "@/lib/jeu";
import { libelleClasse, libelleRole, options } from "@/lib/libelles";
import { nomRaid, raids } from "@/lib/raids";
import { NomClasse, NomRole, RoleIcone } from "@/app/ClasseIcone";
import { MenuDeroulant } from "@/app/MenuDeroulant";

const tousLesRoles = Object.keys(libelleRole) as Role[];
const cle = (classe: Classe, role: Role) => `${classe}.${role}`;

/**
 * Haut du formulaire de création : raid, date, heure, durée, puis la compo
 * actuelle (boutons − / +) et les besoins précis (lignes ajoutables).
 * `personnage` est le choix du personnage, rendu par la page serveur.
 */
export function ChoixCompo({ fuseau, personnage }: { fuseau: string; personnage: React.ReactNode }) {
  const [contenu, setContenu] = useState<Contenu>("MONT_HYJAL_10");
  const [compo, setCompo] = useState<Record<string, number>>({});
  const [lignes, setLignes] = useState<number[]>([0]);
  const [prochaineLigne, setProchaineLigne] = useState(1);
  const [exigences, setExigences] = useState<Record<number, number>>({});

  const taille = raids[contenu].taille;
  const nombre = (classe: Classe, role: Role) => compo[cle(classe, role)] ?? 0;
  const totalRole = (role: Role) =>
    Object.entries(compo)
      .filter(([k]) => k.endsWith(`.${role}`))
      .reduce((t, [, n]) => t + n, 0);
  const joueurs = Object.values(compo).reduce((a, b) => a + b, 0);
  const places = Math.max(0, taille - joueurs);
  const exigees = lignes.reduce((t, l) => t + (exigences[l] ?? 0), 0);

  // Chaque clic part de la dernière valeur réelle (même en cliquant très vite).
  const changer = (classe: Classe, role: Role, delta: number) => {
    setCompo((precedent) => {
      const actuel = precedent[cle(classe, role)] ?? 0;
      const total = Object.values(precedent).reduce((a, b) => a + b, 0);
      // Impossible de dépasser la taille du raid ou de descendre sous zéro.
      const suivant = Math.max(0, Math.min(actuel + delta, actuel + (taille - total)));
      return { ...precedent, [cle(classe, role)]: suivant };
    });
  };

  return (
    <>
      <div className="rangee rangee-raid">
        <label className="champ">
          Raid
          <select name="contenu" required value={contenu} onChange={(e) => setContenu(e.target.value as Contenu)}>
            {options(raids).map(([v]) => (
              <option key={v} value={v}>
                {nomRaid(v)}
              </option>
            ))}
          </select>
        </label>
        <label className="champ">
          Date
          <input type="date" name="date" required />
        </label>
        <label className="champ">
          <span>
            Heure <small className="fuseau">({fuseau})</small>
          </span>
          <input type="time" name="heure" required defaultValue="21:00" />
        </label>
        <label className="champ">
          Durée
          <select name="dureeHeures" defaultValue="3">
            {[1, 2, 3, 4, 5, 6].map((h) => (
              <option key={h} value={h}>
                {h} h
              </option>
            ))}
          </select>
        </label>
      </div>

      {personnage}

      <h2>Ta compo actuelle</h2>
      <div className="compteur-compo" aria-live="polite">
        <span title="Tanks">
          <RoleIcone role="TANK" taille={24} /> {totalRole("TANK")}
        </span>
        <span className="separateur">/</span>
        <span title="Soigneurs">
          <RoleIcone role="SOIGNEUR" taille={24} /> {totalRole("SOIGNEUR")}
        </span>
        <span className="separateur">/</span>
        <span title="DPS">
          <RoleIcone role="DPS" taille={24} /> {totalRole("DPS")}
        </span>
        <strong>
          {joueurs}/{taille}
        </strong>
        <small>
          {joueurs >= taille
            ? "Ton raid est déjà plein : il ne reste aucune place à ouvrir."
            : `Il reste ${places} place${places > 1 ? "s" : ""} à pourvoir. Compte-toi dedans.`}
        </small>
      </div>
      <table className="tableau-compo">
        <thead>
          <tr>
            <th></th>
            {tousLesRoles.map((r) => (
              <th key={r}>
                <NomRole role={r} taille={20} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {options(libelleClasse).map(([classe]) => (
            <tr key={classe}>
              <th scope="row">
                <NomClasse classe={classe as Classe} />
              </th>
              {tousLesRoles.map((role) =>
                rolesParClasse[classe as Classe].includes(role) ? (
                  <td key={role}>
                    <div className="compteur-pas">
                      <button
                        type="button"
                        className="pas"
                        onClick={() => changer(classe as Classe, role, -1)}
                        disabled={nombre(classe as Classe, role) === 0}
                        aria-label={`Retirer un ${libelleClasse[classe as Classe]} ${libelleRole[role]}`}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        name={`compo.${classe}.${role}`}
                        value={nombre(classe as Classe, role)}
                        readOnly
                        tabIndex={-1}
                        aria-label={`${libelleClasse[classe as Classe]} ${libelleRole[role]}`}
                      />
                      <button
                        type="button"
                        className="pas"
                        onClick={() => changer(classe as Classe, role, 1)}
                        disabled={joueurs >= taille}
                        aria-label={`Ajouter un ${libelleClasse[classe as Classe]} ${libelleRole[role]}`}
                      >
                        +
                      </button>
                    </div>
                  </td>
                ) : (
                  <td key={role} className="impossible">
                    —
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Besoins précis</h2>
      <p className="doux">Facultatif. Les places sans exigence restent ouvertes à toute classe et tout rôle.</p>
      {lignes.map((l) => (
        <div key={l} className="ligne-besoin">
          <input
            type="number"
            name={`exigences.${l}.nombre`}
            min={0}
            max={places}
            defaultValue={0}
            aria-label="Nombre de places"
            onChange={(e) => setExigences({ ...exigences, [l]: Number(e.target.value) || 0 })}
          />
          <span>place(s) pour</span>
          <div className="besoin-classe">
            <MenuDeroulant
              name={`exigences.${l}.classe`}
              etiquette="Classe"
              options={[
                { valeur: "", libelle: "toute classe" },
                ...options(libelleClasse).map(([v, lib]) => ({ valeur: v, libelle: lib, classe: v })),
              ]}
            />
          </div>
          <div className="besoin-role">
            <MenuDeroulant
              name={`exigences.${l}.role`}
              etiquette="Rôle"
              options={[
                { valeur: "", libelle: "tout rôle" },
                ...options(libelleRole).map(([v, lib]) => ({ valeur: v, libelle: lib, role: v })),
              ]}
            />
          </div>
          {lignes.length > 1 && (
            <button
              type="button"
              className="pas"
              aria-label="Retirer ce besoin"
              onClick={() => setLignes(lignes.filter((x) => x !== l))}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {lignes.length < MAX_EXIGENCES && (
        <button
          type="button"
          className="petit"
          onClick={() => {
            setLignes([...lignes, prochaineLigne]);
            setProchaineLigne(prochaineLigne + 1);
          }}
        >
          + Ajouter un besoin
        </button>
      )}
      {exigees > places && (
        <p role="alert">
          ⚠ Tu demandes {exigees} places précises, mais il n&apos;en reste que {places}.
        </p>
      )}
      {exigees < places && (
        <p className="doux">
          {places - exigees} place{places - exigees > 1 ? "s" : ""} libre{places - exigees > 1 ? "s" : ""} (toute
          classe, tout rôle).
        </p>
      )}
    </>
  );
}
