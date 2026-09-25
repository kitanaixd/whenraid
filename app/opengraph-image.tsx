import { ImageResponse } from "next/og";
import { FOND, OR, TAILLE_APERCU, imageApercu } from "@/lib/imagesApercu";

// Image des liens vers le site (Discord, réseaux) : générée une fois au déploiement.
export const alt = "WhenRaid — WoW Forever raid finder";
export const size = TAILLE_APERCU;
export const contentType = "image/png";

export default async function Image() {
  const [fond, logo] = await Promise.all([imageApercu("fond.jpg"), imageApercu("logo.png")]);
  const raids = ["Barrow Deeps (10)", "Mount Hyjal (20)", "Onyxia (40)"];

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
          background: "linear-gradient(90deg, rgba(9,9,11,0.96) 0%, rgba(9,9,11,0.82) 55%, rgba(9,9,11,0.35) 100%)",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 80px", gap: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={148} height={120} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 26, letterSpacing: 6, color: OR }}>WOW FOREVER</div>
            <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1 }}>WhenRaid</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 44, lineHeight: 1.2, maxWidth: 820 }}>
          <span>Find a raid looking for your class.</span>
          <span style={{ color: "#a1a1aa" }}>Apply in one click, solo or with friends.</span>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {raids.map((r) => (
            <div
              key={r}
              style={{
                display: "flex",
                padding: "10px 22px",
                fontSize: 26,
                border: `2px solid ${OR}`,
                color: OR,
                borderRadius: 999,
                background: "rgba(226,189,111,0.10)",
              }}
            >
              {r}
            </div>
          ))}
          <div style={{ display: "flex", padding: "10px 6px", fontSize: 26, color: "#a1a1aa" }}>whenraid.com</div>
        </div>
      </div>
    </div>,
    size,
  );
}
