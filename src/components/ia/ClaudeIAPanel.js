import React, { useState } from 'react';
import { Sparkles, Building2, FileText, Bell, BarChart2, Loader, AlertCircle, ChevronRight, MessageSquare, Mail, GitCompare, FileSearch } from 'lucide-react';
import { useClaudeAI } from '../../hooks/useClaudeAI';
import { useApp } from '../../context/AppContext';
import { calculerCoutsChantier } from '../../donnees';
import { DS } from '../../ds';

// ── Rendu gras inline sans dangerouslySetInnerHTML ─────────────
function GrasInline({ texte }) {
  const parties = texte.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parties.map((p, i) =>
        i % 2 === 1 ? <strong key={i}>{p}</strong> : p
      )}
    </>
  );
}

// ── Rendu Markdown simplifié ────────────────────────────────────
function MarkdownSimple({ texte }) {
  if (!texte) return null;
  const lignes = texte.split('\n');
  return (
    <div style={{ lineHeight: 1.7, color: 'var(--text-main)', fontSize: 14 }}>
      {lignes.map((ligne, i) => {
        if (!ligne.trim()) return <br key={i} />;
        // Titre ligne entière **...**
        if (ligne.startsWith('**') && ligne.endsWith('**')) {
          return <p key={i} style={{ fontWeight: 700, color: DS.brand.secondary, marginTop: 12, marginBottom: 4 }}>{ligne.replace(/\*\*/g, '')}</p>;
        }
        // Puce
        if (ligne.startsWith('- ') || ligne.startsWith('• ')) {
          return <p key={i} style={{ paddingLeft: 16, marginBottom: 4 }}>• <GrasInline texte={ligne.replace(/^[-•]\s/, '')} /></p>;
        }
        return <p key={i} style={{ marginBottom: 4 }}><GrasInline texte={ligne} /></p>;
      })}
    </div>
  );
}

// ── Bloc résultat ───────────────────────────────────────────────
function ResultatIA({ texte, error, loading }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '24px 0', color: DS.brand.secondary }}>
        <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 14 }}>Claude analyse en cours...</span>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ display: 'flex', gap: 10, padding: '14px 16px', background: '#fef2f2', borderRadius: 10, border: '1px solid #fecaca', color: '#dc2626' }}>
        <AlertCircle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Erreur</div>
          <div style={{ fontSize: 13 }}>{error}</div>
          {error.includes('Edge Function') || error.includes('invoke') ? (
            <div style={{ fontSize: 12, marginTop: 6, color: '#991b1b' }}>
              ℹ️ Vérifier que la fonction "claude-ia" est déployée dans Supabase Dashboard.
            </div>
          ) : null}
        </div>
      </div>
    );
  }
  if (!texte) return null;
  return (
    <div style={{ background: 'var(--bg-page)', borderRadius: 10, padding: '16px 18px', border: '1px solid var(--border)', marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, color: DS.brand.secondary, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <Sparkles size={12} />
        Analyse Claude AI
      </div>
      <MarkdownSimple texte={texte} />
    </div>
  );
}

// ── Onglet : Analyser un chantier ──────────────────────────────
function AnalyseChantier() {
  const { chantiers, devis, parametres } = useApp();
  const { appeler, loading, error } = useClaudeAI();
  const [chantierId, setChantierId] = useState('');
  const [resultat, setResultat] = useState('');

  const actifs = chantiers.filter(c => c.statut?.trim().toLowerCase() !== 'annulé');

  const analyser = async () => {
    const c = chantiers.find(ch => String(ch.id) === String(chantierId));
    if (!c) return;
    const couts = calculerCoutsChantier(c, parametres?.employes || [], parametres?.localites || [], parametres?.parametres || {}, devis);
    const joursReels = new Set((c.journal || []).map(e => e.date).filter(Boolean)).size;
    const texte = await appeler('analyser_chantier', {
      nom: c.nom || c.numero,
      ca: couts.montantTotal,
      coutReel: couts.totalCoutsReel,
      margePct: couts.margeReelPct,
      avancement: parseFloat(c.avancement) || 0,
      joursPrevus: c.nombreJours,
      joursReels,
      statut: c.statut,
      eac: couts.eac,
      rad: couts.rad,
    });
    setResultat(texte);
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Sélectionne un chantier pour obtenir un diagnostic IA avec recommandations.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <select value={chantierId} onChange={e => { setChantierId(e.target.value); setResultat(''); }}
          style={{ flex: 1, minWidth: 200, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13 }}>
          <option value="">— Choisir un chantier —</option>
          {actifs.map(c => <option key={c.id} value={c.id}>{c.nom || c.numero} — {c.statut}</option>)}
        </select>
        <button onClick={analyser} disabled={!chantierId || loading}
          style={{ ...DS.btnPrimary, display: 'flex', alignItems: 'center', gap: 6, opacity: (!chantierId || loading) ? 0.6 : 1 }}>
          <Sparkles size={14} />
          Analyser
        </button>
      </div>
      <ResultatIA texte={resultat} error={error} loading={loading} />
    </div>
  );
}

// ── Onglet : Suggestion de devis ───────────────────────────────
function SuggestionDevis() {
  const { appeler, loading, error } = useClaudeAI();
  const [form, setForm] = useState({ description: '', typeTraveaux: '', surface: '', finition: 'standard' });
  const [resultat, setResultat] = useState('');

  const generer = async () => {
    if (!form.description.trim()) return;
    const texte = await appeler('suggerer_devis', form);
    setResultat(texte);
  };

  const champ = (label, key, opts = {}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</label>
      {opts.textarea ? (
        <textarea value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          rows={3} placeholder={opts.placeholder || ''}
          style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} />
      ) : (
        <input type="text" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          placeholder={opts.placeholder || ''}
          style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13 }} />
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
        Décris les travaux et Claude génère un chiffrage BTP Genève avec postes et prix.
      </p>
      {champ('Description des travaux *', 'description', { textarea: true, placeholder: 'Ex: Pose de faux-plafond en plaque de plâtre + isolation acoustique dans un bureau de 80m²...' })}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {champ('Type de travaux', 'typeTraveaux', { placeholder: 'Ex: Faux-plafond, carrelage...' })}
        {champ('Surface / Quantité', 'surface', { placeholder: 'Ex: 80 m²' })}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Niveau de finition</label>
          <select value={form.finition} onChange={e => setForm(f => ({ ...f, finition: e.target.value }))}
            style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13 }}>
            <option value="économique">Économique</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </select>
        </div>
      </div>
      <button onClick={generer} disabled={!form.description.trim() || loading}
        style={{ ...DS.btnPrimary, display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', opacity: (!form.description.trim() || loading) ? 0.6 : 1 }}>
        <Sparkles size={14} />
        Générer le chiffrage
      </button>
      <ResultatIA texte={resultat} error={error} loading={loading} />
    </div>
  );
}

// ── Onglet : Explication des alertes ───────────────────────────
function ExplicationAlertes() {
  const { agentState } = useApp();
  const { appeler, loading, error } = useClaudeAI();
  const [resultat, setResultat] = useState('');

  const alertes = agentState?.alertes || [];
  const nonLues = alertes.filter(a => !a.lu);

  const expliquer = async () => {
    const texte = await appeler('expliquer_alertes', {
      alertes: nonLues.slice(0, 15).map(a => ({
        niveau: a.niveau,
        message: a.message,
        detail: a.detail,
        agent: a.agent,
      })),
    });
    setResultat(texte);
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Claude explique tes alertes actives en langage clair et propose des actions.
      </p>
      <div style={{ padding: '12px 16px', background: nonLues.length > 0 ? '#fff7ed' : '#f0fdf4', borderRadius: 10, border: `1px solid ${nonLues.length > 0 ? '#fed7aa' : '#bbf7d0'}`, marginBottom: 16, fontSize: 13 }}>
        <span style={{ fontWeight: 600 }}>{nonLues.length} alerte{nonLues.length !== 1 ? 's' : ''} non lue{nonLues.length !== 1 ? 's' : ''}</span>
        {nonLues.length > 0 && (
          <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
            ({nonLues.filter(a => a.niveau === 'DANGER').length} danger, {nonLues.filter(a => a.niveau === 'ATTENTION').length} attention)
          </span>
        )}
      </div>
      <button onClick={expliquer} disabled={nonLues.length === 0 || loading}
        style={{ ...DS.btnPrimary, display: 'flex', alignItems: 'center', gap: 6, opacity: (nonLues.length === 0 || loading) ? 0.6 : 1 }}>
        <Sparkles size={14} />
        Expliquer les alertes
      </button>
      <ResultatIA texte={resultat} error={error} loading={loading} />
    </div>
  );
}

// ── Onglet : Analyse globale ────────────────────────────────────
function AnalysePortefeuille() {
  const { chantiers, devis, factures, parametres } = useApp();
  const { appeler, loading, error } = useClaudeAI();
  const [resultat, setResultat] = useState('');

  const analyser = async () => {
    const actifs = chantiers.filter(c => c.statut?.trim().toLowerCase() !== 'annulé');
    const chantiersData = actifs.map(c => {
      const couts = calculerCoutsChantier(c, parametres?.employes || [], parametres?.localites || [], parametres?.parametres || {}, devis);
      return {
        nom: c.nom || c.numero,
        ca: couts.montantTotal,
        marge: couts.margeReelPct,
        statut: c.statut,
      };
    });

    const caTotal = chantiersData.reduce((s, c) => s + (c.ca || 0), 0);
    const margesValides = chantiersData.filter(c => c.marge != null && Number.isFinite(c.marge));
    const margeMoyenne = margesValides.length > 0
      ? margesValides.reduce((s, c) => s + c.marge, 0) / margesValides.length
      : null;
    const facture = factures
      .filter(f => f.statut?.trim().toLowerCase() === 'payée')
      .reduce((s, f) => s + (parseFloat(f.montantHT) || 0), 0);

    const texte = await appeler('analyse_portefeuille', { chantiers: chantiersData, caTotal, margeMoyenne, facture });
    setResultat(texte);
  };

  const nbActifs = chantiers.filter(c => ['en cours', 'planifié'].includes(c.statut?.trim().toLowerCase())).length;

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Analyse stratégique de ton portefeuille complet — tendances, risques, décisions à prendre.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { label: 'Chantiers actifs', val: nbActifs },
          { label: 'Total chantiers', val: chantiers.length },
          { label: 'Factures', val: factures.length },
        ].map(k => (
          <div key={k.label} style={{ padding: '10px 16px', background: DS.brand.soft, borderRadius: 10, border: `1px solid ${DS.brand.secondary}33` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: DS.brand.secondary }}>{k.val}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{k.label}</div>
          </div>
        ))}
      </div>
      <button onClick={analyser} disabled={chantiers.length === 0 || loading}
        style={{ ...DS.btnPrimary, display: 'flex', alignItems: 'center', gap: 6, opacity: (chantiers.length === 0 || loading) ? 0.6 : 1 }}>
        <Sparkles size={14} />
        Analyser le portefeuille
      </button>
      <ResultatIA texte={resultat} error={error} loading={loading} />
    </div>
  );
}

// ── Onglet : Chat libre ────────────────────────────────────────
function ChatLibre() {
  const { appeler, loading, error } = useClaudeAI();
  const [question, setQuestion] = useState('');
  const [resultat, setResultat] = useState('');

  const envoyer = async () => {
    if (!question.trim()) return;
    const texte = await appeler('chat_libre', { question });
    setResultat(texte);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
        Pose n'importe quelle question à Claude sur ton activité BTP, la gestion de chantiers ou la réglementation.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Ta question *</label>
        <textarea
          value={question}
          onChange={e => { setQuestion(e.target.value); setResultat(''); }}
          rows={4}
          placeholder="Ex: Comment optimiser mes marges sur les chantiers de faux-plafond ? Quelle est la durée légale de garantie décennale en Suisse ?"
          style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>
      <button onClick={envoyer} disabled={!question.trim() || loading}
        style={{ ...DS.btnPrimary, display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', opacity: (!question.trim() || loading) ? 0.6 : 1 }}>
        <Sparkles size={14} />
        Envoyer
      </button>
      <ResultatIA texte={resultat} error={error} loading={loading} />
    </div>
  );
}

// ── Onglet : Générer email ─────────────────────────────────────
function GenererEmail() {
  const { appeler, loading, error } = useClaudeAI();
  const [form, setForm] = useState({ type: 'Relance facture', destinataire: '', contexte: '', montant: '' });
  const [resultat, setResultat] = useState('');

  const generer = async () => {
    if (!form.destinataire.trim() || !form.contexte.trim()) return;
    const texte = await appeler('generer_email', form);
    setResultat(texte);
  };

  const inputStyle = { padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13, fontFamily: 'inherit' };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' };
  const fieldStyle = { display: 'flex', flexDirection: 'column', gap: 4 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
        Génère un email professionnel adapté à la situation — relance, avis de travaux, envoi de devis ou remerciement.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Type d'email *</label>
          <select value={form.type} onChange={e => { setForm(f => ({ ...f, type: e.target.value })); setResultat(''); }}
            style={inputStyle}>
            <option value="Relance facture">Relance facture</option>
            <option value="Avis de travaux">Avis de travaux</option>
            <option value="Envoi devis">Envoi devis</option>
            <option value="Remerciement">Remerciement</option>
          </select>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Destinataire (nom client) *</label>
          <input type="text" value={form.destinataire}
            onChange={e => { setForm(f => ({ ...f, destinataire: e.target.value })); setResultat(''); }}
            placeholder="Ex: M. Dupont, Société XYZ SA"
            style={inputStyle} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Montant (optionnel)</label>
          <input type="text" value={form.montant}
            onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
            placeholder="Ex: CHF 12'000"
            style={inputStyle} />
        </div>
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Contexte *</label>
        <textarea value={form.contexte}
          onChange={e => { setForm(f => ({ ...f, contexte: e.target.value })); setResultat(''); }}
          rows={3}
          placeholder="Ex: Facture du 15 mai, CHF 12'000, impayée depuis 35 jours. Deuxième relance."
          style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
      <button onClick={generer} disabled={!form.destinataire.trim() || !form.contexte.trim() || loading}
        style={{ ...DS.btnPrimary, display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', opacity: (!form.destinataire.trim() || !form.contexte.trim() || loading) ? 0.6 : 1 }}>
        <Sparkles size={14} />
        Générer l'email
      </button>
      <ResultatIA texte={resultat} error={error} loading={loading} />
    </div>
  );
}

// ── Onglet : Comparer devis ────────────────────────────────────
function ComparerDevis() {
  const { appeler, loading, error } = useClaudeAI();
  const [devis1, setDevis1] = useState({ nom: '', montant: '', description: '' });
  const [devis2, setDevis2] = useState({ nom: '', montant: '', description: '' });
  const [criteres, setCriteres] = useState('');
  const [resultat, setResultat] = useState('');

  const comparer = async () => {
    if (!devis1.nom.trim() || !devis2.nom.trim()) return;
    const texte = await appeler('comparer_devis', {
      devis1: { ...devis1, montant: parseFloat(devis1.montant) || 0 },
      devis2: { ...devis2, montant: parseFloat(devis2.montant) || 0 },
      criteres,
    });
    setResultat(texte);
  };

  const inputStyle = { padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' };
  const fieldStyle = { display: 'flex', flexDirection: 'column', gap: 4 };

  const ColonneDevis = ({ titre, vals, setVals, accent }) => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', background: DS.brand.soft, borderRadius: 10, border: `1px solid ${accent}33` }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{titre}</div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Nom / Référence *</label>
        <input type="text" value={vals.nom} onChange={e => { setVals(v => ({ ...v, nom: e.target.value })); setResultat(''); }}
          placeholder="Ex: Devis Entreprise Alpha" style={inputStyle} />
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Montant HT (CHF)</label>
        <input type="number" value={vals.montant} onChange={e => setVals(v => ({ ...v, montant: e.target.value }))}
          placeholder="Ex: 45000" style={inputStyle} />
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Description / Prestations</label>
        <textarea value={vals.description} onChange={e => setVals(v => ({ ...v, description: e.target.value }))}
          rows={3} placeholder="Détails des prestations, délais, garanties..."
          style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
        Compare deux devis côte à côte et obtiens une analyse IA avec recommandations.
      </p>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <ColonneDevis titre="Devis 1" vals={devis1} setVals={setDevis1} accent={DS.brand.secondary} />
        <ColonneDevis titre="Devis 2" vals={devis2} setVals={setDevis2} accent="#6366f1" />
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Critères de comparaison (optionnel)</label>
        <input type="text" value={criteres} onChange={e => setCriteres(e.target.value)}
          placeholder="Ex: Prix, délais, qualité matériaux, réputation, garantie"
          style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13, fontFamily: 'inherit' }} />
      </div>
      <button onClick={comparer} disabled={!devis1.nom.trim() || !devis2.nom.trim() || loading}
        style={{ ...DS.btnPrimary, display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', opacity: (!devis1.nom.trim() || !devis2.nom.trim() || loading) ? 0.6 : 1 }}>
        <Sparkles size={14} />
        Comparer
      </button>
      <ResultatIA texte={resultat} error={error} loading={loading} />
    </div>
  );
}

// ── Onglet : Analyser PDF ──────────────────────────────────────
function AnalyserPdfTexte() {
  const { appeler, loading, error } = useClaudeAI();
  const [texte, setTexte] = useState('');
  const [typeDoc, setTypeDoc] = useState('Devis');
  const [resultat, setResultat] = useState('');

  const analyser = async () => {
    if (!texte.trim()) return;
    const rep = await appeler('analyser_pdf_texte', { texte, typeDoc });
    setResultat(rep);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
        Colle le texte extrait d'un document PDF et Claude en fait l'analyse détaillée : points clés, risques, montants, délais.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Type de document *</label>
        <select value={typeDoc} onChange={e => { setTypeDoc(e.target.value); setResultat(''); }}
          style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13, alignSelf: 'flex-start', minWidth: 180 }}>
          <option value="Devis">Devis</option>
          <option value="Contrat">Contrat</option>
          <option value="CCTP">CCTP</option>
          <option value="Facture">Facture</option>
          <option value="Autre">Autre</option>
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Texte du document *</label>
        <textarea
          value={texte}
          onChange={e => { setTexte(e.target.value); setResultat(''); }}
          rows={8}
          placeholder="Colle le texte du PDF ici... (Ctrl+A dans votre lecteur PDF, puis copier-coller)"
          style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>
      <button onClick={analyser} disabled={!texte.trim() || loading}
        style={{ ...DS.btnPrimary, display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', opacity: (!texte.trim() || loading) ? 0.6 : 1 }}>
        <Sparkles size={14} />
        Analyser
      </button>
      <ResultatIA texte={resultat} error={error} loading={loading} />
    </div>
  );
}

// ── Panneau principal ───────────────────────────────────────────
const FEATURES = [
  { id: 'chantier',        label: 'Analyser un chantier',  Icon: Building2,    Composant: AnalyseChantier },
  { id: 'devis',           label: 'Suggestion de devis',   Icon: FileText,     Composant: SuggestionDevis },
  { id: 'alertes',         label: 'Expliquer les alertes', Icon: Bell,         Composant: ExplicationAlertes },
  { id: 'portefeuille',    label: 'Analyse globale',       Icon: BarChart2,    Composant: AnalysePortefeuille },
  { id: 'chat_libre',      label: 'Chat libre',            Icon: MessageSquare, Composant: ChatLibre },
  { id: 'generer_email',   label: 'Générer email',         Icon: Mail,         Composant: GenererEmail },
  { id: 'comparer_devis',  label: 'Comparer devis',        Icon: GitCompare,   Composant: ComparerDevis },
  { id: 'analyser_pdf',    label: 'Analyser PDF',          Icon: FileSearch,   Composant: AnalyserPdfTexte },
];

export default function ClaudeIAPanel() {
  const [feature, setFeature] = useState('chantier');
  const active = FEATURES.find(f => f.id === feature);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'start' }}>
      {/* Menu latéral */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {FEATURES.map(f => {
          const isActive = f.id === feature;
          return (
            <button key={f.id} onClick={() => setFeature(f.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 14px', background: isActive ? DS.brand.soft : 'transparent',
                color: isActive ? DS.brand.secondary : 'var(--text-main)',
                border: 'none', borderLeft: isActive ? `3px solid ${DS.brand.secondary}` : '3px solid transparent',
                cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 600 : 400,
                fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s',
              }}>
              <f.Icon size={14} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{f.label}</span>
              {isActive && <ChevronRight size={12} />}
            </button>
          );
        })}
      </div>

      {/* Contenu */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
          {active && <active.Icon size={16} color={DS.brand.secondary} />}
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{active?.label}</h3>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: DS.brand.secondary, fontWeight: 600 }}>
            <Sparkles size={11} />
            Claude AI
          </div>
        </div>
        {active && <active.Composant />}
      </div>
    </div>
  );
}
