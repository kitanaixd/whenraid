"use client";

import { useEffect } from "react";
import { COOKIE_CHOIX } from "@/lib/choixListe";

/** Retient un choix de la liste (personnage ou groupe, vue…) pour le retrouver en y revenant. */
export function MemoriserChoix({ nom = COOKIE_CHOIX, valeur }: { nom?: string; valeur: string }) {
  useEffect(() => {
    document.cookie = `${nom}=${valeur}; path=/; max-age=31536000; samesite=lax`;
  }, [nom, valeur]);
  return null;
}
