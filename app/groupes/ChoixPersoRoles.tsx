"use client";

import { useState } from "react";
import type { Classe, Role } from "@/generated/prisma/enums";
import { ClasseIcone, NomRole } from "@/app/ClasseIcone";
import { useDico } from "@/app/Langue";

type PersoChoix = { id: string; nom: string; classe: Classe; roles: Role[]; ruleset?: string };

/** Personnage du joueur dans un groupe, puis les rôles qu'il y jouera (ceux de ce personnage). */
export function ChoixPersoRoles({
  persos,
  persoInitial,
  rolesInitiaux,
}: {
  persos: PersoChoix[];
  persoInitial?: string;
  rolesInitiaux?: Role[];
}) {
  const d = useDico();
  const [persoId, setPersoId] = useState(persoInitial ?? persos[0]?.id ?? "");
  const perso = persos.find((p) => p.id === persoId);
  // Rôles cochés par défaut : ceux déjà choisis, sinon le premier rôle du personnage.
  const coches = persoId === persoInitial && rolesInitiaux ? rolesInitiaux : (perso?.roles.slice(0, 1) ?? []);

  return (
    <>
      <fieldset className="choix-perso-groupe">
        <legend>{d.groupes.tonPerso}</legend>
        {persos.map((p) => (
          <label key={p.id} className={`perso-choix ${p.id === persoId ? "choisi" : ""}`}>
            <input
              type="radio"
              name="personnageId"
              value={p.id}
              checked={p.id === persoId}
              onChange={() => setPersoId(p.id)}
              className="sr-only"
            />
            <ClasseIcone classe={p.classe} taille={24} />
            <span className="classe" style={{ "--c": `var(--classe-${p.classe})` } as React.CSSProperties}>
              {p.nom}
            </span>
            {p.ruleset && <span className="ruleset-perso">({p.ruleset})</span>}
          </label>
        ))}
      </fieldset>
      {perso && (
        // La clé remet les cases à zéro quand on change de personnage.
        <fieldset key={perso.id} className="rapide-roles">
          <legend>{d.groupes.tesRoles}</legend>
          {perso.roles.map((r) => (
            <label key={r} className="case-role">
              <input type="checkbox" name="roles" value={r} defaultChecked={coches.includes(r)} />
              <NomRole role={r} taille={18} />
            </label>
          ))}
        </fieldset>
      )}
    </>
  );
}
