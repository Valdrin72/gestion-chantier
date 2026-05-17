import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Building2, FileText, Bell, BarChart2, Loader, AlertCircle, ChevronRight, MessageSquare, Mail, GitCompare, FileSearch, SendHorizontal, Brain, Trash2, Save, ChevronDown, ChevronUp } from 'lucide-react';
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

// ── Bulle de message ───────────────────────────────────────────
function BulleMessage({ msg }) {
  const estUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: estUser ? 'flex-end' : 'flex-start', gap: 4 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>
        {estUser ? 'Vous' : '✦ Claude AI'}
      </div>
      <div style={{
        maxWidth: '88%',
        padding: '10px 14px',
        borderRadius: estUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: estUser ? DS.brand.secondary : 'var(--bg-page)',
        color: estUser ? '#fff' : 'var(--text-main)',
        border: estUser ? 'none' : '1px solid var(--border)',
        fontSize: 13,
        lineHeight: 1.65,
      }}>
        {estUser ? msg.content : <MarkdownSimple texte={msg.content} />}
      </div>
    </div>
  );
}

// ── Panneau mémoire CYNA ───────────────────────────────────────
function PanneauMemoire({ memoire, onSave }) {
  const [texte, setTexte] = useState(memoire);
  const [sauve, setSauve] = useState(false);

  const sauver = () => {
    onSave(texte);
    setSauve(true);
    setTimeout(() => setSauve(false), 2000);
  };

  return (
    <div style={{ background: 'var(--bg-page)', border: `1px solid ${DS.brand.secondary}44`, borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: DS.brand.secondary, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Brain size={13} /> Mémoire CYNA — Ce que Claude sait sur votre entreprise
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
        Écrivez ici tout ce que Claude doit mémoriser sur CYNA (clients importants, types de chantiers, préférences, tarifs, équipe…). Cette mémoire est active dans chaque conversation.
      </p>
      <textarea
        value={texte}
        onChange={e => setTexte(e.target.value)}
        rows={6}
        placeholder={`Exemples :\n- CYNA SÀRL est spécialisée en faux-plafonds et faux-planchers à Genève\n- Nos principaux clients : architectes et promoteurs genevois\n- Tarif journalier employé moyen : CHF 750 chargé\n- Marge cible : 22% minimum\n- Equipe : 8 employés dont 3 chefs de chantier`}
        style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={sauver}
          style={{ ...DS.btnPrimary, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Save size={13} />
          {sauve ? 'Sauvegardé ✓' : 'Sauvegarder la mémoire'}
        </button>
        {texte && (
          <button onClick={() => { setTexte(''); onSave(''); }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Trash2 size={13} />
            Effacer
          </button>
        )}
      </div>
    </div>
  );
}

// ── Onglet : Chat libre (conversation multi-tours) ─────────────
function ChatLibre() {
  const { appeler, loading, error } = useClaudeAI();
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cyna_chat_history') || '[]'); } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [memoire, setMemoire] = useState(() => localStorage.getItem('cyna_ia_memoire') || '');
  const [showMemoire, setShowMemoire] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (messages.length > 0) {
      localStorage.setItem('cyna_chat_history', JSON.stringify(messages.slice(-60)));
    }
  }, [messages]);

  const sauvegarderMemoire = (texte) => {
    setMemoire(texte);
    localStorage.setItem('cyna_ia_memoire', texte);
  };

  const envoyer = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setInput('');
    const newMessages = [...messages, { role: 'user', content: question }];
    setMessages(newMessages);

    const reponse = await appeler('chat_libre', {
      messages: newMessages,
      contexte_cyna: memoire,
    });

    if (reponse) {
      setMessages(prev => [...prev, { role: 'assistant', content: reponse }]);
    }
  };

  const effacerConversation = () => {
    setMessages([]);
    localStorage.removeItem('cyna_chat_history');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: 'calc(100vh - 280px)', minHeight: 420 }}>

      {/* Barre d'outils */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setShowMemoire(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: `1px solid ${DS.brand.secondary}55`, background: memoire ? DS.brand.soft : 'transparent', color: DS.brand.secondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Brain size={13} />
          Mémoire CYNA {memoire ? '(active)' : '(vide)'}
          {showMemoire ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {messages.length > 0 && (
          <button onClick={effacerConversation}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Trash2 size={12} />
            Nouvelle conversation
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
          {messages.length > 0 ? `${Math.floor(messages.length / 2)} échange${messages.length > 2 ? 's' : ''}` : 'Conversation vide'}
        </span>
      </div>

      {/* Panneau mémoire (rétractable) */}
      {showMemoire && <PanneauMemoire memoire={memoire} onSave={sauvegarderMemoire} />}

      {/* Zone de conversation */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 2px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '40px 0' }}>
            <Sparkles size={28} style={{ margin: '0 auto 12px', display: 'block', color: DS.brand.secondary, opacity: 0.5 }} />
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Bonjour, je suis Claude AI</div>
            <div style={{ fontSize: 12 }}>Posez-moi n'importe quelle question sur vos chantiers, devis, réglementation BTP…</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Je mémorise notre conversation et apprends à connaître CYNA.</div>
          </div>
        )}
        {messages.map((msg, i) => <BulleMessage key={i} msg={msg} />)}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: DS.brand.secondary, fontSize: 13 }}>
            <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
            Claude réfléchit…
          </div>
        )}
        {error && (
          <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: '#fef2f2', borderRadius: 10, border: '1px solid #fecaca', color: '#dc2626', fontSize: 13 }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Zone de saisie */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
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
