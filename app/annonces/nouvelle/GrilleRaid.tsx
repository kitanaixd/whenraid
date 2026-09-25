"use client";

import type { Classe, Role } from "@/generated/prisma/enums";
import { ClasseIcone, RoleIcone } from "@/app/ClasseIcone";
import { useDico } from "@/app/Langue";
import { rolesParClasse } from "@/lib/jeu";

/** Une case de la grille : un joueur de la compo, un joueur déjà accepté, une place réservée ou libre. */
export type CaseRaid =
  | { type: "membre"; classe: Classe; role: Role; moi?: boolean; nom?: string | null }
  | { type: "accepte" }
  | { type: "besoin"; classe?: Classe; role?: Role }
  | { type: "libre" };

const ORDRE_ROLES: Role[] = ["TANK", "SOIGNEUR", "DPS"];

/**
 * Aperçu du raid façon « cadres de raid » : une colonne par groupe de 5 (2 colonnes pour
 * un raid de 10, 4 pour 20, 8 pour 40). Joueurs de la compo en cases pleines, à la couleur
 * de leur classe ; places réservées en pointillés ; places libres hachurées.
 */
export function GrilleRaid({
  taille,
  cases,
  compacte = false,
}: {
  taille: number;
  cases: CaseRaid[];
  /** Colonne étroite (page du raid) : au-delà de 10 joueurs, les cases n'affichent que les icônes. */
  compacte?: boolean;
}) {
  const icones = compacte && taille > 10;
  const d = useDico();
  // Toujours Tank > Soigneur > DPS : dans chaque rôle, les joueurs puis les places réservées.
  // Une place réservée à une classe sans rôle précisé prend le seul rôle de cette classe s'il n'y en a qu'un
  // (mage, voleur…), sinon elle vient après les DPS. Puis les joueurs déjà acceptés, puis les places libres.
  const roleDe = (c: CaseRaid): Role | undefined => {
    if (c.type === "membre") return c.role;
    if (c.type !== "besoin") return undefined;
    if (c.role) return c.role;
    const possibles = c.classe ? rolesParClasse[c.classe] : [];
    return possibles.length === 1 ? possibles[0] : undefined;
  };
  const rang = (c: CaseRaid) => {
    const role = roleDe(c);
    if (role) return ORDRE_ROLES.indexOf(role) * 2 + (c.type === "membre" ? 0 : 1);
    return c.type === "besoin" ? 6 : c.type === "accepte" ? 7 : 8;
  };
  const triees = [...cases].sort((a, b) => rang(a) - rang(b)).slice(0, taille);
  while (triees.length < taille) triees.push({ type: "libre" });

  return (
    <div
      className={`grille-raid-apercu g${Math.ceil(taille / 5)} ${icones ? "icones" : ""}`}
      style={{ "--groupes": Math.ceil(taille / 5) } as React.CSSProperties}
    >
      {triees.map((c, n) => {
        if (c.type === "membre") {
          return (
            <div
              key={n}
              className={`case-raid membre ${c.moi ? "moi" : ""}`}
              style={{ "--c": `var(--classe-${c.classe})` } as React.CSSProperties}
              title={[c.nom, d.classe[c.classe], d.role[c.role]].filter(Boolean).join(" · ")}
            >
              <span className="case-raid-role">
                <RoleIcone role={c.role} taille={14} />
              </span>
              {icones ? (
                <ClasseIcone classe={c.classe} taille={18} />
              ) : (
                <span className="case-nom">{c.moi ? d.commun.toi : (c.nom ?? d.classe[c.classe])}</span>
              )}
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
        // Place libre : « + Libre » (juste « + » quand les cases sont petites).
        return (
          <div key={n} className="case-raid libre" title={d.creation.caseLibre}>
            <span className="case-nom">{icones ? "+" : `+ ${d.creation.caseLibre}`}</span>
          </div>
        );
      })}
    </div>
  );
}
