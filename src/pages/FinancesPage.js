// ============================================================
// CYNA — MODULE FINANCES (Factures + Paiements unifiés)
// ============================================================
import React, { useState, useMemo, useCallback } from 'react';
import { DollarSign, FileText, Clock, AlertTriangle, CreditCard, TrendingUp, Calendar, Zap } from 'lucide-react';
import Factures from '../Factures';
import Paiements from '../Paiements';
import { getIntervallesPeriode, getPeriodeLabel, facturesInPeriode, calculerCA } from '../donnees';

const fmt  = (n) => (parseFloat(n) || 0).toLocaleString('fr-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtK = (n) => { const v = parseFloat(n) || 0; return v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(Math.round(v)); };

// ── Composant Trésorerie prévisionnelle ──────────────────────────────────────
function Tresorerie({ factures = [], chantiers = [], clients = [], devis = [] }) {
  const today = new Date(); today.setHours(0,0,0,0);

  const data = useMemo(() => {
    // ── 1. Factures impayées classées par urgence ────────────────
    const impayees = factures
      .filter(f => f.statut !== 'annulee' && f.statut !== 'payee')
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
    const aFacturer = chantiers
      .filter(c => ['en cours', 'terminé', 'planifié'].includes(c.statut?.trim().toLowerCase()) && c.devisId)
      .map(c => {
        const ca = calculerCA(c, devis);
        if (!ca || ca <= 0) return null;
        const avancement = parseFloat(c.avancement) || 0;
        const facturesChantier = factures.filter(f => String(f.chantierId) === String(c.id) && f.statut !== 'annulee');
        const dejaFacture = facturesChantier.reduce((s, f) => s + (parseFloat(f.montantTTC)||0), 0);
        const potentiel = Math.max(0, (ca * avancement / 100) - dejaFacture);
        if (potentiel < 500) return null;
        const client = clients.find(cl => String(cl.id) === String(c.clientId));
        return { id: c.id, nom: c.nom || c.numero, clientNom: client?.entreprise || client?.nom || '—', avancement, ca, dejaFacture, potentiel };
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
      .filter(f => f.statut === 'payee' && (f.dateEmission || f.dateFacture || f.creeLe) && (f.paiementsHistorique || []).length > 0)
      .map(f => {
        const last = [...f.paiementsHistorique].sort((a, b) => (a.date || '').localeCompare(b.date || '')).pop();
        if (!last?.date) return null;
        const dateRef = f.dateEmission || f.dateFacture || f.creeLe;
        const d = Math.round((new Date(last.date) - new Date(dateRef)) / 86400000);
        return d >= 0 ? d : null;
      })
      .filter(d => d !== null);
    const delaiMoyen = delais.length > 0 ? Math.round(delais.reduce((s, d) => s + d, 0) / delais.length) : null;

    // Top clients par CA
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

    return {
      impayees, aFacturer, semaines, maxSemaine,
      totalAEncaisser, totalRetard, totalCetteSemaine, totalAFacturer, total60j, signalCash,
      caTotalFacture, encaisseTotal, nbFactures, ticketMoyen, tauxEncaissement, delaiMoyen,
      topClients, topChantiers,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factures, chantiers, clients, devis]);

  const urgenceConfig = {
    retard:  { couleur: '#ef4444', bg: '#ef444410', label: 'En retard',    dot: 'red' },
    urgent:  { couleur: '#f59e0b', bg: '#f59e0b10', label: '≤ 7 jours',   dot: 'yellow' },
    proche:  { couleur: '#3b82f6', bg: '#3b82f610', label: '≤ 30 jours',  dot: '●' },
    normal:  { couleur: '#6b7280', bg: '#6b728010', label: '> 30 jours',  dot: '○' },
  };

  const signalConfig = {
    danger:  { couleur: '#ef4444', bg: '#ef444412', icone: 'danger', texte: 'Encaissements critiques en retard — relancer immédiatement' },
    warning: { couleur: '#f59e0b', bg: '#f59e0b12', icone: 'warning', texte: 'Des paiements arrivent bientôt — anticiper les relances' },
    ok:      { couleur: '#10b981', bg: '#10b98112', icone: '',  texte: 'Situation cash saine — aucune urgence détectée' },
  };
  const signal = signalConfig[data.signalCash];

  return (
    <div>
      {/* ── Signal global ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderRadius: 14, marginBottom: 24, background: signal.bg, border: `1px solid ${signal.couleur}30`, borderLeft: `4px solid ${signal.couleur}` }}>
        <span style={{ fontSize: 20 }}>{signal.icone}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: signal.couleur }}>{signal.texte}</span>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'À encaisser (total)', val: `CHF ${fmt(data.totalAEncaisser)}`, couleur: '#3b82f6', Icon: Clock,       sub: `${data.impayees.length} facture${data.impayees.length !== 1 ? 's' : ''} impayée${data.impayees.length !== 1 ? 's' : ''} en cours`, desc: 'Solde restant à recevoir sur toutes les factures ouvertes' },
          { label: 'En retard',           val: `CHF ${fmt(data.totalRetard)}`,     couleur: '#ef4444', Icon: AlertTriangle, sub: data.totalRetard > 0 ? 'Action immédiate requise' : 'Aucun retard', desc: 'Factures dont la date d\'échéance est dépassée' },
          { label: 'Cette semaine',       val: `CHF ${fmt(data.totalCetteSemaine)}`,couleur: '#f59e0b', Icon: Zap,          sub: 'Échéances dans les 7 prochains jours', desc: 'Montant à encaisser d\'ici 7 jours' },
          { label: 'À facturer (potentiel)',val: `CHF ${fmt(data.totalAFacturer)}`,couleur: '#10b981', Icon: TrendingUp,   sub: `${data.aFacturer.length} chantier${data.aFacturer.length !== 1 ? 's' : ''} — selon avancement`, desc: 'CA × avancement% − déjà facturé, sur chantiers actifs' },
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
            {k.desc && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic', opacity: 0.75 }}>{k.desc}</div>}
          </div>
        ))}
      </div>

      {/* ── Timeline 8 semaines ── */}
      <div style={{ background: 'var(--surface-glass)', border: '1px solid var(--border-glass)', borderRadius: 16, padding: '22px 24px', marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={15} style={{ color: '#3b82f6' }} />
          Encaissements prévus — 8 semaines
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 100 }}>
          {data.semaines.map((s, i) => {
            const pct = data.maxSemaine > 0 ? (s.montant / data.maxSemaine) * 100 : 0;
            const hasData = s.montant > 0;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                {hasData && (
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6' }}>{fmtK(s.montant)}</div>
                )}
                <div style={{ width: '100%', flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ width: '100%', height: hasData ? `${Math.max(pct, 6)}%` : '4px', background: hasData ? `linear-gradient(180deg, #3b82f6, #1d4ed8)` : 'var(--border-glass)', borderRadius: '4px 4px 0 0', transition: 'height 0.3s', minHeight: 4 }} />
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.label}</div>
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
                    <span style={{ fontSize: 13 }}>{cfg.dot}</span>
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
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>CHF {fmt(c.potentiel)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>à facturer</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                      <span>Avancement {c.avancement}%</span>
                      <span>CA {fmt(c.ca)}</span>
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

      {/* ── Performance globale (toujours rempli s'il y a des factures) ── */}
      {data.nbFactures > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={15} style={{ color: '#3b82f6' }} />
            Performance globale
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>(toutes périodes confondues)</span>
          </div>

          {/* KPIs cumulés */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'CA facturé total',    val: `CHF ${fmt(data.caTotalFacture)}`,  couleur: '#3b82f6', Icon: FileText,   sub: `${data.nbFactures} facture${data.nbFactures !== 1 ? 's' : ''}` },
              { label: 'Encaissé total',      val: `CHF ${fmt(data.encaisseTotal)}`,    couleur: '#10b981', Icon: DollarSign, sub: `Taux ${data.tauxEncaissement}%` },
              { label: 'Ticket moyen',        val: `CHF ${fmt(data.ticketMoyen)}`,      couleur: '#8b5cf6', Icon: TrendingUp, sub: 'par facture' },
              { label: 'Délai paiement moyen', val: data.delaiMoyen !== null ? `${data.delaiMoyen} j` : '—', couleur: '#f59e0b', Icon: Clock, sub: data.delaiMoyen !== null ? 'sur factures payées' : 'pas encore de données' },
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
              </div>
            ))}
          </div>

          {/* Top clients + Top chantiers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ background: 'var(--surface-glass)', border: '1px solid var(--border-glass)', borderRadius: 16, padding: '20px 22px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <DollarSign size={14} style={{ color: '#3b82f6' }} />
                Top clients par CA
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
                              <span style={{ color: '#3b82f6', fontWeight: 800, marginRight: 6 }}>#{i + 1}</span>{cl.nom}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cl.nb} facture{cl.nb > 1 ? 's' : ''}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#3b82f6' }}>CHF {fmt(cl.ca)}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{pct.toFixed(0)}% du CA</div>
                          </div>
                        </div>
                        <div style={{ height: 4, background: 'var(--border-glass)', borderRadius: 4 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)', borderRadius: 4 }} />
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
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{pct.toFixed(0)}% du CA</div>
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
  paiementsData = {}, setPaiementsData,
  naviguer, contexte = {}, profil,
  periodeGlobale = 'mois',
}) {
  const [onglet, setOnglet] = useState('tresorerie');

  // ── Exclure les factures orphelines (chantier, devis ou client supprimé) ──
  const facturesOrphelines = useMemo(() =>
    factures.filter(f => {
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

  // ── KPIs synthèse (filtrés par période) ─────────────────────
  const kpis = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const actives = facturesPeriode.filter(f => f.statut !== 'annulee');
    const totalFacture  = actives.reduce((s, f) => s + (parseFloat(f.montantTTC)  || 0), 0);
    const totalPaye     = actives.reduce((s, f) => s + Math.min(parseFloat(f.montantPaye)||0, parseFloat(f.montantTTC)||0), 0);
    const enAttente     = actives
      .filter(f => f.statut !== 'payee' && !(f.dateEcheance && f.dateEcheance < today))
      .reduce((s, f) => s + Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0)), 0);
    // "En retard" = toutes factures non payées avec échéance dépassée (toutes périodes confondues)
    const enRetard = facturesValides
      .filter(f => f.statut !== 'annulee' && f.statut !== 'payee' && f.dateEcheance && f.dateEcheance < today)
      .reduce((s, f) => s + Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0)), 0);
    return { totalFacture, totalPaye, enAttente, enRetard };
  }, [facturesPeriode, facturesValides]);

  const tabs = [
    { id: 'tresorerie', label: 'Trésorerie',          count: null },
    { id: 'factures',   label: 'Factures',            count: facturesPeriode.filter(f => f.statut !== 'annulee').length },
    { id: 'paiements',  label: 'Paiements chantiers', count: null },
  ];

  return (
    <div>
      {/* ── En-tête ── */}
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Finances</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {getPeriodeLabel(periodeGlobale)} — Factures, paiements et suivi financier
          </div>
        </div>
      </div>

      {/* ── Alerte données orphelines ── */}
      {facturesOrphelines.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderRadius: 12, marginBottom: 18, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderLeft: '4px solid #ef4444' }}>
          <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>
            <strong>{facturesOrphelines.length} facture{facturesOrphelines.length > 1 ? 's' : ''} orpheline{facturesOrphelines.length > 1 ? 's' : ''}</strong>
            {' '}— liée{facturesOrphelines.length > 1 ? 's' : ''} à un chantier ou devis supprimé. Ces montants sont exclus des calculs.
          </div>
          <button
            onClick={() => { if (window.confirm(`Supprimer définitivement ${facturesOrphelines.length} facture(s) orpheline(s) ?`)) onSave(factures.filter(f => !facturesOrphelines.some(o => o.id === f.id))); }}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
          >
            Supprimer
          </button>
        </div>
      )}

      {/* ── KPIs résumé — gradients saturés (identiques Dashboard) ── */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'var(--g4)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Total facturé',  val: `CHF ${fmt(kpis.totalFacture)}`,  sub: 'Montant émis sur la période', gradient: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)', glow: 'rgba(59,130,246,0.32)',   Icon: FileText },
          { label: 'Total encaissé', val: `CHF ${fmt(kpis.totalPaye)}`,     sub: 'Paiements reçus des clients',  gradient: 'linear-gradient(135deg, #065F46 0%, #10B981 100%)', glow: 'rgba(16,185,129,0.32)',  Icon: DollarSign },
          { label: 'En attente',     val: `CHF ${fmt(kpis.enAttente)}`,     sub: 'Pas encore échu',              gradient: 'linear-gradient(135deg, #92400E 0%, #F59E0B 100%)', glow: 'rgba(245,158,11,0.32)', Icon: Clock },
          { label: 'En retard',      val: `CHF ${fmt(kpis.enRetard)}`,      sub: 'Échéance dépassée — à relancer', gradient: 'linear-gradient(135deg, #991B1B 0%, #EF4444 100%)', glow: 'rgba(239,68,68,0.32)',   Icon: AlertTriangle },
        ].map(k => (
          <div key={k.label} className="kpi-card" style={{
            background: k.gradient, borderRadius: 16, padding: '22px 20px', minHeight: 130,
            boxShadow: `0 4px 20px ${k.glow}, 0 1px 4px rgba(0,0,0,0.12)`,
            border: '1px solid rgba(255,255,255,0.15)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', right: -18, top: -18, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ position: 'absolute', right: -32, bottom: -32, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, position: 'relative' }}>
              <k.Icon size={18} strokeWidth={2} style={{ color: '#ffffff' }} />
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.72)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>{k.label}</div>
            <div className="kpi-val" style={{ fontSize: 26, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.8px', lineHeight: 1, position: 'relative' }}>{k.val}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 8, position: 'relative' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Alertes retard ── */}
      {kpis.enRetard > 0 && (() => {
        const today = new Date().toISOString().slice(0, 10);
        const nbRetard = facturesPeriode.filter(f =>
          f.statut !== 'payee' && f.statut !== 'annulee' && f.dateEcheance && f.dateEcheance < today
        ).length;
        return (
          <div className="alert-banner alert-banner-danger" style={{ marginBottom: 20 }}>
            <strong>{nbRetard} facture{nbRetard > 1 ? 's' : ''} en retard</strong>
            {' — '}CHF {fmt(kpis.enRetard)} impayé{nbRetard > 1 ? 's' : ''}. Consultez l'onglet Factures pour les détails.
          </div>
        );
      })()}

      {/* ── Navigation onglets ── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border-glass)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setOnglet(t.id)} style={{
            background: 'transparent', border: 'none',
            borderBottom: `2px solid ${onglet === t.id ? 'rgba(59,130,246,0.8)' : 'transparent'}`,
            color: onglet === t.id ? '#60a5fa' : 'var(--text-secondary)',
            padding: '10px 22px', fontSize: 14,
            fontWeight: onglet === t.id ? 700 : 500,
            cursor: 'pointer', transition: 'all 0.18s',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {t.label}
            {t.count !== null && (
              <span style={{ background: 'var(--border-glass-strong)', borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Contenu ── */}
      {onglet === 'tresorerie' && (
        <Tresorerie factures={facturesPeriode} chantiers={chantiers} clients={clients} devis={devis} />
      )}
      <div style={{ display: onglet === 'factures' ? 'block' : 'none' }}>
        <Factures
          factures={facturesValides}
          onSave={onSaveFactures}
          clients={clients}
          chantiers={chantiers}
          devis={devis}
          paiementsData={paiementsData}
          setPaiementsData={setPaiementsData}
          naviguer={naviguer}
          profil={profil}
          periodeGlobale={periodeGlobale}
          hideHeader
        />
      </div>
      <div style={{ display: onglet === 'paiements' ? 'block' : 'none' }}>
        <Paiements
          chantiers={chantiers}
          clients={clients}
          paiementsData={paiementsData}
          setPaiementsData={setPaiementsData}
          hideHeader
        />
      </div>
    </div>
  );
}
