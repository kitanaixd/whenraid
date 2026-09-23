"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Banniere = { id: string; type: "CANDIDATURE_ACCEPTEE" | "NOUVELLE_CANDIDATURE"; texte: string; lien: string };

const CLE = "whenraid.bannieres-vues";
const INTERVALLE = 30_000;
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
 * Bannières en bas à droite : « tu es convié » et « nouvelle candidature ».
 * La page demande les nouveautés toutes les 30 s tant que l'onglet est visible.
 */
export function Bannieres() {
  const [affichees, setAffichees] = useState<Banniere[]>([]);
  const router = useRouter();
  const minuteries = useRef(new Map<string, ReturnType<typeof setTimeout>>());

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
        if (!reponse.ok) return;
        const recues = (await reponse.json()) as Banniere[];
        const vues = lireVues();
        const nouvelles = recues.filter((b) => !vues.has(b.id));
        if (!actif || nouvelles.length === 0) return;
        for (const b of nouvelles) vues.add(b.id);
        enregistrerVues(vues);
        setAffichees((a) => [...nouvelles, ...a].slice(0, 3));
        for (const b of nouvelles) minuteries.current.set(b.id, setTimeout(() => fermer(b.id), DUREE));
        router.refresh(); // met à jour la cloche et les listes
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
      {affichees.map((b) => (
        <div key={b.id} className={`banniere banniere-${b.type === "CANDIDATURE_ACCEPTEE" ? "acceptee" : "candidature"}`}>
          <span className="banniere-symbole" aria-hidden="true">
            {b.type === "CANDIDATURE_ACCEPTEE" ? "✔" : "+"}
          </span>
          {/* <a> simple : pas de préchargement, qui marquerait la notification comme lue. */}
          <a href={b.lien} className="banniere-texte" onClick={() => fermer(b.id)}>
            <strong>{b.type === "CANDIDATURE_ACCEPTEE" ? "Convocation" : "Nouvelle candidature"}</strong>
            <span>{b.texte}</span>
          </a>
          <button type="button" className="banniere-fermer" aria-label="Fermer" onClick={() => fermer(b.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
