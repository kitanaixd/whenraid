import { ImageResponse } from "next/og";
import { apercuRaid, dateApercu, titreApercu } from "@/lib/apercu";
import { COULEUR_CLASSE, COULEUR_ROLE, FOND, OR, TAILLE_APERCU, imageApercu } from "@/lib/imagesApercu";
import { dicoCourant, langueCourante } from "@/lib/langue";
import { nomRaid, raids } from "@/lib/raids";

// Image du lien d'un raid partagé (Discord, réseaux) : illustration du raid, date, monde,
// grille de raid (classes et rôles, jamais de noms) et ce que le raid recherche encore.
export const alt = "WhenRaid";
export const size = TAILLE_APERCU;
export const contentType = "image/png";

const LARGEUR_GRILLE = 420;
const ECART = 6;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [a, d, langue] = await Promise.all([apercuRaid(id), dicoCourant(), langueCourante()]);
  if (!a) {
    // Raid introuvable ou brouillon : l'image générique du site.
    const { default: imageSite } = await import("../../opengraph-image");
    return imageSite();
  }

  const [fond, logo, faction, tank, soin, dps] = await Promise.all([
    imageApercu(`${raids[a.contenu].image}.jpg`),
    imageApercu("logo.png"),
    imageApercu(`${a.faction}.png`),
    imageApercu("TANK.png"),
    imageApercu("SOIGNEUR.png"),
    imageApercu("DPS.png"),
  ]);
  const iconeRole = { TANK: tank, SOIGNEUR: soin, DPS: dps };

  // Grille : une colonne par groupe de 5, cases de même largeur quelle que soit la taille (max 100 px).
  const groupes = Math.ceil(a.taille / 5);
  const largeurCase = Math.min(100, Math.floor((LARGEUR_GRILLE - (groupes - 1) * ECART) / groupes));
  const cases = [...a.cases];
  while (cases.length < a.taille) cases.push({ type: "libre" });
  const rang = (c: (typeof cases)[number]) => {
    const role = c.type === "libre" ? undefined : c.role;
    const ordre = role ? ["TANK", "SOIGNEUR", "DPS"].indexOf(role) * 2 : 6;
    return ordre + (c.type === "membre" ? 0 : 1) + (c.type === "libre" ? 2 : 0);
  };
  const triees = cases.sort((x, y) => rang(x) - rang(y)).slice(0, a.taille);
  const colonnes = Array.from({ length: groupes }, (_, g) => triees.slice(g * 5, g * 5 + 5));

  const etat =
    a.statut === "ANNULEE"
      ? d.apercu.annule
      : a.debutUtc.getTime() < Date.now()
        ? d.apercu.termine
        : a.ouvertes === 0
          ? d.apercu.complet
          : null;
  const recherche = a.recherche.filter((r) => r.nombre > 0);

  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: FOND, color: "#fafafa" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={fond} alt="" width={1200} height={630} style={{ position: "absolute", top: 0, left: 0 }} />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          display: "flex",
          background: "linear-gradient(90deg, rgba(9,9,11,0.94) 0%, rgba(9,9,11,0.8) 55%, rgba(9,9,11,0.5) 100%)",
        }}
      />
      <div style={{ display: "flex", width: "100%", padding: "52px 56px", gap: 48 }}>
        {/* Colonne de gauche : le raid. */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 24, letterSpacing: 4, color: OR }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={faction} alt="" width={40} height={40} />
            {`${d.faction[a.faction]} · ${d.ruleset[a.ruleset]} · ${a.region}`.toUpperCase()}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 22,
              fontSize: 66,
              fontWeight: 700,
              lineHeight: 1.05,
              maxHeight: 142,
              overflow: "hidden",
            }}
          >
            {titreApercu(a, d)}
          </div>
          {a.titre && (
            <div style={{ display: "flex", marginTop: 10, fontSize: 32, color: "#a1a1aa" }}>
              {nomRaid(a.contenu, d)}
            </div>
          )}
          <div style={{ display: "flex", marginTop: 22, fontSize: 36 }}>{dateApercu(a.debutUtc, a.region, langue)}</div>
          <div style={{ display: "flex", marginTop: 14, gap: 12, fontSize: 24, color: "#d4d4d8" }}>
            <div style={{ display: "flex" }}>{d.raid.loot(d.reglesLoot[a.reglesLoot])}</div>
            <div style={{ display: "flex", color: "#52525b" }}>·</div>
            <div style={{ display: "flex" }}>{d.apercu.organisePar(a.organisateur.nom)}</div>
          </div>

          {/* Ce que le raid recherche encore. */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", gap: 12 }}>
            {etat ? (
              <div style={{ display: "flex", fontSize: 34, color: OR }}>{etat}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: "#a1a1aa" }}>
                  {d.apercu.recherche.toUpperCase()}
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {recherche.map((r) => (
                    <div
                      key={r.role ?? "libre"}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 18px 8px 10px",
                        fontSize: 30,
                        fontWeight: 700,
                        borderRadius: 999,
                        border: `2px solid ${r.role ? COULEUR_ROLE[r.role] : OR}`,
                        background: "rgba(9,9,11,0.6)",
                      }}
                    >
                      {r.role ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={iconeRole[r.role]} alt="" width={34} height={34} />
                      ) : (
                        <div style={{ display: "flex", width: 34, justifyContent: "center", color: OR }}>+</div>
                      )}
                      {r.role
                        ? `${r.nombre} ${r.nombre > 1 ? d.rolesPluriel[r.role] : d.role[r.role]}`
                        : d.raid.besoin.placesLibres(r.nombre)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Colonne de droite : remplissage et grille de raid. */}
        <div style={{ display: "flex", flexDirection: "column", width: LARGEUR_GRILLE, gap: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <span style={{ fontSize: 56, fontWeight: 700, color: OR }}>{a.joueurs}</span>
              <span style={{ fontSize: 32, color: "#a1a1aa", paddingBottom: 8 }}>/ {a.taille}</span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="" width={74} height={60} />
          </div>
          <div style={{ display: "flex", height: 8, background: "rgba(255,255,255,0.12)" }}>
            <div style={{ display: "flex", width: `${(100 * a.joueurs) / a.taille}%`, background: OR }} />
          </div>
          <div style={{ display: "flex", gap: ECART, justifyContent: "center", marginTop: 6 }}>
            {colonnes.map((colonne, g) => (
              <div key={g} style={{ display: "flex", flexDirection: "column", gap: ECART }}>
                {colonne.map((c, n) => {
                  const base = {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: largeurCase,
                    height: 44,
                  } as const;
                  if (c.type === "membre") {
                    return (
                      <div
                        key={n}
                        style={{ ...base, background: COULEUR_CLASSE[c.classe], border: "2px solid rgba(0,0,0,0.55)" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={iconeRole[c.role]} alt="" width={24} height={24} />
                      </div>
                    );
                  }
                  if (c.type === "besoin") {
                    const couleur = c.classe ? COULEUR_CLASSE[c.classe] : c.role ? COULEUR_ROLE[c.role] : OR;
                    return (
                      <div key={n} style={{ ...base, border: `2px dashed ${couleur}`, background: "rgba(9,9,11,0.7)" }}>
                        {c.role && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={iconeRole[c.role]} alt="" width={24} height={24} />
                        )}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={n}
                      style={{
                        ...base,
                        border: "2px dashed rgba(226,189,111,0.45)",
                        background: "rgba(9,9,11,0.55)",
                        color: OR,
                        fontSize: 26,
                      }}
                    >
                      +
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div
            style={{ display: "flex", marginTop: "auto", justifyContent: "flex-end", fontSize: 24, color: "#a1a1aa" }}
          >
            whenraid.com
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
