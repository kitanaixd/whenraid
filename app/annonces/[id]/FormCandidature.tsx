"use client";

import { useState } from "react";
import type { Classe, Role } from "@/generated/prisma/enums";
import { MenuDeroulant } from "@/app/MenuDeroulant";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";
import { NomRole } from "@/app/ClasseIcone";

export type PersoCandidat = { id: string; libelle: string; classe: Classe; roles: Role[] };

/** Candidature en trois étapes : personnage, puis rôle (selon le personnage), puis note pour le RL. */
export function FormCandidature({
  action,
  placeId,
  persos,
  listeAttente,
}: {
  action: (form: FormData) => void;
  placeId: string;
  persos: PersoCandidat[];
  listeAttente: boolean;
}) {
  const [persoId, setPersoId] = useState(persos[0]?.id ?? "");
  const perso = persos.find((p) => p.id === persoId) ?? persos[0];
  const [role, setRole] = useState<Role | undefined>(perso?.roles[0]);
  // Si le rôle choisi n'existe pas pour le nouveau personnage, on prend son premier rôle.
  const roleValide = perso && role && perso.roles.includes(role) ? role : perso?.roles[0];

  return (
    <form action={action} className="form-candidature">
      <input type="hidden" name="placeId" value={placeId} />
      <input type="hidden" name="role" value={roleValide ?? ""} />
      <div className="champ">
        1. Personnage
        <MenuDeroulant
          name="personnageId"
          etiquette="Personnage"
          options={persos.map((p) => ({ valeur: p.id, libelle: p.libelle, classe: p.classe }))}
          surChangement={setPersoId}
        />
      </div>
      <div className="champ">
        2. Rôle
        <div className="choix-roles" role="radiogroup" aria-label="Rôle">
          {perso?.roles.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={r === roleValide}
              className={`petit ${r === roleValide ? "choisi" : ""}`}
              onClick={() => setRole(r)}
            >
              <NomRole role={r} taille={18} />
            </button>
          ))}
        </div>
      </div>
      <label className="champ">
        3. Note pour le RL <small className="fuseau">(facultatif, 80 caractères)</small>
        <input name="note" maxLength={80} placeholder="Ex. : stuff T2, dispo jusqu'à minuit" />
      </label>
      <div>
        <BoutonEnvoi className="principal" enCours="Envoi…">
          {listeAttente ? "Rejoindre la liste d'attente" : "Candidater"}
        </BoutonEnvoi>
      </div>
    </form>
  );
}
