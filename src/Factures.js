// ============================================================
// CYNA — MODULE FACTURES v2
// clientId obligatoire, chantierId optionnel
// type: 'acompte' | 'situation' | 'finale' | 'standard'
// source: 'devis' | 'chantier' | 'manuel'
// statut: 'brouillon' | 'envoyee' | 'partielle' | 'payee' | 'retard' | 'annulee'
// ============================================================

import React, { useState, useMemo } from 'react';
import { FileDown, Download } from 'lucide-react';
import { DS } from './ds';
import { exportCSV } from './utils/exportCSV';
import { fmtN, getIntervallesPeriode, facturesInPeriode, genererNumeroFacture, calculerStatutFacture } from './donnees';
import { prochainRappel, niveauInfo, genererTexteRappel, marquerRappelEnvoye } from './relances';
import { exportFicheChantier, exportFacture } from './ExportPDF';

// ── TVA suisse ───────────────────────────────────────────────
const TVA_OPTIONS = [
  { label: '8.1% — Standard',      value: 8.1 },
  { label: '2.5% — Réduit',        value: 2.5 },
  { label: '3.7% — Hébergement',   value: 3.7 },
  { label: '0% — Exonéré',         value: 0   },
];

// ── Labels d'affichage ───────────────────────────────────────
const STATUT_LABELS = {
  brouillon:  'Brouillon',
  envoyee:    'Envoyée',
  partielle:  'Partielle',
  payee:      'Payée',
  retard:     'En retard',
  annulee:    'Annulée',
};

const TYPE_LABELS = {
  acompte:   'Acompte',
  situation: 'Situation',
  finale:    'Finale',
  standard:  'Standard',
};

const SOURCE_LABELS = {
  devis:    'Depuis devis',
  chantier: 'Depuis chantier',
  manuel:   'Manuelle',
};

// ── Couleurs statuts ─────────────────────────────────────────
const STATUT_COLORS = {
  brouillon:  { bg: 'rgba(139,92,246,0.12)',  text: '#8b5cf6' },
  envoyee:    { bg: 'rgba(13,61,110,0.12)',   text: '#0d3d6e' },
  partielle:  { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' },
  payee:      { bg: 'rgba(16,185,129,0.12)', text: '#10b981' },
  retard:     { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444' },
  annulee:    { bg: 'rgba(100,100,100,0.12)',text: '#6b7280' },
};

// ── Styles partagés — Design System CYNA ────────────────────
const S = {
  card:       DS.card,
  th:         DS.th,
  td:         DS.td,
  input:      DS.input,
  label:      DS.label,
  btnPrimary: DS.btnPrimary,
  btnSuccess: DS.btnSuccess,
  btnDanger:  DS.btnDanger,
  btnGhost:   DS.btnGhost,
};

// ── Badge statut ─────────────────────────────────────────────
function BadgeStatut({ statut }) {
  const c = STATUT_COLORS[statut] || STATUT_COLORS.brouillon;
  return (
    <span style={{
      background: c.bg, color: c.text,
      padding: '4px 11px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
      border: `1px solid ${c.text}40`,
      letterSpacing: '0.2px',
    }}>
      {STATUT_LABELS[statut] || statut}
    </span>
  );
}

// ── KPI Card ─────────────────────────────────────────────────
function KpiCard({ label, value, couleur, icon, sous }) {
  return (
    <div className="premium-card" style={{
      ...S.card,
      flex: 1, minWidth: 180,
      background: `linear-gradient(145deg, ${couleur}12 0%, ${couleur}06 60%, rgba(255,255,255,0.025) 100%)`,
      border: `1px solid ${couleur}30`,
      boxShadow: `0 2px 8px rgba(0,0,0,0.3), 0 8px 28px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.09)`,
      overflow: 'hidden', position: 'relative',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 16, right: 16, height: 1, background: `linear-gradient(90deg, transparent, ${couleur}50 50%, transparent)` }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 10 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.8px' }}>{value}</div>
          {sous && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{sous}</div>}
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: `linear-gradient(135deg, ${couleur}30 0%, ${couleur}18 100%)`,
          border: `1px solid ${couleur}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
          boxShadow: `0 0 24px ${couleur}30, inset 0 1px 0 rgba(255,255,255,0.1)`,
        }}>{icon}</div>
      </div>
    </div>
  );
}

// ── COMPOSANT PRINCIPAL ──────────────────────────────────────
export default function Factures({ profil, clients = [], chantiers = [], devis = [], factures = [], onSave, paiementsData = {}, setPaiementsData, naviguer, hideHeader = false, periodeGlobale = 'mois', parametres = null }) {
  const [vue, setVue] = useState('liste');   // 'liste' | 'form' | 'detail'
  const [selected, setSelected] = useState(null);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [filtreType, setFiltreType] = useState('');
  const [recherche, setRecherche] = useState('');
  const [form, setForm] = useState(null);
  const [paiementModal, setPaiementModal] = useState(null); // facture sur laquelle on enregistre
  const [paiementForm, setPaiementForm] = useState({ montant: '', date: new Date().toISOString().slice(0, 10), note: '' });
  const [rappelModal, setRappelModal] = useState(null); // { facture, niveau, contenu }
  const [pageFact, setPageFact] = useState(0);
  const PAGE_SIZE_FACT = 50;

  const canEdit = ['cyna', 'cynatech'].includes(profil?.id);

  // ── Enregistrer un paiement depuis la facture ─────────────
  const enregistrerPaiement = () => {
    if (!paiementModal || !paiementForm.montant) return;
    const f = paiementModal;
    const montant = parseFloat(paiementForm.montant) || 0;
    if (montant <= 0) return;
    const restantDu = (f.montantTTC ?? 0) - (f.montantPaye ?? 0);
    if (montant > restantDu + 0.01) {
      alert(`Montant trop élevé. Solde restant : CHF ${restantDu.toFixed(2)}`);
      return;
    }

    // 1. Ajouter dans paiementsData (clé = chantierId ou 'misc')
    if (setPaiementsData) {
      const cle = f.chantierId || 'misc';
      const existants = paiementsData[cle] || [];
      const nouveau = {
        id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        montant,
        date: paiementForm.date,
        dateEcheance: paiementForm.date,
        type: 'Virement',
        statut: 'Payé',
        notes: paiementForm.note || `Paiement facture ${f.numero}`,
        factureId: f.id,
        chantierId: f.chantierId || null,
      };
      setPaiementsData({ ...paiementsData, [cle]: [...existants, nouveau] });
    }

    // 2. Mettre à jour montantPaye + statut + historique de la facture
    const entreeHistorique = { id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, montant, date: paiementForm.date, mode: 'Virement', note: paiementForm.note };
    const nouveauPaiements = [...(f.paiementsHistorique || []), entreeHistorique];
    const nouveauMontantPaye = nouveauPaiements.reduce((s, p) => s + (parseFloat(p.montant) || 0), 0);
    const restant = (parseFloat(f.montantTTC) || 0) - nouveauMontantPaye;
    const nouveauStatut = restant <= 0.01 ? 'payee' : 'partielle';
    const factureMAJ = {
      ...f,
      montantPaye: nouveauMontantPaye,
      statut: nouveauStatut,
      paiementsHistorique: nouveauPaiements,
    };
    onSave(factures.map(x => x.id === f.id ? factureMAJ : x));

    setPaiementModal(null);
    setPaiementForm({ montant: '', date: new Date().toISOString().slice(0, 10), note: '' });
    // Mettre à jour la vue détail si ouverte
    if (selected?.id === f.id) setSelected(factureMAJ);
  };

  // ── KPIs (filtrés par période, cohérents avec la liste) ──
  const kpis = useMemo(() => {
    const { debut, fin } = getIntervallesPeriode(periodeGlobale);
    const today = new Date().toISOString().slice(0, 10);
    // Base : factures de la période avec statut recalculé, hors annulées
    const base = factures
      .map(f => ({ ...f, statut: calculerStatutFacture(f) }))
      .filter(f => f.statut !== 'annulee' && facturesInPeriode(f, debut, fin));
    const totalFacture  = base.reduce((s, f) => s + (parseFloat(f.montantTTC)  || 0), 0);
    // Plafonner montantPaye à montantTTC pour éviter encaissé > facturé
    const totalEncaisse = base.reduce((s, f) => s + Math.min(parseFloat(f.montantPaye)||0, parseFloat(f.montantTTC)||0), 0);
    const totalRetard   = base
      .filter(f => f.statut === 'retard' || (f.statut !== 'payee' && f.dateEcheance && f.dateEcheance < today))
      .reduce((s, f) => s + Math.max(0, (parseFloat(f.montantTTC)||0) - Math.min(parseFloat(f.montantPaye)||0, parseFloat(f.montantTTC)||0)), 0);
    const nbBrouillon   = factures.filter(f => f.statut === 'brouillon').length;
    return { totalFacture, totalEncaisse, totalRetard, nbBrouillon };
  }, [factures, periodeGlobale]);

  // ── Filtrage (statut, type, recherche, période) ──────────
  const facturesFiltrees = useMemo(() => {
    const { debut, fin } = getIntervallesPeriode(periodeGlobale);
    return factures.map(f => ({ ...f, statut: calculerStatutFacture(f) })).filter(f => {
      if (!facturesInPeriode(f, debut, fin)) return false;
      if (filtreStatut && f.statut !== filtreStatut) return false;
      if (filtreType   && f.type   !== filtreType)   return false;
      if (recherche) {
        const q = recherche.toLowerCase();
        const client = clients.find(c => String(c.id) === String(f.clientId));
        const match =
          (f.numero || '').toLowerCase().includes(q) ||
          (client?.nom || '').toLowerCase().includes(q) ||
          (f.objet || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.dateEmission || b.creeLe || 0) - new Date(a.dateEmission || a.creeLe || 0));
  }, [factures, filtreStatut, filtreType, recherche, clients, periodeGlobale]);

  // Reset page quand les filtres changent
  React.useEffect(() => { setPageFact(0); }, [filtreStatut, filtreType, recherche, periodeGlobale]);

  const totalPagesFact = Math.ceil(facturesFiltrees.length / PAGE_SIZE_FACT);
  const facturesPage = facturesFiltrees.slice(pageFact * PAGE_SIZE_FACT, (pageFact + 1) * PAGE_SIZE_FACT);

  const fmt = (n) => fmtN(n, 2);

  // ── Ouvrir formulaire ────────────────────────────────────
  const ouvrirForm = (facture = null) => {
    if (facture) {
      setForm({ ...facture });
    } else {
      const dateEmissionDefaut = new Date().toISOString().slice(0, 10);
      const dateEcheanceDefaut = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      setForm({
        id: `fact_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        numero: genererNumeroFacture(factures),
        clientId: '',
        chantierId: '',
        devisId: '',
        type: 'standard',
        source: 'manuel',
        statut: 'brouillon',
        dateEmission: dateEmissionDefaut,
        dateEcheance: dateEcheanceDefaut,
        objet: '',
        lignes: [{ description: '', quantite: 1, prixUnitaire: 0, tva: 8.1 }],
        montantHT: 0,
        montantTVA: 0,
        montantTTC: 0,
        montantPaye: 0,
        notes: '',
        creeLe: new Date().toISOString(),
      });
    }
    setVue('form');
  };

  // ── Calcul totaux ────────────────────────────────────────
  const calculerTotaux = (lignes) => {
    const montantHT  = lignes.reduce((s, l) => s + (l.quantite * l.prixUnitaire), 0);
    const montantTVA = lignes.reduce((s, l) => s + (l.quantite * l.prixUnitaire * l.tva / 100), 0);
    return { montantHT, montantTVA, montantTTC: montantHT + montantTVA };
  };

  const updateLigne = (i, field, val) => {
    const lignes = form.lignes.map((l, idx) =>
      idx === i ? { ...l, [field]: field === 'description' ? val : parseFloat(val) || 0 } : l
    );
    const totaux = calculerTotaux(lignes);
    setForm(f => ({ ...f, lignes, ...totaux }));
  };

  const ajouterLigne = () => {
    const lignes = [...form.lignes, { _uid: Date.now(), description: '', quantite: 1, prixUnitaire: 0, tva: 8.1 }];
    const totaux = calculerTotaux(lignes);
    setForm(f => ({ ...f, lignes, ...totaux }));
  };

  const supprimerLigne = (i) => {
    const lignes = form.lignes.filter((_, idx) => idx !== i);
    const totaux = calculerTotaux(lignes);
    setForm(f => ({ ...f, lignes, ...totaux }));
  };

  const sauvegarder = (statut = null) => {
    const data = statut ? { ...form, statut } : { ...form };
    if (!data.clientId) { alert('Le client est obligatoire.'); return; }
    // Validation stricte à l'émission
    if (statut === 'envoyee') {
      // Avertissement si ni chantier ni devis lié (facture non ancrée)
      if (!data.chantierId && !data.devisId) {
        if (!window.confirm('Cette facture n\'est liée ni à un chantier ni à un devis. Elle sera traitée comme orpheline et exclue des calculs de marges. Continuer ?')) return;
      }
      if (!data.dateEmission || !data.dateEcheance) {
        alert('Date d\'émission et date d\'échéance requises avant émission.');
        return;
      }
      const de = new Date(data.dateEmission);
      const dc = new Date(data.dateEcheance);
      if (isNaN(de.getTime()) || isNaN(dc.getTime())) {
        alert('Dates d\'émission/échéance invalides.');
        return;
      }
      if (dc < de) {
        alert('L\'échéance ne peut pas être avant l\'émission.');
        return;
      }
      if (!Array.isArray(data.lignes) || data.lignes.length === 0 ||
          data.lignes.every(l => !((parseFloat(l.quantite) || 0) > 0 && (parseFloat(l.prixUnitaire) || 0) > 0))) {
        alert('Au moins une ligne avec quantité et prix > 0 est requise.');
        return;
      }
    }
    const totaux = calculerTotaux(data.lignes || []);
    Object.assign(data, totaux);

    // Alerte dépassement devis : total HT facturé > montantHT du devis lié
    if (data.devisId && statut === 'envoyee') {
      const devisLie = devis.find(d => String(d.id) === String(data.devisId));
      if (devisLie) {
        const caDevis = parseFloat(devisLie.montantHT) || 0;
        const autresFactures = factures.filter(f => String(f.devisId) === String(data.devisId) && f.id !== data.id && f.statut !== 'annulee' && f.statut !== 'brouillon');
        const dejaFactureHT = autresFactures.reduce((s, f) => s + (parseFloat(f.montantHT) || 0), 0);
        const totalAvecCette = dejaFactureHT + (parseFloat(data.montantHT) || 0);
        if (caDevis > 0 && totalAvecCette > caDevis * 1.001) {
          const depasse = Math.round(totalAvecCette - caDevis);
          if (!window.confirm(`Attention : cette facture porterait le total facturé à CHF ${Math.round(totalAvecCette).toLocaleString('fr-CH')} soit un dépassement de CHF ${depasse.toLocaleString('fr-CH')} par rapport au CA du devis (CHF ${Math.round(caDevis).toLocaleString('fr-CH')}). Continuer ?`)) return;
        }
      }
    }

    const liste = factures.some(f => f.id === data.id)
      ? factures.map(f => f.id === data.id ? data : f)
      : [...factures, data];
    onSave(liste);
    setVue('liste');
    setForm(null);
  };

  const supprimerFacture = (id, returnToListe = false) => {
    const f = factures.find(x => x.id === id);
    const msg = `Supprimer la facture ${f?.numero || ''} ?\nCette action est irréversible.`;
    if (!window.confirm(msg)) return;
    // Nettoyer paiements orphelins
    if (setPaiementsData && paiementsData) {
      const nouveau = { ...paiementsData };
      for (const chantierId in nouveau) {
        if (Array.isArray(nouveau[chantierId])) {
          nouveau[chantierId] = nouveau[chantierId].filter(p => String(p.factureId) !== String(id));
        }
      }
      setPaiementsData(nouveau);
    }
    onSave(factures.filter(x => x.id !== id));
    if (returnToListe) { setVue('liste'); setSelected(null); }
  };

  const ouvrirRappel = (facture, niveau) => {
    const cli = clients.find(c => String(c.id) === String(facture.clientId));
    const contenu = genererTexteRappel(niveau, facture, cli);
    setRappelModal({ facture, niveau, contenu });
  };

  const confirmerRappelEnvoye = () => {
    if (!rappelModal) return;
    const { facture, niveau } = rappelModal;
    const factureMAJ = marquerRappelEnvoye(facture, niveau);
    onSave(factures.map(x => x.id === facture.id ? factureMAJ : x));
    if (selected?.id === facture.id) setSelected(factureMAJ);
    setRappelModal(null);
  };

  const changerStatut = (id, statut) => {
    const f = factures.find(x => x.id === id);
    if (!f) return;
    if (statut === 'envoyee') {
      if (!f.dateEmission || !f.dateEcheance) {
        alert('Date d\'émission et date d\'échéance requises avant émission.');
        return;
      }
      const de = new Date(f.dateEmission);
      const dc = new Date(f.dateEcheance);
      if (isNaN(de.getTime()) || isNaN(dc.getTime())) {
        alert('Dates d\'émission/échéance invalides.');
        return;
      }
      if (dc < de) {
        alert('L\'échéance ne peut pas être avant l\'émission.');
        return;
      }
      if (!Array.isArray(f.lignes) || f.lignes.length === 0 ||
          f.lignes.every(l => !((parseFloat(l.quantite) || 0) > 0 && (parseFloat(l.prixUnitaire) || 0) > 0))) {
        alert('Au moins une ligne avec quantité et prix > 0 est requise.');
        return;
      }
    }
    let updates = { statut };
    // Quand on marque "Payée" manuellement, compléter montantPaye si nécessaire
    if (statut === 'payee') {
      const montantTTC = parseFloat(f.montantTTC) || 0;
      const montantPaye = parseFloat(f.montantPaye) || 0;
      if (montantTTC > montantPaye + 0.01) {
        const restant = montantTTC - montantPaye;
        const entree = { id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, montant: restant, date: new Date().toISOString().slice(0, 10), mode: 'Divers', note: 'Soldé manuellement' };
        updates.montantPaye = montantTTC;
        updates.paiementsHistorique = [...(f.paiementsHistorique || []), entree];
      }
    }
    onSave(factures.map(x => x.id === id ? { ...x, ...updates } : x));
  };

  // ── Vue détail ───────────────────────────────────────────
  const voirDetail = (f) => { setSelected(f); setVue('detail'); };

  const exporterCSV = () => {
    const entetes = ['Numéro', 'Client', 'Chantier', 'Type', 'Statut', 'Date émission', 'Échéance', 'Montant HT (CHF)', 'TVA (%)', 'Montant TTC (CHF)', 'Payé (CHF)'];
    const lignes = factures.map(f => {
      const client = clients.find(c => String(c.id) === String(f.clientId));
      const chantier = chantiers.find(c => String(c.id) === String(f.chantierId));
      return [
        f.numero || '',
        client ? `${client.prenom} ${client.nom}`.trim() : '',
        chantier?.nom || '',
        f.type || '',
        f.statut || '',
        f.dateEmission || '',
        f.dateEcheance || '',
        Math.round(parseFloat(f.montantHT) || 0),
        parseFloat(f.tva) || 8.1,
        Math.round(parseFloat(f.montantTTC) || 0),
        Math.round(parseFloat(f.montantPaye) || 0),
      ];
    });
    exportCSV(`factures_${new Date().toISOString().slice(0,10)}.csv`, entetes, lignes);
  };

  // ============================
  //  LISTE
  // ============================
  if (vue === 'liste') return (<React.Fragment key="liste">
    <div>
      {!hideHeader && (
        <div className="page-header-row">
          <div className="page-title-block">
            <div className="page-title-main">Factures</div>
            <div className="page-title-sub">{factures.length} facture{factures.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="page-actions-group">
            {factures.length > 0 && (
              <button style={S.btnGhost} onClick={exporterCSV}><Download size={14} /> Exporter CSV</button>
            )}
            {canEdit && (
              <button style={S.btnPrimary} onClick={() => ouvrirForm()}>+ Nouvelle facture</button>
            )}
          </div>
        </div>
      )}
      {hideHeader && canEdit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <button style={S.btnPrimary} onClick={() => ouvrirForm()}>+ Nouvelle facture</button>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <KpiCard label="Total facturé"  value={`${fmt(kpis.totalFacture)} CHF`}  couleur="#0d3d6e" icon="doc" />
        <KpiCard label="Encaissé"       value={`${fmt(kpis.totalEncaisse)} CHF`} couleur="#10b981" icon="" />
        <KpiCard label="En retard"      value={`${fmt(kpis.totalRetard)} CHF`}   couleur="#ef4444" icon="" />
        <KpiCard label="Brouillons"     value={kpis.nbBrouillon}                 couleur="#8b5cf6" icon="edit" />
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Rechercher (numéro, client, objet)…"
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          style={{ ...S.input, width: 260 }}
        />
        <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)}
          style={{ ...S.input, width: 160 }}>
          <option value="">Tous statuts</option>
          {Object.entries(STATUT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filtreType} onChange={e => setFiltreType(e.target.value)}
          style={{ ...S.input, width: 160 }}>
          <option value="">Tous types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* Liste factures — card rows */}
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        {facturesFiltrees.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ fontSize: 32, color: "var(--text-muted)" }}>—</div>
            <div className="empty-state-title">Aucune facture trouvée</div>
            <div className="empty-state-sub">Modifiez vos filtres ou créez une nouvelle facture</div>
          </div>
        ) : (
          <table className="table-cards" style={{ width: '100%' }}>
            <thead>
              <tr>
                {['Numéro', 'Client', 'Type', 'Émission', 'Échéance', 'Montant TTC', 'Payé / Progression', 'Statut', 'Actions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facturesPage.map((f, idx) => {
                const client = clients.find(c => String(c.id) === String(f.clientId));
                const restant = (f.montantTTC ?? 0) - (f.montantPaye ?? 0);
                const pctPaye = f.montantTTC > 0
                  ? Math.min(Math.round((f.montantPaye ?? 0) / f.montantTTC * 100), 100)
                  : 0;
                const couleurBar = restant <= 0.01 ? '#10b981' : '#f59e0b';
                return (
                  <tr key={f.id}
                    className={`ds-animate-in row-${f.statut}`}
                    style={{ cursor: 'pointer', animationDelay: `${idx * 35}ms` }}
                    onClick={() => voirDetail(f)}>
                    <td style={S.td}>
                      <span style={{ fontWeight: 700, color: '#0d3d6e', letterSpacing: '-0.2px' }}>{f.numero}</span>
                    </td>
                    <td style={S.td}>
                      {client?.nom
                        ? <span style={{ fontWeight: 600 }}>{client.nom}</span>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={S.td}>
                      <span style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, letterSpacing: '0.3px' }}>
                        {TYPE_LABELS[f.type] || f.type}
                      </span>
                    </td>
                    <td style={{ ...S.td, color: 'var(--text-secondary)', fontSize: 13 }}>{f.dateEmission || '—'}</td>
                    <td style={{ ...S.td, color: f.statut === 'retard' ? '#ef4444' : 'var(--text-secondary)', fontSize: 13, fontWeight: f.statut === 'retard' ? 600 : 400 }}>
                      {f.dateEcheance || '—'}
                      {f.statut === 'retard' && <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, marginTop: 1 }}>EN RETARD</div>}
                    </td>
                    <td style={{ ...S.td, fontWeight: 700, fontSize: 15 }}>{fmt(f.montantTTC)} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>CHF</span></td>
                    <td style={S.td}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: restant > 0.01 ? '#f59e0b' : '#10b981', marginBottom: 4 }}>
                        {fmt(f.montantPaye)} CHF
                      </div>
                      {(f.montantTTC ?? 0) > 0 && (
                        <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden', width: 90 }}>
                          <div style={{ height: '100%', width: `${pctPaye}%`, background: `linear-gradient(90deg, ${couleurBar}, ${couleurBar}cc)`, borderRadius: 4, boxShadow: `0 0 6px ${couleurBar}55`, transition: 'width 0.4s ease' }} />
                        </div>
                      )}
                    </td>
                    <td style={S.td}><BadgeStatut statut={f.statut} /></td>
                    <td style={S.td} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                        {canEdit && (
                          <>
                            <button style={{ ...S.btnGhost, padding: '5px 10px', fontSize: 12 }}
                              onClick={() => ouvrirForm(f)}>Modifier</button>
                            {f.statut === 'brouillon' && (
                              <button style={{ ...S.btnSuccess, padding: '5px 10px', fontSize: 12 }}
                                onClick={() => changerStatut(f.id, 'envoyee')}>Émettre</button>
                            )}
                          </>
                        )}
                        {(f.statut === 'envoyee' || f.statut === 'partielle') && (
                          <button style={{ ...S.btnPrimary, padding: '5px 10px', fontSize: 12 }}
                            onClick={() => setPaiementModal(f)}>Payer</button>
                        )}
                        {canEdit && (
                          <button
                            style={{ ...S.btnDanger, padding: '5px 10px', fontSize: 12, opacity: 0.75 }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '0.75'}
                            onClick={() => supprimerFacture(f.id)}>Suppr</button>
                        )}
                        {(() => {
                          const chantierF = chantiers.find(c => String(c.id) === String(f.chantierId));
                          const clientF = clients.find(c => String(c.id) === String(f.clientId));
                          const devisF = devis.find(d => String(d.id) === String(f.devisId));
                          return (
                            <>
                              <button
                                style={{ ...DS.iconBtn, padding: '5px 8px', background: 'rgba(13,61,110,0.08)', color: '#0d3d6e' }}
                                title="Télécharger facture PDF (QR-paiement)"
                                onClick={() => exportFacture(f, clientF, chantierF, devisF, parametres)}
                              ><FileDown size={13} /></button>
                              {chantierF && parametres && (
                                <button
                                  style={{ ...DS.iconBtn, padding: '5px 8px' }}
                                  title="Exporter fiche chantier PDF"
                                  onClick={() => exportFicheChantier(chantierF, clients, parametres, devis)}
                                ><FileDown size={13} /></button>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination factures */}
      {totalPagesFact > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 12 }}>
          <button onClick={() => setPageFact(p => Math.max(0, p - 1))} disabled={pageFact === 0}
            style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', cursor: pageFact === 0 ? 'not-allowed' : 'pointer', opacity: pageFact === 0 ? 0.4 : 1, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
            ← Préc.
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {pageFact + 1} / {totalPagesFact} · {facturesFiltrees.length} factures
          </span>
          <button onClick={() => setPageFact(p => Math.min(totalPagesFact - 1, p + 1))} disabled={pageFact === totalPagesFact - 1}
            style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', cursor: pageFact === totalPagesFact - 1 ? 'not-allowed' : 'pointer', opacity: pageFact === totalPagesFact - 1 ? 0.4 : 1, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
            Suiv. →
          </button>
        </div>
      )}

      {/* ── Modal paiement ── */}
      {paiementModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) setPaiementModal(null); }}>
          <div style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)', backdropFilter: 'blur(20px) saturate(1.8)', WebkitBackdropFilter: 'blur(20px) saturate(1.8)', borderRadius: 18, padding: 28, width: 420, boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="ds-card-title" style={{ marginBottom: 6 }}>Enregistrer un paiement</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              {paiementModal.numero} — Solde restant : <strong style={{ color: '#f59e0b' }}>{fmt((paiementModal.montantTTC ?? 0) - (paiementModal.montantPaye ?? 0))} CHF</strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
              <div>
                <label style={S.label}>Montant (CHF) *</label>
                <input type="text" inputMode="numeric" style={S.input} autoFocus
                  value={paiementForm.montant ? fmtN(paiementForm.montant) : ''}
                  placeholder={`Solde : ${fmt((paiementModal.montantTTC ?? 0) - (paiementModal.montantPaye ?? 0))}`}
                  onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); setPaiementForm(p => ({ ...p, montant: raw })); }} />
              </div>
              <div>
                <label style={S.label}>Date de paiement</label>
                <input type="date" style={S.input} value={paiementForm.date}
                  onChange={e => setPaiementForm(p => ({ ...p, date: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...S.btnSuccess, flex: 1 }} onClick={enregistrerPaiement}>Confirmer le paiement</button>
              <button style={S.btnGhost} onClick={() => setPaiementModal(null)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  </React.Fragment>);

  // ============================
  //  DETAIL
  // ============================
  if (vue === 'detail' && selected) {
    const f = factures.find(x => x.id === selected.id) || selected;
    const client = clients.find(c => String(c.id) === String(f.clientId));
    const chantier = chantiers.find(c => String(c.id) === String(f.chantierId));
    const devisLie = devis.find(d => String(d.id) === String(f.devisId));
    const restant = (f.montantTTC ?? 0) - (f.montantPaye ?? 0);

    return (<React.Fragment key="detail">
      <div>
        <div className="page-header-row" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1 }}>
            <button style={S.btnGhost} onClick={() => setVue('liste')}>← Retour</button>
            <div className="page-title-main">Facture {f.numero}</div>
            <BadgeStatut statut={f.statut} />
          {(() => {
            const chantierDetail = chantiers.find(c => String(c.id) === String(f.chantierId));
            const clientDetail = clients.find(c => String(c.id) === String(f.clientId));
            const devisDetail = devis.find(d => String(d.id) === String(f.devisId));
            return (
              <>
                <button
                  style={{ ...S.btnGhost, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(13,61,110,0.08)', color: '#0d3d6e', fontWeight: 700 }}
                  title="Télécharger facture PDF avec section QR-paiement"
                  onClick={() => exportFacture(f, clientDetail, chantierDetail, devisDetail, parametres)}
                ><FileDown size={14} /> Facture PDF</button>
                {chantierDetail && parametres && (
                  <button
                    style={{ ...S.btnGhost, display: 'flex', alignItems: 'center', gap: 5 }}
                    title="Exporter fiche chantier PDF"
                    onClick={() => exportFicheChantier(chantierDetail, clients, parametres, devis)}
                  ><FileDown size={14} /> Fiche chantier</button>
                )}
              </>
            );
          })()}
          {canEdit && (
            <>
              <button style={S.btnGhost} onClick={() => ouvrirForm(f)}>Modifier</button>
              {f.statut === 'brouillon' && (
                <button style={S.btnSuccess} onClick={() => { changerStatut(f.id, 'envoyee'); setSelected({ ...f, statut: 'envoyee' }); }}>Émettre</button>
              )}
              {(f.statut === 'envoyee' || f.statut === 'partielle') && (
                <>
                  <button style={S.btnPrimary} onClick={() => setPaiementModal(f)}>Paiement</button>
                  <button style={{ ...S.btnGhost, color: '#10b981', borderColor: 'rgba(16,185,129,0.4)' }}
                    onClick={() => { changerStatut(f.id, 'payee'); setSelected({ ...f, statut: 'payee' }); }}>
                    Payée
                  </button>
                </>
              )}
              <button
                style={{ ...S.btnDanger, marginLeft: 8 }}
                onClick={() => supprimerFacture(f.id, true)}>
                Supprimer
              </button>
            </>
          )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* Infos générales */}
          <div style={S.card}>
            <div className="ds-card-title">Informations</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                ['Type', TYPE_LABELS[f.type] || f.type],
                ['Source', SOURCE_LABELS[f.source] || f.source],
                ['Émission', f.dateEmission || '—'],
                ['Échéance', f.dateEcheance || '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{v}</div>
                </div>
              ))}
              {/* Client avec lien */}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>Client</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                  {client?.nom || '—'}
                  {naviguer && client && (
                    <span onClick={() => naviguer('clients', { clientActif: client.id })}
                      style={{ fontSize: 11, color: '#0d3d6e', cursor: 'pointer', marginLeft: 6 }}>Voir →</span>
                  )}
                </div>
              </div>
              {/* Chantier avec lien */}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>Chantier</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                  {chantier?.nom || chantier?.numero || '—'}
                  {naviguer && chantier && (
                    <span onClick={() => naviguer('chantiers', { chantierActif: chantier.id })}
                      style={{ fontSize: 11, color: '#0d3d6e', cursor: 'pointer', marginLeft: 6 }}>Voir →</span>
                  )}
                </div>
              </div>
              {/* Devis avec lien */}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>Devis lié</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                  {devisLie?.numero || '—'}
                  {naviguer && devisLie && (
                    <span onClick={() => naviguer('devis')}
                      style={{ fontSize: 11, color: '#0d3d6e', cursor: 'pointer', marginLeft: 6 }}>Voir →</span>
                  )}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>Objet</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{f.objet || '—'}</div>
              </div>
            </div>
          </div>

          {/* Totaux */}
          <div style={S.card}>
            <div className="ds-card-title">Montants</div>
            {[
              ['Montant HT',  fmt(f.montantHT) + ' CHF',  'var(--text-primary)'],
              ['TVA',         fmt(f.montantTVA) + ' CHF', 'var(--text-secondary)'],
              ['Montant TTC', fmt(f.montantTTC) + ' CHF', 'var(--text-primary)', true],
              ['Payé',        fmt(f.montantPaye) + ' CHF','#10b981'],
            ].map(([label, val, color, bold]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontSize: bold ? 18 : 14, fontWeight: bold ? 700 : 500, color }}>{val}</span>
              </div>
            ))}
            {/* Solde restant — mis en avant */}
            <div style={{
              marginTop: 12, borderRadius: 10, padding: '12px 16px',
              background: restant <= 0.01 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
              border: `1px solid ${restant <= 0.01 ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: restant <= 0.01 ? '#10b981' : '#f59e0b' }}>
                {restant <= 0.01 ? 'Soldée' : 'Solde restant'}
              </span>
              <span style={{ fontSize: 22, fontWeight: 800, color: restant <= 0.01 ? '#10b981' : '#f59e0b' }}>
                {fmt(Math.max(restant, 0))} CHF
              </span>
            </div>
            {/* Barre de recouvrement */}
            {(f.montantTTC ?? 0) > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <span>Recouvrement</span>
                  <span>{f.montantTTC > 0 ? Math.round((f.montantPaye ?? 0) / f.montantTTC * 100) : 0}%</span>
                </div>
                <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${f.montantTTC > 0 ? Math.min(Math.round((f.montantPaye ?? 0) / f.montantTTC * 100), 100) : 0}%`, background: '#10b981', borderRadius: 3 }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Lignes */}
        <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div className="ds-card-title" style={{ margin: 0 }}>Lignes de facturation</div>
          </div>
          <table className="table-cards" style={{ width: '100%' }}>
            <thead>
              <tr>
                {['Description', 'Quantité', 'Prix unitaire', 'TVA', 'Total HT'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(f.lignes || []).map((l, i) => (
                <tr key={l._uid || `ligne-detail-${i}`} className="ds-animate-in" style={{ animationDelay: `${i * 30}ms` }}>
                  <td style={{ ...S.td, fontWeight: 500 }}>{l.description || '—'}</td>
                  <td style={{ ...S.td, color: 'var(--text-secondary)' }}>{l.quantite}</td>
                  <td style={{ ...S.td, color: 'var(--text-secondary)' }}>{fmt(l.prixUnitaire)} CHF</td>
                  <td style={{ ...S.td, color: 'var(--text-secondary)' }}>{l.tva}%</td>
                  <td style={{ ...S.td, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(l.quantite * l.prixUnitaire)} CHF</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Historique des paiements */}
        {(f.paiementsHistorique || []).length > 0 && (
          <div style={{ ...S.card, marginTop: 16 }}>
            <div className="ds-card-title" style={{ marginBottom: 14 }}>Historique des paiements</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...(f.paiementsHistorique || [])].sort((a, b) => a.date.localeCompare(b.date)).map((p, i) => (
                <div key={p.id || `paiement-${i}`} className="ds-animate-in" style={{
                  animationDelay: `${i * 30}ms`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)',
                  borderRadius: 10, padding: '10px 14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', minWidth: 22, textAlign: 'center' }}>#{i + 1}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.date}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Virement{p.note ? ` · ${p.note}` : ''}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>+{fmt(p.montant)} CHF</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Relances (factures non payées uniquement) ── */}
        {f.statut !== 'payee' && f.statut !== 'annulee' && f.statut !== 'brouillon' && (() => {
          const prochaine = prochainRappel(f);
          const rappels = f.rappels || [];
          return (
            <div style={{ ...S.card, marginTop: 16 }}>
              <div className="ds-card-title" style={{ marginBottom: 14 }}>Relances</div>

              {/* Historique des relances déjà envoyées */}
              {rappels.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  {rappels.sort((a, b) => a.niveau - b.niveau).map(r => {
                    const info = niveauInfo(r.niveau);
                    return (
                      <div key={r.niveau} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: `${info.couleur}15`, border: `1px solid ${info.couleur}40`,
                        borderRadius: 10, padding: '10px 14px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 18 }}>✓</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: info.couleur }}>{info.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Envoyé le {r.date}</div>
                          </div>
                        </div>
                        <button style={{ ...S.btnGhost, fontSize: 12 }}
                          onClick={() => ouvrirRappel(f, r.niveau)}>Revoir</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Prochain rappel à envoyer */}
              {prochaine && canEdit && (() => {
                const info = niveauInfo(prochaine.niveau);
                return (
                  <div style={{
                    background: `${info.couleur}10`, border: `2px solid ${info.couleur}`,
                    borderRadius: 12, padding: 16, display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center', gap: 12,
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: info.couleur, marginBottom: 4 }}>
                        ⚠ {info.label} à envoyer
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Facture en retard de {prochaine.joursRetard} jours · Solde restant : {fmt(Math.max(restant, 0))} CHF
                      </div>
                    </div>
                    <button onClick={() => ouvrirRappel(f, prochaine.niveau)}
                      style={{ ...S.btnPrimary, background: info.couleur, borderColor: info.couleur, fontWeight: 700 }}>
                      Générer le rappel →
                    </button>
                  </div>
                );
              })()}

              {/* Aucune action nécessaire */}
              {!prochaine && rappels.length === 0 && (
                <div style={{ padding: '12px 0', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                  Aucune relance nécessaire pour le moment.
                </div>
              )}
              {!prochaine && rappels.length >= 3 && (
                <div style={{ padding: '12px 0', fontSize: 13, color: '#ef4444', textAlign: 'center', fontWeight: 600 }}>
                  Tous les rappels ont été envoyés. Procédure de poursuite envisageable.
                </div>
              )}
            </div>
          );
        })()}

        {f.notes && (
          <div style={{ ...S.card, marginTop: 16 }}>
            <div className="ds-section-label">Notes</div>
            <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.6 }}>{f.notes}</p>
          </div>
        )}

        {canEdit && (
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button style={S.btnDanger} onClick={() => {
              supprimerFacture(f.id);
              setVue('liste');
            }}>Supprimer</button>
          </div>
        )}

        {/* ── Modal paiement (vue détail) ── */}
        {paiementModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
            onClick={e => { if (e.target === e.currentTarget) setPaiementModal(null); }}>
            <div style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)', backdropFilter: 'blur(20px) saturate(1.8)', WebkitBackdropFilter: 'blur(20px) saturate(1.8)', borderRadius: 18, padding: 28, width: 420, boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="ds-card-title" style={{ marginBottom: 6 }}>Enregistrer un paiement</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                {paiementModal.numero} — Solde restant : <strong style={{ color: '#f59e0b' }}>{fmt((paiementModal.montantTTC ?? 0) - (paiementModal.montantPaye ?? 0))} CHF</strong>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
                <div>
                  <label style={S.label}>Montant (CHF) *</label>
                  <input type="text" inputMode="numeric" style={S.input} autoFocus
                    value={paiementForm.montant ? fmtN(paiementForm.montant) : ''}
                    placeholder={`Solde : ${fmt((paiementModal.montantTTC ?? 0) - (paiementModal.montantPaye ?? 0))}`}
                    onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); setPaiementForm(p => ({ ...p, montant: raw })); }} />
                </div>
                <div>
                  <label style={S.label}>Date de paiement</label>
                  <input type="date" style={S.input} value={paiementForm.date}
                    onChange={e => setPaiementForm(p => ({ ...p, date: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={{ ...S.btnSuccess, flex: 1 }} onClick={enregistrerPaiement}>Confirmer le paiement</button>
                <button style={S.btnGhost} onClick={() => setPaiementModal(null)}>Annuler</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal rappel : affiche le texte, permet de copier/imprimer/marquer envoyé ── */}
        {rappelModal && (() => {
          const info = niveauInfo(rappelModal.niveau);
          const { contenu, facture } = rappelModal;
          const dejaEnvoye = (facture.rappels || []).some(r => r.niveau === rappelModal.niveau);
          const copierTexte = async () => {
            try { await navigator.clipboard.writeText(contenu.texte); alert('Texte copié dans le presse-papier.'); }
            catch { alert('Copie impossible. Sélectionnez le texte manuellement.'); }
          };
          const imprimer = () => {
            const w = window.open('', '_blank', 'width=800,height=900');
            if (!w) return;
            const escHtml = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
            w.document.write(`<!DOCTYPE html><html><head><title>${escHtml(contenu.objet)}</title>
              <style>body{font-family:Georgia,serif;padding:40px;line-height:1.6;white-space:pre-wrap;font-size:13px;color:#222;}</style>
              </head><body>${escHtml(contenu.texte)}</body></html>`);
            w.opener = null;
            w.document.close();
            setTimeout(() => w.print(), 300);
          };
          return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}
              onClick={e => { if (e.target === e.currentTarget) setRappelModal(null); }}>
              <div style={{
                background: 'linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)',
                backdropFilter: 'blur(20px) saturate(1.8)', WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
                borderRadius: 18, padding: 24, width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto',
                boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)',
                border: `2px solid ${info.couleur}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 8, height: 32, background: info.couleur, borderRadius: 4 }} />
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: info.couleur }}>{info.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Facture {facture.numero}</div>
                  </div>
                </div>

                <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                  Objet : <strong>{contenu.objet}</strong>
                </div>

                <textarea readOnly value={contenu.texte} style={{
                  width: '100%', minHeight: 360, padding: 16, borderRadius: 10,
                  border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)',
                  color: 'var(--text-primary)', fontSize: 12, lineHeight: 1.6,
                  fontFamily: 'Georgia, serif', resize: 'vertical',
                }} />

                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, marginBottom: 16 }}>
                  Copiez ce texte dans votre logiciel email, votre messagerie ou imprimez-le pour envoi postal.
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button style={S.btnGhost} onClick={copierTexte}>📋 Copier le texte</button>
                  <button style={S.btnGhost} onClick={imprimer}>🖨 Imprimer</button>
                  <div style={{ flex: 1 }} />
                  <button style={S.btnGhost} onClick={() => setRappelModal(null)}>Fermer</button>
                  {!dejaEnvoye && (
                    <button onClick={confirmerRappelEnvoye}
                      style={{ ...S.btnSuccess, background: info.couleur, borderColor: info.couleur }}>
                      ✓ Marquer comme envoyé
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </React.Fragment>);
  }

  // ============================
  //  FORMULAIRE
  // ============================
  if (vue === 'form' && form) {
    const isNew = !factures.some(f => f.id === form.id);

    return (<React.Fragment key="form">
      <div style={{ padding: 24, maxWidth: 900 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
          <button style={S.btnGhost} onClick={() => { setVue('liste'); setForm(null); }}>← Annuler</button>
          <div className="page-title-main">{isNew ? 'Nouvelle facture' : `Modifier ${form.numero}`}</div>
        </div>

        {/* Ligne 1 : méta */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={S.label}>Numéro</label>
            <input style={{ ...S.input, color: 'var(--text-secondary)' }} value={form.numero} readOnly />
          </div>
          <div>
            <label style={S.label}>Type *</label>
            <select style={S.input} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Source</label>
            <select style={S.input} value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
              {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* Ligne 2 : entités */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={S.label}>Client * (obligatoire)</label>
            <select style={{ ...S.input, borderColor: !form.clientId ? '#ef4444' : 'var(--border)' }}
              value={form.clientId}
              onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
              <option value="">— Sélectionner —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{[c.prenom, c.nom].filter(Boolean).join(' ')}{c.entreprise ? ` (${c.entreprise})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Chantier (optionnel)</label>
            <select style={S.input} value={form.chantierId}
              onChange={e => setForm(f => ({ ...f, chantierId: e.target.value }))}>
              <option value="">— Aucun —</option>
              {chantiers.map(c => <option key={c.id} value={c.id}>{c.nom || c.numero}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Devis lié (optionnel)</label>
            <select style={S.input} value={form.devisId}
              onChange={e => setForm(f => ({ ...f, devisId: e.target.value }))}>
              <option value="">— Aucun —</option>
              {devis.map(d => <option key={d.id} value={d.id}>{d.numero}</option>)}
            </select>
          </div>
        </div>

        {/* Ligne 3 : dates + objet */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={S.label}>Date d'émission</label>
            <input type="date" style={S.input} value={form.dateEmission}
              onChange={e => setForm(f => ({ ...f, dateEmission: e.target.value }))} />
          </div>
          <div>
            <label style={S.label}>Date d'échéance</label>
            <input type="date" style={S.input} value={form.dateEcheance}
              onChange={e => setForm(f => ({ ...f, dateEcheance: e.target.value }))} />
          </div>
          <div>
            <label style={S.label}>Objet</label>
            <input style={S.input} placeholder="Ex: Travaux de rénovation façade" value={form.objet}
              onChange={e => setForm(f => ({ ...f, objet: e.target.value }))} />
          </div>
        </div>

        {/* Lignes de facturation */}
        <div style={{ ...S.card, padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="ds-section-label">Lignes</div>
            <button style={{ ...S.btnGhost, padding: '6px 12px', fontSize: 13 }} onClick={ajouterLigne}>+ Ligne</button>
          </div>
          <table className="table-cards" style={{ width: '100%' }}>
            <thead>
              <tr>
                {['Description', 'Qté', 'Prix unit. (CHF)', 'TVA', 'Total HT', ''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.lignes.map((l, i) => (
                <tr key={l._uid || `ligne_${i}`}>
                  <td style={S.td}>
                    <input style={S.input} value={l.description}
                      onChange={e => updateLigne(i, 'description', e.target.value)}
                      placeholder="Description du poste" />
                  </td>
                  <td style={{ ...S.td, width: 80 }}>
                    <input type="number" style={S.input} value={l.quantite} min={0}
                      onChange={e => updateLigne(i, 'quantite', e.target.value)} />
                  </td>
                  <td style={{ ...S.td, width: 140 }}>
                    <input type="text" inputMode="numeric" style={S.input} value={l.prixUnitaire ? fmtN(l.prixUnitaire) : ''}
                      onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); updateLigne(i, 'prixUnitaire', raw); }} />
                  </td>
                  <td style={{ ...S.td, width: 130 }}>
                    <select style={S.input} value={l.tva}
                      onChange={e => updateLigne(i, 'tva', e.target.value)}>
                      {TVA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td style={{ ...S.td, fontWeight: 600, width: 120 }}>
                    {fmt(l.quantite * l.prixUnitaire)} CHF
                  </td>
                  <td style={{ ...S.td, width: 40 }}>
                    {form.lignes.length > 1 && (
                      <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}
                        onClick={() => supprimerLigne(i)}>×</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Totaux */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ minWidth: 280 }}>
              {[
                ['Montant HT',  fmt(form.montantHT) + ' CHF',  false],
                ['TVA',         fmt(form.montantTVA) + ' CHF', false],
                ['Total TTC',   fmt(form.montantTTC) + ' CHF', true],
              ].map(([label, val, bold]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: bold ? 'none' : '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{label}</span>
                  <span style={{ fontSize: bold ? 18 : 14, fontWeight: bold ? 700 : 500, color: bold ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 16 }}>
          <label style={S.label}>Notes / conditions</label>
          <textarea style={{ ...S.input, height: 80, resize: 'vertical' }}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Conditions de paiement, remarques…" />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={S.btnGhost} onClick={() => sauvegarder('brouillon')}>
            Enregistrer brouillon
          </button>
          <button style={S.btnSuccess} onClick={() => sauvegarder('envoyee')}>
            Émettre la facture
          </button>
          {!isNew && (
            <button style={S.btnDanger} onClick={() => {
              supprimerFacture(form.id);
              setVue('liste');
            }}>
              Supprimer
            </button>
          )}
        </div>
      </div>
    </React.Fragment>);
  }

  return null;
}
