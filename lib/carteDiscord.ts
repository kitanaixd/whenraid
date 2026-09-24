// Mise en forme des MP Discord : une carte (embed) avec un titre, une couleur selon
// le type de message, les infos du raid en champs et des boutons-liens vers le site.
import type { Contenu, Role, TypeNotification } from "@/generated/prisma/enums";
import { nomEnJeu } from "@/lib/jeu";
import type { Dico } from "@/lib/i18n";
import { nomRaid, raids } from "@/lib/raids";
import { URL_SITE } from "@/lib/site";

export type MessageDiscord = {
  embeds: object[];
  components?: object[];
};

const OR = 0xe2bd6f;
export const COULEUR_OR = OR;
const VERT = 0x3ba55d;
const ROUGE = 0xed4245;
const ORANGE = 0xf0b232;

export const COULEUR_NOTIFICATION: Record<TypeNotification, number> = {
  CANDIDATURE_ACCEPTEE: VERT,
  CANDIDATURE_REFUSEE: ROUGE,
  RAID_COMPLET: ORANGE,
  RAID_ANNULE: ROUGE,
  NOUVELLE_CANDIDATURE: OR,
  VALIDER_PRESENCES: OR,
  DESISTEMENT: ORANGE,
  CANDIDATURE_GROUPE: OR,
  RETIRE_PAR_RL: ROUGE,
};

type RaidCarte = { id: string; contenu: Contenu; titre: string | null; debutUtc: Date };

/** Nom affiché du raid : son titre s'il en a un, suivi du raid. */
export function nomCarte(annonce: RaidCarte, d: Dico) {
  return annonce.titre ? `${annonce.titre} · ${nomRaid(annonce.contenu, d)}` : nomRaid(annonce.contenu, d);
}

/** Date affichée par Discord dans l'heure et la langue de chaque lecteur, avec « dans 2 heures ». */
export function dateDiscord(instant: Date) {
  const t = Math.floor(instant.getTime() / 1000);
  return `<t:${t}:F> (<t:${t}:R>)`;
}

export const lienRaid = (annonceId: string, ancre = "") => `${URL_SITE}/annonces/${annonceId}${ancre}`;

/** Une carte de raid, avec des boutons-liens (le premier est le plus important). */
export function carteRaid({
  annonce,
  d,
  titre,
  couleur,
  description,
  champs = [],
  boutons,
}: {
  annonce: RaidCarte;
  d: Dico;
  titre: string;
  couleur: number;
  description: string;
  champs?: { name: string; value: string; inline?: boolean }[];
  boutons?: { libelle: string; url: string }[];
}): MessageDiscord {
  const liens = boutons ?? [{ libelle: d.discord.voirRaid, url: lienRaid(annonce.id) }];
  return {
    embeds: [
      {
        title: titre,
        url: lienRaid(annonce.id),
        description,
        color: couleur,
        fields: [{ name: d.discord.champ.date, value: dateDiscord(annonce.debutUtc) }, ...champs],
        thumbnail: { url: `${URL_SITE}/raids/${raids[annonce.contenu].image}-petit.webp` },
        footer: { text: d.discord.pied },
      },
    ],
    components: [
      {
        type: 1,
        components: liens.slice(0, 5).map((b) => ({ type: 2, style: 5, label: b.libelle, url: b.url })),
      },
    ],
  };
}

/** Carte d'une notification du site envoyée en MP (acceptation, refus, désistement…). */
export function carteNotification(
  type: TypeNotification,
  annonce: RaidCarte,
  d: Dico,
  personnage?: { nom: string; nomDeFamille: string | null } | null,
  role?: Role | null,
) {
  const champs = [];
  if (type === "CANDIDATURE_ACCEPTEE" && personnage) {
    const avecRole = role ? " · " + d.role[role] : "";
    champs.push({ name: d.discord.champ.personnage, value: nomEnJeu(personnage) + avecRole, inline: true });
  }
  return carteRaid({
    annonce,
    d,
    titre: d.discord.titre[type],
    couleur: COULEUR_NOTIFICATION[type],
    description: d.notification[type]("**" + nomCarte(annonce, d) + "**"),
    champs,
  });
}
