---
name: lz-video-ai-prompts
description: Skill prompts vidéo IA Le Lézard — bibliothèque de prompts prêts à l'emploi pour Sora 2, Runway Gen-4, Kling 2.5, Veo 3, Hailuo. Invoque avec /lz-video-ai-prompts pour générer un plan vidéo cinématographique.
---

# Bibliothèque prompts vidéo IA — Le Lézard

Référence rapide pour générer des plans vidéo de qualité cinéma sans
artefacts, sans logos déformés, sans visages morphés.

## Structure universelle d'un bon prompt

```
[SHOT TYPE] of [SUBJECT] [ACTION] in [ENVIRONMENT].
Shot on [CAMERA/LENS], [DEPTH OF FIELD], [LIGHTING].
[MOOD/GRADING DESCRIPTION].
[ASPECT RATIO + DURATION].
```

## 5 templates testés

### Template 1 — Fashion macro (texture, détail produit)

```
Extreme close-up macro shot of [FABRIC/PRODUCT DETAIL] with slow camera
push-in. The texture is clearly visible: [SPECIFIC TEXTURE WORDS like "jersey
grain weave", "knit cotton", "embroidered thread"]. Soft side lighting falls
at 45-degree angle creating depth in the threads. Camera is on a vintage
Cooke S4 macro lens, ultra-shallow depth of field. Slight breathing motion
of the fabric. Portra 400 film stock emulation, subtle film grain.
Editorial fashion film, hushed and luxurious mood. No text, no logos
visible. Vertical 9:16, 4 seconds.
```

**Usage** : Runway Gen-4 (top), Kling 2.5
**Évite** : Sora 2 (parfois floute le macro)

### Template 2 — Urban portrait (humain en environnement)

```
Slow handheld tracking shot following a [PERSON DESCRIPTION] from behind/3/4
as they walk through [ENVIRONMENT]. They wear [CLOTHING WITH SPECIFIC COLOR].
[Time of day and atmospheric condition: "early morning mist", "golden hour",
"overcast steel-gray sky"]. The camera follows for 5 seconds with subtle
breathing motion. Shot on Arri Alexa with a 35mm anamorphic lens, shallow
depth of field. Cinematic color grade: desaturated palette except the [KEY
ACCENT COLOR] which pops. Kodak film grain. Contemplative, editorial fashion
film vibe. No text, no visible logos. Vertical 9:16.
```

**Usage** : Kling 2.5 (best for human movement), Runway Gen-4
**Évite** : Pika (mouvement humain bizarre)

### Template 3 — Abstract motion (color/fabric)

```
Abstract motion graphic sequence in vertical 9:16: [N COLORED ELEMENTS or
FABRICS] sweep across the frame in rapid succession, each [INTERACTION
TYPE: "ripping diagonally", "fading into", "colliding with"] the previous
one. Between each, a brief flash of [TRANSITIONAL COLOR/TEXTURE]. Camera
is locked-off, the action happens through the elements moving at varying
speeds. Shot in studio with hard rim lighting on the edges. Cinematic film
grain, motion blur on transitions. 6 seconds total. No text, no logos.
Editorial luxury fashion aesthetic.
```

**Usage** : Luma Dream Machine, Pika 2, Runway Gen-4
**Évite** : Veo 3 (trop cher pour de l'abstrait)

### Template 4 — Architecture / lieu (sans personne)

```
Static [WIDE/MEDIUM] shot of [SPECIFIC LOCATION DESCRIPTION] at [TIME OF DAY].
The frame is composed with [GEOMETRIC OBSERVATION about the location]. Slight
push-in over 5 seconds. Atmospheric: [WEATHER]. Shot on RED Komodo, 24mm
wide angle, deep focus. Color palette: [PALETTE description]. Slight film
grain. Cinema vérité observational style. No people visible, no text.
Vertical 9:16.
```

**Usage** : Runway Gen-4, Sora 2 (si dispo)

### Template 5 — Hands / gesture (geste isolé)

```
Close-up shot of human hands [DOING SPECIFIC ACTION: "folding a red football
jersey", "touching embroidered fabric", "tying laces"]. The hands are warm,
natural skin tones, no jewelry. Slow deliberate gesture. Background is soft
out of focus [COLOR]. Shot on 85mm lens, very shallow depth of field. Soft
warm window light from the left. Slight film grain, editorial fashion film
mood. 4 seconds. Vertical 9:16. No text, no logos visible.
```

**Usage** : Kling 2.5 (best for hands), Runway Gen-4

## Mots-clés cinéma qui marchent

### Lens / caméra
- `Arri Alexa` / `RED Komodo` / `Sony Venice` (cinéma haut de gamme)
- `35mm anamorphic` (look ciné moderne)
- `85mm portrait lens` (compression flatteuse)
- `Cooke S4 vintage` (vibe rétro chic)
- `macro lens` (détails extrêmes)

### Film stock / grading
- `Kodak 2383 film grain`
- `Portra 400 emulation`
- `desaturated except [color]`
- `crushed shadows, lifted highlights`
- `teal and orange grade` (cliché — éviter sauf si voulu)
- `monochromatic except accent`

### Mouvements caméra
- `slow push-in`
- `slow pull-out`
- `handheld with subtle breathing`
- `dolly tracking shot`
- `static locked-off`
- `whip pan transition` (pour transitions)

### Lumière
- `golden hour backlight`
- `hard side lighting like Caravaggio`
- `soft window light`
- `chiaroscuro` (clair-obscur)
- `rim lighting on edges`
- `overcast diffused daylight`

### Mood
- `editorial fashion film`
- `contemplative, A24 vibe`
- `streetwear lookbook aesthetic`
- `Wong Kar-wai inspired`
- `Sofia Coppola intimate`
- `cinema vérité observational`

## Mots à BANNIR

- ❌ `epic`, `awesome`, `amazing`
- ❌ `beautiful woman/man` (stéréotype)
- ❌ `4K HD ultra realistic` (redondant)
- ❌ `professional` (vide)
- ❌ Chaînes d'adjectifs (`stunning vibrant dynamic`)
- ❌ `with text overlay "..."` (presque jamais lisible)
- ❌ `with [BRAND] logo visible` (déformé à coup sûr)

## Règles de hauteur de prompt

- **Trop court** (< 30 mots) : l'IA invente → résultat random
- **Optimal** : 60-100 mots
- **Trop long** (> 150 mots) : l'IA dilue → mood perdu

## Tester avant de balancer 10 générations

1. Première génération en quality `standard` (= 1 crédit)
2. Si direction OK → quality `pro` (= 4-8 crédits)
3. Tester 2 seeds différentes avant de garder
4. Itérer 2-3 fois max sur un même prompt — si toujours nul, changer de prompt

## Logos et texte = JAMAIS dans le prompt

- L'IA déforme les logos à chaque frame
- Le texte généré IA est souvent illisible
- **Solution** : générer le fond IA seulement, overlay logo/texte en post
  (CapCut, After Effects)

## Workflow type pour une vidéo 6-10s

1. `lz-video-director` te donne 4 plans
2. Tu génères 4 prompts (un par plan) en suivant les templates
3. L'humain copie-colle dans Runway/Kling
4. L'humain télécharge les 4 vidéos
5. `lz-motion-designer` spécifie l'overlay logo + texte
6. L'humain monte dans CapCut (cuts + overlay + son)
7. Export final 9:16 MP4
