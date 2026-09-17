# Illustrazioni Midjourney

Il sito ha degli **slot per illustrazioni**. Se un file manca, lo slot usa la grafica vettoriale (stemma, gradienti, fari),
quindi puoi aggiungere le immagini una alla volta senza rompere niente.

## Procedura

1. Genera con i prompt qui sotto. **Parti dallo stadio** (n. 1): scegli la variante migliore e copiane l'URL.
   In tutti i prompt successivi aggiungi `--sref <URL dello stadio>`: così palette e tratto restano coerenti.
2. Fai l'upscale (Upscale Subtle) e scarica il PNG.
3. Rinomina il file **esattamente** come indicato (l'estensione non importa) e salvalo in `art-src/`
   (nella root del progetto, cartella ignorata da git).
4. Lancia `npm run art`. Lo script:
   - rimuove lo sfondo piatto dalle figure scontornate (lo sfondo deve essere uniforme e toccare i bordi),
   - ritaglia i margini vuoti, ridimensiona e ottimizza,
   - salva il risultato in `public/art/` con il nome che il sito si aspetta.
5. Ricarica la pagina: l'illustrazione compare da sola.

Se lo sfondo non viene tolto bene (resta un alone), rilancia con più tolleranza: `ART_TOLERANCE=60 npm run art`.
Se hai già un PNG trasparente (ad es. da Photoshop o remove.bg), lo script lo riconosce e non tocca lo sfondo.

## Regole generali dei prompt

- Niente nomi di marchi, giochi o artisti: descriviamo lo stile.
- Midjourney non scrive testi in modo affidabile, quindi **nessuna scritta nelle immagini**: i testi li mette il sito.
- Le figure scontornate vanno su **sfondo bianco piatto**, figura intera, senza ombra a terra.

Blocco di stile comune (già incluso nei prompt):

> gritty fantasy american football comic illustration, bold black ink linework, cel shading with painterly texture, crimson red, mustard gold and slate blue palette, subtle halftone print grain

---

## 1. Stadio (sfondo copertina e testate di tutte le pagine)

`art-src/stadium.png` → `public/art/stadium.jpg`

```
wide view of a ramshackle fantasy football stadium at night, towering wooden and stone stands packed with a roaring crowd of orcs, dwarves and humans waving pennants, blazing floodlights on iron towers with volumetric light beams and dust in the air, muddy green pitch with chalk lines in the foreground, dramatic cinematic atmosphere, gritty fantasy american football comic illustration, bold black ink linework, cel shading with painterly texture, crimson red, mustard gold and slate blue palette, subtle halftone print grain, empty center composition for text --ar 21:9 --v 7 --style raw --no text, letters, logo, watermark, signature
```

## 2. Giocatore della copertina (home, a destra)

`art-src/hero-player.png` → `public/art/hero-player.webp`

```
full body heroic low angle shot of a massive orc blitzer charging forward with a spiked leather football tucked under his arm, crimson and gold armored shoulder pads with rivets, cracked helmet with horns, snarling tusks, mud and dust flying, dynamic action pose, gritty fantasy american football comic illustration, bold black ink linework, cel shading with painterly texture, crimson red, mustard gold and slate blue palette, isolated on a plain flat white background, no ground shadow --ar 3:4 --v 7 --style raw --no text, letters, logo, watermark, background scenery
```

## 3. Logo della lega (completo)

`art-src/logo.png` → `public/art/logo.webp` (+ favicon `src/app/icon.png` generata in automatico)

Il logo è **solo illustrazione**: niente più stemma vettoriale. Compare nella navbar, nel menu mobile, nel login,
nella copertina (se manca il giocatore) e come filigrana nelle testate.
Consigli: genera con `--sref` dello stadio, scegli la variante più leggibile anche piccola (deve funzionare a 50px),
evita dettagli sottili sui bordi. Se Midjourney sbaglia la scritta, usa **Vary (Region)** solo sulla fascia del testo.

Soggetto: **solo un pallone da football macchiato di sangue**, nessuna razza o personaggio.

Versione A, **pallone isolato** (consigliata, massima leggibilità anche piccola):

```
hand-drawn logo icon of a single battered leather american football splattered with blood, three quarter view tilted diagonally, thick white laces, deep scratches and stitched tears in the leather, bold crimson blood splatter and drips running down one side, small blood droplets flying around, thick black ink outlines, comic book inking with cross-hatching, cel shading with painterly texture, brown leather, crimson red, bone white and a touch of mustard gold highlight, gritty vintage print feel, simple bold silhouette readable at small size, centered, sticker-style die-cut edge, isolated on a plain flat white background --ar 1:1 --v 7 --style raw --stylize 150 --no text, letters, numbers, characters, creatures, skull, helmet, photo, 3d render, watermark, signature
```

Versione B, **pallone su splash di sangue** (più "emblema", sempre senza personaggi):

```
hand-drawn emblem of a battered leather american football with thick white laces placed diagonally over a large crimson blood splatter burst, spiked brass studs along the seam, blood dripping from the ball, thick black ink outlines, comic book inking with cross-hatching, cel shading with painterly texture, brown leather, crimson red, bone white and mustard gold accents, gritty vintage print feel, bold compact silhouette readable at small size, perfectly centered, sticker-style die-cut edge, isolated on a plain flat white background --ar 1:1 --v 7 --style raw --stylize 150 --no text, letters, numbers, characters, creatures, skull, helmet, shield, frame, photo, 3d render, watermark, signature
```

## 4. Trofeo (podio della home, 1° posto)

`art-src/trophy.png` → `public/art/trophy.webp`

```
ornate spiked golden championship cup trophy with brass skulls on the handles and a red ribbon, dented and battle worn, front view, centered, gritty fantasy american football comic illustration, bold black ink linework, cel shading with painterly texture, gold and crimson, isolated on a plain flat white background, no ground shadow --ar 1:1 --v 7 --style raw --no text, letters, engraving text, watermark
```

## 5. Star player (home)

`art-src/star-player.png` → `public/art/star-player.webp`

```
full body portrait of a cocky elf catcher striking a victory pose, one arm raised holding a football high, lean athletic build, slate blue and gold armor, long flowing hair, confident grin, three quarter view, gritty fantasy american football comic illustration, bold black ink linework, cel shading with painterly texture, crimson red, mustard gold and slate blue palette, isolated on a plain flat white background, no ground shadow --ar 3:4 --v 7 --style raw --no text, letters, logo, watermark, background scenery
```

## 6. Testate di pagina (figura che esce dalla fascia, a destra)

Tutte con lo stesso finale: figura intera o mezzo busto, **sfondo bianco piatto**, formato `--ar 4:5`.

Finale comune da aggiungere a ogni soggetto:

```
, gritty fantasy american football comic illustration, bold black ink linework, cel shading with painterly texture, crimson red, mustard gold and slate blue palette, isolated on a plain flat white background, no ground shadow --ar 4:5 --v 7 --style raw --no text, letters, logo, watermark, background scenery
```

| File in `art-src/` | Pagina | Soggetto (inizio del prompt) |
|---|---|---|
| `header-teams.png` | Squadre | `a stout dwarf blocker in heavy riveted armor with arms crossed, braided beard, proud stance, three quarter view` |
| `header-schedule.png` | Calendario | `a goblin referee in a black and white striped shirt blowing a whistle and holding an oversized hourglass, mischievous expression` |
| `header-match.png` | Partita | `two linemen colliding shoulder to shoulder, a human in red armor and an orc in green armor, dynamic impact pose, debris flying` |
| `header-standings.png` | Classifica | `a triumphant ogre lifting a spiked golden trophy above his head with both hands, roaring in victory` |
| `header-stats.png` | Statistiche | `a hunched rat-man statistician with round spectacles holding a long scroll of scores and a quill, sly grin` |
| `header-skills.png` | Skill | `an ancient heavy leather-bound rulebook with brass corners and spikes, floating open with glowing pages and loose parchment notes, no readable writing` |
| `header-coaches.png` | Allenatori | `a grizzled veteran human coach with an eyepatch and a cigar, holding a clipboard, wearing a crimson coat with brass buttons, arms crossed` |
| `header-seasons.png` | Stagioni | `a tall wooden banner pole with torn crimson and slate blue pennants and a brass spiked finial, draped with a chain of trophies and medals` |
| `header-login.png` | Login admin | `a hulking troll bouncer in a brass-studded leather vest guarding a heavy iron locker room door, holding a huge key ring` |

Esempio completo (Squadre):

```
a stout dwarf blocker in heavy riveted armor with arms crossed, braided beard, proud stance, three quarter view, gritty fantasy american football comic illustration, bold black ink linework, cel shading with painterly texture, crimson red, mustard gold and slate blue palette, isolated on a plain flat white background, no ground shadow --ar 4:5 --v 7 --style raw --no text, letters, logo, watermark, background scenery
```

## 7. (Facoltativo) Texture pergamena

`art-src/texture-parchment.png` → `public/art/texture-parchment.jpg` (predisposta, non ancora usata)

```
seamless tileable texture of aged parchment paper, subtle stains, fibers and creases, warm cream and tan tones, even lighting, flat top-down scan, no objects --ar 1:1 --v 7 --style raw --tile --no text, letters, shadows, vignette
```

---

## Mappa slot → pagina

| File finale in `public/art/` | Dove compare |
|---|---|
| `stadium.jpg` | Copertina home (a colori) e sfondo di **tutte** le testate (duotono rosso/navy/ardesia) |
| `hero-player.webp` | Copertina home, a destra (al posto dello stemma grande) |
| `logo.webp` | Logo della lega: navbar, menu mobile, login, copertina, filigrana testate, `/brand`, favicon |
| `trophy.webp` | Podio della home, sopra la squadra prima in classifica |
| `star-player.webp` | Riquadro "Star Player" della home |
| `header-*.webp` | Testata della rispettiva pagina (sostituisce la filigrana dello stemma) |
