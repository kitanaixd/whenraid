"use client";

import { useState } from "react";
import type { Classe, Contenu, Role } from "@/generated/prisma/enums";
import { MAX_EXIGENCES, rolesParClasse } from "@/lib/jeu";
import { options } from "@/lib/libelles";
import { nomRaid, raids } from "@/lib/raids";
import { NomClasse, NomRole, RoleIcone } from "@/app/ClasseIcone";
import { MenuDeroulant } from "@/app/MenuDeroulant";
import { useDico } from "@/app/Langue";

const tousLesRoles: Role[] = ["TANK", "SOIGNEUR", "DPS"];
const cle = (classe: Classe, role: Role) => `${classe}.${role}`;

/** Un besoin précis : « n places pour telle classe / tel rôle » ('' = toute classe / tout rôle). */
export type Besoin = { classe: string; role: string; nombre: number };

/** Un personnage avec lequel le RL peut organiser, et les rôles qu'il peut y tenir. */
export type PersoOrganisateur = { id: string; libelle: string; classe: Classe; roles: Role[] };

/**
 * Formulaire de compo : raid, date, heure, durée (à la création), puis la compo
 * actuelle (boutons − / +) et les besoins précis (lignes ajoutables).
 * À la modification d'un raid : pas de ligne raid / date (`entete` faux), compo et
 * besoins pré-remplis, et `dejaPris` places déjà occupées par des joueurs acceptés.
 * À la création (`organisateurs`) : le RL choisit son personnage et son rôle, et compte
 * aussitôt dans la compo (une place qu'on ne peut pas retirer avec « − »).
 */
export function ChoixCompo({
  fuseau,
  personnage,
  entete = true,
  contenuInitial = "MONT_HYJAL_10",
  compoInitiale = {},
  besoinsInitiaux = [],
  dejaPris = 0,
  dateMin,
  organisateurs,
}: {
  fuseau: string;
  personnage?: React.ReactNode;
  entete?: boolean;
  contenuInitial?: Contenu;
  compoInitiale?: Record<string, number>;
  besoinsInitiaux?: Besoin[];
  dejaPris?: number;
  /** Premier jour possible (aujourd'hui, dans le fuseau du RL) : pas de raid dans le passé. */
  dateMin?: string;
  organisateurs?: PersoOrganisateur[];
}) {
  const d = useDico();
  const [contenu, setContenu] = useState<Contenu>(contenuInitial);
  const [compo, setCompo] = useState<Record<string, number>>(compoInitiale);
  // Le personnage et le rôle du RL : une place comptée d'office dans la compo.
  const [persoRlId, setPersoRlId] = useState(organisateurs?.[0]?.id ?? "");
  const persoRl = organisateurs?.find((p) => p.id === persoRlId);
  const [roleRl, setRoleRl] = useState<Role | undefined>(persoRl?.roles[0]);
  const cleRl = persoRl && roleRl ? cle(persoRl.classe, roleRl) : null;
  const moi = cleRl ? 1 : 0;
  const nbLignes = Math.max(1, besoinsInitiaux.length);
  const [lignes, setLignes] = useState<number[]>(Array.from({ length: nbLignes }, (_, i) => i));
  const [prochaineLigne, setProchaineLigne] = useState(nbLignes);
  const [exigences, setExigences] = useState<Record<number, number>>(
    Object.fromEntries(besoinsInitiaux.map((b, i) => [i, b.nombre])),
  );

  // Places que le RL peut répartir : la taille, moins les joueurs acceptés (qui gardent leur place).
  const taille = raids[contenu].taille - dejaPris;
  // Les nombres affichés (et envoyés) comptent le RL dans sa case.
  const nombre = (classe: Classe, role: Role) =>
    (compo[cle(classe, role)] ?? 0) + (cleRl === cle(classe, role) ? 1 : 0);
  const totalRole = (role: Role) =>
    Object.entries(compo)
      .filter(([k]) => k.endsWith(`.${role}`))
      .reduce((t, [, n]) => t + n, 0) + (roleRl === role && cleRl ? 1 : 0);
  const joueurs = Object.values(compo).reduce((a, b) => a + b, 0) + moi;
  const places = Math.max(0, taille - joueurs);
  const exigees = lignes.reduce((t, l) => t + (exigences[l] ?? 0), 0);

  // Chaque clic part de la dernière valeur réelle (même en cliquant très vite).
  const changer = (classe: Classe, role: Role, delta: number) => {
    setCompo((precedent) => {
      const actuel = precedent[cle(classe, role)] ?? 0;
      const total = Object.values(precedent).reduce((a, b) => a + b, 0) + moi;
      // Impossible de dépasser la taille du raid ou de descendre sous zéro.
      const suivant = Math.max(0, Math.min(actuel + delta, actuel + (taille - total)));
      return { ...precedent, [cle(classe, role)]: suivant };
    });
  };

  return (
    <>
      {entete && (
        <div className="rangee rangee-raid">
          <label className="champ">
            {d.champ.raid}
            <select name="contenu" required value={contenu} onChange={(e) => setContenu(e.target.value as Contenu)}>
              {options(raids).map(([v]) => (
                <option key={v} value={v}>
                  {nomRaid(v, d)}
                </option>
              ))}
            </select>
          </label>
          <label className="champ">
            {d.creation.date}
            <input type="date" name="date" required min={dateMin} />
          </label>
          <label className="champ">
            <span>
              {d.creation.heure} <small className="fuseau">({fuseau})</small>
            </span>
            <input type="time" name="heure" required defaultValue="21:00" />
          </label>
          <label className="champ">
            {d.champ.duree}
            <select name="dureeHeures" defaultValue="3">
              {[1, 2, 3, 4, 5, 6].map((h) => (
                <option key={h} value={h}>
                  {h} h
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {personnage}
      {organisateurs && (
        <div className="rangee choix-organisateur">
          <div className="champ">
            {d.creation.avecQuelPerso}
            <MenuDeroulant
              name="personnageId"
              etiquette={d.creation.avecQuelPerso}
              options={organisateurs.map((p) => ({ valeur: p.id, classe: p.classe, libelle: p.libelle }))}
              surChangement={(id) => {
                setPersoRlId(id);
                setRoleRl(organisateurs.find((p) => p.id === id)?.roles[0]);
              }}
            />
          </div>
          <fieldset className="rapide-roles">
            <legend>{d.creation.tonRole}</legend>
            {persoRl?.roles.length === 0 && <p className="doux">{d.creation.aucunRolePossible}</p>}
            {persoRl?.roles.map((r) => (
              <label key={r} className="case-role">
                <input
                  type="radio"
                  name="roleOrganisateur"
                  value={r}
                  checked={roleRl === r}
                  onChange={() => setRoleRl(r)}
                />
                <NomRole role={r} taille={18} />
              </label>
            ))}
          </fieldset>
        </div>
      )}

      <h2>{d.creation.compoActuelle}</h2>
      <div className="compteur-compo" aria-live="polite">
        <span title={d.rolesPluriel.TANK}>
          <RoleIcone role="TANK" taille={24} /> {totalRole("TANK")}
        </span>
        <span className="separateur">/</span>
        <span title={d.rolesPluriel.SOIGNEUR}>
          <RoleIcone role="SOIGNEUR" taille={24} /> {totalRole("SOIGNEUR")}
        </span>
        <span className="separateur">/</span>
        <span title={d.rolesPluriel.DPS}>
          <RoleIcone role="DPS" taille={24} /> {totalRole("DPS")}
        </span>
        <strong>
          {joueurs + dejaPris}/{taille + dejaPris}
        </strong>
        <small>{joueurs >= taille ? d.creation.raidPlein : d.creation.placesRestantes(places)}</small>
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
          {options(d.classe).map(([classe]) => (
            <tr key={classe}>
              <th scope="row">
                <NomClasse classe={classe} />
              </th>
              {tousLesRoles.map((role) =>
                rolesParClasse[classe].includes(role) ? (
                  <td key={role}>
                    <div className="compteur-pas">
                      <button
                        type="button"
                        className="pas"
                        onClick={() => changer(classe, role, -1)}
                        disabled={(compo[cle(classe, role)] ?? 0) === 0}
                        aria-label={d.creation.retirerUn(d.classe[classe], d.role[role])}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        name={`compo.${classe}.${role}`}
                        value={nombre(classe, role)}
                        readOnly
                        tabIndex={-1}
                        aria-label={`${d.classe[classe]} ${d.role[role]}`}
                      />
                      <button
                        type="button"
                        className="pas"
                        onClick={() => changer(classe, role, 1)}
                        disabled={joueurs >= taille}
                        aria-label={d.creation.ajouterUn(d.classe[classe], d.role[role])}
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

      <h2>{d.creation.besoins}</h2>
      <p className="doux">{d.creation.besoinsAide}</p>
      {lignes.map((l) => (
        <div key={l} className="ligne-besoin">
          <input
            type="number"
            name={`exigences.${l}.nombre`}
            min={0}
            max={places}
            defaultValue={besoinsInitiaux[l]?.nombre ?? 0}
            aria-label={d.creation.nombrePlaces}
            onChange={(e) => setExigences({ ...exigences, [l]: Number(e.target.value) || 0 })}
          />
          <span>{d.creation.placesPour}</span>
          <div className="besoin-classe">
            <MenuDeroulant
              name={`exigences.${l}.classe`}
              etiquette={d.champ.classe}
              valeurInitiale={besoinsInitiaux[l]?.classe ?? ""}
              options={[
                { valeur: "", libelle: d.commun.touteClasseMin },
                ...options(d.classe).map(([v, lib]) => ({ valeur: v, libelle: lib, classe: v })),
              ]}
            />
          </div>
          <div className="besoin-role">
            <MenuDeroulant
              name={`exigences.${l}.role`}
              etiquette={d.champ.role}
              valeurInitiale={besoinsInitiaux[l]?.role ?? ""}
              options={[
                { valeur: "", libelle: d.commun.toutRoleMin },
                ...options(d.role).map(([v, lib]) => ({ valeur: v, libelle: lib, role: v })),
              ]}
            />
          </div>
          {lignes.length > 1 && (
            <button
              type="button"
              className="pas"
              aria-label={d.creation.retirerBesoin}
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
          {d.creation.ajouterBesoin}
        </button>
      )}
      {exigees > places && <p role="alert">{d.creation.tropDemandees(exigees, places)}</p>}
      {exigees < places && <p className="doux">{d.creation.placesLibres(places - exigees)}</p>}
    </>
  );
}
