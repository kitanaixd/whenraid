"use client";

import type { Classe, Role } from "@/generated/prisma/enums";
import { ClasseIcone, RoleIcone } from "@/app/ClasseIcone";
import { useDico } from "@/app/Langue";

/** Une case de la grille : un joueur de la compo, un joueur déjà accepté, une place réservée ou libre. */
export type CaseRaid =
  | { type: "membre"; classe: Classe; role: Role; moi?: boolean }
  | { type: "accepte" }
  | { type: "besoin"; classe?: Classe; role?: Role }
  | { type: "libre" };

const ORDRE_ROLES: Role[] = ["TANK", "SOIGNEUR", "DPS"];

/**
 * Aperçu du raid façon « cadres de raid » : une colonne par groupe de 5 (2 colonnes pour
 * un raid de 10, 4 pour 20, 8 pour 40). Joueurs de la compo en cases pleines, à la couleur
 * de leur classe ; places réservées en pointillés ; places libres hachurées.
 */
export function GrilleRaid({ taille, cases }: { taille: number; cases: CaseRaid[] }) {
  const d = useDico();
  // Les joueurs d'abord (tanks, soigneurs, DPS), puis les acceptés, les places réservées et libres.
  const rang = (c: CaseRaid) =>
    c.type === "membre" ? ORDRE_ROLES.indexOf(c.role) : c.type === "accepte" ? 3 : c.type === "besoin" ? 4 : 5;
  const triees = [...cases].sort((a, b) => rang(a) - rang(b)).slice(0, taille);
  while (triees.length < taille) triees.push({ type: "libre" });

  return (
    <div className="grille-raid-apercu" style={{ "--groupes": Math.ceil(taille / 5) } as React.CSSProperties}>
      {triees.map((c, n) => {
        if (c.type === "membre") {
          return (
            <div
              key={n}
              className={`case-raid membre ${c.moi ? "moi" : ""}`}
              style={{ "--c": `var(--classe-${c.classe})` } as React.CSSProperties}
              title={`${d.classe[c.classe]} · ${d.role[c.role]}`}
            >
              <span className="case-raid-role">
                <RoleIcone role={c.role} taille={14} />
              </span>
              <span className="case-nom">{c.moi ? d.commun.toi : d.classe[c.classe]}</span>
            </div>
          );
        }
        if (c.type === "accepte") {
          return (
            <div key={n} className="case-raid accepte">
              <span className="case-nom">{d.creation.caseAccepte}</span>
            </div>
          );
        }
        if (c.type === "besoin") {
          return (
            <div
              key={n}
              className="case-raid besoin"
              style={
                {
                  "--c": c.classe ? `var(--classe-${c.classe})` : `var(--role-${c.role ?? "libre"})`,
                } as React.CSSProperties
              }
              title={[c.classe && d.classe[c.classe], c.role && d.role[c.role]].filter(Boolean).join(" · ")}
            >
              {c.role && (
                <span className="case-raid-role">
                  <RoleIcone role={c.role} taille={14} />
                </span>
              )}
              {c.classe ? (
                <ClasseIcone classe={c.classe} taille={20} />
              ) : (
                <span className="case-nom">{c.role ? d.role[c.role] : ""}</span>
              )}
            </div>
          );
        }
        return <div key={n} className="case-raid libre" aria-hidden="true" />;
      })}
    </div>
  );
}
