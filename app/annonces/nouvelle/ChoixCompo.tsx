"use client";

import { useState } from "react";
import type { Classe, Contenu, Role } from "@/generated/prisma/enums";
import { LIGNES_EXIGENCES, rolesParClasse } from "@/lib/jeu";
import { libelleClasse, libelleRole, options } from "@/lib/libelles";
import { nomRaid, raids } from "@/lib/raids";
import { NomClasse } from "@/app/ClasseIcone";


const tousLesRoles = Object.keys(libelleRole) as Role[];

export function ChoixCompo() {
  const [contenu, setContenu] = useState<Contenu>("MONT_HYJAL_10");
  const [compo, setCompo] = useState<Record<string, number>>({});
  const [exigences, setExigences] = useState<Record<number, number>>({});

  const taille = raids[contenu].taille;
  const joueurs = Object.values(compo).reduce((a, b) => a + b, 0);
  const places = Math.max(0, taille - joueurs);
  const exigees = Object.values(exigences).reduce((a, b) => a + b, 0);

  return (
    <>
      <p>
        <label>
          Raid{" "}
          <select name="contenu" required value={contenu} onChange={(e) => setContenu(e.target.value as Contenu)}>
            {options(raids).map(([v]) => (
              <option key={v} value={v}>
                {nomRaid(v)}
              </option>
            ))}
          </select>
        </label>
      </p>

      <h2>Ta compo actuelle</h2>
      <p>
        <small>Compte-toi dedans. Seules les combinaisons possibles en jeu ont une case.</small>
      </p>
      <table>
        <thead>
          <tr>
            <th></th>
            {tousLesRoles.map((r) => (
              <th key={r}>{libelleRole[r]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {options(libelleClasse).map(([classe, libelle]) => (
            <tr key={classe}>
              <th scope="row">
                <NomClasse classe={classe as Classe} />
              </th>
              {tousLesRoles.map((role) => (
                <td key={role}>
                  {rolesParClasse[classe as Classe].includes(role) ? (
                    <input
                      type="number"
                      name={`compo.${classe}.${role}`}
                      min={0}
                      max={taille}
                      defaultValue={0}
                      aria-label={`${libelle} ${libelleRole[role]}`}
                      style={{ width: "3.5rem" }}
                      onChange={(e) => setCompo({ ...compo, [`${classe}.${role}`]: Number(e.target.value) || 0 })}
                    />
                  ) : (
                    "—"
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p aria-live="polite">
        <strong>
          {joueurs} joueur{joueurs > 1 ? "s" : ""} sur {taille}
        </strong>{" "}
        —{" "}
        {joueurs >= taille
          ? "⚠ ton raid est déjà plein, il ne reste aucune place à ouvrir."
          : `il reste ${places} place${places > 1 ? "s" : ""} à pourvoir.`}
      </p>

      <h2>Besoins précis (facultatif)</h2>
      <p>
        <small>
          Les places sans exigence sont ouvertes à toute classe et tout rôle. Ajoute une ligne seulement si tu as
          besoin d&apos;une classe, d&apos;un rôle, ou des deux.
        </small>
      </p>
      {LIGNES_EXIGENCES.map((i) => (
        <p key={i}>
          <label>
            <input
              type="number"
              name={`exigences.${i}.nombre`}
              min={0}
              max={places}
              defaultValue={0}
              style={{ width: "3.5rem" }}
              aria-label={`Nombre de places, ligne ${i + 1}`}
              onChange={(e) => setExigences({ ...exigences, [i]: Number(e.target.value) || 0 })}
            />
          </label>{" "}
          place(s) pour{" "}
          <select name={`exigences.${i}.classe`} aria-label={`Classe, ligne ${i + 1}`} defaultValue="">
            <option value="">toute classe</option>
            {options(libelleClasse).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>{" "}
          <select name={`exigences.${i}.role`} aria-label={`Rôle, ligne ${i + 1}`} defaultValue="">
            <option value="">tout rôle</option>
            {options(libelleRole).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </p>
      ))}
      {exigees > places && (
        <p role="alert">
          ⚠ Tu demandes {exigees} places précises, mais il n&apos;en reste que {places}.
        </p>
      )}
      {exigees <= places && places > 0 && (
        <p>
          <small>
            {places - exigees} place{places - exigees > 1 ? "s" : ""} libre{places - exigees > 1 ? "s" : ""} (toute
            classe, tout rôle).
          </small>
        </p>
      )}
    </>
  );
}
