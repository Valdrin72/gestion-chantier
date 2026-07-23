import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, Building2, FileText, Bell, BarChart2, Loader, AlertCircle,
  ChevronRight, MessageSquare, Mail, GitCompare, FileSearch,
  SendHorizontal, Brain, Trash2, Save, ChevronDown, ChevronUp, Telescope,
} from 'lucide-react';
import { useClaudeAI } from '../../hooks/useClaudeAI';
import { useApp } from '../../context/AppContext';
import { calculerCoutsChantier } from '../../donnees';
import { joursReelsChantier } from '../../calculs/pointagesHelper';
import { DS } from '../../ds';

// ── Limite mémoire partagée ─────────────────────────────────────
const LIMITE_MEMOIRE = 8000;
function trimMemoire(texte) {
  if (texte.length <= LIMITE_MEMOIRE) return texte;
  const coupe = texte.slice(texte.length - LIMITE_MEMOIRE);
  const premier = coupe.indexOf('\n');
  return premier >= 0 ? coupe.slice(premier + 1) : coupe;
}

// ── Mémoire CYNA partagée (localStorage) ──────────────────────
function useMemoire() {
  const [memoire, setMemoireState] = useState(() => localStorage.getItem('cyna_ia_memoire') || '');

  const setMemoire = useCallback((texte) => {
    setMemoireState(texte);
    localStorage.setItem('cyna_ia_memoire', texte);
  }, []);

  // Sauvegarde explicite (PanneauMemoire)
  const sauvegarder = useCallback((extrait) => {
    const date = new Date().toLocaleDateString('fr-CH');
    const ligne = `[${date}] ${extrait.slice(0, 400)}`;
    setMemoireState(prev => {
      const update = trimMemoire(prev ? `${prev}\n${ligne}` : ligne);
      localStorage.setItem('cyna_ia_memoire', update);
      return update;
    });
  }, []);

  // Auto-save : extrait compact (1-2 phrases max) ajouté automatiquement
  const autoSave = useCallback((contexte, reponse) => {
    const date = new Date().toLocaleDateString('fr-CH');
    const apercu = reponse.replace(/\n+/g, ' ').replace(/\*\*/g, '').slice(0, 200);
    const ligne = `[${date}][${contexte}] ${apercu}`;
    setMemoireState(prev => {
      const update = trimMemoire(prev ? `${prev}\n${ligne}` : ligne);
      localStorage.setItem('cyna_ia_memoire', update);
      return update;
    });
  }, []);

  return { memoire, setMemoire, sauvegarder, autoSave };
}

// ── Compteur d'insights mémoire ────────────────────────────────
function compteurInsights(memoire) {
  if (!memoire) return 0;
  return (memoire.match(/^\[/gm) || []).length;
}

// ── Rendu gras inline ──────────────────────────────────────────
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

// ── Rendu Markdown simplifié ───────────────────────────────────
function MarkdownSimple({ texte }) {
  if (!texte) return null;
  const lignes = texte.split('\n');
  return (
    <div style={{ lineHeight: 1.7, color: 'var(--text-main)', fontSize: 14 }}>
      {lignes.map((ligne, i) => {
        if (!ligne.trim()) return <br key={i} />;
        if (ligne.startsWith('**') && ligne.endsWith('**'))
          return <p key={i} style={{ fontWeight: 700, color: DS.brand.secondary, marginTop: 12, marginBottom: 4 }}>{ligne.replace(/\*\*/g, '')}</p>;
        if (ligne.startsWith('- ') || ligne.startsWith('• '))
          return <p key={i} style={{ paddingLeft: 16, marginBottom: 4 }}>• <GrasInline texte={ligne.replace(/^[-•]\s/, '')} /></p>;
        return <p key={i} style={{ marginBottom: 4 }}><GrasInline texte={ligne} /></p>;
      })}
    </div>
  );
}

// ── Bloc résultat IA — mémoire automatique ─────────────────────
function ResultatIA({ texte, error, loading }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '24px 0', color: DS.brand.secondary }}>
        <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 14 }}>Claude analyse en cours…</span>
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
        </div>
      </div>
    );
  }
  if (!texte) return null;
  return (
    <div style={{ background: 'var(--bg-page)', borderRadius: 10, padding: '16px 18px', border: '1px solid var(--border)', marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: DS.brand.secondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <Sparkles size={12} /> Analyse Claude AI
        </div>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: DS.brand.secondary, opacity: 0.7 }}>
          <Brain size={11} /> Mémorisé automatiquement
        </span>
      </div>
      <MarkdownSimple texte={texte} />
    </div>
  );
}

// ── Suite de conversation après une analyse initiale ───────────
function ConversationSuite({ contexteInitial, memoire, autoSave, placeholder }) {
  const { appeler, loading, error } = useClaudeAI();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const prevContexteRef = useRef('');
  const bottomRef = useRef(null);

  // Quand une nouvelle analyse arrive, l'injecter dans la conversation
  // sans effacer l'historique — Claude accumule tout pour apprendre
  useEffect(() => {
    if (!contexteInitial || contexteInitial === prevContexteRef.current) return;
    prevContexteRef.current = contexteInitial;
    if (messages.length > 0) {
      // Ajouter un séparateur visuel + la nouvelle analyse dans le fil
      setMessages(prev => [
        ...prev,
        { role: 'system_sep', content: '── Nouvelle analyse ──' },
        { role: 'assistant', content: contexteInitial },
      ]);
    }
  }, [contexteInitial]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const envoyer = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setInput('');
    const newMessages = [...messages, { role: 'user', content: question }];
    setMessages(newMessages);
    // Construire l'historique complet pour l'API : analyse initiale en tête + tout l'historique
    const historique = [
      { role: 'assistant', content: contexteInitial },
      // filtrer les séparateurs visuels — l'API ne les voit pas
      ...newMessages.filter(m => m.role !== 'system_sep'),
    ];
    const reponse = await appeler('chat_libre', {
      messages: historique.slice(-40),
      contexte_cyna: memoire,
    });
    if (reponse) {
      setMessages(prev => [...prev, { role: 'assistant', content: reponse }]);
      if (autoSave) autoSave('Suivi', reponse);
    }
  };

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: DS.brand.secondary, display: 'flex', alignItems: 'center', gap: 6, marginBottom: messages.length > 0 ? 12 : 10 }}>
        <MessageSquare size={13} /> Continuer la discussion
      </div>

      {messages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12, maxHeight: 420, overflowY: 'auto', paddingRight: 2 }}>
          {messages.map((msg, i) =>
            msg.role === 'system_sep'
              ? <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>NOUVELLE ANALYSE</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
              : <BulleMessage key={i} msg={msg} />
          )}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: DS.brand.secondary, fontSize: 13 }}>
              <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Claude réfléchit…
            </div>
          )}
          {error && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 10, border: '1px solid #fecaca', color: '#dc2626', fontSize: 13 }}>{error}</div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer(); } }}
          placeholder={placeholder || 'Posez une question de suivi… (Entrée pour envoyer)'}
          rows={2}
          style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13, resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
        />
        <button
          onClick={envoyer}
          disabled={!input.trim() || loading}
          style={{ ...DS.btnPrimary, padding: '10px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', opacity: (!input.trim() || loading) ? 0.5 : 1, flexShrink: 0 }}>
          <SendHorizontal size={15} />
        </button>
      </div>
    </div>
  );
}

// ── Panneau mémoire CYNA (global + condenseur) ────────────────
function PanneauMemoire({ memoire, onSave }) {
  const { appeler, loading } = useClaudeAI();
  const [texte, setTexte] = useState(memoire);
  const [sauve, setSauve] = useState(false);
  const nb = compteurInsights(memoire);

  useEffect(() => { setTexte(memoire); }, [memoire]);

  const sauver = () => {
    onSave(texte);
    setSauve(true);
    setTimeout(() => setSauve(false), 2000);
  };

  const condenser = async () => {
    if (!memoire.trim()) return;
    const condensee = await appeler('resumer_memoire', { memoire });
    if (condensee) {
      setTexte(condensee);
      onSave(condensee);
    }
  };

  return (
    <div style={{ background: 'var(--bg-page)', border: `1px solid ${DS.brand.secondary}44`, borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: DS.brand.secondary, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Brain size={13} /> Mémoire CYNA
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {nb > 0 && (
            <span style={{ fontSize: 11, background: DS.brand.soft, color: DS.brand.secondary, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
              {nb} insight{nb > 1 ? 's' : ''} accumulé{nb > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
        Claude lit cette mémoire dans <strong>chaque</strong> analyse, email, anticipation et conversation. Elle s'enrichit automatiquement après chaque analyse.
      </p>
      <textarea value={texte} onChange={e => setTexte(e.target.value)} rows={7}
        placeholder={`Exemples :\n- CYNA SÀRL spécialisée en faux-plafonds et faux-planchers à Genève\n- Principaux clients : architectes et promoteurs genevois\n- Tarif journalier moyen : CHF 750 chargé\n- Marge cible : 22% minimum\n- Équipe : 8 employés dont 3 chefs de chantier`}
        style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 12, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={sauver}
          style={{ ...DS.btnPrimary, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Save size={13} /> {sauve ? 'Sauvegardé ✓' : 'Sauvegarder'}
        </button>
        {nb > 3 && (
          <button onClick={condenser} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: `1px solid ${DS.brand.secondary}55`, background: DS.brand.soft, color: DS.brand.secondary, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}>
            <Sparkles size={13} /> {loading ? 'Condensation…' : 'Condenser avec Claude'}
          </button>
        )}
        {texte && (
          <button onClick={() => { setTexte(''); onSave(''); }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Trash2 size={13} /> Effacer tout
          </button>
        )}
      </div>
      {nb > 3 && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
          💡 "Condenser avec Claude" réorganise et nettoie la mémoire automatiquement pour la garder efficace.
        </p>
      )}
    </div>
  );
}

// ── Onglet : Analyser un chantier ─────────────────────────────
function AnalyseChantier({ memoire, onSauvegarder, autoSave }) {
  const { chantiers, devis, parametres, pointages = [] } = useApp();
  const { appeler, loading, error } = useClaudeAI();
  const [chantierId, setChantierId] = useState('');
  const [resultat, setResultat] = useState('');
  const actifs = chantiers.filter(c => c.statut?.trim().toLowerCase() !== 'annulé');

  const analyser = async () => {
    const c = chantiers.find(ch => String(ch.id) === String(chantierId));
    if (!c) return;
    const couts = calculerCoutsChantier(c, parametres?.employes || [], parametres?.localites || [], parametres?.parametres || {}, devis, pointages);
    const joursReels = joursReelsChantier(pointages, c.id);
    const texte = await appeler('analyser_chantier', {
      nom: c.nom || c.numero, ca: couts.montantTotal, coutReel: couts.totalCoutsReel,
      margePct: couts.margeActuellePct, avancement: parseFloat(c.avancement) || 0,
      joursPrevus: c.nombreJours, joursReels, statut: c.statut,
      eac: couts.eac, rad: couts.rad, contexte_cyna: memoire,
    });
    if (texte) { setResultat(texte); autoSave(`Chantier ${c.nom || c.numero}`, texte); }
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Sélectionne un chantier pour obtenir un diagnostic IA avec recommandations.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <select value={chantierId} onChange={e => setChantierId(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13 }}>
          <option value="">— Choisir un chantier —</option>
          {actifs.map(c => <option key={c.id} value={c.id}>{c.nom || c.numero} — {c.statut}</option>)}
        </select>
        <button onClick={analyser} disabled={!chantierId || loading}
          style={{ ...DS.btnPrimary, display: 'flex', alignItems: 'center', gap: 6, opacity: (!chantierId || loading) ? 0.6 : 1 }}>
          <Sparkles size={14} /> Analyser
        </button>
      </div>
      <ResultatIA texte={resultat} error={error} loading={loading} onSauvegarder={onSauvegarder} />
      {resultat && <ConversationSuite contexteInitial={resultat} memoire={memoire} autoSave={autoSave} placeholder='Ex: "Que faire pour améliorer cette marge ?" "Quels risques de dépassement ?"…' />}
    </div>
  );
}

// ── Onglet : Suggestion de devis ──────────────────────────────
function SuggestionDevis({ memoire, onSauvegarder, autoSave }) {
  const { appeler, loading, error } = useClaudeAI();
  const [form, setForm] = useState({ description: '', typeTraveaux: '', surface: '', finition: 'standard' });
  const [resultat, setResultat] = useState('');

  const generer = async () => {
    if (!form.description.trim()) return;
    const texte = await appeler('suggerer_devis', { ...form, contexte_cyna: memoire });
    if (texte) { setResultat(texte); autoSave(`Devis ${form.typeTraveaux || form.description.slice(0, 30)}`, texte); }
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
      {champ('Description des travaux *', 'description', { textarea: true, placeholder: 'Ex: Pose de faux-plafond en plaque de plâtre + isolation acoustique dans un bureau de 80m²…' })}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {champ('Type de travaux', 'typeTraveaux', { placeholder: 'Ex: Faux-plafond, carrelage…' })}
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
        <Sparkles size={14} /> Générer le chiffrage
      </button>
      <ResultatIA texte={resultat} error={error} loading={loading} onSauvegarder={onSauvegarder} />
      {resultat && <ConversationSuite contexteInitial={resultat} memoire={memoire} autoSave={autoSave} placeholder='Ex: "Ajoute la pose de rails", "Quel délai pour ce chantier ?", "Monte le niveau premium"…' />}
    </div>
  );
}

// ── Onglet : Explication des alertes ──────────────────────────
function ExplicationAlertes({ memoire, onSauvegarder, autoSave }) {
  const { agentState } = useApp();
  const { appeler, loading, error } = useClaudeAI();
  const [resultat, setResultat] = useState('');
  const alertes = agentState?.alertes || [];
  const nonLues = alertes.filter(a => !a.lu);

  const expliquer = async () => {
    const texte = await appeler('expliquer_alertes', {
      alertes: nonLues.slice(0, 15).map(a => ({ niveau: a.niveau, message: a.message, detail: a.detail, agent: a.agent })),
      contexte_cyna: memoire,
    });
    if (texte) { setResultat(texte); autoSave('Alertes', texte); }
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
        <Sparkles size={14} /> Expliquer les alertes
      </button>
      <ResultatIA texte={resultat} error={error} loading={loading} onSauvegarder={onSauvegarder} />
      {resultat && <ConversationSuite contexteInitial={resultat} memoire={memoire} autoSave={autoSave} placeholder="Ex: Quelle est la priorité absolue ? Comment résoudre l'alerte sur le chantier X ?" />}
    </div>
  );
}

// ── Onglet : Analyse globale ───────────────────────────────────
function AnalysePortefeuille({ memoire, onSauvegarder, autoSave }) {
  const { chantiers, devis, factures, parametres, pointages = [] } = useApp();
  const { appeler, loading, error } = useClaudeAI();
  const [resultat, setResultat] = useState('');

  const analyser = async () => {
    const actifs = chantiers.filter(c => c.statut?.trim().toLowerCase() !== 'annulé');
    const chantiersData = actifs.map(c => {
      const couts = calculerCoutsChantier(c, parametres?.employes || [], parametres?.localites || [], parametres?.parametres || {}, devis, pointages);
      return { nom: c.nom || c.numero, ca: couts.montantTotal, marge: couts.margeActuellePct, statut: c.statut };
    });
    const caTotal = chantiersData.reduce((s, c) => s + (c.ca || 0), 0);
    const margesValides = chantiersData.filter(c => c.marge != null && Number.isFinite(c.marge));
    const margeMoyenne = margesValides.length > 0 ? margesValides.reduce((s, c) => s + c.marge, 0) / margesValides.length : null;
    const facture = factures.filter(f => f.statut?.trim().toLowerCase() === 'payée').reduce((s, f) => s + (parseFloat(f.montantHT) || 0), 0);
    const texte = await appeler('analyse_portefeuille', { chantiers: chantiersData, caTotal, margeMoyenne, facture, contexte_cyna: memoire });
    if (texte) { setResultat(texte); autoSave('Portefeuille', texte); }
  };

  const nbActifs = chantiers.filter(c => ['en cours', 'planifié'].includes(c.statut?.trim().toLowerCase())).length;

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Analyse stratégique de ton portefeuille complet — tendances, risques, décisions à prendre.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {[{ label: 'Chantiers actifs', val: nbActifs }, { label: 'Total chantiers', val: chantiers.length }, { label: 'Factures', val: factures.length }].map(k => (
          <div key={k.label} style={{ padding: '10px 16px', background: DS.brand.soft, borderRadius: 10, border: `1px solid ${DS.brand.secondary}33` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: DS.brand.secondary }}>{k.val}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{k.label}</div>
          </div>
        ))}
      </div>
      <button onClick={analyser} disabled={chantiers.length === 0 || loading}
        style={{ ...DS.btnPrimary, display: 'flex', alignItems: 'center', gap: 6, opacity: (chantiers.length === 0 || loading) ? 0.6 : 1 }}>
        <Sparkles size={14} /> Analyser le portefeuille
      </button>
      <ResultatIA texte={resultat} error={error} loading={loading} onSauvegarder={onSauvegarder} />
      {resultat && <ConversationSuite contexteInitial={resultat} memoire={memoire} autoSave={autoSave} placeholder='Ex: "Quel chantier sacrifier en priorité ?", "Comment améliorer la marge globale ?"…' />}
    </div>
  );
}

// ── Onglet : Anticiper ─────────────────────────────────────────
function Anticiper({ memoire, onSauvegarder, autoSave }) {
  const { chantiers, devis, factures, parametres, agentState, pointages = [] } = useApp();
  const { appeler, loading, error } = useClaudeAI();
  const [horizon, setHorizon] = useState('30');
  const [resultat, setResultat] = useState('');

  const anticiper = async () => {
    const chantiersData = chantiers
      .filter(c => c.statut?.trim().toLowerCase() !== 'annulé')
      .map(c => {
        const couts = calculerCoutsChantier(c, parametres?.employes || [], parametres?.localites || [], parametres?.parametres || {}, devis, pointages);
        return {
          nom: c.nom || c.numero,
          statut: c.statut,
          avancement: parseFloat(c.avancement) || 0,
          marge: couts.margeActuellePct,
          ca: couts.montantTotal,
          coutReel: couts.totalCoutsReel,
          eac: couts.eac,
          rad: couts.rad,
          finPrevue: c.dateFin,
          joursPrevus: c.nombreJours,
        };
      });

    const facturesEnCours = factures
      .filter(f => f.statut?.trim().toLowerCase() !== 'payée')
      .map(f => ({ montantHT: parseFloat(f.montantHT) || 0, statut: f.statut, dateEmission: f.dateEmission }));

    const alertes = (agentState?.alertes || [])
      .filter(a => !a.lu)
      .slice(0, 20)
      .map(a => ({ niveau: a.niveau, message: a.message }));

    const texte = await appeler('anticiper', {
      horizon: parseInt(horizon),
      chantiers: chantiersData,
      facturesEnCours,
      alertes,
      contexte_cyna: memoire,
    });
    if (texte) { setResultat(texte); autoSave(`Anticipation J+${horizon}`, texte); }
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Claude analyse toutes vos données en temps réel et prédit ce qui va se passer — risques, opportunités, trésorerie, chantiers en danger.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Horizon de prévision :</span>
        {['30', '60', '90'].map(j => (
          <button key={j} onClick={() => setHorizon(j)}
            style={{ padding: '7px 18px', borderRadius: 20, border: `1px solid ${horizon === j ? DS.brand.secondary : 'var(--border)'}`, background: horizon === j ? DS.brand.soft : 'transparent', color: horizon === j ? DS.brand.secondary : 'var(--text-main)', fontWeight: horizon === j ? 700 : 400, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            J+{j}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { label: 'Chantiers analysés', val: chantiers.filter(c => c.statut?.trim().toLowerCase() !== 'annulé').length },
          { label: 'Factures en attente', val: factures.filter(f => f.statut?.trim().toLowerCase() !== 'payée').length },
          { label: 'Alertes actives', val: (agentState?.alertes || []).filter(a => !a.lu).length },
        ].map(k => (
          <div key={k.label} style={{ padding: '10px 16px', background: DS.brand.soft, borderRadius: 10, border: `1px solid ${DS.brand.secondary}33` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: DS.brand.secondary }}>{k.val}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{k.label}</div>
          </div>
        ))}
      </div>
      <button onClick={anticiper} disabled={chantiers.length === 0 || loading}
        style={{ ...DS.btnPrimary, display: 'flex', alignItems: 'center', gap: 6, opacity: (chantiers.length === 0 || loading) ? 0.6 : 1 }}>
        <Telescope size={14} /> Anticiper à J+{horizon}
      </button>
      <ResultatIA texte={resultat} error={error} loading={loading} onSauvegarder={onSauvegarder} />
      {resultat && <ConversationSuite contexteInitial={resultat} memoire={memoire} autoSave={autoSave} placeholder='Ex: "Et si on retarde le chantier X ?", "Comment sécuriser la trésorerie ?", "Quel scénario pessimiste ?"…' />}
    </div>
  );
}

// ── Bulle de message (Chat libre) ──────────────────────────────
function BulleMessage({ msg }) {
  const estUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: estUser ? 'flex-end' : 'flex-start', gap: 4 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>
        {estUser ? 'Vous' : '✦ Claude AI'}
      </div>
      <div style={{
        maxWidth: '88%', padding: '10px 14px',
        borderRadius: estUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: estUser ? DS.brand.secondary : 'var(--bg-page)',
        color: estUser ? '#fff' : 'var(--text-main)',
        border: estUser ? 'none' : '1px solid var(--border)',
        fontSize: 13, lineHeight: 1.65,
      }}>
        {estUser ? msg.content : <MarkdownSimple texte={msg.content} />}
      </div>
    </div>
  );
}

// ── Onglet : Chat libre (multi-tours + mémoire) ────────────────
function ChatLibre({ memoire, setMemoire }) {
  const { appeler, loading, error } = useClaudeAI();
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cyna_chat_history') || '[]'); } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [showMemoire, setShowMemoire] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (messages.length > 0) {
      localStorage.setItem('cyna_chat_history', JSON.stringify(messages.slice(-60)));
    }
  }, [messages]);

  const envoyer = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setInput('');
    const newMessages = [...messages, { role: 'user', content: question }];
    // Cap RAM à 100 messages, envoie uniquement les 30 derniers à l'API
    const cappedMessages = newMessages.slice(-100);
    setMessages(cappedMessages);
    const reponse = await appeler('chat_libre', { messages: cappedMessages.slice(-30), contexte_cyna: memoire });
    if (reponse) {
      setMessages(prev => [...prev, { role: 'assistant', content: reponse }].slice(-100));
      // Auto-mémorisation de chaque réponse
      const date = new Date().toLocaleDateString('fr-CH');
      const ligne = `[${date}] ${reponse.slice(0, 300)}`;
      setMemoire(trimMemoire(memoire ? `${memoire}\n${ligne}` : ligne));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: 'calc(100vh - 280px)', minHeight: 420 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setShowMemoire(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: `1px solid ${DS.brand.secondary}55`, background: memoire ? DS.brand.soft : 'transparent', color: DS.brand.secondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Brain size={13} />
          Mémoire CYNA {memoire ? '(active)' : '(vide)'}
          {showMemoire ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {messages.length > 0 && (
          <button onClick={() => { setMessages([]); localStorage.removeItem('cyna_chat_history'); }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Trash2 size={12} /> Nouvelle conversation
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
          {messages.length > 0 ? `${Math.floor(messages.length / 2)} échange${messages.length > 2 ? 's' : ''}` : 'Conversation vide'}
        </span>
      </div>

      {showMemoire && <PanneauMemoire memoire={memoire} onSave={setMemoire} />}

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 2px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '40px 0' }}>
            <Sparkles size={28} style={{ margin: '0 auto 12px', display: 'block', color: DS.brand.secondary, opacity: 0.5 }} />
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Bonjour, je suis Claude AI</div>
            <div style={{ fontSize: 12 }}>Posez-moi n'importe quelle question sur vos chantiers, devis, réglementation BTP…</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Je mémorise notre conversation et apprends à connaître CYNA.</div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i}>
            <BulleMessage msg={msg} />
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: DS.brand.secondary, fontSize: 13 }}>
            <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
            Claude réfléchit…
          </div>
        )}
        {error && (
          <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: '#fef2f2', borderRadius: 10, border: '1px solid #fecaca', color: '#dc2626', fontSize: 13 }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer(); } }}
          placeholder="Posez votre question… (Entrée pour envoyer, Maj+Entrée pour saut de ligne)"
          rows={2}
          style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13, resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
        />
        <button onClick={envoyer} disabled={!input.trim() || loading}
          style={{ ...DS.btnPrimary, padding: '10px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, opacity: (!input.trim() || loading) ? 0.5 : 1, flexShrink: 0 }}>
          <SendHorizontal size={15} />
        </button>
      </div>
    </div>
  );
}

// ── Onglet : Générer email (conversationnel) ───────────────────
function GenererEmail({ memoire, onSauvegarder }) {
  const { appeler, loading, error } = useClaudeAI();
  const [form, setForm] = useState({ type: 'Relance facture', destinataire: '', contexte: '', montant: '' });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState('form'); // 'form' | 'chat'
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const inputStyle = { padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13, fontFamily: 'inherit' };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' };
  const fieldStyle = { display: 'flex', flexDirection: 'column', gap: 4 };

  const envoyer = async (question) => {
    const q = (question ?? input).trim();
    if (!q || loading) return;
    if (!question) setInput('');
    const newMessages = [...messages, { role: 'user', content: q }];
    setMessages(newMessages);
    const reponse = await appeler('chat_email', { emailParams: form, messages: newMessages, contexte_cyna: memoire });
    if (reponse) {
      setMessages(prev => [...prev, { role: 'assistant', content: reponse }]);
      if (onSauvegarder) onSauvegarder(reponse);
    }
  };

  const generer = async () => {
    if (!form.destinataire.trim() || !form.contexte.trim()) return;
    setPhase('chat');
    setMessages([]);
    const premierMsg = `Génère un email de type "${form.type}" pour ${form.destinataire}. Contexte : ${form.contexte}.${form.montant ? ` Montant : CHF ${form.montant}.` : ''}`;
    await envoyer(premierMsg);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Formulaire (toujours visible pour modifier) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Type d'email *</label>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inputStyle}>
            <option value="Relance facture">Relance facture</option>
            <option value="Avis de travaux">Avis de travaux</option>
            <option value="Envoi devis">Envoi devis</option>
            <option value="Remerciement">Remerciement</option>
          </select>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Destinataire *</label>
          <input type="text" value={form.destinataire} onChange={e => setForm(f => ({ ...f, destinataire: e.target.value }))} placeholder="Ex: M. Dupont, Société XYZ SA" style={inputStyle} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Montant (optionnel)</label>
          <input type="text" value={form.montant} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} placeholder="Ex: 12000" style={inputStyle} />
        </div>
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Contexte *</label>
        <textarea value={form.contexte} onChange={e => setForm(f => ({ ...f, contexte: e.target.value }))} rows={2}
          placeholder="Ex: Facture du 15 mai, CHF 12'000, impayée depuis 35 jours. Deuxième relance."
          style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
      <button onClick={generer} disabled={!form.destinataire.trim() || !form.contexte.trim() || loading}
        style={{ ...DS.btnPrimary, display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', opacity: (!form.destinataire.trim() || !form.contexte.trim() || loading) ? 0.6 : 1 }}>
        <Sparkles size={14} /> {phase === 'chat' ? 'Regénérer' : 'Générer l\'email'}
      </button>

      {/* Zone de conversation */}
      {phase === 'chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: DS.brand.secondary, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Mail size={12} /> Retouchez l'email directement en discutant
            </div>
            <button onClick={() => { setPhase('form'); setMessages([]); }}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Trash2 size={11} /> Recommencer
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 460, overflowY: 'auto' }}>
            {messages.map((msg, i) => (
              <div key={i}>
                <BulleMessage msg={msg} />
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: DS.brand.secondary, fontSize: 13 }}>
                <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Claude rédige…
              </div>
            )}
            {error && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 10, border: '1px solid #fecaca', color: '#dc2626', fontSize: 13 }}>
                {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer(); } }}
              placeholder='Ex: "Rends-le plus ferme", "Ajoute les intérêts moratoires", "Raccourcis le corps"…'
              rows={2}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13, resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
            />
            <button onClick={() => envoyer()} disabled={!input.trim() || loading}
              style={{ ...DS.btnPrimary, padding: '10px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', opacity: (!input.trim() || loading) ? 0.5 : 1, flexShrink: 0 }}>
              <SendHorizontal size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Onglet : Comparer devis ────────────────────────────────────
function ComparerDevis({ memoire, onSauvegarder, autoSave }) {
  const { appeler, loading, error } = useClaudeAI();
  const [devis1, setDevis1] = useState({ nom: '', montant: '', description: '' });
  const [devis2, setDevis2] = useState({ nom: '', montant: '', description: '' });
  const [criteres, setCriteres] = useState('');
  const [resultat, setResultat] = useState('');
  const inputStyle = { padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' };
  const fieldStyle = { display: 'flex', flexDirection: 'column', gap: 4 };

  const comparer = async () => {
    if (!devis1.nom.trim() || !devis2.nom.trim()) return;
    const texte = await appeler('comparer_devis', {
      devis1: { ...devis1, montant: parseFloat(devis1.montant) || 0 },
      devis2: { ...devis2, montant: parseFloat(devis2.montant) || 0 },
      criteres, contexte_cyna: memoire,
    });
    setResultat(texte);
  };

  const ColonneDevis = ({ titre, vals, setVals, accent }) => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', background: DS.brand.soft, borderRadius: 10, border: `1px solid ${accent}33` }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{titre}</div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Nom / Référence *</label>
        <input type="text" value={vals.nom} onChange={e => { setVals(v => ({ ...v, nom: e.target.value })); setResultat(''); }} placeholder="Ex: Devis Entreprise Alpha" style={inputStyle} />
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Montant HT (CHF)</label>
        <input type="number" value={vals.montant} onChange={e => setVals(v => ({ ...v, montant: e.target.value }))} placeholder="Ex: 45000" style={inputStyle} />
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Description / Prestations</label>
        <textarea value={vals.description} onChange={e => setVals(v => ({ ...v, description: e.target.value }))} rows={3}
          placeholder="Détails des prestations, délais, garanties…" style={{ ...inputStyle, resize: 'vertical' }} />
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
        <Sparkles size={14} /> Comparer
      </button>
      <ResultatIA texte={resultat} error={error} loading={loading} onSauvegarder={onSauvegarder} />
      {resultat && <ConversationSuite contexteInitial={resultat} memoire={memoire} autoSave={autoSave} placeholder="Ex: Lequel choisir si le délai est prioritaire ? Y a-t-il des risques cachés ?" />}
    </div>
  );
}

// ── Onglet : Analyser PDF (conversationnel) ────────────────────
function AnalyserPdfTexte({ memoire, onSauvegarder }) {
  const { appeler, loading, error } = useClaudeAI();
  const [texte, setTexte] = useState('');
  const [typeDoc, setTypeDoc] = useState('Devis');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState('form'); // 'form' | 'chat'
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const envoyer = async (question) => {
    const q = (question ?? input).trim();
    if (!q || loading) return;
    if (!question) setInput('');
    const newMessages = [...messages, { role: 'user', content: q }];
    setMessages(newMessages);
    const reponse = await appeler('chat_pdf', { pdfTexte: texte, typeDoc, messages: newMessages, contexte_cyna: memoire });
    if (reponse) {
      setMessages(prev => [...prev, { role: 'assistant', content: reponse }]);
      if (onSauvegarder) onSauvegarder(reponse);
    }
  };

  const analyser = async () => {
    if (!texte.trim()) return;
    setPhase('chat');
    setMessages([]);
    await envoyer(`Analyse ce ${typeDoc} en détail : résumé exécutif, informations clés, points de risque, conformité BTP suisse, et questions à clarifier.`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Formulaire (masqué en mode chat pour gagner de l'espace) */}
      {phase === 'form' ? (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            Colle le texte d'un document et discutez avec Claude dessus — analyse, questions sur des clauses, risques, conformité.
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>Type de document</label>
            <select value={typeDoc} onChange={e => setTypeDoc(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13 }}>
              <option value="Devis">Devis</option>
              <option value="Contrat">Contrat</option>
              <option value="CCTP">CCTP</option>
              <option value="Facture">Facture</option>
              <option value="Autre">Autre</option>
            </select>
          </div>
          <textarea value={texte} onChange={e => setTexte(e.target.value)} rows={9}
            placeholder="Colle le texte du PDF ici… (Ctrl+A dans votre lecteur PDF, puis copier-coller)"
            style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} />
          <button onClick={analyser} disabled={!texte.trim() || loading}
            style={{ ...DS.btnPrimary, display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', opacity: (!texte.trim() || loading) ? 0.6 : 1 }}>
            <Sparkles size={14} /> Analyser et discuter
          </button>
        </>
      ) : (
        /* Mode chat : résumé du document + bouton pour revenir */
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: DS.brand.soft, borderRadius: 10, border: `1px solid ${DS.brand.secondary}33` }}>
          <FileSearch size={14} color={DS.brand.secondary} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 12, color: DS.brand.secondary, fontWeight: 600 }}>
            {typeDoc} · {texte.length} caractères analysés
          </div>
          <button onClick={() => { setPhase('form'); setMessages([]); }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Trash2 size={11} /> Nouveau document
          </button>
        </div>
      )}

      {/* Zone de conversation */}
      {phase === 'chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: DS.brand.secondary, display: 'flex', alignItems: 'center', gap: 5 }}>
            <FileSearch size={12} /> Posez toutes vos questions sur ce document
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 460, overflowY: 'auto' }}>
            {messages.map((msg, i) => (
              <div key={i}>
                <BulleMessage msg={msg} />
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: DS.brand.secondary, fontSize: 13 }}>
                <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Claude analyse…
              </div>
            )}
            {error && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 10, border: '1px solid #fecaca', color: '#dc2626', fontSize: 13 }}>
                {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer(); } }}
              placeholder='Ex: "Quels sont les risques sur la clause 4 ?", "La TVA est-elle correcte ?", "Résume les délais importants"…'
              rows={2}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13, resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
            />
            <button onClick={() => envoyer()} disabled={!input.trim() || loading}
              style={{ ...DS.btnPrimary, padding: '10px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', opacity: (!input.trim() || loading) ? 0.5 : 1, flexShrink: 0 }}>
              <SendHorizontal size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Panneau principal ──────────────────────────────────────────
const FEATURES = [
  { id: 'anticiper',      label: 'Anticiper',             Icon: Telescope,     hasMemoire: true },
  { id: 'chantier',       label: 'Analyser un chantier',  Icon: Building2,     hasMemoire: true },
  { id: 'devis',          label: 'Suggestion de devis',   Icon: FileText,      hasMemoire: true },
  { id: 'alertes',        label: 'Expliquer les alertes', Icon: Bell,          hasMemoire: true },
  { id: 'portefeuille',   label: 'Analyse globale',       Icon: BarChart2,     hasMemoire: true },
  { id: 'chat_libre',     label: 'Chat libre',            Icon: MessageSquare, hasMemoire: true },
  { id: 'generer_email',  label: 'Générer email',         Icon: Mail,          hasMemoire: true },
  { id: 'comparer_devis', label: 'Comparer devis',        Icon: GitCompare,    hasMemoire: true },
  { id: 'analyser_pdf',   label: 'Analyser PDF',          Icon: FileSearch,    hasMemoire: true },
];

// ── Écran : Assistant IA désactivé (interrupteur OFF) ──────────
function IADesactivee() {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', padding: '28px 24px', maxWidth: 620 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Brain size={20} color={DS.brand.secondary} />
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Assistant IA désactivé</h3>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        L'Assistant IA est <strong>désactivé par défaut</strong> pour protéger la confidentialité de tes données.
        Tant qu'il est désactivé, <strong>aucune donnée de chantier ne quitte l'application</strong>.
      </p>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Pour l'activer : <strong>Paramètres → Confidentialité → Assistant IA</strong>. Tu verras alors précisément
        quelles données seraient envoyées à un service externe, et il te sera demandé de confirmer.
      </p>
    </div>
  );
}

// ── Écran : consentement avant le premier envoi (IA activée, pas encore confirmée) ──
function IAConsentement({ onAccept }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: `2px solid ${DS.brand.secondary}55`, padding: '28px 24px', maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <AlertCircle size={20} color={DS.brand.secondary} />
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Avant d'utiliser l'Assistant IA</h3>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Les analyses IA envoient certaines données de tes chantiers à un <strong>service externe (API Anthropic)</strong>
        pour générer les réponses. Selon l'analyse demandée, cela peut inclure :
      </p>
      <ul style={{ fontSize: 13, color: 'var(--text-main)', lineHeight: 1.8, margin: '10px 0 16px', paddingLeft: 20 }}>
        <li><strong>Noms de chantier</strong> (qui peuvent contenir un nom de client)</li>
        <li><strong>Montants : CA, coûts réels, marges, EAC/RAD</strong></li>
        <li>Le texte que tu saisis dans le chat et, le cas échéant, le contenu d'un PDF importé</li>
      </ul>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 18 }}>
        Aucune adresse, aucun téléphone ni email client n'est transmis. Tu peux désactiver l'Assistant IA
        à tout moment dans Paramètres → Confidentialité.
      </p>
      <button onClick={onAccept}
        style={{ ...DS.btnPrimary, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Sparkles size={14} /> J'ai compris — activer les analyses
      </button>
    </div>
  );
}

export default function ClaudeIAPanel() {
  const [feature, setFeature] = useState('anticiper');
  const { parametres, setParametres } = useApp();
  const iaActivee = parametres?.parametres?.iaActivee === true;
  const iaConsentement = parametres?.parametres?.iaConsentement === true;
  const { memoire, setMemoire, sauvegarder, autoSave } = useMemoire();
  const nb = compteurInsights(memoire);
  const active = FEATURES.find(f => f.id === feature);

  // Interrupteur maître OFF → panneau inactif, rien ne part.
  if (!iaActivee) return <IADesactivee />;
  // Activé mais pas encore confirmé → écran de consentement (avant tout premier envoi).
  if (!iaConsentement) {
    return (
      <IAConsentement
        onAccept={() => setParametres({ ...parametres, parametres: { ...parametres.parametres, iaConsentement: true } })}
      />
    );
  }

  const renderFeature = () => {
    const props = { memoire, onSauvegarder: sauvegarder, autoSave };
    switch (feature) {
      case 'anticiper':      return <Anticiper {...props} />;
      case 'chantier':       return <AnalyseChantier {...props} />;
      case 'devis':          return <SuggestionDevis {...props} />;
      case 'alertes':        return <ExplicationAlertes {...props} />;
      case 'portefeuille':   return <AnalysePortefeuille {...props} />;
      case 'chat_libre':     return <ChatLibre memoire={memoire} setMemoire={setMemoire} />;
      case 'generer_email':  return <GenererEmail memoire={memoire} onSauvegarder={sauvegarder} />;
      case 'comparer_devis': return <ComparerDevis {...props} />;
      case 'analyser_pdf':   return <AnalyserPdfTexte memoire={memoire} onSauvegarder={sauvegarder} />;
      default:               return null;
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'start' }}>
      {/* Menu latéral */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {/* Indicateur mémoire */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: memoire ? DS.brand.secondary : 'var(--text-muted)', fontWeight: 600 }}>
          <Brain size={11} />
          {nb > 0 ? `${nb} insight${nb > 1 ? 's' : ''} mémorisé${nb > 1 ? 's' : ''}` : 'Mémoire vide'}
        </div>
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
            <Sparkles size={11} /> Claude AI
          </div>
        </div>
        {renderFeature()}
      </div>
    </div>
  );
}
