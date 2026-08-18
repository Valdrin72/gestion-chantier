// ============================================================
// CYNA — MODULE FINANCES (Factures + Paiements unifiés)
// ============================================================
import React, { useState, useMemo, useCallback, useLayoutEffect } from 'react';
import { DollarSign, FileText, Clock, AlertTriangle, CreditCard, TrendingUp, Calendar, Zap, CheckCircle, Menu, Plus } from 'lucide-react';
import Factures from '../Factures';
import RelancesTab from '../RelancesTab';
import { getIntervallesPeriode, getPeriodeLabel, facturesInPeriode, calculerCA, calculerCAForfait, calculerStatutFacture, calculerEtatChantier, tauxTVAParam, margePortefeuille } from '../donnees';
import { useApp } from '../context/AppContext';
import { prochainRappel } from '../relances';
import { V1, mono, carteV1, heroFond, heroMono, RYTHME } from '../design/v1';

const fmt  = (n) => (parseFloat(n) || 0).toLocaleString('fr-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtK = (n) => { const v = parseFloat(n) || 0; return v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(Math.round(v)); };

// Bouton translucide du hero bleu nuit (mêmes tokens que les autres pages v1).
const heroBtn = { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, padding: '6px 11px', cursor: 'pointer', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' };
// Solde restant d'une facture (source unique : montantTTC − Σ paiements). Lecture seule.
const soldeRestantFacture = (f) => {
  const total = parseFloat(f.montantTTC) || parseFloat(f.montantHT) || 0;
  const paye = (f.paiementsHistorique || []).reduce((s, p) => s + (parseFloat(p.montant) || 0), 0);
  return Math.max(0, total - paye);
};

// ── Composant Trésorerie prévisionnelle ──────────────────────────────────────
function Tresorerie({ factures = [], chantiers = [], clients = [], devis = [], parametres = null, onEmettreFacture = null, onEmettreExtra = null, pointages = [] }) {
  const today = new Date(); today.setHours(0,0,0,0);

  const data = useMemo(() => {
    // ── 1. Factures impayées classées par urgence ────────────────
    const impayees = factures
      .filter(f => f.statut !== 'annulee' && f.statut !== 'brouillon' && calculerStatutFacture(f) !== 'payee')
      .map(f => {
        const restant = Math.max(0, (parseFloat(f.montantTTC)||0) - (parseFloat(f.montantPaye)||0));
        const echeance = f.dateEcheance ? new Date(f.dateEcheance) : null;
        const joursRestants = echeance ? Math.round((echeance - today) / 86400000) : null;
        const client = clients.find(c => String(c.id) === String(f.clientId));
        const chantier = chantiers.find(c => String(c.id) === String(f.chantierId));
        let urgence = 'normal';
        if (joursRestants === null) urgence = 'normal';
        else if (joursRestants < 0) urgence = 'retard';
        else if (joursRestants <= 7) urgence = 'urgent';
        else if (joursRestants <= 30) urgence = 'proche';
        return { ...f, restant, joursRestants, urgence, clientNom: client?.entreprise || client?.nom || '—', chantierNom: chantier?.nom || '—' };
      })
      .filter(f => f.restant > 0)
      .sort((a, b) => {
        const order = { retard: 0, urgent: 1, proche: 2, normal: 3 };
        return order[a.urgence] - order[b.urgence];
      });

    const totalAEncaisser = impayees.reduce((s, f) => s + f.restant, 0);
    const totalRetard = impayees.filter(f => f.urgence === 'retard').reduce((s, f) => s + f.restant, 0);
    const totalCetteSemaine = impayees.filter(f => f.urgence === 'urgent').reduce((s, f) => s + f.restant, 0);

    // ── 2. Chantiers à facturer ──────────────────────────────────
    const employes = parametres?.employes || [];
    const paramsConfig = parametres?.parametres || parametres || {};
    const aFacturer = chantiers
      .filter(c => ['en cours', 'terminé', 'planifié'].includes(c.statut?.trim().toLowerCase()) && c.devisId)
      .map(c => {
        const caForfait = calculerCAForfait(c, devis);
        if (!caForfait || caForfait <= 0) return null;
        const ca = calculerCA(c, devis);
        // Source unique : avancement depuis journal (calculerEtatChantier), fallback sur valeur manuelle
        const etat = calculerEtatChantier(c, employes, devis, paramsConfig, pointages);
        const avancement = etat.totalJoursReels > 0 ? etat.avancementPct : (parseFloat(c.avancement) || 0);
        // déjà facturé = situations/acomptes/finales — EXCLUT les factures d'extras (extraId renseigné)
        const facturesChantier = factures.filter(f => String(f.chantierId) === String(c.id) && f.statut !== 'annulee' && !f.extraId);
        const dejaFacture = facturesChantier.reduce((s, f) => s + (parseFloat(f.montantHT) || 0), 0);
        const potentiel = Math.max(0, (caForfait * avancement / 100) - dejaFacture);
        if (potentiel < 500) return null;
        const client = clients.find(cl => String(cl.id) === String(c.clientId));
        return { id: c.id, nom: c.nom || c.numero, clientNom: client?.entreprise || client?.nom || '—', avancement, ca, caForfait, dejaFacture, potentiel };
      })
      .filter(Boolean)
      .sort((a, b) => b.potentiel - a.potentiel);

    const totalAFacturer = aFacturer.reduce((s, c) => s + c.potentiel, 0);

    // ── 3. Timeline 8 semaines ───────────────────────────────────
    const semaines = Array.from({ length: 8 }, (_, i) => {
      const debut = new Date(today); debut.setDate(today.getDate() + i * 7);
      const fin   = new Date(debut); fin.setDate(debut.getDate() + 6);
      const debutStr = debut.toISOString().slice(0,10);
      const finStr   = fin.toISOString().slice(0,10);
      const montant = impayees
        .filter(f => f.dateEcheance && f.dateEcheance >= debutStr && f.dateEcheance <= finStr)
        .reduce((s, f) => s + f.restant, 0);
      const label = i === 0 ? 'Cette sem.' : i === 1 ? 'Sem. proch.' : `S+${i+1}`;
      return { label, montant, debut: debutStr };
    });

    // Retard dans la semaine 0
    const montantRetard = impayees.filter(f => f.urgence === 'retard').reduce((s,f) => s + f.restant, 0);
    if (montantRetard > 0) semaines[0].montant += montantRetard;

    const maxSemaine = Math.max(...semaines.map(s => s.montant), 1);

    // ── 4. Signal de santé cash ──────────────────────────────────
    const total60j = impayees
      .filter(f => f.joursRestants !== null && f.joursRestants <= 60)
      .reduce((s, f) => s + f.restant, 0);
    const signalCash = totalRetard > 10000 ? 'danger'
      : totalRetard > 0 || totalCetteSemaine > 0 ? 'warning'
      : 'ok';

    // ── 5. Stats cumulées (performance globale) ──────────────────
    const factActives = factures.filter(f => f.statut !== 'annulee');
    const caTotalFacture = factActives.reduce((s, f) => s + (parseFloat(f.montantTTC) || 0), 0);
    // Plafonner montantPaye à montantTTC pour éviter encaissé > facturé
    const encaisseTotal  = factActives.reduce((s, f) => s + Math.min(parseFloat(f.montantPaye)||0, parseFloat(f.montantTTC)||0), 0);
    const nbFactures     = factActives.length;
    const ticketMoyen    = nbFactures > 0 ? caTotalFacture / nbFactures : 0;
    const tauxEncaissement = caTotalFacture > 0 ? Math.round((encaisseTotal / caTotalFacture) * 100) : 0;

    // Délai moyen paiement (sur factures payées, depuis dateEmission jusqu'au dernier paiement)
    const delais = factActives
      .filter(f => f.statut === 'payee' && (f.dateEmission || f.creeLe) && (f.paiementsHistorique || []).length > 0)
      .map(f => {
        const last = [...f.paiementsHistorique].sort((a, b) => (a.date || '').localeCompare(b.date || '')).pop();
        if (!last?.date) return null;
        const dateRef = f.dateEmission || f.creeLe;
        const d = Math.round((new Date(last.date) - new Date(dateRef)) / 86400000);
        return d >= 0 ? d : null;
      })
      .filter(d => d !== null);
    const delaiMoyen = delais.length > 0 ? Math.round(delais.reduce((s, d) => s + d, 0) / delais.length) : null;

    // Top clients par CA facturé
    const caParClient = {};
    factActives.forEach(f => {
      const cl = clients.find(c => String(c.id) === String(f.clientId));
      if (!cl) return;
      if (!caParClient[cl.id]) caParClient[cl.id] = { nom: cl.entreprise || `${cl.prenom || ''} ${cl.nom || ''}`.trim() || '—', ca: 0, nb: 0 };
      caParClient[cl.id].ca += parseFloat(f.montantTTC) || 0;
      caParClient[cl.id].nb += 1;
    });
    const topClients = Object.values(caParClient).sort((a, b) => b.ca - a.ca).slice(0, 5);

    // Top chantiers par CA facturé
    const caParChantier = {};
    factActives.forEach(f => {
      const ch = chantiers.find(c => String(c.id) === String(f.chantierId));
      if (!ch) return;
      if (!caParChantier[ch.id]) caParChantier[ch.id] = { nom: ch.nom || ch.numero || '—', ca: 0 };
      caParChantier[ch.id].ca += parseFloat(f.montantTTC) || 0;
    });
    const topChantiers = Object.values(caParChantier).sort((a, b) => b.ca - a.ca).slice(0, 5);

    // ── 6. Extras à facturer ─────────────────────────────────────
    const extrasAFacturer = chantiers.flatMap(c => {
      const extras = (c.extras || []).filter(e =>
        !factures.some(f => String(f.extraId) === String(e.id) && f.statut !== 'annulee')
      );
      const client = clients.find(cl => String(cl.id) === String(c.clientId));
      return extras.map(e => {
        const montant = e.mode === 'forfait'
          ? parseFloat(e.montantForfait) || 0
          : (parseFloat(e.heures) || 0) * (parseFloat(e.tarifHeure) || 0);
        return { ...e, chantierNom: c.nom || c.numero || '—', chantierId: c.id, devisId: c.devisId, clientId: c.clientId, clientNom: client?.entreprise || client?.nom || '—', montant };
      }).filter(e => e.montant > 0);
    });
    const totalExtrasAFacturer = extrasAFacturer.reduce((s, e) => s + e.montant, 0);

    return {
      impayees, aFacturer, semaines, maxSemaine,
      totalAEncaisser, totalRetard, totalCetteSemaine, totalAFacturer, total60j, signalCash,
      caTotalFacture, encaisseTotal, nbFactures, ticketMoyen, tauxEncaissement, delaiMoyen,
      topClients, topChantiers, extrasAFacturer, totalExtrasAFacturer,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factures, chantiers, clients, devis, parametres, pointages]);

  // Rentabilité du portefeuille — SOURCE UNIQUE partagée avec l'Accueil (même chiffre).
  const marge = useMemo(
    () => margePortefeuille(chantiers, parametres?.employes || [], parametres?.localites || [], parametres?.parametres, devis, pointages),
    [chantiers, parametres, devis, pointages]
  );

  const urgenceConfig = {
    retard:  { couleur: '#ef4444', bg: '#ef444410', label: 'En retard'  },
    urgent:  { couleur: '#f59e0b', bg: '#f59e0b10', label: '≤ 7 jours'  },
    proche:  { couleur: '#0d3d6e', bg: '#0d3d6e10', label: '≤ 30 jours' },
    normal:  { couleur: '#6b7280', bg: '#6b728010', label: '> 30 jours' },
  };

  const signalConfig = {
    danger:  { couleur: '#ef4444', bg: '#ef444412', Icone: AlertTriangle, texte: 'Encaissements critiques en retard — relancer immédiatement' },
    warning: { couleur: '#f59e0b', bg: '#f59e0b12', Icone: AlertTriangle, texte: 'Des paiements arrivent bientôt — anticiper les relances' },
    ok:      { couleur: '#10b981', bg: '#10b98112', Icone: CheckCircle,   texte: 'Situation cash saine — aucune urgence détectée' },
  };
  const signal = signalConfig[data.signalCash];

  return (
    <div>
      {/* ── Signal impayés — bandeau discret (bord gauche coloré) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderRadius: 12, marginBottom: RYTHME.entreSections, background: signal.couleur + '0f', border: `1px solid ${signal.couleur}30`, borderLeft: `4px solid ${signal.couleur}` }}>
        <signal.Icone size={16} color={signal.couleur} strokeWidth={2} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: signal.couleur }}>{signal.texte}</span>
      </div>

      {/* ── KPIs Trésorerie — une seule ligne v1 (liseré coloré) : À encaisser / Cette semaine / Facturable / Marge ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: RYTHME.entreCartes, marginBottom: RYTHME.entreSections }}>
        {[
          { label: 'À ENCAISSER',  val: `CHF ${fmt(data.totalAEncaisser)}`, couleur: V1.danger, sub: `${data.impayees.length} facture${data.impayees.length !== 1 ? 's' : ''} impayée${data.impayees.length !== 1 ? 's' : ''} · dont ${fmt(data.totalRetard)} en retard` },
          { label: 'CETTE SEMAINE', val: `CHF ${fmt(data.totalCetteSemaine)}`, couleur: V1.warn, sub: 'Échéances dans les 7 prochains jours' },
          { label: 'FACTURABLE MAINTENANT', val: `CHF ${fmt(data.totalAFacturer)}`, couleur: V1.ok, sub: `${data.aFacturer.length} chantier${data.aFacturer.length !== 1 ? 's' : ''} — selon avancement` },
          { label: 'MARGE MOYENNE', val: marge.pct === null ? '—' : `${Math.round(marge.pct)}%`, couleur: V1.bleu, sub: marge.nbAnalyses > 0 ? `sur ${marge.nbAnalyses} chantier${marge.nbAnalyses > 1 ? 's' : ''} avec coûts saisis` : 'Aucun chantier avec coûts saisis' },
        ].map(k => (
          <div key={k.label} style={{ ...carteV1, borderTop: `3px solid ${k.couleur}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: V1.texteMuted, marginBottom: 8 }}>{k.label}</div>
            <div style={{ ...mono(22, k.couleur, 600), lineHeight: 1.1 }}>{k.val}</div>
            <div style={{ fontSize: 11, color: V1.texteMuted, marginTop: 6, lineHeight: 1.35 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Timeline 8 semaines ── */}
      <div style={{ background: 'var(--surface-glass)', border: '1px solid var(--border-glass)', borderRadius: 16, padding: '22px 24px', marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={15} style={{ color: '#0d3d6e' }} />
          Encaissements prévus — 8 semaines
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 100 }}>
          {data.semaines.map((s, i) => {
            const pct = data.maxSemaine > 0 ? (s.montant / data.maxSemaine) * 100 : 0;
            const hasData = s.montant > 0;
            // Semaine courante en bleu profond, semaines suivantes en gris/bleu clair.
            const couleurBarre = i === 0 ? V1.bleu : V1.bleuClair;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                {hasData && (
                  <div style={{ ...mono(9, i === 0 ? V1.bleu : V1.texteMuted, 600) }}>{fmtK(s.montant)}</div>
                )}
                <div style={{ width: '100%', flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ width: '100%', height: hasData ? `${Math.max(pct, 6)}%` : '4px', background: hasData ? couleurBarre : V1.separation, borderRadius: '4px 4px 0 0', transition: 'height 0.3s', minHeight: 4 }} />
                </div>
                <div style={{ fontSize: 9, color: i === 0 ? V1.bleu : V1.texteMuted, textAlign: 'center', fontWeight: i === 0 ? 700 : 600, whiteSpace: 'nowrap' }}>{s.label}</div>
              </div>
            );
          })}
        </div>
        {data.totalAEncaisser === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>Aucune facture impayée</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* ── Factures à encaisser ── */}
        <div style={{ background: 'var(--surface-glass)', border: '1px solid var(--border-glass)', borderRadius: 16, padding: '20px 22px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={14} style={{ color: '#f59e0b' }} />
            Factures à encaisser
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{data.impayees.length} facture{data.impayees.length !== 1 ? 's' : ''}</span>
          </div>
          {data.impayees.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Aucune facture en attente</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto' }}>
              {data.impayees.map(f => {
                const cfg = urgenceConfig[f.urgence];
                return (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.couleur}25` }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: cfg.couleur, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.clientNom}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.chantierNom} · {f.numero || f.id}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: cfg.couleur }}>CHF {fmt(f.restant)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {f.joursRestants === null ? 'Sans échéance'
                          : f.joursRestants < 0 ? `${Math.abs(f.joursRestants)}j de retard`
                          : f.joursRestants === 0 ? 'Aujourd\'hui'
                          : `J+${f.joursRestants}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Chantiers à facturer ── */}
        <div style={{ background: 'var(--surface-glass)', border: '1px solid var(--border-glass)', borderRadius: 16, padding: '20px 22px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={14} style={{ color: '#10b981' }} />
            Chantiers à facturer
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{data.aFacturer.length} chantier{data.aFacturer.length !== 1 ? 's' : ''}</span>
          </div>
          {data.aFacturer.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Tous les chantiers sont à jour</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto' }}>
              {data.aFacturer.map(c => (
                <div key={c.id} style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nom}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.clientNom}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>CHF {fmt(c.potentiel)}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>à facturer</div>
                      </div>
                      {onEmettreFacture && (
                        <button
                          onClick={() => onEmettreFacture(c)}
                          style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700, background: '#10b981', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                        >
                          Créer la facture d'avancement →
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                      <span>Avancement {c.avancement}%</span>
                      <span>CA signé {fmt(c.ca)}</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--border-glass)', borderRadius: 4 }}>
                      <div style={{ height: '100%', width: `${c.avancement}%`, background: 'linear-gradient(90deg, #10b981, #059669)', borderRadius: 4 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Extras à facturer ── */}
      {data.extrasAFacturer.length > 0 && (
        <div style={{ background: 'var(--surface-glass)', border: `1px solid ${V1.bleuClair}`, borderRadius: 16, padding: '20px 22px', marginTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={14} style={{ color: V1.bleu }} />
            Extras à facturer
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
              {data.extrasAFacturer.length} extra{data.extrasAFacturer.length !== 1 ? 's' : ''} — Total HT CHF {fmt(data.totalExtrasAFacturer)}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
            {data.extrasAFacturer.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: V1.bleuFond, border: `1px solid ${V1.bleuClair}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {e.chantierNom} · {e.mode === 'forfait' ? 'forfait' : `${e.heures}h × CHF ${e.tarifHeure}/h`}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginRight: onEmettreExtra ? 12 : 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: V1.bleu }}>CHF {fmt(e.montant)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>HT</div>
                </div>
                {onEmettreExtra && (
                  <button
                    onClick={() => onEmettreExtra(e)}
                    style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700, background: V1.bleu, color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    Facturer →
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Performance globale (toujours rempli s'il y a des factures) ── */}
      {data.nbFactures > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={15} style={{ color: '#0d3d6e' }} />
            Performance globale
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>(toutes périodes confondues)</span>
          </div>

          {/* KPIs cumulés */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'CA facturé total',    val: `CHF ${fmt(data.caTotalFacture)}`,  couleur: '#0d3d6e', Icon: FileText,   sub: `${data.nbFactures} facture${data.nbFactures !== 1 ? 's' : ''}`, desc: 'Σ montantTTC de toutes les factures émises' },
              { label: 'Total payé',          val: `CHF ${fmt(data.encaisseTotal)}`,    couleur: '#10b981', Icon: DollarSign, sub: `Taux ${data.tauxEncaissement}%`, desc: 'Σ paiements reçus / CA facturé × 100' },
              { label: 'Montant moyen par facture', val: `CHF ${fmt(data.ticketMoyen)}`,      couleur: V1.bleu, Icon: TrendingUp, sub: 'par facture', desc: 'CA total ÷ nombre de factures émises' },
              { label: 'Temps moyen avant paiement', val: data.delaiMoyen !== null ? `${data.delaiMoyen} j` : '—', couleur: '#f59e0b', Icon: Clock, sub: data.delaiMoyen !== null ? 'sur factures payées' : 'pas encore de données', desc: 'Moy. jours entre émission et encaissement' },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--ds-card-bg)', border: '1px solid var(--ds-card-border)', borderRadius: 14, padding: '18px 20px', boxShadow: 'var(--ds-card-shadow)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: k.couleur + '14', border: `1px solid ${k.couleur}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <k.Icon size={16} style={{ color: k.couleur }} strokeWidth={2} />
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>{k.label}</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px', lineHeight: 1.1 }}>{k.val}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{k.sub}</div>
                {k.desc && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, fontStyle: 'italic', opacity: 0.75 }}>{k.desc}</div>}
              </div>
            ))}
          </div>

          {/* Top clients + Top chantiers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ background: 'var(--surface-glass)', border: '1px solid var(--border-glass)', borderRadius: 16, padding: '20px 22px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <DollarSign size={14} style={{ color: '#0d3d6e' }} />
                Top clients par CA facturé
              </div>
              {data.topClients.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Aucun client facturé</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.topClients.map((cl, i) => {
                    const pct = data.caTotalFacture > 0 ? (cl.ca / data.caTotalFacture) * 100 : 0;
                    return (
                      <div key={i} style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span style={{ color: '#0d3d6e', fontWeight: 800, marginRight: 6 }}>#{i + 1}</span>{cl.nom}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cl.nb} facture{cl.nb > 1 ? 's' : ''}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#0d3d6e' }}>CHF {fmt(cl.ca)}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{Math.round(pct)}% du CA facturé</div>
                          </div>
                        </div>
                        <div style={{ height: 4, background: 'var(--border-glass)', borderRadius: 4 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #0d3d6e, #082d52)', borderRadius: 4 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ background: 'var(--surface-glass)', border: '1px solid var(--border-glass)', borderRadius: 16, padding: '20px 22px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={14} style={{ color: '#10b981' }} />
                Top chantiers par CA facturé
              </div>
              {data.topChantiers.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Aucun chantier facturé</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.topChantiers.map((ch, i) => {
                    const pct = data.caTotalFacture > 0 ? (ch.ca / data.caTotalFacture) * 100 : 0;
                    return (
                      <div key={i} style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span style={{ color: '#10b981', fontWeight: 800, marginRight: 6 }}>#{i + 1}</span>{ch.nom}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>CHF {fmt(ch.ca)}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{Math.round(pct)}% du CA facturé</div>
                          </div>
                        </div>
                        <div style={{ height: 4, background: 'var(--border-glass)', borderRadius: 4 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #10b981, #059669)', borderRadius: 4 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Finances({
  factures = [], onSave,
  clients = [], chantiers = [], devis = [],
  naviguer, contexte = {}, profil,
  periodeGlobale = 'mois',
  parametres = null,
  pointages = [],
}) {
  const { confirmer, afficherNotif, ouvrirMenu, setPeriodeGlobale = () => {} } = useApp();
  const [onglet, setOnglet] = useState('tresorerie');
  const [preRemplirFacture, setPreRemplirFacture] = useState(null);
  // Signal incrémental → demande d'ouverture du formulaire « Nouvelle facture » (bouton du hero).
  const [nouvelleFactureSignal, setNouvelleFactureSignal] = useState(0);

  // La page passe en « hero plein écran » (Topbar blanc masqué) comme Accueil / Chantiers / fiche.
  useLayoutEffect(() => {
    document.body.classList.add('hero-fullscreen');
    return () => document.body.classList.remove('hero-fullscreen');
  }, []);

  // Ouverture directe d'un onglet via naviguer('finances', { onglet: 'paiements' })
  // (ex. clic sur une alerte de paiement). Ids valides = les 4 onglets de Finances.
  React.useEffect(() => {
    const cible = contexte?.onglet;
    if (cible && ['tresorerie', 'factures', 'relances'].includes(cible)) setOnglet(cible);
  }, [contexte?.onglet]);

  // Déclenchement depuis ChantierDetail via naviguer('finances', { preRemplirExtra: {...} })
  React.useEffect(() => {
    if (!contexte?.preRemplirExtra) return;
    setPreRemplirFacture(contexte.preRemplirExtra);
    setOnglet('factures');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contexte?.preRemplirExtra]);

  const onEmettreExtra = useCallback((extra) => {
    const tvaDefaut = tauxTVAParam(parametres);
    const lignes = extra.mode === 'forfait'
      ? [{ description: extra.description, quantite: 1, prixUnitaire: parseFloat(extra.montantForfait) || 0, tva: tvaDefaut }]
      : [{ description: extra.description, quantite: parseFloat(extra.heures) || 0, prixUnitaire: parseFloat(extra.tarifHeure) || 0, tva: tvaDefaut }];
    setPreRemplirFacture({
      chantierId: String(extra.chantierId),
      devisId: extra.devisId || '',
      clientId: extra.clientId || '',
      type: 'standard',
      objet: `Extra — ${extra.description}`,
      extraId: String(extra.id),
      lignes,
    });
    setOnglet('factures');
  }, [parametres]);

  const onEmettreFacture = useCallback((chantierData) => {
    const chantierObj = chantiers.find(ch => String(ch.id) === String(chantierData.id));
    const situationNum = factures.filter(
      f => String(f.chantierId) === String(chantierData.id) && f.type === 'situation' && f.statut !== 'annulee'
    ).length + 1;
    setPreRemplirFacture({
      chantierId: String(chantierData.id),
      devisId: chantierObj?.devisId || '',
      clientId: chantierObj?.clientId || '',
      type: 'situation',
      objet: `Facture d'avancement n°${situationNum} — ${chantierData.nom}`,
      lignes: [{
        description: `Facture d'avancement n°${situationNum} — avancement ${Math.round(chantierData.avancement)}%`,
        quantite: 1,
        prixUnitaire: Math.round(chantierData.potentiel * 100) / 100,
        tva: tauxTVAParam(parametres),
      }],
    });
    setOnglet('factures');
  }, [chantiers, factures, parametres]);

  // ── Exclure les factures orphelines (chantier, devis ou client supprimé, ou sans ancrage) ──
  const facturesOrphelines = useMemo(() =>
    factures.filter(f => {
      // Facture sans chantierId ni devisId = orpheline (pas d'ancrage dans le portefeuille)
      if (!f.chantierId && !f.devisId) return true;
      if (f.chantierId && !chantiers.some(ch => String(ch.id) === String(f.chantierId))) return true;
      if (f.devisId   && !devis.some(d   => String(d.id)   === String(f.devisId)))   return true;
      if (f.clientId  && !clients.some(cl => String(cl.id)  === String(f.clientId)))  return true;
      return false;
    })
  , [factures, chantiers, devis, clients]);

  const facturesValides = useMemo(() =>
    factures.filter(f => !facturesOrphelines.some(o => o.id === f.id))
  , [factures, facturesOrphelines]);

  // Wrapper onSave : réintègre les orphelines pour ne pas les écraser silencieusement
  const onSaveFactures = useCallback((nouvellesValides) => {
    const orphelines = factures.filter(f => facturesOrphelines.some(o => o.id === f.id));
    onSave([...orphelines, ...nouvellesValides]);
  }, [factures, facturesOrphelines, onSave]);

  // ── Factures filtrées par période ────────────────────────────
  const facturesPeriode = useMemo(() => {
    const { debut, fin } = getIntervallesPeriode(periodeGlobale);
    return facturesValides.filter(f => facturesInPeriode(f, debut, fin));
  }, [facturesValides, periodeGlobale]);

  // ── KPIs synthèse globale (toutes périodes — cohérent avec onglet Trésorerie) ─
  const kpis = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    // Exclure brouillons (non envoyés) et annulées — seules les factures réelles comptent
    const actives = facturesValides
      .filter(f => f.statut !== 'annulee' && f.statut !== 'brouillon')
      .map(f => ({ ...f, statutCalc: calculerStatutFacture(f) }));
    const totalFacture  = actives.reduce((s, f) => s + (parseFloat(f.montantTTC) || 0), 0);
    const totalPaye     = actives.reduce((s, f) => s + Math.min(parseFloat(f.montantPaye)||0, parseFloat(f.montantTTC)||0), 0);
    const enAttente     = actives
      .filter(f => f.statutCalc !== 'payee' && !(f.dateEcheance && f.dateEcheance < today))
      .reduce((s, f) => s + Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0)), 0);
    const enRetard = actives
      .filter(f => f.statutCalc !== 'payee' && f.dateEcheance && f.dateEcheance < today)
      .reduce((s, f) => s + Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0)), 0);
    return { totalFacture, totalPaye, enAttente, enRetard };
  }, [facturesValides]);

  // Nombre de factures nécessitant une relance (badge rouge onglet Relances)
  const nbRelances = useMemo(() =>
    factures.filter(f => prochainRappel(f) !== null).length,
    [factures]
  );

  // KPIs relances (mêmes fonctions que RelancesTab) — pour le bandeau adaptatif du hero.
  const relancesKpis = useMemo(() => {
    const aRelancer = factures.map(f => ({ f, prochaine: prochainRappel(f) })).filter(x => x.prochaine !== null);
    return {
      nbARelancer: aRelancer.length,
      montantImpaye: aRelancer.reduce((s, { f }) => s + soldeRestantFacture(f), 0),
      nb1erRappel: aRelancer.filter(x => x.prochaine.niveau === 1).length,
      nbMiseEnDemeure: aRelancer.filter(x => x.prochaine.niveau === 3).length,
    };
  }, [factures]);

  const tabs = [
    { id: 'tresorerie', label: 'Trésorerie',          count: null,    badgeRouge: false },
    { id: 'factures',   label: 'Factures',            count: facturesPeriode.filter(f => f.statut !== 'annulee').length, badgeRouge: false },
    { id: 'relances',   label: 'Relances',            count: nbRelances > 0 ? nbRelances : null, badgeRouge: nbRelances > 0 },
  ];

  // ── Les 4 chiffres du hero s'ADAPTENT à l'onglet actif ──
  const heroChiffres = onglet === 'relances'
    ? [
        { label: 'À RELANCER',      val: String(relancesKpis.nbARelancer),           couleur: '#F5B14A' },
        { label: 'MONTANT IMPAYÉ',  val: `CHF ${fmt(relancesKpis.montantImpaye)}`,    couleur: '#FF7A6B' },
        { label: '1ER RAPPEL',      val: String(relancesKpis.nb1erRappel),           couleur: '#8FBCE6' },
        { label: 'MISE EN DEMEURE', val: String(relancesKpis.nbMiseEnDemeure),       couleur: '#C88BF0' },
      ]
    : [
        { label: 'TOTAL FACTURÉ', val: `CHF ${fmt(kpis.totalFacture)}`, couleur: '#8FBCE6' },
        { label: 'TOTAL PAYÉ',    val: `CHF ${fmt(kpis.totalPaye)}`,    couleur: '#4ADE80' },
        { label: 'EN ATTENTE',    val: `CHF ${fmt(kpis.enAttente)}`,    couleur: '#F5B14A' },
        { label: 'EN RETARD',     val: `CHF ${fmt(kpis.enRetard)}`,     couleur: '#FF7A6B' },
      ];

  const PERIODES = [{ id: 'semaine', label: 'Cette semaine' }, { id: 'mois', label: 'Ce mois' }, { id: 'annee', label: 'Cette année' }];

  // setFactures pour RelancesTab : met à jour dans le tableau COMPLET (orphelines incluses)
  const setFacturesRelances = useCallback((updater) => {
    onSave(typeof updater === 'function' ? updater(factures) : updater);
  }, [factures, onSave]);

  return (
    <div>
      {/* ══ HERO BLEU NUIT (design v1, bord à bord, collé au sommet) ══ */}
      <div className="page-hero-bleed" data-testid="hero-finances"
        style={{ ...heroFond, padding: '20px 32px 0', position: 'relative' }}>

        {/* Ligne 1 — ☰ · CYNA · FINANCES / 03 · période · sélecteur + Nouvelle facture */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          {ouvrirMenu && (
            <button onClick={ouvrirMenu} aria-label="Menu" style={{ ...heroBtn, padding: 7 }}><Menu size={16} /></button>
          )}
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: '0.06em', color: '#fff' }}>CYNA</span>
          <span style={heroMono(10, 0.55)}>· FINANCES / 03 · {getPeriodeLabel(periodeGlobale).toUpperCase()}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <select value={periodeGlobale} onChange={e => setPeriodeGlobale(e.target.value)} aria-label="Période"
              style={{ ...heroBtn, padding: '6px 8px' }}>
              {PERIODES.map(p => <option key={p.id} value={p.id} style={{ color: '#16233A' }}>{p.label}</option>)}
            </select>
            <button onClick={() => { setOnglet('factures'); setNouvelleFactureSignal(n => n + 1); }}
              style={{ ...heroBtn, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 700 }}>
              <Plus size={14} /> Nouvelle facture
            </button>
          </div>
        </div>

        {/* Ligne 2 — titre + ligne mono */}
        <div style={heroMono(11, 0.6)}>FINANCES / 03</div>
        <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 34, margin: '8px 0 8px', letterSpacing: '-0.02em', color: '#fff' }}>Finances</h1>
        <div style={heroMono(11, 0.7)}>FACTURES · PAIEMENTS · SUIVI FINANCIER</div>

        {/* Ligne 3 — les 4 chiffres clés (adaptés à l'onglet) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 20 }} data-testid="hero-chiffres">
          {heroChiffres.map(t => (
            <div key={t.label} data-testid={`hero-kpi-${t.label.toLowerCase().replace(/\s+/g, '-')}`}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={heroMono(9, 0.6)}>{t.label}</div>
              <div style={{ ...mono(22, t.couleur, 500), lineHeight: 1.1, marginTop: 4 }}>{t.val}</div>
            </div>
          ))}
        </div>

        {/* Ligne 4 — onglets collés au bas du hero (avec compteurs) */}
        <div style={{ display: 'flex', gap: 2, marginTop: 22, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {tabs.map(t => {
            const actif = onglet === t.id;
            return (
              <button key={t.id} onClick={() => setOnglet(t.id)} style={{
                background: 'transparent', border: 'none',
                borderBottom: actif ? '2px solid #fff' : '2px solid transparent',
                color: actif ? '#fff' : 'rgba(255,255,255,0.6)',
                padding: '10px 18px', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14, fontWeight: actif ? 700 : 500, whiteSpace: 'nowrap', flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {t.label}
                {t.count !== null && (
                  <span style={{
                    background: t.badgeRouge ? 'rgba(255,122,107,0.25)' : 'rgba(255,255,255,0.16)',
                    color: t.badgeRouge ? '#FF7A6B' : '#fff',
                    border: t.badgeRouge ? '1px solid rgba(255,122,107,0.5)' : '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700,
                  }}>{t.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Alerte données orphelines ── */}
      {facturesOrphelines.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderRadius: 12, marginBottom: 18, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderLeft: '4px solid #ef4444' }}>
          <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>
            <strong>{facturesOrphelines.length} facture{facturesOrphelines.length > 1 ? 's' : ''} sans chantier ni devis rattaché</strong>
            {' '}— le chantier ou le devis lié a été supprimé. Ces montants sont exclus des totaux.
          </div>
          <button
            onClick={async () => { if (await confirmer(`Supprimer définitivement ${facturesOrphelines.length} facture(s) orpheline(s) ?\n\nCette action est irréversible.`, { labelOui: 'Supprimer' })) onSave(factures.filter(f => !facturesOrphelines.some(o => o.id === f.id))); }}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
          >
            Supprimer
          </button>
        </div>
      )}

      {/* ── Alertes retard ── */}
      {kpis.enRetard > 0 && (() => {
        const today = new Date().toISOString().slice(0, 10);
        const nbRetard = facturesValides.filter(f =>
          f.statut !== 'payee' && f.statut !== 'annulee' && f.dateEcheance && f.dateEcheance < today
        ).length;
        return (
          <div className="alert-banner alert-banner-danger" style={{ marginBottom: 20 }}>
            <strong>{nbRetard} facture{nbRetard > 1 ? 's' : ''} en retard</strong>
            {' — '}CHF {fmt(kpis.enRetard)} impayé{nbRetard > 1 ? 's' : ''}. Consultez l'onglet Factures pour les détails.
          </div>
        );
      })()}

      {/* ── Contenu ── */}
      {onglet === 'tresorerie' && (
        <Tresorerie factures={facturesValides} chantiers={chantiers} clients={clients} devis={devis} parametres={parametres} onEmettreFacture={onEmettreFacture} onEmettreExtra={onEmettreExtra} pointages={pointages} />
      )}
      <div style={{ display: onglet === 'factures' ? 'block' : 'none' }}>
        <Factures
          factures={facturesValides}
          onSave={onSaveFactures}
          clients={clients}
          chantiers={chantiers}
          devis={devis}
          naviguer={naviguer}
          profil={profil}
          periodeGlobale={periodeGlobale}
          parametres={parametres}
          hideHeader
          preRemplir={preRemplirFacture}
          onConsumePreRemplir={() => setPreRemplirFacture(null)}
          nouvelleFactureSignal={nouvelleFactureSignal}
        />
      </div>
      {onglet === 'relances' && (
        <RelancesTab
          factures={factures}
          clients={clients}
          chantiers={chantiers}
          setFactures={setFacturesRelances}
          afficherNotif={afficherNotif}
        />
      )}
    </div>
  );
}
