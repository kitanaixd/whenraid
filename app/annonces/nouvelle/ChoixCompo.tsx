"use client";

import { useState } from "react";
import type { Classe, Contenu, Role } from "@/generated/prisma/enums";
import { MAX_EXIGENCES, rolesParClasse } from "@/lib/jeu";
import { options, optionsTriees } from "@/lib/libelles";
import { nomRaid, raids } from "@/lib/raids";
import { ClasseIcone, NomClasse, NomRole, RoleIcone } from "@/app/ClasseIcone";
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
  // Besoins précis : aucune ligne au départ ; chacune garde son nombre, sa classe et son rôle.
  const [lignes, setLignes] = useState<number[]>(besoinsInitiaux.map((_, i) => i));
  const [prochaineLigne, setProchaineLigne] = useState(besoinsInitiaux.length);
  const [besoins, setBesoins] = useState<Record<number, Besoin>>(
    Object.fromEntries(besoinsInitiaux.map((b, i) => [i, b])),
  );
  const besoin = (l: number) => besoins[l] ?? { classe: "", role: "", nombre: 1 };
  const majBesoin = (l: number, champ: Partial<Besoin>) =>
    setBesoins((avant) => ({ ...avant, [l]: { ...(avant[l] ?? { classe: "", role: "", nombre: 1 }), ...champ } }));

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
  const exigees = lignes.reduce((t, l) => t + besoin(l).nombre, 0);
  /** « 2 Prêtres », « 1 Tank », « 3 Prêtres Soigneurs »… pour le récapitulatif. */
  const libelleBesoin = (b: Besoin) => {
    const pluriel = b.nombre > 1;
    const role = b.role ? (pluriel ? d.rolesPluriel[b.role as Role] : d.role[b.role as Role]) : "";
    if (b.classe) {
      const classe = d.classe[b.classe as Classe];
      return `${b.nombre} ${pluriel ? d.raid.besoin.classes(classe) : classe}${role ? ` ${role}` : ""}`;
    }
    return role ? `${b.nombre} ${role}` : d.creation.besoinQuelconque(b.nombre);
  };

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
          {optionsTriees(d.classe).map(([classe]) => (
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
      <div className="besoins-precis">
        {lignes.map((l) => {
          const b = besoin(l);
          return (
            <div key={l} className="ligne-besoin-v2">
              {/* Nombre de places : − / + comme pour la compo. */}
              <div className="compteur-pas">
                <button
                  type="button"
                  className="pas"
                  onClick={() => majBesoin(l, { nombre: Math.max(1, b.nombre - 1) })}
                  disabled={b.nombre <= 1}
                  aria-label={d.creation.moinsUnePlace}
                >
                  −
                </button>
                <input
                  type="number"
                  name={`exigences.${l}.nombre`}
                  value={b.nombre}
                  readOnly
                  tabIndex={-1}
                  aria-label={d.creation.nombrePlaces}
                />
                <button
                  type="button"
                  className="pas"
                  onClick={() => majBesoin(l, { nombre: b.nombre + 1 })}
                  disabled={exigees >= places}
                  aria-label={d.creation.plusUnePlace}
                >
                  +
                </button>
              </div>
              <span className="doux">{d.creation.placesPour}</span>
              <div className="besoin-classe">
                <MenuDeroulant
                  name={`exigences.${l}.classe`}
                  etiquette={d.champ.classe}
                  valeurInitiale={b.classe}
                  surChangement={(v) =>
                    // Un rôle que la nouvelle classe ne peut pas jouer est remis à « tout rôle ».
                    majBesoin(l, {
                      classe: v,
                      role: v && b.role && !rolesParClasse[v as Classe].includes(b.role as Role) ? "" : b.role,
                    })
                  }
                  options={[
                    { valeur: "", libelle: d.commun.touteClasseMin },
                    ...optionsTriees(d.classe).map(([v, lib]) => ({ valeur: v, libelle: lib, classe: v })),
                  ]}
                />
              </div>
              <div className="besoin-role">
                <MenuDeroulant
                  key={`${l}-${b.classe}`}
                  name={`exigences.${l}.role`}
                  etiquette={d.champ.role}
                  valeurInitiale={b.role}
                  surChangement={(v) => majBesoin(l, { role: v })}
                  options={[
                    { valeur: "", libelle: d.commun.toutRoleMin },
                    // Seulement les rôles que la classe choisie peut jouer.
                    ...options(d.role)
                      .filter(([v]) => !b.classe || rolesParClasse[b.classe as Classe].includes(v))
                      .map(([v, lib]) => ({ valeur: v, libelle: lib, role: v })),
                  ]}
                />
              </div>
              <button
                type="button"
                className="pas retirer-besoin"
                aria-label={d.creation.retirerBesoin}
                title={d.creation.retirerBesoin}
                onClick={() => setLignes(lignes.filter((x) => x !== l))}
              >
                ✕
              </button>
            </div>
          );
        })}
        {lignes.length < MAX_EXIGENCES && (
          <button
            type="button"
            className="petit ajouter-besoin"
            disabled={exigees >= places}
            onClick={() => {
              setLignes([...lignes, prochaineLigne]);
              setProchaineLigne(prochaineLigne + 1);
            }}
          >
            {d.creation.ajouterBesoin}
          </button>
        )}
      </div>
      {/* Récapitulatif des places ouvertes : barre proportionnelle et légende. */}
      {exigees > places ? (
        <p role="alert" className="avertissement">
          {d.creation.tropDemandees(exigees, places)}
        </p>
      ) : (
        <div className="recap-places">
          <p className="recap-titre">{d.creation.placesOuvertes(places)}</p>
          {/* Une barre découpée en segments proportionnels : chaque besoin, puis les places libres. */}
          <div className="recap-barre" aria-hidden="true">
            {lignes
              .map((l) => besoin(l))
              .filter((b) => b.nombre > 0)
              .map((b, n) => (
                <span
                  key={n}
                  style={
                    {
                      flexGrow: b.nombre,
                      "--c": b.classe ? `var(--classe-${b.classe})` : `var(--role-${b.role || "libre"})`,
                    } as React.CSSProperties
                  }
                >
                  {b.nombre}
                </span>
              ))}
            {places - exigees > 0 && (
              <span className="recap-libre" style={{ flexGrow: places - exigees }}>
                {places - exigees}
              </span>
            )}
          </div>
          <ul className="recap-legende">
            {lignes
              .map((l) => besoin(l))
              .filter((b) => b.nombre > 0)
              .map((b, n) => (
                <li key={n}>
                  {b.classe ? (
                    <ClasseIcone classe={b.classe as Classe} taille={20} />
                  ) : b.role ? (
                    <RoleIcone role={b.role as Role} taille={20} />
                  ) : (
                    <span className="recap-puce-libre">✦</span>
                  )}
                  {b.classe && b.role && <RoleIcone role={b.role as Role} taille={16} />}
                  <span>{libelleBesoin(b)}</span>
                </li>
              ))}
            {places - exigees > 0 && (
              <li className="libre">
                <span className="recap-puce-libre">✦</span>
                <span>{d.creation.libres(places - exigees)}</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </>
  );
}
