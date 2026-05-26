# Architecture CYNA Gestion-Chantier — Cartographie

> Document généré automatiquement par `/cartographier`. Reflète l'état du code au moment de la génération.
> **Dernière mise à jour :** `2026-05-26`
> **Branche analysée :** `claude/debug-terminal-issue-uvSBY`

---

## Vue d'ensemble

- **Total fichiers source** (src/) : 127 fichiers (hors CSS)
- **Total lignes de code** : ~33 000 lignes
- **Fichiers > 500 lignes** : 14 (à surveiller — voir section Couplages forts)
- **Fichiers candidats code mort** : 9 (jamais importés par aucun autre fichier)
- **Groupes de duplications suspectes** : 4

---

## 1. Structure de src/

### Dossiers
| Dossier | Nb fichiers | Total lignes | Rôle principal |
|---|---|---|---|
| `src/` (racine) | 38 | 18 818 | Pages, moteur IA, utilitaires — mélange non rangé |
| `src/pages/` | 11 | 5 355 | Pages principales de l'app (routage par App.js) |
| `src/components/` | 8 | 1 491 | Composants UI partagés (Layout, Search, Modal…) |
| `src/components/chantiers/` | 4 | 1 637 | Composants spécialisés chantiers (liste, détail, form, kanban) |
| `src/components/chantiers/detail/` | 5 | 697 | Sous-composants du détail chantier (rentabilité, projection…) |
| `src/components/ia/` | 1 | 1 065 | Panneau Claude IA intégré |
| `src/components/ui/` | 7 | 237 | Primitives UI (Badge, Toggle, KpiCard, ProgressBar…) |
| `src/hooks/` | 6 | 499 | Hooks custom React |
| `src/context/` | 1 | 13 | Provider React (AppContext) |
| `src/lib/` | 1 | 16 | Client Supabase |
| `src/utils/` | 2 | 100 | Export/Import CSV |
| `src/calculs/` | 20 | 1 214 | Modules de calcul purs + tests Vitest (187 tests) |
| `src/modules/alertes/` | 5 | 379 | Module alertes — page + bootstrap + adapter |
| `src/modules/alertes/lib/` | 5 | 255 | Moteur alertes (engine, store, scheduler, digest, notifications) |
| `src/modules/alertes/lib/rules/` | 7 | 556 | 15+ règles BTP (financier, trésorerie, planning, RH, qualité, sécurité) |
| `src/modules/alertes/lib/__tests__/` | 2 | 218 | Tests Vitest des règles alertes |
| `src/modules/alertes/components/` | 5 | 331 | Composants UI alertes (AlertCard, BellIcon, InlineAlert…) |
| `src/modules/alertes/hooks/` | 3 | 58 | Hooks alertes (useAlerts, useAlertCount, useAlertActions) |
| `src/constants/` | 1 | 7 | Constante statuts chantier |
| `src/styles/` | 1 | 0 | theme.css (vide) |

### Fichiers à la racine de src/
| Fichier | Lignes | Catégorie déduite | Devrait être dans |
|---|---|---|---|
| `App.js` | 464 | Entrée | racine (OK) |
| `index.js` | 22 | Entrée | racine (OK) |
| `Login.js` | 287 | Page | `src/pages/` |
| `AgentEngine.js` | 2 193 | Système IA | `src/modules/agents/` |
| `Agents.js` | 1 137 | Système IA | `src/modules/agents/` |
| `useAgents.js` | 333 | Système IA | `src/modules/agents/` |
| `Analyse.js` | 1 135 | Page (multi-onglets analyse) | `src/pages/` |
| `AuditApp.js` | 776 | Page (audit interne) | `src/pages/` |
| `BenchmarkMarche.js` | 255 | Page | `src/pages/` |
| `Calendrier.js` | 356 | Composant (calendrier chantier) | `src/components/` |
| `Documents.js` | 156 | Page — **jamais importée** | `src/pages/` |
| `ExportPDF.js` | 940 | Utilitaire PDF | `src/utils/` ou `src/modules/` |
| `Factures.js` | 1 248 | Page Factures | `src/pages/` |
| `Heures.js` | 482 | Page Heures | `src/pages/` |
| `ImportPDF.js` | 933 | Utilitaire PDF | `src/utils/` ou `src/modules/` |
| `Marges.js` | 197 | Composant analyse marges | `src/components/` |
| `MetragePlan.js` | 557 | Page — **jamais importée** | `src/pages/` |
| `Paiements.js` | 384 | Composant onglet finances | `src/components/` |
| `Photos.js` | 291 | Page — **jamais importée** | `src/pages/` |
| `Planning.js` | 835 | Composant planning (affiché dans PlanningPage) | `src/components/` |
| `Qualite.js` | 343 | Page — **jamais importée** | `src/pages/` |
| `Rapport.js` | 262 | Composant rapport (utilisé dans Analyse) | `src/components/` |
| `RelancesTab.js` | 347 | Composant onglet relances | `src/components/` |
| `SimulateurCroissance.js` | 273 | Page | `src/pages/` |
| `SoumissionAssistee.js` | 658 | Page — **jamais importée** | `src/pages/` |
| `Statistiques.js` | 544 | Composant statistiques | `src/components/` |
| `alertes.js` | 282 | Système alertes V1 | `src/modules/` ou supprimer |
| `dateUtils.js` | 23 | Utilitaire dates — **jamais importé** | `src/utils/` |
| `donnees.js` | 1 165 | Données & calculs métier (CRITIQUE) | racine (OK — référencé partout) |
| `donnees-demo.js` | 1 142 | Données de démonstration | `src/fixtures/` |
| `ds.js` | 303 | Design system (tokens CSS + styles) | racine (OK — référencé partout) |
| `permissions.js` | 44 | RBAC — **jamais importé** | `src/utils/` |
| `relances.js` | 204 | Utilitaire relances factures | `src/utils/` |
| `reportWebVitals.js` | 13 | CRA boilerplate — **jamais importé** | supprimer |
| `setupTests.js` | 5 | CRA boilerplate Jest | racine (OK — chargé par Jest config) |

---

## 2. Inventaire par catégorie

### 2.1 Pages (`src/pages/` + racine)
| Fichier | Lignes | Rôle métier | Importé par |
|---|---|---|---|
| `src/App.js` | 464 | Entrée, routage, layout global | `src/index.js` |
| `src/Login.js` | 287 | Authentification, accès demo | `src/App.js` |
| `src/Factures.js` | 1 248 | Gestion des factures (émission, suivi) | `src/App.js`, `src/alertes.js`, `src/useAgents.js`, +14 autres |
| `src/Heures.js` | 482 | Saisie des heures par chantier/employé | `src/App.js`, `src/AuditApp.js`, +10 autres |
| `src/Planning.js` | 835 | Planning Gantt chantiers | `src/App.js`, `src/useAgents.js`, +5 autres |
| `src/Analyse.js` | 1 135 | Multi-onglets : marges, stats, rapport, benchmark | `src/pages/RapportsPage.js` |
| `src/AuditApp.js` | 776 | Audit interne de l'app (debug) | `src/pages/CentreIA.js` |
| `src/BenchmarkMarche.js` | 255 | Benchmark marché genevois | `src/pages/RapportsPage.js` |
| `src/SimulateurCroissance.js` | 273 | Simulation de croissance CA | `src/pages/RapportsPage.js` |
| `src/Documents.js` | 156 | Gestionnaire docs (devis/factures) | **aucun** |
| `src/MetragePlan.js` | 557 | Métrés sur plan (calcul surfaces) | **aucun** |
| `src/Photos.js` | 291 | Galerie photos chantiers | **aucun** |
| `src/Qualite.js` | 343 | Contrôle qualité / PV | **aucun** |
| `src/SoumissionAssistee.js` | 658 | Aide à la soumission / chiffrage | **aucun** |
| `src/pages/Dashboard.js` | 1 352 | Tableau de bord principal — KPIs, alertes, activité | `src/App.js` |
| `src/pages/ChantiersPage.js` | 173 | Page chantiers (shell + filtres) | `src/App.js` |
| `src/pages/DevisPage.js` | 832 | Création / gestion des devis | `src/App.js` |
| `src/pages/ClientsPage.js` | 428 | Gestion des clients | `src/App.js` |
| `src/pages/EmployesPage.js` | 377 | Gestion des employés | `src/App.js`, `src/pages/ParametresPage.js` |
| `src/pages/FinancesPage.js` | 618 | Vue finances (factures, relances, paiements) | `src/App.js` |
| `src/pages/ParametresPage.js` | 610 | Paramètres app (données, config, employes) | `src/App.js` |
| `src/pages/PlanningPage.js` | 27 | Shell page planning (appelle Planning.js) | `src/App.js` |
| `src/pages/RapportsPage.js` | — | Rapports / analyses / simulateur | `src/App.js` |
| `src/pages/CentreIA.js` | 37 | Shell page Centre IA | `src/App.js` |
| `src/pages/CalculsPage.js` | 813 | 8 calculateurs BTP interactifs | `src/App.js` |
| `src/modules/alertes/AlertsPage.js` | 131 | Page alertes — liste filtrée + KPIs sévérité | `src/App.js` |

### 2.2 Composants UI réutilisables
| Fichier | Lignes | Rôle | Utilisé dans |
|---|---|---|---|
| `src/components/Layout.js` | 446 | Sidebar, Topbar, MobileNav | `src/App.js`, `src/Planning.js`, `src/components/chantiers/ChantiersListe.js` |
| `src/components/GlobalSearch.js` | 304 | Recherche globale multi-entités | `src/components/Layout.js` |
| `src/components/ModalSaisieHeures.js` | 260 | Modal saisie rapide des heures | `src/App.js` |
| `src/components/SaisieRapideDashboard.js` | 237 | Widget saisie rapide sur Dashboard | `src/pages/Dashboard.js` |
| `src/components/SharedBadges.js` | 74 | Badges de statut réutilisables | `src/components/chantiers/ChantierDetail.js`, `src/pages/ClientsPage.js`, `src/pages/EmployesPage.js` |
| `src/components/ErrorBoundary.js` | 45 | Gestion erreurs React | `src/App.js` |
| `src/components/InstallPWA.js` | 68 | Prompt installation PWA | `src/App.js` |
| `src/components/OfflineBanner.js` | 57 | Bannière mode hors-ligne | `src/App.js` |
| `src/components/ui/Badge.js` | 63 | Badge UI générique | via `src/components/ui/index.js` |
| `src/components/ui/ConfirmModal.js` | 57 | Modal de confirmation | `src/App.js`, `src/pages/DevisPage.js` |
| `src/components/ui/EmployeeAvatar.js` | 20 | Avatar employé | via `src/components/ui/index.js` |
| `src/components/ui/KpiCard.js` | 65 | Carte KPI standardisée | `src/pages/Dashboard.js`, `src/Marges.js`, `src/Statistiques.js` |
| `src/components/ui/ProgressBar.js` | 11 | Barre de progression | via `src/components/ui/index.js` |
| `src/components/ui/Toggle.js` | 15 | Toggle on/off | via `src/components/ui/index.js` |
| `src/components/ui/index.js` | 6 | Barrel export des primitives UI | **jamais importé directement** (chaque fichier importe séparément) |
| `src/components/chantiers/ChantierDetail.js` | 732 | Détail complet d'un chantier | `src/pages/ChantiersPage.js` |
| `src/components/chantiers/ChantierForm.js` | 334 | Formulaire création/édition chantier | `src/pages/ChantiersPage.js` |
| `src/components/chantiers/ChantiersListe.js` | 379 | Liste des chantiers avec filtres | `src/pages/ChantiersPage.js` |
| `src/components/chantiers/KanbanChantiers.js` | 192 | Vue kanban des chantiers | `src/pages/ChantiersPage.js` |
| `src/components/chantiers/detail/DetailEcarts.js` | 52 | Onglet écarts budget vs réel | `src/components/chantiers/ChantierDetail.js` |
| `src/components/chantiers/detail/DetailProjection.js` | 127 | Onglet projections EAC/RAD | `src/components/chantiers/ChantierDetail.js` |
| `src/components/chantiers/detail/DetailRecommandations.js` | 231 | Onglet recommandations IA | `src/components/chantiers/ChantierDetail.js` |
| `src/components/chantiers/detail/DetailRentabilite.js` | 241 | Onglet rentabilité chantier | `src/components/chantiers/ChantierDetail.js` |
| `src/components/chantiers/detail/DetailVelocite.js` | 46 | Onglet vélocité/vitesse avancement | `src/components/chantiers/ChantierDetail.js` |
| `src/components/ia/ClaudeIAPanel.js` | 1 065 | Panneau conversation Claude AI | `src/pages/CentreIA.js` (via Agents.js) |
| `src/modules/alertes/components/AlertCard.js` | — | Carte d'alerte avec actions | `src/modules/alertes/AlertsPage.js` |
| `src/modules/alertes/components/AlertSeverityBadge.js` | 32 | Badge sévérité (CRITICAL/HIGH…) | `src/modules/alertes/AlertsPage.js`, `src/modules/alertes/components/AlertCard.js` |
| `src/modules/alertes/components/BellIcon.js` | 64 | Icône cloche avec badge compteur | `src/components/Layout.js` |
| `src/modules/alertes/components/InlineAlert.js` | 27 | Alerte inline dans les pages | usage ponctuel |
| `src/modules/alertes/components/NotificationCenter.js` | — | Centre de notifications | non câblé dans App.js |

### 2.3 Hooks custom
| Fichier | Lignes | Ce qu'il fait | Utilisé par |
|---|---|---|---|
| `src/hooks/useAuth.js` | 116 | Session Supabase, rôles, pages autorisées | `src/App.js`, `src/hooks/useSupabaseData.js` |
| `src/hooks/useSupabaseData.js` | 297 | Sync données Supabase ↔ state local | `src/App.js` |
| `src/hooks/useChantierCalculs.js` | 19 | Calculs dérivés pour un chantier | `src/components/chantiers/ChantierDetail.js` |
| `src/hooks/useChantierFiltres.js` | 25 | Filtres et tri de la liste chantiers | `src/pages/ChantiersPage.js` |
| `src/hooks/useClaudeAI.js` | 28 | Interface avec l'API Claude IA | `src/components/ia/ClaudeIAPanel.js` |
| `src/hooks/useIsMobile.js` | 14 | Détection breakpoint mobile | `src/pages/Dashboard.js` |
| `src/useAgents.js` | 333 | Orchestrateur agents IA (timers, mémoire) | `src/App.js` |
| `src/modules/alertes/hooks/useAlerts.js` | 27 | Alertes filtrées depuis le store | `src/modules/alertes/AlertsPage.js` |
| `src/modules/alertes/hooks/useAlertCount.js` | 9 | Compteur d'alertes urgentes (badge nav) | `src/App.js` |
| `src/modules/alertes/hooks/useAlertActions.js` | 22 | Actions sur alertes (acknowledge, snooze, resolve) | `src/modules/alertes/components/AlertCard.js` |

### 2.4 Utilitaires métier (calculs, logique)
| Fichier | Lignes | Domaine | Utilisé par |
|---|---|---|---|
| `src/donnees.js` | 1 165 | **Source unique de vérité** : CA, coûts, marges, EAC, RAD, journal | 44 fichiers (couplage central) |
| `src/relances.js` | 204 | Logique de relance factures impayées | `src/alertes.js`, `src/Factures.js`, `src/RelancesTab.js`, `src/pages/FinancesPage.js` |
| `src/dateUtils.js` | 23 | Parse dates safe, jours entre deux dates | **jamais importé** |
| `src/permissions.js` | 44 | RBAC pages/actions (CYNA + CYNATECH) | **jamais importé** |
| `src/calculs/constants.js` | 10 | Constantes CYNA (TVA, coefficients, seuils) | `src/modules/alertes/lib/rules/tresorerie.js` |
| `src/calculs/couts.js` | 28 | Calcul CHR (coût horaire réel) | non importé en prod (utilisé dans tests) |
| `src/calculs/evm.js` | 22 | Calcul EVM (CPI, SPI, EAC, RAD) | `src/modules/alertes/lib/rules/financier.js` |
| `src/calculs/format.js` | 31 | Formatage CHF, %, nombres | `src/modules/alertes/lib/rules/financier.js`, `…tresorerie.js` |
| `src/calculs/marges.js` | 36 | Calcul marges brute/nette | non importé en prod (utilisé dans tests) |
| `src/calculs/planning.js` | 36 | Calcul jours ouvrables, délais | non importé en prod (utilisé dans tests) |
| `src/calculs/pricing.js` | 32 | Calcul devis global (HT, TVA, TTC) | non importé en prod (utilisé dans tests) |
| `src/calculs/probabilites.js` | 50 | Distribution normale, Monte Carlo | non importé en prod (utilisé dans tests) |
| `src/calculs/stats.js` | 32 | Statistiques (régression, z-score) | non importé en prod (utilisé dans tests) |
| `src/calculs/tresorerie.js` | 43 | DSO, intérêts moratoires, hypothèque légale | `src/modules/alertes/contextAdapter.js`, `…rules/tresorerie.js` |
| `src/utils/exportCSV.js` | 16 | Export données en CSV | `src/pages/ParametresPage.js`, `src/pages/ClientsPage.js`, +2 |
| `src/utils/importCSV.js` | 84 | Import CSV chantiers/clients | `src/pages/ParametresPage.js` |
| `src/constants/statuts.js` | 7 | Constante `TOUS_STATUTS` | `src/Planning.js`, `src/pages/ChantiersPage.js`, `src/pages/DevisPage.js` |

### 2.5 Système IA / Agents
| Fichier | Lignes | Rôle | Dépendances |
|---|---|---|---|
| `src/AgentEngine.js` | 2 193 | Moteur agents IA — 20 agents en 3 tiers (analyse, intelligence croisée, synthèse) | `src/donnees.js`, `src/ds.js` |
| `src/Agents.js` | 1 137 | UI panel agents — affichage résultats, scores, alertes visuelles | `src/donnees.js`, `src/ds.js`, `src/Factures.js` |
| `src/useAgents.js` | 333 | Hook orchestration agents — timers, mémoire localStorage, state | `src/AgentEngine.js` |
| `src/components/ia/ClaudeIAPanel.js` | 1 065 | Conversation continue avec Claude API | `src/hooks/useClaudeAI.js` |
| `src/pages/CentreIA.js` | 37 | Shell page Centre IA (Agents + AuditApp + ClaudeIA) | `src/Agents.js`, `src/AuditApp.js` |
| `src/AuditApp.js` | 776 | Audit diagnostic de l'app (cohérence données, calculs) | `src/donnees.js`, `src/Factures.js`, `src/Heures.js` |

### 2.6 Données et configuration
| Fichier | Lignes | Contenu | Utilisé par |
|---|---|---|---|
| `src/donnees.js` | 1 165 | Logique métier + données initiales + constantes BTP | 44 fichiers |
| `src/donnees-demo.js` | 1 142 | Jeu de données démo (7 chantiers, 7 factures, 9 devis…) | `src/donnees.js` |
| `src/ds.js` | 303 | Design system — tokens couleurs, espacements, styles inline | 38 fichiers |
| `src/calculs/__fixtures__/cyna.js` | 58 | Fixtures partagées pour les tests Vitest | tests uniquement |

### 2.7 Module Supabase / Data
| Fichier | Lignes | Rôle | Tables impactées |
|---|---|---|---|
| `src/lib/supabase.js` | 16 | Client Supabase (createClient) | — |
| `src/hooks/useSupabaseData.js` | 297 | CRUD Supabase + sync localStorage | `user_data` (blob JSON unique par user) |

### 2.8 Context / State global
| Fichier | Lignes | Ce qu'il expose | Consommé par |
|---|---|---|---|
| `src/context/AppContext.js` | 13 | `AppProvider`, `useApp` — partage état global (chantiers, devis, factures…) | `src/App.js` (provider), 19 composants (consumer) |
| `src/modules/alertes/lib/store.js` | 58 | Store Zustand — alertes, acknowledge, snooze, resolve | `src/modules/alertes/hooks/useAlerts.js`, `src/modules/alertes/lib/engine.js`, +3 |

---

## 3. Drapeaux et alertes

### 🔴 Candidats code mort (jamais importés par aucun autre fichier)

> Fichiers présents dans le repo mais qu'aucun autre fichier n'importe. **À vérifier manuellement** avant suppression.

| Fichier | Lignes | Dernier commit | Note |
|---|---|---|---|
| `src/Documents.js` | 156 | 2026-05-19 | Page gestionnaire docs — existait avant mais non routée dans App.js actuel |
| `src/MetragePlan.js` | 557 | 2026-05-19 | Page métrés — non routée dans App.js actuel |
| `src/Photos.js` | 291 | 2026-05-19 | Page photos chantiers — non routée |
| `src/Qualite.js` | 343 | 2026-05-19 | Page contrôle qualité — non routée |
| `src/SoumissionAssistee.js` | 658 | 2026-05-24 | Page soumission assistée — non routée (était importée par ImportPDF.js lui-même non routé) |
| `src/permissions.js` | 44 | 2026-05-24 | RBAC — remplacé par `useAuth.js` qui gère les pages autorisées |
| `src/dateUtils.js` | 23 | 2026-05-11 | Utilitaire dates — doublonne la logique présente dans donnees.js |
| `src/reportWebVitals.js` | 13 | 2026-04-28 | Boilerplate CRA — jamais appelé |
| `src/components/ui/index.js` | 6 | — | Barrel export jamais utilisé — chaque consommateur importe directement |

**Total lignes de code mort confirmé : ~2 091 lignes**

### 🟡 Duplications potentielles

#### Groupe 1 : Système d'alertes (alertes v1 vs module alertes v2)
- `src/alertes.js` (282 lignes) — Alertes V1, fonctions pures retournant `{id, type, niveau, message, page}`, importé par App.js, Layout.js, Dashboard.js
- `src/modules/alertes/` (module complet) — Alertes V2, moteur temps réel, store Zustand, 15 règles BTP, cooldowns, scheduler
- **Verdict** : **Coexistence intentionnelle mais à durée limitée.** `alertes.js` est encore actif et câblé (3 importateurs). Le module V2 est fonctionnel en parallèle. Les deux systèmes produisent des alertes sans coordination entre eux.

#### Groupe 2 : Système d'agents IA (3 fichiers étroitement liés)
- `src/AgentEngine.js` (2 193 lignes) — Moteur : logique des 20 agents, calculs, données retournées
- `src/Agents.js` (1 137 lignes) — UI : affichage des résultats des agents, composant React
- `src/useAgents.js` (333 lignes) — Hook : orchestre AgentEngine, gère timers et mémoire
- **Verdict** : **Fonctions différentes, architecture en couches.** Pas de duplication — c'est un découpage moteur/UI/hook. En revanche, AgentEngine.js à 2 193 lignes est un fichier très lourd.

#### Groupe 3 : Données métier (donnees.js vs calculs/)
- `src/donnees.js` (1 165 lignes) — Contient à la fois les données initiales, les constantes BTP ET les fonctions de calcul (calculerCoutsChantier, calculerEtatChantier, calculerCA…)
- `src/calculs/*.js` (10 fichiers, ~350 lignes) — Modules de calcul purs, testés avec Vitest, utilisés uniquement par le module alertes
- **Verdict** : **Duplication de logique.** `donnees.js` contient des calculs qui existent aussi dans `src/calculs/`. Les deux coexistent sans coordination. `donnees.js` est le seul utilisé par l'app principale.

#### Groupe 4 : Rapport / RapportsPage
- `src/Rapport.js` (262 lignes) — Ancien composant rapport hebdomadaire (utilisé par Analyse.js)
- `src/pages/RapportsPage.js` — Page rapports actuelle qui assemble Analyse, SimulateurCroissance, BenchmarkMarche
- **Verdict** : **Évolution successive.** Rapport.js est un sous-composant d'Analyse.js qui est lui-même inclus dans RapportsPage. Hiérarchie claire, pas de duplication.

### 🟠 Couplages forts

> Fichiers importés par plus de 10 autres. Modifier ces fichiers présente un risque de régression élevé.

| Fichier | Nombre d'importateurs | Risque |
|---|---|---|
| `src/donnees.js` | **44** | Critique — toucher ce fichier impacte presque toute l'app |
| `src/ds.js` | **38** | Élevé — tout composant qui a un style en dépend |
| `src/context/AppContext.js` | **19** | Élevé — fournit l'état global à toutes les pages |
| `src/Factures.js` | **19** | Modéré — importé par agents, alertes, pages, composants |
| `src/Heures.js` | **14** | Modéré — importé par agents, calculs, pages |

### 🟣 Fichiers très volumineux (> 500 lignes)

| Fichier | Lignes | Catégorie |
|---|---|---|
| `src/AgentEngine.js` | 2 193 | Système IA — moteur 20 agents |
| `src/pages/Dashboard.js` | 1 352 | Page — tableau de bord principal |
| `src/Factures.js` | 1 248 | Page — gestion complète des factures |
| `src/donnees.js` | 1 165 | Données + calculs métier |
| `src/donnees-demo.js` | 1 142 | Données de démonstration |
| `src/Agents.js` | 1 137 | Système IA — UI des agents |
| `src/Analyse.js` | 1 135 | Page — multi-onglets analyse |
| `src/components/ia/ClaudeIAPanel.js` | 1 065 | Composant IA — conversation Claude |
| `src/ExportPDF.js` | 940 | Utilitaire PDF |
| `src/ImportPDF.js` | 933 | Utilitaire PDF |
| `src/Planning.js` | 835 | Composant planning Gantt |
| `src/pages/DevisPage.js` | 832 | Page — gestion devis |
| `src/pages/CalculsPage.js` | 813 | Page — 8 calculateurs BTP |
| `src/AuditApp.js` | 776 | Page — audit diagnostic |

### 🔵 Mauvais emplacement potentiel

> Fichiers à la racine de `src/` alors qu'un dossier équivalent existe.

| Fichier | Emplacement actuel | Emplacement suggéré |
|---|---|---|
| `src/Login.js` | racine de src/ | `src/pages/` |
| `src/AgentEngine.js` | racine de src/ | `src/modules/agents/` |
| `src/Agents.js` | racine de src/ | `src/modules/agents/` |
| `src/useAgents.js` | racine de src/ | `src/modules/agents/` ou `src/hooks/` |
| `src/Analyse.js` | racine de src/ | `src/pages/` |
| `src/AuditApp.js` | racine de src/ | `src/pages/` |
| `src/BenchmarkMarche.js` | racine de src/ | `src/pages/` |
| `src/Calendrier.js` | racine de src/ | `src/components/` |
| `src/Documents.js` | racine de src/ | `src/pages/` (si réactivée) |
| `src/ExportPDF.js` | racine de src/ | `src/utils/` ou `src/modules/pdf/` |
| `src/Factures.js` | racine de src/ | `src/pages/` |
| `src/Heures.js` | racine de src/ | `src/pages/` |
| `src/ImportPDF.js` | racine de src/ | `src/utils/` ou `src/modules/pdf/` |
| `src/Marges.js` | racine de src/ | `src/components/` |
| `src/MetragePlan.js` | racine de src/ | `src/pages/` (si réactivée) |
| `src/Paiements.js` | racine de src/ | `src/components/` |
| `src/Photos.js` | racine de src/ | `src/pages/` (si réactivée) |
| `src/Planning.js` | racine de src/ | `src/components/` |
| `src/Qualite.js` | racine de src/ | `src/pages/` (si réactivée) |
| `src/Rapport.js` | racine de src/ | `src/components/` |
| `src/RelancesTab.js` | racine de src/ | `src/components/` |
| `src/SimulateurCroissance.js` | racine de src/ | `src/pages/` |
| `src/SoumissionAssistee.js` | racine de src/ | `src/pages/` (si réactivée) |
| `src/Statistiques.js` | racine de src/ | `src/components/` |
| `src/alertes.js` | racine de src/ | `src/modules/alertes/` (si conservée) |
| `src/dateUtils.js` | racine de src/ | `src/utils/` (si conservée) |
| `src/permissions.js` | racine de src/ | `src/utils/` (si conservée) |
| `src/relances.js` | racine de src/ | `src/utils/` |

**38 fichiers sont à la racine de `src/` — dont 26 devraient être dans des sous-dossiers.**

---

## 4. Carte des dépendances clés

### Fichiers les plus importés (modifier = risque élevé de régression)

| Fichier | Importé par |
|---|---|
| `src/donnees.js` | App.js, Dashboard.js, ChantiersPage.js, DevisPage.js, Factures.js, … +39 autres |
| `src/ds.js` | App.js, Dashboard.js, DevisPage.js, Factures.js, Agents.js, … +33 autres |
| `src/context/AppContext.js` | App.js (provider), Dashboard.js, ChantiersPage.js, DevisPage.js, … +16 autres |
| `src/Factures.js` | App.js, alertes.js, useAgents.js, Agents.js, AgentEngine.js, … +14 autres |
| `src/Heures.js` | App.js, AuditApp.js, donnees.js, Agents.js, AgentEngine.js, … +9 autres |

### Fichiers avec le plus d'imports internes (responsabilités larges)

| Fichier | Nb imports internes | Principales dépendances |
|---|---|---|
| `src/App.js` | **27** | Layout, donnees, toutes les pages, hooks auth/data/agents/alertes, providers |
| `src/components/chantiers/ChantierDetail.js` | **10** | donnees, ds, hooks/useChantierCalculs, SharedBadges, tous les Detail* |
| `src/pages/Dashboard.js` | **6** | donnees, ds, useIsMobile, SaisieRapideDashboard, AppContext |
| `src/pages/FinancesPage.js` | **6** | donnees, ds, Factures, Paiements, RelancesTab, AppContext |
| `src/pages/DevisPage.js` | **6** | donnees, ds, ExportPDF, AssistantDevisIA, ConfirmModal, AppContext |
| `src/pages/ClientsPage.js` | **6** | donnees, ds, SharedBadges, exportCSV, AppContext |
| `src/pages/ChantiersPage.js` | **6** | donnees, ds, useChantierFiltres, ChantierForm, ChantiersListe, KanbanChantiers |

---

## 5. Recommandations de l'agent — RIEN

L'agent `code-cartographer` ne fait AUCUNE recommandation de refactoring. Sa mission est purement descriptive. La phase de consolidation viendra dans une étape suivante, sur la base de ce document.

---

## 6. Comment relire ce document

1. **Section 1** te donne la vue d'ensemble — combien de fichiers, où ils sont
2. **Section 2** te dit ce que fait chaque fichier — tu peux te repérer
3. **Section 3 (drapeaux)** est la section CRITIQUE — c'est là qu'on va prendre les décisions
4. **Section 4** t'aide à savoir quels fichiers sont "intouchables" sans précaution

Quand tu auras lu, signale à Claude ce qui te surprend ou ce qui te paraît prioritaire. **On commencera la consolidation par là.**
