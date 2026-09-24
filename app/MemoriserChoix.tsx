"use client";

import { useEffect } from "react";
import { COOKIE_CHOIX } from "@/lib/choixListe";

/** Retient le personnage ou le groupe choisi, pour le retrouver en revenant sur la liste. */
export function MemoriserChoix({ valeur }: { valeur: string }) {
  useEffect(() => {
    document.cookie = `${COOKIE_CHOIX}=${valeur}; path=/; max-age=31536000; samesite=lax`;
  }, [valeur]);
  return null;
}
