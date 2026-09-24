"use client";

import { useFormStatus } from "react-dom";

/**
 * Bouton d'envoi qui se désactive pendant l'envoi du formulaire :
 * un double-clic ne peut plus envoyer deux fois la même action.
 */
export function BoutonEnvoi({
  children,
  enCours = "…",
  className,
  disabled,
  name,
  value,
  formAction,
}: {
  children: React.ReactNode;
  enCours?: string;
  className?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
  /** Autre action que celle du formulaire (ex. « Refuser » à côté de « Accepter »). */
  formAction?: (form: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      formAction={formAction}
      className={className}
      disabled={pending || disabled}
      aria-busy={pending}
    >
      {pending ? enCours : children}
    </button>
  );
}
