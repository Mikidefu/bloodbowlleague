# Blood Bowl League · New Season — Brand Guide

Restyling ispirato a due riferimenti:

- **Spike! Journal**: fondi rosso sangue granulosi, bande ardesia, titoli giallo senape in corsivo pesante, capolettera, box con filetto giallo, pagine pergamena con cornice color cuoio, schizzi di sangue e catene.
- **Rulebook 3ª stagione**: carta chiara, fascia rossa col bordo curvo, titoli slab rossi condensati con "!", blu navy, tabelle roster (intestazione rossa, righe alternate azzurrine, barra blu con tre stelle), stemma a punte.

Direzione **ibrida**: testate e navigazione scure (Spike!), contenuti su pergamena o carta (Rulebook).
Tutti gli asset sono originali: nessuna illustrazione o logo di Games Workshop è stato copiato.

## Token (in `src/app/globals.css`)

| Ruolo | Token | Valore |
|---|---|---|
| Rosso Spike (fondi) | `--bb-blood-700` | `#9a2226` |
| Rosso Rulebook (fasce, intestazioni tabelle, CTA) | `--bb-red` | `#c8252c` |
| Rosso scuro / ombre | `--bb-blood-800`, `--bb-blood-950` | `#7a1a1c`, `#3a0d0f` |
| Ardesia (fondo sito, pannelli) | `--bb-slate-800/700/900/950` | `#2d323a` … |
| Testo secondario su scuro | `--bb-slate-300` | `#a9aeb7` |
| Giallo senape (titoli, accenti) | `--bb-mustard` | `#eab22a` |
| Cuoio (cornici, linguette) | `--bb-tan`, `--bb-tan-dark` | `#b8926a`, `#8a6843` |
| Pergamena (card) | `--bb-parchment`, `--bb-parchment-2` | `#efe5d2`, `#e4d6bb` |
| Carta (tabelle, input) | `--bb-paper` | `#f6f2ea` |
| Blu navy | `--bb-navy`, `--bb-navy-deep` | `#25386f`, `#1a2852` |
| Righe alternate tabelle | `--bb-sky`, `--bb-sky-2` | `#e3e8f2`, `#cfd8ea` |
| Inchiostro | `--bb-ink`, `--bb-ink-soft` | `#1d1a18`, `#544b45` |
| Verde positivo | `--bb-success` | `#3d7a34` |

**Regole colore**: su fondo scuro il testo è `--bb-parchment` e gli accenti sono `--bb-mustard`. Su pergamena o carta il testo è `--bb-ink` e gli accenti sono `--bb-blood-700`/`--bb-red`. Non usare `#fff`/`#000` puri, a parte il titolo bianco della copertina.
Gli alias legacy (`--color-*`, `--font-impact`, …) esistono solo come rete di sicurezza: il codice nuovo usa i token `--bb-*`.

## Tipografia

| Token | Font | Uso |
|---|---|---|
| `--font-display` | Barlow Condensed 600–900 (anche corsivo) | Titoli Spike! (corsivo 800), navigazione, pulsanti, etichette, numeri grandi |
| `--font-slab` | Rokkitt 500–900 | Titoli Rulebook (900), occhielli in maiuscoletto, wordmark, numeri di pagina |
| `--font-body` | Archivo | Testo corrente |
| `--font-data` | Archivo + `font-stretch: 80–85%` | Tabelle, statistiche, dati |

Titoli sempre MAIUSCOLI. Un punto esclamativo è benvenuto ma non va aggiunto ai testi tradotti.

## Classi globali

- **Pannelli**: `.card` / `.panel-parchment` (pergamena, cornice cuoio a doppio filetto), `.panel-blood`, `.panel-slate`, `.intro-box` (filetto giallo), `.dropcap`.
- **Titoli**: `.title-slab` (rosso slab con filetto, su chiaro), `.title-spike` (giallo corsivo, su scuro), `.subhead` (maiuscoletto con filetto; si adatta a chiaro e scuro).
- **Pulsanti**: `.btn` (pergamena) + `.btn-primary` (rosso), `.btn-gold`, `.btn-navy`, `.btn-slate`. Forma inclinata e bordo inferiore in rilievo.
- **Tabelle**: `.table-container` > `.stars-bar` + `table.data-table`. Usare `.num` per le colonne numeriche e `tfoot` per la barra navy.
- **Decorazioni**: `.page-tab` (linguetta cuoio col numero), `.tag` / `.tag-red` / `.tag-navy` (etichetta inclinata), `.splatter` / `.splatter-b` (schizzo, `position: absolute`), `.chain-rule` (catena divisoria), `.torn-bottom` (bordo inferiore strappato).
- **Stati**: `.loading-state`, `.muted`.

## Componenti (`src/components/brand/`)

- `<PageHeader title kicker? subtitle? icon? actions? tone?="blood|slate|navy" />`: testata di **ogni** pagina con fascia curva e titolo corsivo giallo. Sostituisce i vecchi `headerArea`/`pageTitle`.
- `<Emblem size? topText? bottomText? initials? />`: stemma SVG della lega con anello a punte.

## Asset (`public/brand/`)

| File | Descrizione |
|---|---|
| `grain.svg` | Grana fine (tile 240px) per carta e pulsanti |
| `grunge.svg` | Macchie da stampa (tile 900px) per fondi scuri o rossi |
| `badge-ring.svg` | Stemma senza testo (favicon, filigrane). Copia in `src/app/icon.svg` |
| `stars-bar.svg` | Barra navy con tre stelle sopra le tabelle |
| `splatter-a.svg`, `splatter-b.svg` | Schizzi di sangue |
| `spiked-ball.svg` | Pallone chiodato (icona o illustrazione) |
| `chain.svg` | Maglia di catena ripetibile |
| `torn-edge.svg` | Maschera per il bordo strappato |

## Regole di layout

- Il fondo del sito è ardesia: i contenuti stanno in pannelli pergamena, rossi o ardesia, **mai** testo scuro direttamente sul fondo.
- Niente rotazioni casuali "carta appiccicata" e niente ombre nere piene 8px del vecchio stile: si usa `--shadow-print`. L'inclinazione è riservata a titoli, fasce, etichette e pulsanti.
- Colori squadra (`primary_color`) solo come accento: filetto, bordo del logo o striscia. Mai come fondo di testo senza controllare il contrasto.
- Mobile: margini laterali di 16px, niente scroll orizzontale della pagina (le tabelle scorrono nel proprio contenitore), bersagli touch da almeno 44px.

## Livello premium

- **Materiali**: `--bb-brass` (ottone), `--bb-gold-text` (testo dorato), `--rivet` (rivetto), `--shadow-deep`, `--ease-out`.
- **Classi**: `.plate` (placca d'ottone con rivetti), `.gold-text` (titolo dorato in rilievo). `.card` ha la cornice in ottone con rivetti, `.panel-blood`/`.panel-slate` hanno il filetto d'ottone e profondità, i pulsanti sono metallici con riflesso al passaggio del mouse.
- **Atmosfera globale**: vignettatura da stadio e grana di stampa sopra la pagina; i blocchi di `main` entrano con un'animazione morbida (disattivata con `prefers-reduced-motion`).
- **Componenti**: `<Wordmark />` (lettere cesellate argento + nastro rosso), `<Emblem />` in ottone con cuore illustrabile, `<PageHeader />` con scena di stadio in duotono e personaggio scontornato automatico per sezione.
- **Illustrazioni**: slot facoltativi definiti in `src/lib/art.ts`, caricati con `useArt()` (se il file manca resta la grafica vettoriale). Prompt e procedura in `docs/MIDJOURNEY.md`, preparazione file con `npm run art`.

## Linguaggio "editoriale gaming" (v3)

Ispirato a landing sportive/gaming (Nike, Valorant, Project Mugen): composizioni a strati, geometrie spigolose irregolari, numerazione delle sezioni, nastri diagonali.

**Componenti** (`src/components/brand/`):

- `<Shards variant="hero|band|header" />`: schegge poligonali irregolari (rosso, navy, filetti d'ottone) da mettere `position:absolute` dietro al contenuto. Il genitore deve avere `position: relative; isolation: isolate`.
- `<TapeStrip text|items tone="mustard|red|ink" angle moving reverse label />`: nastro "da cantiere" diagonale con testo ripetuto; `items` accetta link (es. risultati). Scorre in loop se `moving`.
- `<SectionTitle index="01" title micro on="dark|light" align="left|right" action />`: titolo di sezione con numero gigante a contorno, micro-etichetta tecnica (`S01 // …`) e azione a destra.
- `<Hotspot x y side length rise>…</Hotspot>`: punto pulsante con linea tratteggiata e cartellino smussato, posizionato in % su un contenitore relativo.
- `<PageHeader>` ora ha sagoma irregolare, schegge, titolo fantasma, numero di sezione automatico (01 Teams … 07 Seasons) e nastro sul bordo.

**Utility globali**:

- `.bleed`: sezione a tutta larghezza dentro `.container` (espone `--gutter` per allineare il contenuto a 1240px).
- `.ghost-text` (+ `.on-light`): parola gigante a contorno sullo sfondo, `position:absolute`.
- `.chamfer` (`--cut`): angoli tagliati a 45°. `.offset-frame`: cornice sottile sfalsata dietro all'elemento (mettere `.chamfer` su un figlio, non sullo stesso elemento).
- `.page-rail`: binario decorativo fisso a sinistra (solo ≥1500px), già nel layout.

**Regole di impaginazione**:

- Alternare fasce scure e chiare (pergamena `#f3ecdf`) con bordi tagliati via `clip-path` a poligono irregolare, non dritti.
- Ogni sezione principale di una pagina ha un `SectionTitle` numerato; i personaggi/illustrazioni possono sfondare il bordo della fascia.
- Micro-etichette in `--font-data` 80% maiuscolo spaziato (`letter-spacing: .2em`) per dare il tono "tecnico".
- Contenere sempre gli elementi decorativi che sforano (`overflow: hidden` sulla sezione) per non creare scroll orizzontale su mobile; se un'illustrazione deve uscire dall'alto non usare `overflow-x: clip` sullo stesso contenitore.
