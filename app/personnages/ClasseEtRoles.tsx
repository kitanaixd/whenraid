"use client";

import { useState } from "react";
import type { Classe, Role } from "@/generated/prisma/enums";
import { MenuDeroulant } from "@/app/MenuDeroulant";
import { useDico } from "@/app/Langue";
import { rolesParClasse } from "@/lib/jeu";
import { options, optionsTriees } from "@/lib/libelles";

/** Classe du personnage et rôles jouables : seuls les rôles possibles pour la classe sont proposés. */
export function ClasseEtRoles({ classeInitiale, rolesInitiaux }: { classeInitiale?: Classe; rolesInitiaux?: Role[] }) {
  const d = useDico();
  const classes = optionsTriees(d.classe);
  const [classe, setClasse] = useState<Classe>(classeInitiale ?? (classes[0][0] as Classe));
  const [roles, setRoles] = useState<Role[]>(rolesInitiaux ?? []);
  const possibles = rolesParClasse[classe];
  // Une classe à un seul rôle (mage, voleur…) : ce rôle est coché d'office.
  const coches = possibles.length === 1 ? possibles : roles.filter((r) => possibles.includes(r));

  return (
    <>
      <div className="rangee">
        <div className="champ">
          {d.champ.classe}
          <MenuDeroulant
            name="classe"
            etiquette={d.champ.classe}
            valeurInitiale={classe}
            surChangement={(v) => setClasse(v as Classe)}
            options={classes.map(([v, l]) => ({ valeur: v, libelle: l, classe: v }))}
          />
        </div>
      </div>
      <fieldset>
        <legend>{d.personnages.rolesJouables}</legend>
        <div className="cases">
          {options(d.role)
            .filter(([v]) => possibles.includes(v as Role))
            .map(([v, l]) => (
              <label key={v}>
                <input
                  type="checkbox"
                  name="rolesJouables"
                  value={v}
                  checked={coches.includes(v as Role)}
                  disabled={possibles.length === 1}
                  onChange={(e) => setRoles(e.target.checked ? [...coches, v as Role] : coches.filter((r) => r !== v))}
                />{" "}
                {l}
              </label>
            ))}
          {/* Case désactivée : elle n'est pas envoyée, le rôle unique part donc en champ caché. */}
          {possibles.length === 1 && <input type="hidden" name="rolesJouables" value={possibles[0]} />}
        </div>
      </fieldset>
    </>
  );
}
