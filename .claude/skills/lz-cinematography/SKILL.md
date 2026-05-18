---
name: lz-cinematography
description: Skill cinématographie Le Lézard — vocabulaire technique vidéo (lentilles, lumière, mouvements caméra, color grading) pour brief des productions vidéo cohérentes. Invoque avec /lz-cinematography pour parler le langage du cinéma.
---

# Cinématographie pour Le Lézard — Vocabulaire technique

Référence pour parler en mots précis quand on brief une vidéo, un photoshoot,
ou un prompt IA. Si tu utilises ces mots, tu seras compris des pros.

## Types de plans (Shot types)

| Code | Nom | Description | Usage Le Lézard |
|------|-----|-------------|-----------------|
| **ECU** | Extreme Close-Up | Détail (œil, broderie, fil) | Macro textile, détail crest |
| **CU** | Close-Up | Visage entier ou objet entier | Visage modèle, logo packaging |
| **MCU** | Medium Close-Up | Tête + épaules | Portrait porter |
| **MS** | Medium Shot | Buste à hanches | Look complet |
| **MWS** | Medium Wide Shot | Personne entière, contexte limité | Outfit en mouvement |
| **WS** | Wide Shot | Personne + environnement | Plan paysage Genève |
| **EWS** | Extreme Wide Shot | Paysage dominant | Lac Léman, montagne |
| **OTS** | Over-The-Shoulder | Depuis derrière l'épaule | Conversation, contexte |
| **POV** | Point Of View | Vu par les yeux du sujet | Immersif, rare Le Lézard |

## Mouvements caméra (Camera movement)

### Mouvements physiques

| Nom | Description | Effet émotionnel |
|-----|-------------|------------------|
| **Pan** | Caméra fixe pivote horizontalement | Reveal, contexte |
| **Tilt** | Caméra fixe pivote verticalement | Échelle, grandeur |
| **Dolly in/out** | Caméra avance/recule sur rail | Intimité ↗ / distance ↗ |
| **Push-in** | Petit dolly in vers sujet | Tension, focus |
| **Pull-out** | Petit dolly out depuis sujet | Reveal, distance |
| **Tracking** | Caméra suit le sujet en parallèle | Intime, marche |
| **Handheld** | Caméra à la main, légère instabilité | Authentique, brut |
| **Steadicam** | Mouvement fluide stabilisé | Élégant, smooth |
| **Crane / Jib** | Montée/descente verticale | Cinéma, dramatique |
| **Whip pan** | Pan ultra-rapide | Transition, énergie |
| **Static** | Caméra immobile | Contemplatif, fort |

### Pour Le Lézard

- **Privilégier** : static, slow push-in, slow tracking, slight handheld
- **Éviter** : crane (trop cinéma), whip pan systématique (gimmicky)

## Lentilles (Lenses) — focales

| Focale | Effet | Quand utiliser |
|--------|-------|----------------|
| **14-24mm** (ultra wide) | Distorsion, immersif | Plans architecture, lac |
| **24-35mm** (wide) | Naturel élargi | Plans lieu + personnage |
| **50mm** (standard) | Vision humaine | Portrait casual |
| **85mm** (portrait) | Compression flatteuse | Visage, détails maillot |
| **100-150mm** (tele) | Compression, isolation | Plan distant épuré |
| **Macro 100mm+** | Détails extrêmes | Textures tissu, broderie |
| **Anamorphique** | Cinéma, flares horizontaux | Look ciné premium |

## Profondeur de champ (Depth of field — DOF)

| DOF | Description | Effet |
|-----|-------------|-------|
| **Deep focus** | Tout net (foreground → background) | Documentaire, observationnel |
| **Medium focus** | Sujet net, fond légèrement flou | Standard |
| **Shallow** | Sujet net, fond très flou (bokeh) | Mode, isolation produit |
| **Ultra shallow** | Que le détail net, reste flou | Macro, hyper intime |

Pour Le Lézard : **shallow par défaut**, ultra shallow pour produits.

## Lumière (Lighting)

### Sources

| Type | Effet | Usage |
|------|-------|-------|
| **Natural light** | Authentique, imprévisible | Outdoor, golden hour |
| **Window light** | Soft, naturel, latéral | Studio simple |
| **Softbox** | Diffuse, contrôlable | Studio produit |
| **Hard light** | Ombre dure, contraste | Editorial, drama |
| **Neon / practical** | Couleur ambiante | Nuit, urbain |
| **Bounce** | Lumière rebondie sur surface | Soft naturel |

### Directions

| Direction | Effet |
|-----------|-------|
| **Front light** | Plat, lisible mais ennuyeux |
| **Side light (45°)** | Sculpte le sujet, dimension |
| **Back light** | Halo, silhouette, mystérieux |
| **Rim light** | Contour lumineux |
| **Top light** | Dramatique, peut creuser ombres |
| **Underlight** | Inquiétant, à éviter |

### Heures de la journée (outdoor)

| Heure | Nom | Caractéristique |
|-------|-----|-----------------|
| **5h30-6h30** | Blue hour | Bleu profond, mystique |
| **6h30-8h** | Golden hour matin | Doré chaud, soft |
| **10h-15h** | Daylight | Dur (sauf overcast), à éviter |
| **17h-19h** | Golden hour soir | Doré orangé, magique |
| **19h-20h** | Blue hour | Bleu profond, néons |
| **Nuit** | Practical / artificielle | Cinéma noir, néon |

Pour Le Lézard : **golden hour soir** ou **overcast daylight** privilégiés.

## Color grading (étalonnage)

### Looks classiques

| Look | Caractéristique | Référence |
|------|-----------------|-----------|
| **Kodak 2383** | Cinéma 35mm, chaud | Tarantino, Wes Anderson |
| **Portra 400** | Photo mode, doux | Vogue editorials |
| **Bleach bypass** | Désaturé, contraste | "Saving Private Ryan" |
| **Teal & Orange** | Cinéma Hollywood (cliché) | Blockbusters |
| **Monochromatic** | Une seule teinte | Sofia Coppola |
| **Crushed black** | Ombres noires absolues | A24 films |
| **Lifted highlights** | Highlights tirés vers crème | Fashion film |

### Pour Le Lézard

```
Look Le Lézard signature :
- Désaturation globale : -10%
- Highlights : tirés vers crème (#F4F1EA)
- Shadows : crushed mais pas noir absolu (#1A1A1A)
- Skin tones : naturels, légèrement tirés vers neutre
- Saturation préservée sur : couleur accent maillot
- Grain léger : équivalent ISO 800
```

## Frame rate (cadence)

| FPS | Effet |
|-----|-------|
| **24 fps** | Cinéma, mouvement filmique |
| **25 fps** | PAL Europe, similar 24 |
| **30 fps** | Digital, légèrement moins ciné |
| **60 fps** | Smooth, sport, slow-mo possible |
| **120 fps+** | Slow-motion pure |

Pour Le Lézard : **24 fps** par défaut, **60 fps** si plans slow-mo voulus.

## Aspect ratios (formats)

| Format | Ratio | Usage |
|--------|-------|-------|
| **9:16** | Vertical | Reels, Stories, TikTok |
| **1:1** | Carré | Feed IG legacy |
| **4:5** | Portrait | Feed IG moderne |
| **16:9** | Horizontal | YouTube, web, lookbook |
| **2.35:1** | Cinemascope | Film de marque cinéma |

## Audio cinématographique

| Élément | Description |
|---------|-------------|
| **Diegetic sound** | Son présent dans la scène (vent, pas) |
| **Non-diegetic** | Musique ajoutée par-dessus |
| **Foley** | Bruitages refaits (footsteps, fabric) |
| **Score** | Musique originale composée |
| **Ambient** | Texture sonore d'ambiance |
| **SFX** | Effets ponctuels (whoosh, kick) |
| **Silence** | Outil puissant utilisé trop rarement |

Pour Le Lézard :
- **Track + SFX** : kick deep + whoosh sur transitions
- **Silence respiré** : 0.5-1s sur le frame final

## Vocabulaire de réalisateurs / inspirations

| Réalisateur | Style à connaître | Application Le Lézard |
|-------------|-------------------|------------------------|
| **Wong Kar-wai** | Lumière néon, motion blur, lonely | Plans nocturnes Genève |
| **Sofia Coppola** | Pastel, intime, féminin, fashion | Plans modèles intimes |
| **Wes Anderson** | Symétrique, palette, frontal | À éviter (trop signé) |
| **A24 (Eggers, Glazer)** | Grain, désaturé, A.D. tendue | Plans atmosphériques |
| **Sean Baker** | Lo-fi, vrai, naturalisme | Plans documentaires |
| **Hu Bo / Wong / Tsai** | Plans longs contemplatifs | Plans macro lents |

## Anti-patterns visuels

- 🔴 Filtre Instagram VSCO en bloc
- 🔴 Saturation +50 partout
- 🔴 Skin smoothing visible
- 🔴 Sharpening excessif
- 🔴 Vignettage marqué (rideau noir tout autour)
- 🔴 LUT teal & orange par défaut
- 🔴 Watermark IA visible

## Glossaire rapide

| Terme | Définition |
|-------|------------|
| **B-roll** | Plans d'illustration entre plans principaux |
| **Cut on action** | Coupe pendant un mouvement (invisible) |
| **Match cut** | Cut entre deux plans visuellement similaires |
| **L-cut / J-cut** | Audio commence avant ou continue après l'image |
| **Insert** | Plan court inséré (détail, réaction) |
| **Establishing shot** | Plan d'ouverture qui situe le lieu |
| **Beauty shot** | Plan produit, lisse et flatteur |
| **Hero shot** | Le plan signature de la séquence |
