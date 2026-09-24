"use client";

/**
 * Formulaire de filtre (GET) qui s'applique dès qu'on coche une case ou change un menu :
 * pas besoin de bouton « Filtrer ».
 */
export function FormulaireAuto({
  className,
  label,
  children,
}: {
  className?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <form
      method="get"
      role="search"
      aria-label={label}
      className={className}
      onChange={(e) => e.currentTarget.requestSubmit()}
    >
      {children}
    </form>
  );
}
