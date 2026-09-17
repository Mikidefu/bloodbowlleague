// Percorsi delle illustrazioni generate con Midjourney (vedi docs/MIDJOURNEY.md).
// Ogni slot è facoltativo: se il file non esiste in public/art il sito usa la grafica vettoriale.
export const ART = {
  crest: '/art/logo-crest.webp',
  stadium: '/art/stadium.jpg',
  heroPlayer: '/art/hero-player.webp',
  trophy: '/art/trophy.webp',
  starPlayer: '/art/star-player.webp',
  parchment: '/art/texture-parchment.jpg',
  headers: {
    teams: '/art/header-teams.webp',
    schedule: '/art/header-schedule.webp',
    match: '/art/header-match.webp',
    standings: '/art/header-standings.webp',
    stats: '/art/header-stats.webp',
    skills: '/art/header-skills.webp',
    coaches: '/art/header-coaches.webp',
    seasons: '/art/header-seasons.webp',
    login: '/art/header-login.webp',
  },
} as const;
