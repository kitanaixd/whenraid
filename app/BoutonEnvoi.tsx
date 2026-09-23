"use client";

import { useFormStatus } from "react-dom";

/**
 * Bouton d'envoi qui se désactive pendant l'envoi du formulaire :
 * un double-clic ne peut plus envoyer deux fois la même action.
 */
export function BoutonEnvoi({
  children,
  enCours = "Envoi…",
  className,
  disabled,
  name,
  value,
}: {
  children: React.ReactNode;
  enCours?: string;
  className?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      disabled={pending || disabled}
      aria-busy={pending}
    >
      {pending ? enCours : children}
    </button>
  );
}
