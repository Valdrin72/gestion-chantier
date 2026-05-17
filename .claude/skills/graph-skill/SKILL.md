---
name: graph-skill
description: Obsidian Graph View pour CYNA — visualise le graphe complet des entités (chantiers ↔ devis ↔ factures ↔ clients ↔ employés) et détecte les îlots isolés, liens orphelins, et noeuds critiques. Inspiré du graph-skill de Karpathy.
trigger: /graph-skill
---

# Skill : Graph View — Cartographie des entités CYNA

## Concept

Comme l'Obsidian Graph View, cette skill génère une **représentation visuelle** des liens
entre toutes les entités de l'app CYNA. Elle révèle :

- Les **nœuds orphelins** (entités sans liens = données perdues)
- Les **nœuds critiques** (entités liées à beaucoup d'autres = points de rupture)
- Les **îlots isolés** (groupes d'entités déconnectés du reste)
- Les **liens manquants** (incohérences de référence)

---

## Quand l'utilisateur tape `/graph-skill`

### Phase 1 — Lecture des données

Lire le code source pour extraire les structures de données réelles :

```bash
grep -n "devisId\|chantierId\|clientId\|factureId\|employe" src/donnees.js | head -40
grep -n "chantier\.devisId\|facture\.chantierId\|chantier\.clientId" src/ -r --include="*.js" | head -20
```

### Phase 2 — Construire le graphe mental

Analyser les liens définis dans le code :

```
ARCHITECTURE LIENS CYNA :

Client ──────────────────────┐
  │                          │
  └─► Devis ─────────────────┤
        │                    │
        └─► Chantier ────────┤
              │              │
              ├─► Facture ───┘
              │
              ├─► Journal (heures)
              │     └─► Employé
              │
              └─► Avenant
```

**Règles de liens obligatoires (CLAUDE.md) :**
```
facture.devisId   → doit exister dans devis[]
facture.chantierId → doit exister dans chantiers[]
facture.clientId  → doit exister dans clients[]
chantier.devisId  → doit exister dans devis[]
chantier.clientId → doit exister dans clients[]
```

### Phase 3 — Génération du graphe ASCII

Produire une représentation visuelle textuelle :

```
CYNA GRAPH VIEW — [date]
═══════════════════════════════════════════════════════════

👤 CLIENTS (N)                    📋 DEVIS (N)
┌──────────────────┐             ┌─────────────────────────┐
│ • Client A  ─────┼─────────────┼──► Devis DEV-2024-001   │
│ • Client B  ─────┼──────┐      │    Devis DEV-2024-002   │
│ • Client C  [!]  │      │      │    Devis DEV-2024-003   │
└──────────────────┘      │      └─────────────────────────┘
                          │               │
🏗️ CHANTIERS (N)          │               │
┌──────────────────────┐  │               │
│ • CH-001 Réno HB  ◄──┼──┼───────────────┘
│ • CH-002 Bureau   ◄──┼──┘
│ • CH-003 [ORPHELIN!] │ ← pas de devisId
└──────────────────────┘
        │
💰 FACTURES (N)
┌──────────────────────┐
│ • FAC-001 → CH-001   │
│ • FAC-002 → [??]  [!]│ ← chantierId introuvable
│ • FAC-003 → CH-002   │
└──────────────────────┘

[!] = anomalie détectée
```

### Phase 4 — Rapport d'anomalies

Lister tous les problèmes détectés :

```
🔍 ANOMALIES GRAPHE
═══════════════════════════════════════════════════════════

🔴 LIENS BRISÉS (orphelins) :
  • Facture FAC-002 → chantierId "ch_999" inexistant
  • Chantier CH-005 → devisId "dev_888" inexistant

🟠 NŒUDS ISOLÉS :
  • Client "Dupont SA" → aucun devis, aucune facture
  • Devis DEV-2024-010 → aucun chantier lié

🟡 NŒUDS CRITIQUES (hub) :
  • Client "Entreprise X" → lié à 8 chantiers, 15 factures
    ⚠ Supprimer ce client casserait 23 entités

📊 STATISTIQUES GRAPHE :
  Clients :   N (N isolés)
  Devis :     N (N sans chantier)
  Chantiers : N (N orphelins)
  Factures :  N (N liens brisés)
  Densité :   X liens / entité (idéal : >2.0)
```

### Phase 5 — Correction automatique (si --fix)

Pour chaque lien brisé détecté :
- Proposer une correction (trouver l'entité la plus probable par nom/date)
- Ou marquer l'entité comme orpheline (statut `orphelin`)
- Ne jamais supprimer sans confirmation

```bash
# Après correction
CI=true npm run build
git add -A && git commit -m "fix(graph): correction liens orphelins détectés par graph-skill"
```

---

## Options

- `/graph-skill` — génère le graphe complet en lecture seule
- `/graph-skill --anomalies` — affiche uniquement les anomalies
- `/graph-skill --client "Nom Client"` — graphe centré sur un client
- `/graph-skill --fix` — corrige les liens brisés automatiquement
- `/graph-skill --export` — génère un JSON pour visualisation externe (D3.js/Obsidian)

---

## Format JSON export (--export)

```json
{
  "nodes": [
    { "id": "client_1", "type": "client", "label": "Entreprise X", "links": 8 },
    { "id": "devis_1",  "type": "devis",  "label": "DEV-2024-001", "links": 2 }
  ],
  "edges": [
    { "from": "client_1", "to": "devis_1",  "type": "clientId" },
    { "from": "devis_1",  "to": "ch_001",   "type": "devisId"  }
  ],
  "orphans": ["ch_005", "fac_002"],
  "criticalNodes": ["client_1"]
}
```

---

## Intégration équipe

Graph-skill travaille avec :
- `data-integrity` — valide les liens inter-entités trouvés
- `data-guardian` — alerte si trop d'orphelins (risque perte données)
- `darwin` — les nœuds orphelins sont des gènes fragiles à corriger
