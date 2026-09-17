// Percorsi delle illustrazioni generate con Midjourney (vedi docs/MIDJOURNEY.md).
// Ogni slot è facoltativo: se il file non esiste in public/art il sito usa la grafica vettoriale.
export const ART = {
  crest: '/art/logo-crest.png',
  stadium: '/art/stadium.jpg',
  heroPlayer: '/art/hero-player.png',
  trophy: '/art/trophy.png',
  starPlayer: '/art/star-player.png',
  parchment: '/art/texture-parchment.jpg',
  headers: {
    teams: '/art/header-teams.png',
    schedule: '/art/header-schedule.png',
    match: '/art/header-match.png',
    standings: '/art/header-standings.png',
    stats: '/art/header-stats.png',
    skills: '/art/header-skills.png',
    coaches: '/art/header-coaches.png',
    seasons: '/art/header-seasons.png',
    login: '/art/header-login.png',
  },
} as const;
