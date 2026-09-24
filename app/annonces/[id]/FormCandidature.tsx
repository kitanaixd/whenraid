"use client";

import { useState } from "react";
import type { Classe, Role } from "@/generated/prisma/enums";
import { MenuDeroulant } from "@/app/MenuDeroulant";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";
import { NomRole } from "@/app/ClasseIcone";
import { useDico } from "@/app/Langue";

export type PersoCandidat = { id: string; libelle: string; classe: Classe; roles: Role[] };

/**
 * Candidature en trois étapes : personnage, puis rôle(s) (selon le personnage), puis note pour le RL.
 * Le joueur peut proposer plusieurs rôles : le RL choisit à l'acceptation.
 */
export function FormCandidature({
  action,
  annonceId,
  persos,
  listeAttente,
  persoInitial,
}: {
  action: (form: FormData) => void;
  annonceId: string;
  persos: PersoCandidat[];
  listeAttente: boolean;
  /** Personnage choisi sur la liste des raids, présélectionné s'il est éligible. */
  persoInitial?: string;
}) {
  const t = useDico().formCandidature;
  const [persoId, setPersoId] = useState(
    persos.some((p) => p.id === persoInitial) ? persoInitial! : (persos[0]?.id ?? ""),
  );
  const perso = persos.find((p) => p.id === persoId) ?? persos[0];
  const [coches, setCoches] = useState<Role[]>(perso?.roles.slice(0, 1) ?? []);
  // On ne garde que les rôles possibles pour le personnage choisi ; au moins un par défaut.
  const rolesValides = coches.filter((r) => perso?.roles.includes(r));
  const roles = rolesValides.length > 0 ? rolesValides : (perso?.roles.slice(0, 1) ?? []);

  const basculer = (r: Role) => setCoches(roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r]);

  return (
    <form action={action} className="form-candidature">
      <input type="hidden" name="annonceId" value={annonceId} />
      {roles.map((r) => (
        <input key={r} type="hidden" name="roles" value={r} />
      ))}
      <div className="champ">
        {t.personnage}
        <MenuDeroulant
          name="personnageId"
          etiquette={t.personnage}
          valeurInitiale={persoId}
          options={persos.map((p) => ({ valeur: p.id, libelle: p.libelle, classe: p.classe }))}
          surChangement={setPersoId}
        />
      </div>
      <div className="champ">
        {t.role}
        {perso && perso.roles.length > 1 && <small className="fuseau">{t.plusieursRoles}</small>}
        <div className="choix-roles" role="group" aria-label={t.rolesProposes}>
          {perso?.roles.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={roles.includes(r)}
              className={`petit ${roles.includes(r) ? "choisi" : ""}`}
              onClick={() => basculer(r)}
            >
              <NomRole role={r} taille={18} />
            </button>
          ))}
        </div>
      </div>
      <label className="champ">
        {t.note} <small className="fuseau">{t.noteAide}</small>
        <input name="note" maxLength={80} placeholder={t.notePlaceholder} />
      </label>
      <div>
        <BoutonEnvoi className="principal" enCours={t.envoi}>
          {listeAttente ? t.rejoindreAttente : t.candidater}
        </BoutonEnvoi>
      </div>
    </form>
  );
}
