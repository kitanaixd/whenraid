"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Classe, Faction, Role } from "@/generated/prisma/enums";
import { ClasseIcone, FactionIcone, RoleIcone } from "./ClasseIcone";

export type OptionMenu = { valeur: string; libelle: string; classe?: Classe; role?: Role; faction?: Faction };

function Icone({ option }: { option?: OptionMenu }) {
  if (option?.classe) return <ClasseIcone classe={option.classe} taille={22} />;
  if (option?.role) return <RoleIcone role={option.role} taille={22} />;
  if (option?.faction) return <FactionIcone faction={option.faction} taille={22} />;
  return <span className="menu-sans-icone" />;
}

/**
 * Menu déroulant avec icônes de classe (le <select> natif n'accepte que du texte).
 * La valeur choisie part avec le formulaire via un champ caché `name`.
 * Clavier : flèches, Début / Fin, Entrée ou Espace pour choisir, Échap pour fermer.
 */
export function MenuDeroulant({
  name,
  options,
  valeurInitiale,
  etiquette,
  surChangement,
}: {
  name: string;
  options: OptionMenu[];
  valeurInitiale?: string;
  etiquette: string;
  surChangement?: (valeur: string) => void;
}) {
  const [valeur, setValeur] = useState(valeurInitiale ?? options[0]?.valeur ?? "");
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);
  const conteneur = useRef<HTMLDivElement>(null);
  const liste = useRef<HTMLUListElement>(null);
  const id = useId();

  const choisie = options.find((o) => o.valeur === valeur) ?? options[0];

  // Ferme le menu quand on clique ailleurs.
  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: MouseEvent) => {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
  }, [ouvert]);

  // Garde l'option active visible pendant la navigation au clavier.
  useEffect(() => {
    if (ouvert) liste.current?.children[actif]?.scrollIntoView({ block: "nearest" });
  }, [ouvert, actif]);

  const ouvrir = () => {
    setActif(Math.max(0, options.findIndex((o) => o.valeur === valeur)));
    setOuvert(true);
  };
  const choisir = (index: number) => {
    const option = options[index];
    if (!option) return;
    setValeur(option.valeur);
    setOuvert(false);
    surChangement?.(option.valeur);
  };

  const auClavier = (e: React.KeyboardEvent) => {
    if (!ouvert) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        ouvrir();
      }
      return;
    }
    const derniere = options.length - 1;
    if (e.key === "ArrowDown") setActif((a) => Math.min(a + 1, derniere));
    else if (e.key === "ArrowUp") setActif((a) => Math.max(a - 1, 0));
    else if (e.key === "Home") setActif(0);
    else if (e.key === "End") setActif(derniere);
    else if (e.key === "Enter" || e.key === " ") choisir(actif);
    else if (e.key === "Escape") setOuvert(false);
    else if (e.key === "Tab") return setOuvert(false);
    else return;
    e.preventDefault();
  };

  return (
    <div className="menu-deroulant" ref={conteneur}>
      <input type="hidden" name={name} value={valeur} />
      <button
        type="button"
        className="menu-choisi"
        role="combobox"
        aria-label={etiquette}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-controls={`${id}-liste`}
        aria-activedescendant={ouvert ? `${id}-${actif}` : undefined}
        onClick={() => (ouvert ? setOuvert(false) : ouvrir())}
        onKeyDown={auClavier}
      >
        <Icone option={choisie} />
        <span className="menu-libelle">{choisie?.libelle}</span>
        <span className="menu-fleche" aria-hidden="true">
          ▾
        </span>
      </button>
      {ouvert && (
        <ul className="menu-liste" role="listbox" id={`${id}-liste`} ref={liste} aria-label={etiquette}>
          {options.map((o, i) => (
            <li
              key={o.valeur}
              id={`${id}-${i}`}
              role="option"
              aria-selected={o.valeur === valeur}
              className={i === actif ? "actif" : undefined}
              onMouseEnter={() => setActif(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choisir(i)}
            >
              <Icone option={o} />
              <span>{o.libelle}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
