"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type TypeBanniere =
  | "CANDIDATURE_ACCEPTEE"
  | "CANDIDATURE_REFUSEE"
  | "NOUVELLE_CANDIDATURE"
  | "DESISTEMENT"
  | "RAID_ANNULE"
  | "RAID_COMPLET";
type Banniere = { id: string; type: TypeBanniere; texte: string; lien: string };
type Reponse = { empreinte: string; bannieres: Banniere[] };

/** Titre, symbole et couleur de chaque bannière. */
const STYLE: Record<TypeBanniere, { titre: string; symbole: string; ton: string }> = {
  CANDIDATURE_ACCEPTEE: { titre: "Convocation", symbole: "✔", ton: "succes" },
  CANDIDATURE_REFUSEE: { titre: "Candidature refusée", symbole: "✕", ton: "alerte" },
  NOUVELLE_CANDIDATURE: { titre: "Nouvelle candidature", symbole: "+", ton: "info" },
  DESISTEMENT: { titre: "Désistement", symbole: "!", ton: "attention" },
  RAID_ANNULE: { titre: "Raid annulé", symbole: "!", ton: "alerte" },
  RAID_COMPLET: { titre: "Raid complet", symbole: "⏳", ton: "attention" },
};

const CLE = "whenraid.bannieres-vues";
const INTERVALLE = 15_000;
const DUREE = 10_000;

// Bannières déjà montrées sur ce navigateur (confort uniquement : le stockage peut être absent).
function lireVues(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CLE) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function enregistrerVues(vues: Set<string>) {
  try {
    localStorage.setItem(CLE, JSON.stringify([...vues].slice(-50)));
  } catch {
    // Stockage indisponible (navigation privée…) : la bannière pourra réapparaître, sans gravité.
  }
}

/**
 * Tient la page à jour sans rechargement : toutes les 15 s (onglet visible), demande au
 * serveur une empreinte de ce qui concerne le joueur ; si elle a changé (nouvelle
 * candidature, acceptation, refus, désistement, annulation…), la page se met à jour.
 * Affiche aussi en bas à droite une bannière pour chaque nouvelle notification importante.
 */
export function Bannieres() {
  const [affichees, setAffichees] = useState<Banniere[]>([]);
  const router = useRouter();
  const minuteries = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const derniereEmpreinte = useRef<string | null>(null);

  const fermer = useCallback((id: string) => {
    setAffichees((b) => b.filter((x) => x.id !== id));
    clearTimeout(minuteries.current.get(id));
    minuteries.current.delete(id);
  }, []);

  useEffect(() => {
    let actif = true;
    const verifier = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const reponse = await fetch("/api/notifications/bannieres", { cache: "no-store" });
        if (!reponse.ok || !actif) return;
        const { empreinte, bannieres } = (await reponse.json()) as Reponse;

        // Quelque chose a changé depuis le dernier passage : on met la page à jour.
        const aChange = derniereEmpreinte.current !== null && derniereEmpreinte.current !== empreinte;
        derniereEmpreinte.current = empreinte;

        const vues = lireVues();
        const nouvelles = bannieres.filter((b) => !vues.has(b.id));
        if (nouvelles.length > 0) {
          for (const b of nouvelles) vues.add(b.id);
          enregistrerVues(vues);
          setAffichees((a) => [...nouvelles, ...a].slice(0, 3));
          for (const b of nouvelles) minuteries.current.set(b.id, setTimeout(() => fermer(b.id), DUREE));
        }
        if (aChange || nouvelles.length > 0) router.refresh();
      } catch {
        // Réseau indisponible : on réessaiera au prochain passage.
      }
    };
    verifier();
    const intervalle = setInterval(verifier, INTERVALLE);
    document.addEventListener("visibilitychange", verifier);
    const toutes = minuteries.current;
    return () => {
      actif = false;
      clearInterval(intervalle);
      document.removeEventListener("visibilitychange", verifier);
      for (const t of toutes.values()) clearTimeout(t);
    };
  }, [fermer, router]);

  if (affichees.length === 0) return null;
  return (
    <div className="bannieres" role="status" aria-live="polite">
      {affichees.map((b) => {
        const style = STYLE[b.type];
        return (
          <div key={b.id} className={`banniere ton-${style.ton}`}>
            <span className="banniere-symbole" aria-hidden="true">
              {style.symbole}
            </span>
            {/* <a> simple : pas de préchargement, qui marquerait la notification comme lue. */}
            <a href={b.lien} className="banniere-texte" onClick={() => fermer(b.id)}>
              <strong>{style.titre}</strong>
              <span>{b.texte}</span>
            </a>
            <button type="button" className="banniere-fermer" aria-label="Fermer" onClick={() => fermer(b.id)}>
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
