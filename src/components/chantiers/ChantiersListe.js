import React, { useMemo, useState, useEffect, useLayoutEffect } from 'react';
import {
  X, Pencil, Trash2, Archive, AlertTriangle, ChevronRight, Eye, Download, LayoutList, LayoutGrid, Menu, Bell,
} from 'lucide-react';
import { exportCSV } from '../../utils/exportCSV';
import KanbanChantiers from './KanbanChantiers';
import {
  fmtN, calculerCoutsChantier, C, calculerEtatChantier,
  assertEtatCoherent, calculerCA, isChantierActif,
} from '../../donnees';
import { indicateursMargeChantier } from '../../calculs/periode';
import { DS, badgeStatut } from '../../ds';
import { V1, mono, carteV1, heroFond, heroMono, barreProgression, RYTHME } from '../../design/v1';
import { useApp } from '../../context/AppContext';
import useIsMobile from '../../hooks/useIsMobile';
import { chantierEstReferencé } from '../../utils/referenceGuard';
import ArchiveToggle from '../shared/ArchiveToggle';
import ArchivedRow from '../shared/ArchivedRow';

const PAGE_SIZE = 50;
const STATUTS = ['Tous', 'Planifié', 'En cours', 'Suspendu', 'Attente paiement', 'Terminé', 'Facturé', 'Clôturé'];

// Bouton translucide sur le hero bleu nuit (cohérent avec l'Accueil).
const heroBtn = { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, padding: '6px 11px', cursor: 'pointer', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: 12, fontWeight: 600 };

function ChantiersListe({
  chantiersFiltres,
  chantiersArchives = [],
  joursParChantier,
  filtre,
  setFiltre,
  onSelect,
  onModifier,
  onSupprimer,
  onArchiver,
  onRestaurer,
  formSlot,
}) {
  const { chantiers, clients, devis = [], factures = [], pointages = [], parametres, naviguer, contexte, agentState, confirmer, periodeGlobale = 'mois', setPeriodeGlobale = () => {}, ouvrirMenu } = useApp();
  const isMobile = useIsMobile();
  const [page, setPage] = useState(0);
  const [vueMode, setVueMode] = useState('liste');
  const [voirArchives, setVoirArchives] = useState(false);

  // Hero bleu plein écran : masque la barre blanche (Topbar) tant que la LISTE est
  // montée. La fiche détail démonte la liste → le Topbar (☰/retour) réapparaît.
  useLayoutEffect(() => {
    document.body.classList.add('hero-fullscreen');
    return () => document.body.classList.remove('hero-fullscreen');
  }, []);

  // Un chantier référencé (heures/factures) ne se supprime pas → on l'archive.
  // Vierge → suppression dure. Décide quel bouton afficher par ligne.
  const estReference = React.useCallback(
    (c) => chantierEstReferencé(c, { factures, pointages }) !== null,
    [factures, pointages],
  );
  useEffect(() => { setPage(0); }, [filtre, periodeGlobale, chantiersFiltres.length]);

  const deriveMap = React.useMemo(() => {
    const map = {};
    (agentState?.agentData?.DerivePredictor?.resultats || []).forEach(r => { map[r.chantierId] = r; });
    return map;
  }, [agentState]);

  // KPIs financiers — CA FACTURÉ HT de la période + coûts prorata + à-facturer, via le helper
  // partagé indicateursMargeChantier (même source que la page Marges → chiffres identiques pour
  // un même chantier/période). Fini le CA devisé rattaché au chevauchement dateDebut, qui comptait
  // un chantier à 100 % dans CHAQUE mois qu'il traversait (double-comptage). nbEnCours / nbEnRetard
  // restent des indicateurs de PORTEFEUILLE (état courant, pas « de la période ») — libellés en clair.
  const kpi = useMemo(() => {
    const cfg = parametres.parametres;
    const indics = chantiersFiltres.map(c => indicateursMargeChantier(c, parametres.employes, cfg, pointages, factures, periodeGlobale));
    const factures_ = indics.filter(i => i.caHT > 0);              // chantiers facturés sur la période
    const caTotal = factures_.reduce((t, i) => t + i.caHT, 0);     // CA FACTURÉ HT
    const coutsFactures = factures_.reduce((t, i) => t + i.couts, 0);
    const margeTotal = caTotal - coutsFactures;
    const margePct = caTotal > 0 ? Math.round((margeTotal / caTotal) * 1000) / 10 : null;
    const aFacturer = indics.reduce((t, i) => t + i.aFacturer, 0); // coûts engagés non facturés (toutes lignes)
    const nbFactures = factures_.length;
    // Portefeuille (globaux, pas filtrés par la période)
    const nbEnCours = chantiers.filter(c => c.archive !== true && (c.statut || '').toLowerCase() === 'en cours').length;
    const nbEnRetard = chantiersFiltres.filter(c => { const j = joursParChantier[c.id]; return j !== null && j < 0; }).length;
    const joursPlanifies = chantiersFiltres.reduce((t, c) => t + (parseInt(c.nombreJours) || 0), 0);
    return { nbEnCours, nbEnRetard, caTotal, margeTotal, margePct, aFacturer, nbFactures, joursPlanifies };
  }, [chantiersFiltres, chantiers, parametres, joursParChantier, periodeGlobale, pointages, factures]);

  // Décisions/scoring chantiers
  const getDecisionChantier = (etatC) => {
    if (etatC.totalJoursReels === 0 && etatC.coutTotalReel > 0)
      return { icone: '', label: 'Incohérent', couleur: '#90a4ae', message: 'Activité sans suivi', sous: 'Des coûts sont saisis sans journées déclarées', niveau: 'warning', priorite: 4 };
    if (etatC.avancementPct >= 100) {
      const msgT = etatC.deriveJours > 0
        ? `Terminé avec +${etatC.deriveJours} j de retard`
        : etatC.deriveJours < 0
          ? `Terminé avec ${Math.abs(etatC.deriveJours)} j d'avance`
          : 'Chantier finalisé';
      const sousT = (etatC.projectionDisponible && etatC.margeEstimee !== null)
        ? etatC.margeEstimee >= 0 ? `+CHF ${fmtN(Math.round(etatC.margeEstimee))} de marge` : `Perte CHF ${fmtN(Math.abs(Math.round(etatC.margeEstimee)))}`
        : null;
      return { icone: '', label: 'Terminé', couleur: '#78909c', message: msgT, sous: sousT, niveau: 'ok', priorite: 5 };
    }
    if (etatC.deriveJours >= 5)
      return { niveau: 'critique', label: 'Retard critique', couleur: C.danger, message: `+${etatC.deriveJours} j de retard`, sous: (etatC.projectionDisponible && etatC.margeEstimee !== null && etatC.margeEstimee < 0) ? `Perte estimée CHF ${fmtN(Math.abs(Math.round(etatC.margeEstimee)))}` : null, priorite: 1 };
    if (etatC.projectionDisponible && etatC.margeEstimee !== null && etatC.margeEstimee < 0)
      return { niveau: 'critique', label: 'Perte estimée', couleur: C.danger, message: `Perte estimée CHF ${fmtN(Math.abs(Math.round(etatC.margeEstimee)))}`, sous: 'Basé sur tendance actuelle', priorite: 2 };
    if (etatC.deriveJours >= 2)
      return { niveau: 'warning', label: 'À surveiller', couleur: C.warning, message: `Retard léger : +${etatC.deriveJours} j`, sous: null, priorite: 3 };
    return { niveau: 'ok', label: 'Dans les temps', couleur: C.secondaire, message: 'Cadence normale', sous: null, priorite: 6 };
  };

  const DECISION_INVALIDE = { icone: '', label: 'Données invalides', couleur: '#90a4ae', message: 'Impossible d\'analyser ce chantier', sous: 'Vérifier les données saisies', niveau: 'invalid', priorite: 0 };

  const scored = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return [...chantiersFiltres].map(c => {
      const etatC = calculerEtatChantier(c, parametres.employes, devis, parametres.parametres, pointages);
      const coherence = assertEtatCoherent(etatC);
      if (!coherence.ok)
        return { c, etatC, decision: DECISION_INVALIDE, indicateurs: [], actions: [] };
      const decision = getDecisionChantier(etatC);
      const estTermine = etatC.avancementPct >= 100;
      const perteDejaExprimee = decision.priorite === 2 || (decision.priorite === 1 && decision.sous !== null);
      const deriveDejaExprimee = decision.priorite === 1 || decision.priorite === 3;
      const dataDejaExprimee   = decision.priorite === 4;
      const margeAbs = (etatC.margeEstimee !== null && !isNaN(etatC.margeEstimee)) ? Math.round(Math.abs(etatC.margeEstimee)) : 0;
      const hasHeuresAuj = (c.journal || []).some(e =>
        e.date === todayStr && (e.employes || []).some(emp => (parseFloat(emp.heuresTravaillees) || 0) > 0)
      );
      const ind = [];
      if (!estTermine && !perteDejaExprimee && etatC.projectionDisponible && margeAbs > 0 && etatC.margeEstimee < 0)
        ind.push({ type: 'perte',  label: `Perte CHF ${fmtN(margeAbs)}`,  couleur: C.danger,  tooltip: 'Le chantier est déficitaire selon la projection' });
      if (!estTermine && !dataDejaExprimee && etatC.totalJoursReels === 0 && etatC.coutTotalReel > 0)
        ind.push({ type: 'data',   label: 'Données',                        couleur: '#90a4ae', tooltip: 'Des données sont incohérentes ou manquantes' });
      if (!estTermine && !deriveDejaExprimee && etatC.totalJoursReels > 0 && etatC.deriveJours >= 2 && !isNaN(etatC.deriveJours))
        ind.push({ type: 'derive', label: `+${etatC.deriveJours} j`,        couleur: C.warning, tooltip: 'Décalage entre prévu et réel' });
      if (!estTermine && isChantierActif(c) && etatC.totalJoursReels > 0 && !hasHeuresAuj)
        ind.push({ type: 'no_hours', label: 'Aucune saisie aujourd\'hui', couleur: C.warning, tooltip: 'Aucune heure déclarée pour ce chantier aujourd\'hui' });
      const PRIO_IND = { perte: 0, data: 1, derive: 2, no_hours: 3 };
      const indicateurs = ind.sort((a, b) => PRIO_IND[a.type] - PRIO_IND[b.type]).slice(0, 2);
      return { c, etatC, decision, indicateurs };
    }).sort((a, b) => a.decision.priorite - b.decision.priorite);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chantiersFiltres, parametres.employes, devis]);

  const nbCritique = useMemo(() => scored.filter(x => x.decision.niveau === 'critique').length, [scored]);
  const nbWarning  = useMemo(() => scored.filter(x => x.decision.niveau === 'warning').length, [scored]);

  const totalPages = Math.ceil(scored.length / PAGE_SIZE);
  const scoredPage = scored.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const exporterCSV = () => {
    const entetes = ['Nom', 'Client', 'Statut', 'Début', 'Fin prévue', 'Jours planifiés', 'CA signé HT (CHF)', 'Avancement (%)', 'Marge réelle (%)'];
    const lignes = chantiersFiltres.map(c => {
      const clientNom = (clients.find(cl => String(cl.id) === String(c.clientId))?.nom || '') + ' ' + (clients.find(cl => String(cl.id) === String(c.clientId))?.prenom || '');
      const ca = calculerCA(c, devis);
      const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis, pointages);
      return [
        c.nom || '',
        clientNom.trim(),
        c.statut || '',
        c.dateDebut || '',
        c.dateFin || '',
        c.nombreJours || 0,
        ca !== null ? Math.round(ca) : '',
        couts.avancementPct !== null ? couts.avancementPct : '',
        couts.margeActuellePct !== null ? couts.margeActuellePct : '',
      ];
    });
    exportCSV(`chantiers_${new Date().toISOString().slice(0,10)}.csv`, entetes, lignes);
  };

  // Couleur d'une marge % (vert bonne / ambre limite / rouge faible)
  const couleurMargePct = (pct) => pct == null ? V1.texteMuted : pct >= 15 ? V1.ok : pct >= 0 ? V1.warn : V1.danger;

  // ── 4 chiffres du hero (valeurs brutes des memos) ──
  // Couleur de la marge de période (vert ≥20 % / ambre 0–20 % / rouge <0), lisible sur le bleu nuit.
  const couleurMargeHero = kpi.margePct == null ? '#fff' : kpi.margePct >= 20 ? '#7BE3A6' : kpi.margePct >= 0 ? '#FFD479' : '#FF9C9C';
  const tiles = [
    { label: 'EN COURS', val: String(kpi.nbEnCours), sub: kpi.nbEnRetard > 0 ? `${kpi.nbEnRetard} EN RETARD` : 'PORTEFEUILLE', couleur: '#fff' },
    { label: 'CA FACTURÉ', val: `CHF ${fmtN(kpi.caTotal)}`, sub: `${kpi.nbFactures} FACTURÉ${kpi.nbFactures !== 1 ? 'S' : ''}`, couleur: '#fff' },
    { label: 'MARGE', val: kpi.margePct !== null ? `${kpi.margePct}%` : '—', sub: null, couleur: couleurMargeHero },
    { label: 'À FACTURER', val: `CHF ${fmtN(kpi.aFacturer)}`, sub: kpi.aFacturer > 0 ? 'NON FACTURÉ' : null, couleur: kpi.aFacturer > 0 ? '#FFD479' : '#fff' },
  ];

  const PERIODES = [{ id: 'semaine', label: 'Cette semaine' }, { id: 'mois', label: 'Ce mois' }, { id: 'annee', label: 'Cette année' }];
  const actionsHero = (
    <>
      {contexte?.clientActif && <button onClick={() => naviguer('clients')} style={heroBtn}><ChevronRight size={13} style={{ transform: 'rotate(180deg)' }} /> Clients</button>}
      {contexte?.employeActif && <button onClick={() => naviguer('employes')} style={heroBtn}><ChevronRight size={13} style={{ transform: 'rotate(180deg)' }} /> Employés</button>}
      {(contexte?.clientActif || contexte?.employeActif) && <button onClick={() => naviguer('chantiers')} style={heroBtn}><X size={13} /> Filtre</button>}
      {/* Sélecteur de période (intégré au hero, translucide) */}
      <select value={periodeGlobale} onChange={e => setPeriodeGlobale(e.target.value)} aria-label="Période"
        style={{ ...heroBtn, padding: '6px 8px' }}>
        {PERIODES.map(p => <option key={p.id} value={p.id} style={{ color: '#16233A' }}>{p.label}</option>)}
      </select>
      {/* Notifications */}
      <button onClick={() => naviguer('alertes')} aria-label="Notifications" style={{ ...heroBtn, padding: 7 }}><Bell size={15} /></button>
      {chantiersFiltres.length > 0 && <button onClick={exporterCSV} style={heroBtn}><Download size={13} /> CSV</button>}
      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, overflow: 'hidden' }}>
        <button onClick={() => setVueMode('liste')} title="Vue liste"
          style={{ padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: vueMode === 'liste' ? '#fff' : 'transparent', color: vueMode === 'liste' ? V1.marine : 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700 }}>
          <LayoutList size={14} /> Liste
        </button>
        <button onClick={() => setVueMode('kanban')} title="Vue Kanban"
          style={{ padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: vueMode === 'kanban' ? '#fff' : 'transparent', color: vueMode === 'kanban' ? V1.marine : 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700 }}>
          <LayoutGrid size={14} /> Kanban
        </button>
      </div>
    </>
  );

  return (
    <div>
      {/* ── HERO BLEU NUIT (design v1, bord à bord) ── */}
      <div className="page-hero-bleed" style={{ ...heroFond, padding: isMobile ? '16px 16px 20px' : '22px 32px 26px', position: 'relative' }} data-testid="hero-chantiers">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {ouvrirMenu && (
            <button onClick={ouvrirMenu} aria-label="Menu" style={{ ...heroBtn, padding: 7 }}><Menu size={16} /></button>
          )}
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: '0.06em', color: '#fff' }}>CYNA</span>
          <span style={heroMono(10, 0.55)}>· CHANTIERS</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{actionsHero}</div>
        </div>

        <div style={heroMono(11, 0.6)}>CHANTIERS / 05</div>
        <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: isMobile ? 28 : 38, margin: '8px 0 8px', letterSpacing: '-0.02em', color: '#fff' }}>Chantiers</h1>
        <div style={heroMono(11, 0.7)}>
          — {chantiers.filter(c => c.archive !== true).length} CHANTIERS · {kpi.nbEnCours} EN COURS · {fmtN(kpi.joursPlanifies)} JOURS PLANIFIÉS
        </div>

        {/* Bandeau des 4 chiffres */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12, marginTop: 20 }}>
          {tiles.map(t => (
            <div key={t.label} data-testid={`kpi-${t.label.toLowerCase().replace(/\s+/g, '-')}`} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={heroMono(9, 0.6)}>{t.label}</div>
              <div style={{ ...mono(isMobile ? 18 : 22, t.couleur, 500), lineHeight: 1.1, marginTop: 4 }}>{t.val}</div>
              {t.sub && <div style={heroMono(9, 0.5)}>{t.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Filtres d'état en pastilles ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: RYTHME.entreCartes, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', paddingBottom: 2 }}>
        {STATUTS.map(s => {
          const actif = filtre === s;
          return (
            <button key={s} onClick={() => setFiltre(s)} style={{
              background: actif ? V1.bleu : 'transparent',
              color: actif ? '#fff' : V1.texteMuted,
              border: actif ? `1px solid ${V1.bleu}` : `1px solid ${V1.separation}`,
              padding: '7px 14px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: actif ? 700 : 500, whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s',
            }}>{s}</button>
          );
        })}
      </div>

      {chantiersArchives.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <ArchiveToggle
            voirArchives={voirArchives}
            onToggle={() => setVoirArchives(v => !v)}
            count={chantiersArchives.length}
            labelSingulier="chantier archivé"
          />
        </div>
      )}

      {formSlot}

      {/* ── Vue Kanban (fonctionnelle — habillage v1 dans un lot ultérieur) ── */}
      {vueMode === 'kanban' && (
        <KanbanChantiers scored={scored} onSelect={onSelect} />
      )}

      {/* ── Bandeaux d'alerte santé ── */}
      {vueMode === 'liste' && (
        nbCritique > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderRadius: 12, marginBottom: 16, background: V1.danger + '0f', border: `1px solid ${V1.danger}30`, borderLeft: `4px solid ${V1.danger}` }}>
            <AlertTriangle size={18} strokeWidth={2} style={{ color: V1.danger, flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 800, color: V1.danger }}>{nbCritique} chantier{nbCritique > 1 ? 's' : ''} bloque{nbCritique > 1 ? 'nt' : ''} aujourd'hui</span>
          </div>
        ) : nbWarning > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderRadius: 12, marginBottom: 16, background: V1.warn + '0f', border: `1px solid ${V1.warn}30`, borderLeft: `4px solid ${V1.warn}` }}>
            <AlertTriangle size={18} strokeWidth={2} style={{ color: V1.warn, flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 800, color: V1.warn }}>{nbWarning} chantier{nbWarning > 1 ? 's' : ''} à surveiller</span>
          </div>
        ) : null
      )}

      {vueMode === 'liste' && (
        scored.length === 0 ? (
          <div style={{ ...carteV1, padding: '40px 24px', textAlign: 'center', color: V1.texteMuted, fontSize: 14 }}>
            {contexte?.clientActif || contexte?.employeActif ? 'Aucun chantier ne correspond à ce filtre.' : 'Aucun chantier à afficher.'}
          </div>
        ) : isMobile ? (
          /* ── MOBILE : cartes empilées ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: RYTHME.entreCartes }}>
            {scoredPage.map(({ c, etatC, decision }) => {
              const client = clients.find(cl => String(cl.id) === String(c.clientId));
              const bs = badgeStatut(c.statut);
              const avancePct = Math.min(100, Math.max(0, etatC.avancementPct || 0));
              const barre = barreProgression(avancePct, decision.couleur);
              return (
                <div key={c.id} onClick={() => onSelect(c)} role="button" tabIndex={0}
                  style={{ ...carteV1, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 700, color: V1.texte, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nom}</div>
                      <div style={{ ...mono(10, V1.texteMuted), marginTop: 2 }}>{c.numero} · {(c.ville || '—').toUpperCase()}</div>
                    </div>
                    <span style={{ ...mono(10, bs.color, 500), background: bs.bg, borderRadius: 6, padding: '3px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>{(c.statut || '').toUpperCase()}</span>
                  </div>
                  <div style={barre.piste}><div style={barre.remplissage} /></div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: V1.texteMuted }}>{client?.entreprise || '—'}</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                      <span style={mono(13, decision.couleur, 500)}>{avancePct}%</span>
                      <span style={mono(12, couleurMargePct(etatC.margeProjeteePct))}>
                        {etatC.margeProjeteePct != null ? `${etatC.margeProjeteePct}%` : '—'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => onSelect(c)} style={{ ...DS.iconBtn, width: 44, height: 44 }} title="Voir détail"><Eye size={16} /></button>
                    <button onClick={() => onModifier(c)} style={{ ...DS.iconBtn, width: 44, height: 44 }} title="Modifier"><Pencil size={16} /></button>
                    {estReference(c)
                      ? (onArchiver && <button onClick={() => onArchiver(c.id)} style={{ ...DS.iconBtn, width: 44, height: 44 }} title="Archiver"><Archive size={16} /></button>)
                      : (onSupprimer && <button onClick={async () => { if (await confirmer(`Supprimer "${c.nom || c.numero}" ?\n\nCette action est irréversible.`, { labelOui: 'Supprimer' })) onSupprimer(c.id); }} style={{ ...DS.iconBtn, width: 44, height: 44, color: V1.danger }} title="Supprimer"><Trash2 size={16} /></button>)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── DESKTOP : tableau redessiné ── */
          <div style={{ ...carteV1, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Référence', 'Chantier', 'Client', 'Avancement', 'Marge', 'État', 'Actions'].map(col => (
                      <th key={col} style={{ ...mono(10, V1.texteMuted), textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '12px 14px', borderBottom: `1px solid ${V1.separation}`, background: '#FAFBFC', whiteSpace: 'nowrap' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scoredPage.map(({ c, etatC, decision }) => {
                    const client = clients.find(cl => String(cl.id) === String(c.clientId));
                    const bs = badgeStatut(c.statut);
                    const derive = deriveMap[c.id];
                    const avancePct = Math.min(100, Math.max(0, etatC.avancementPct || 0));
                    const barre = barreProgression(avancePct, decision.couleur);
                    const td = { padding: '13px 14px', borderBottom: `1px solid ${V1.separation}`, verticalAlign: 'middle' };
                    return (
                      <tr key={c.id} style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = V1.bleuFond + '55'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                        onClick={() => onSelect(c)}>
                        <td style={td}><span style={mono(11, V1.texteMuted)}>{c.numero}</span></td>
                        <td style={{ ...td, maxWidth: 260 }}>
                          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, fontWeight: 700, color: V1.texte, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nom}</div>
                          <div style={{ ...mono(10, V1.texteMuted), marginTop: 2 }}>{(c.ville || '—').toUpperCase()}</div>
                        </td>
                        <td style={td}><span style={{ fontSize: 13, color: V1.texteMuted }}>{client?.entreprise || '—'}</span></td>
                        <td style={{ ...td, minWidth: 150 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ ...barre.piste, width: 96, height: 6, flexShrink: 0 }}><div style={barre.remplissage} /></div>
                            <span style={mono(11, decision.couleur, 500)}>{avancePct}%</span>
                          </div>
                        </td>
                        <td style={td}>
                          <span style={mono(13, couleurMargePct(etatC.margeProjeteePct), 500)}>
                            {etatC.margeProjeteePct != null ? `${etatC.margeProjeteePct}%` : '—'}
                          </span>
                          {derive && (
                            <div style={{ ...mono(9, derive.statut === 'rouge' ? V1.danger : derive.statut === 'orange' ? V1.warn : V1.ok), marginTop: 3 }}>
                              EAC {Number.isFinite(derive.margeEstimeePct) ? `${derive.margeEstimeePct > 0 ? '+' : ''}${derive.margeEstimeePct}%` : '—'}
                            </div>
                          )}
                        </td>
                        <td style={td}>
                          <span style={{ ...mono(10, bs.color, 500), background: bs.bg, borderRadius: 6, padding: '3px 9px', whiteSpace: 'nowrap', display: 'inline-block' }}>{(c.statut || '').toUpperCase()}</span>
                        </td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button onClick={() => onSelect(c)} style={DS.iconBtn} title="Voir le détail"><Eye size={14} /></button>
                            <button onClick={() => onModifier(c)} style={DS.iconBtn} title="Modifier"><Pencil size={14} /></button>
                            {estReference(c)
                              ? (onArchiver && <button onClick={() => onArchiver(c.id)} style={DS.iconBtn} title="Archiver"><Archive size={14} /></button>)
                              : (onSupprimer && <button onClick={async () => { if (await confirmer(`Supprimer "${c.nom || c.numero}" ?\n\nCette action est irréversible.`, { labelOui: 'Supprimer' })) onSupprimer(c.id); }} style={{ ...DS.iconBtn, color: V1.danger }} title="Supprimer"><Trash2 size={14} /></button>)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ── Section archivés (grisée, restaurable) ── */}
      {voirArchives && chantiersArchives.length > 0 && (
        <div style={{ ...carteV1, padding: 0, overflow: 'hidden', marginTop: 16 }}>
          <div style={{ ...mono(11, V1.texteMuted), padding: '12px 16px', borderBottom: `1px solid ${V1.separation}`, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Chantiers archivés ({chantiersArchives.length})
          </div>
          {chantiersArchives.map(c => (
            <ArchivedRow
              key={c.id}
              label={c.nom || c.numero}
              sublabel={`${c.numero || ''}${c.statut ? ` · ${c.statut}` : ''}`}
              dateArchivage={c.dateArchivage}
              onRestaurer={() => onRestaurer && onRestaurer(c.id)}
              onClick={() => onSelect(c)}
            />
          ))}
        </div>
      )}

      {/* Pagination — liste seulement */}
      {vueMode === 'liste' && totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 12 }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={{ background: 'var(--bg-glass-2)', border: `1px solid ${V1.separation}`, borderRadius: 8, padding: '6px 14px', cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1, fontSize: 13, fontWeight: 600, color: V1.texteMuted, fontFamily: 'inherit' }}>← Préc.</button>
          <span style={mono(12, V1.texteMuted)}>{page + 1} / {totalPages} · {scored.length} chantiers</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
            style={{ background: 'var(--bg-glass-2)', border: `1px solid ${V1.separation}`, borderRadius: 8, padding: '6px 14px', cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page === totalPages - 1 ? 0.4 : 1, fontSize: 13, fontWeight: 600, color: V1.texteMuted, fontFamily: 'inherit' }}>Suiv. →</button>
        </div>
      )}
    </div>
  );
}

export default ChantiersListe;
