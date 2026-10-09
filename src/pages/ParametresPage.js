import ResumeImport from '../components/parametres/ResumeImport';
import CopiesSecours from '../components/parametres/CopiesSecours';
import { verifierSauvegarde, instantaneComplet, resumerImport, telechargerTexte, LIMITE_IMPORT } from '../utils/importControle';
import { ecrireCopieAvantImport } from '../utils/copiesRejetees';
import FormulaireMotDePasse from '../components/FormulaireMotDePasse';
import Corbeille from '../components/parametres/Corbeille';
import React, { useState, useLayoutEffect } from 'react';
import { ChevronRight, Menu } from 'lucide-react';
import { C } from '../donnees';
import { DS } from '../ds';
import { V1, mono, carteV1, heroFond, heroMono } from '../design/v1';
import { useApp } from '../context/AppContext';
import { pointagesApresRestauration } from '../utils/importGuard';
import SimulateurScenarios from '../demo/SimulateurScenarios';

// Bouton translucide du hero bleu nuit (mêmes tokens que les autres pages v1).
const heroBtn = { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, padding: '6px 11px', cursor: 'pointer', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' };


// Sanitise une saisie de taux financier : jamais NaN, jamais négatif.
// Champ vide ou non numérique → 0 ; valeur négative → clampée à 0.
function sanitizeFinancier(raw) {
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  return n;
}

// Champ de taux financier (onglet Devis).
// Buffer string local → la saisie décimale ("8.1", "1.0") n'est jamais cassée.
// Le commit dans parametres passe par sanitizeFinancier → jamais NaN/négatif.
function ChampFinancier({ label, fieldKey, isTVA, value, onCommit }) {
  const [buffer, setBuffer] = React.useState(value == null ? '' : String(value));
  const handle = (raw) => {
    setBuffer(raw);
    onCommit(fieldKey, sanitizeFinancier(raw));
  };
  return (
    <div style={{ background: isTVA ? 'rgba(16,185,129,0.05)' : 'var(--bg-glass-2)', border: `1px solid ${isTVA ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`, borderRadius: '12px', padding: '15px' }}>
      <label style={DS.label}>{label}</label>
      <input type="number"
        value={buffer}
        placeholder={isTVA ? '8.1' : ''}
        onChange={e => handle(e.target.value)}
        style={{ ...DS.input, fontWeight: 'bold', fontSize: '18px', color: isTVA ? '#10b981' : C.primaire, borderColor: isTVA ? '#10b981' : C.primaire, borderWidth: '2px' }} />
      {isTVA && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {(value == null || isNaN(value) || value === 0)
            ? <span style={{ color: '#10b981', fontWeight: 600 }}>✓ 8.1% appliqué automatiquement (taux légal CH 2024)</span>
            : <span>Taux actif : <strong style={{ color: '#10b981' }}>{value}%</strong> — TTC = HT × {Math.round((1 + value / 100) * 1000) / 1000}</span>
          }
          <br />
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Standard BTP Suisse : 8.1% · Pas de double comptage — appliqué une seule fois</span>
        </div>
      )}
    </div>
  );
}

const inputStyle = DS.input;
const labelStyle = DS.label;
const carteStyle = carteV1; // design v1 : toutes les cartes de section en style v1
const thStyle = DS.th;
const tdStyle = DS.td;
const btnPrimaire = DS.btnPrimary;
const btnSucces  = DS.btnSuccess;
const btnDanger  = DS.btnDanger;

function Parametres({ parametres, setParametres, clients = [], setClients = () => {}, chantiers = [], setChantiers = () => {}, devis = [], setDevis = () => {}, factures = [], setFactures = () => {}, pointages = [], setPointages = () => {}, naviguer = () => {} }) {
  // La page passe en « hero plein écran » (Topbar blanc masqué) comme les autres pages v1.
  useLayoutEffect(() => {
    document.body.classList.add('hero-fullscreen');
    return () => document.body.classList.remove('hero-fullscreen');
  }, []);
  const [onglet, setOnglet] = useState('dashboard');
  const [nouveauTravail, setNouveauTravail] = useState({ nom: '', unite: 'm²' });
  const [saved, setSaved] = useState(false);
  const timerSaved = React.useRef(null);
  const importRef = React.useRef(null);
  const { confirmer, afficherNotif, ouvrirMenu, listesCompletes, importerTout, userId, etatEnregistrement, envoyerMaintenant,
    objectifs, evenementsCalendrier, memoireIA, ecrireEtConfirmer, isDemo } = useApp();
  const [projetImport, setProjetImport] = useState(null);
  const [messageImport, setMessageImport] = useState(null);
  const messageImportRef = React.useRef(null);
  useLayoutEffect(() => { messageImportRef.current?.scrollIntoView?.({ block: "nearest" }); }, [messageImport]);
  const [occupeImport, setOccupeImport] = useState(false);
  const verrouImport = React.useRef(false);
  const [memoireVidee, setMemoireVidee] = useState(false);

  const iaActivee = parametres.parametres?.iaActivee !== false; // activé par défaut
  const toggleIA = (valeur) => {
    // Activer/désactiver l'Assistant IA. Désactiver ré-arme aussi le consentement
    // (une prochaine activation redemandera confirmation avant tout envoi).
    sauv({ ...parametres, parametres: { ...parametres.parametres, iaActivee: valeur, iaConsentement: valeur ? parametres.parametres?.iaConsentement : false } });
  };
  const effacerMemoireIA = async () => {
    if (confirmer && !await confirmer(isDemo
      ? 'Effacer la mémoire de l\'Assistant IA ?\n\nLes insights accumulés (localStorage) seront supprimés. Aucune donnée métier n\'est touchée.'
      : 'La mémoire de l\'Assistant IA sera effacée sur tous vos appareils. Aucune donnée métier n\'est touchée.', { labelOui: 'Effacer' })) return;
    if (!isDemo && (!ecrireEtConfirmer || !await ecrireEtConfirmer('memoireIA', ''))) {
      afficherNotif?.("Effacement impossible pour l'instant (modifications en cours d'enregistrement). Réessayez."); return;
    }
    localStorage.removeItem('cyna_ia_memoire');
    const resultat = isDemo ? { ok: true } : await envoyerMaintenant();
    setMemoireVidee(resultat.ok);
    if (afficherNotif) afficherNotif(resultat.ok ? 'Mémoire IA effacée' : 'Effacement enregistré sur cet appareil, en attente d’envoi (voir le bandeau)');
  };

  const etatActuel = () => ({ chantiers, devis, factures, clients, parametres, pointages, listesCompletes, objectifs, evenementsCalendrier, memoireIA });
  const refusEnregistrement = 'Des modifications ne sont pas encore enregistrées. Attendez l’enregistrement (ou téléchargez la copie de secours) avant d’importer.';
  const propre = () => !etatEnregistrement || etatEnregistrement().propre;
  const exporterDonnees = () => {
    const instantane = instantaneComplet(etatActuel());
    delete instantane.meta.source;
    telechargerTexte(JSON.stringify(instantane, null, 2), `cyna-backup-${instantane.meta.date.slice(0,10)}.json`);
  };
  const preparerImport = (data, tailleOctets) => {
    setMessageImport(null);
    if (!propre()) { setMessageImport({ texte: refusEnregistrement }); return; }
    const controle = verifierSauvegarde(data, { tailleOctets });
    if (controle.erreurs.length) {
      setMessageImport({ texte: controle.erreurs.slice(0,10).join('\n') + (controle.erreurs.length > 10 ? `\n… et ${controle.erreurs.length - 10} autres` : '') }); return;
    }
    setProjetImport({ ...controle, meta: data.meta, date: data.date });
  };
  const importerDonnees = async e => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    e.target.value = '';
    if (fichier.size > LIMITE_IMPORT) { setMessageImport({texte:'Le fichier dépasse 20 Mo.'}); return; }
    try { preparerImport(JSON.parse(await fichier.text()), fichier.size); }
    catch { setMessageImport({texte:'JSON invalide : impossible de lire la sauvegarde.'}); }
  };
  const confirmerImport = async () => {
    if (verrouImport.current) return;
    verrouImport.current = true;
    setOccupeImport(true);
    try {
      if (!propre()) { setMessageImport({texte:refusEnregistrement}); setProjetImport(null); return; }
      const instantane = instantaneComplet(etatActuel());
      const nom = `avant-import-${instantane.meta.date.slice(0,19).replace('T','_').replace(/:/g,'-')}.json`;
      try { telechargerTexte(JSON.stringify(instantane, null, 2), nom); }
      catch { setMessageImport({texte:"Copie de sécurité impossible : import annulé. Aucune donnée n'a été modifiée."}); setProjetImport(null); return; }
      const copie = ecrireCopieAvantImport(userId, instantane);
      if (!copie.ok) {
        setMessageImport({texte:copie.stockagePlein
          ? `Import annulé : le stockage de cet appareil est plein, la copie de sécurité locale n'a pas pu être enregistrée. Vos données n'ont pas été modifiées. Le fichier ${nom} a bien été téléchargé. Téléchargez vos copies de secours pour les garder en lieu sûr.`
          : "Copie de sécurité locale impossible : import annulé. Vos données n'ont pas été modifiées.", copies:copie.stockagePlein});
        setProjetImport(null); return;
      }
      const data = { ...projetImport.donnees, pointages: pointagesApresRestauration(projetImport.donnees, pointages).pointages };
      if (importerTout) {
        if (await importerTout(data) !== true) { setMessageImport({texte:!propre() ? refusEnregistrement : "Import non effectué. Vos données n'ont pas été modifiées. La copie de sécurité est conservée."}); setProjetImport(null); return; }
      } else {
        setParametres(data.parametres); setClients(data.clients); setChantiers(data.chantiers);
        setDevis(data.devis); setFactures(data.factures); setPointages(data.pointages);
      }
      const resultat = envoyerMaintenant ? await envoyerMaintenant() : { ok:false };
      setProjetImport(null);
      if (resultat.ok) setMessageImport({texte:`Sauvegarde restaurée et enregistrée. Copie de sécurité : ${nom} (téléchargé) et copie locale conservée.`});
      else if (resultat.conflit) {
        if (resultat.rechargementOk) setMessageImport({texte:"Import refusé : les données ont changé sur un autre appareil. Les données à jour ont été rechargées ; rien n'a été remplacé. Vos copies de sécurité sont conservées."});
      } else setMessageImport({texte:"Import appliqué sur cet appareil mais pas encore enregistré. Ne fermez pas l'application ; il sera réenvoyé dès que possible (voir le bandeau)."});
    } finally { verrouImport.current = false; setOccupeImport(false); }
  };

  const sauv = (data) => {
    setParametres(data);
    if (timerSaved.current) clearTimeout(timerSaved.current);
    setSaved(true);
    timerSaved.current = setTimeout(() => setSaved(false), 2500);
  };

  const onglets = [
    { id: 'compte', label: 'Mon compte', desc: 'Mot de passe' },
    { id: 'copies', label: 'Copies de secours', desc: 'Télécharger ou restaurer' },
    { id: 'corbeille', label: 'Corbeille', desc: 'Restaurer ou supprimer définitivement' },
    { id: 'dashboard', label: 'Réglages tableau de bord', desc: 'Alertes et affichage' },
    { id: 'chantiers', label: 'Légende des statuts', desc: 'Statuts et priorités (lecture seule)' },
    { id: 'devis', label: 'Devis', desc: 'Marges et tarifs' },
    { id: 'travaux', label: 'Travaux', desc: 'Types de travaux' },
    { id: 'societe', label: 'Société', desc: 'N° TVA · Coordonnées' },
    { id: 'paiements', label: 'Paiements', desc: 'Délais et rappels' },
    { id: 'rapport', label: 'Rapport', desc: 'Alertes hebdo' },
    { id: 'agents', label: 'Agents IA', desc: 'Seuils des alertes' },
  ];

  const AGENT_DEFAULTS = {
    seuilMargeDanger: 0,
    seuilMargeAttention: 15,
    seuilRetardAttention: 3,
    seuilRetardCritique: 7,
    seuilBudgetAttention: 5,
    seuilBudgetDanger: 20,
  };
  const agentConf = { ...AGENT_DEFAULTS, ...(parametres.agentsConfig?.alerteChantier || {}) };
  const sauvAgentConf = (key, val) => sauv({
    ...parametres,
    agentsConfig: {
      ...(parametres.agentsConfig || {}),
      alerteChantier: { ...agentConf, [key]: parseFloat(val) || 0 },
    },
  });

  return (
    <div>
      {messageImport && <div ref={messageImportRef} role="alert" data-testid="message-import" style={{whiteSpace:'pre-line',padding:16}}>{messageImport.texte}
        {messageImport.copies && <button onClick={() => setOnglet('copies')}>Voir les copies de secours</button>}
      </div>}
      {projetImport && <ResumeImport resume={resumerImport(etatActuel(), {...projetImport.donnees, meta:projetImport.meta, date:projetImport.date})}
        anomalies={projetImport.anomalies} ignorees={projetImport.ignorees} confirmer={confirmerImport}
        fermer={() => setProjetImport(null)} occupe={occupeImport} />}
      {/* ── Toast de confirmation ── */}
      {saved && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 9999,
          background: 'linear-gradient(135deg, rgba(16,185,129,0.95), rgba(5,150,105,0.95))',
          border: '1px solid rgba(16,185,129,0.5)', borderRadius: 14,
          padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 32px rgba(16,185,129,0.35)', backdropFilter: 'blur(12px)',
          animation: 'fadeIn 0.2s ease',
        }}>
          <span style={{ fontSize: 18 }}>✔</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>Paramètres enregistrés</span>
        </div>
      )}
      {/* ══ HERO BLEU NUIT (design v1, bord à bord, collé au sommet) ══ */}
      <div className="page-hero-bleed" data-testid="hero-parametres" style={{ ...heroFond, padding: '20px 32px 24px', position: 'relative' }}>
        <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={importerDonnees} />
        {/* Ligne 1 — ☰ · CYNA · PARAMÈTRES / 11 · boutons backup */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          {ouvrirMenu && (
            <button onClick={ouvrirMenu} aria-label="Menu" style={{ ...heroBtn, padding: 7 }}><Menu size={16} /></button>
          )}
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: '0.06em', color: '#fff' }}>CYNA</span>
          <span style={heroMono(10, 0.55)}>· PARAMÈTRES / 11</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => importRef.current?.click()} style={heroBtn} title="Restaurer depuis un fichier backup CYNA (.json)">Restaurer backup</button>
            <button onClick={exporterDonnees} style={heroBtn} title="Télécharger une sauvegarde complète de vos données">Exporter backup</button>
            <button onClick={() => sauv({ ...parametres })} style={{ ...heroBtn, background: 'rgba(74,222,128,0.2)', border: '1px solid rgba(74,222,128,0.5)', color: '#4ADE80', fontWeight: 700 }}>Sauvegarder tout</button>
          </div>
        </div>

        {/* Ligne 2 — titre + ligne mono */}
        <div style={heroMono(11, 0.6)}>PARAMÈTRES / 11</div>
        <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 34, margin: '8px 0 8px', letterSpacing: '-0.02em', color: '#fff' }}>Paramètres</h1>
        <div style={heroMono(11, 0.7)}>CONFIGURATION DE L'APPLICATION · SAUVEGARDE AUTOMATIQUE</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-params)', gap: 20, alignItems: 'start' }}>
        {/* ── Sidebar nav ── */}
        <div style={{ ...carteV1, padding: 8 }}>
          {onglets.map(o => {
            const isActive = onglet === o.id;
            return (
              <div key={o.id} onClick={() => setOnglet(o.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                background: isActive ? V1.bleu : 'transparent',
                color: isActive ? '#fff' : V1.texte,
                transition: 'all 0.15s', marginBottom: 2,
              }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 700 : 500 }}>{o.label}</span>
                <ChevronRight size={14} strokeWidth={2} style={{ color: isActive ? 'rgba(255,255,255,0.9)' : V1.texteMuted, flexShrink: 0 }} />
              </div>
            );
          })}
        </div>

        {/* ── Content panel ── */}
        <div>
      {onglet === 'compte' && <section style={carteStyle}><h2>Changer mon mot de passe</h2><FormulaireMotDePasse messageErreur="Impossible de modifier le mot de passe. Réessayez." onSucces={() => afficherNotif?.('Mot de passe modifié')} /></section>}
      {onglet === 'copies' && <CopiesSecours userId={userId} restaurer={preparerImport} />}
      {onglet === 'corbeille' && <Corbeille />}
      {onglet === 'dashboard' && (
        <div style={carteStyle}>
          {/* Simulateur de scénarios — visible uniquement en mode démo (self-gate) */}
          <SimulateurScenarios />
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Paramètres du Dashboard</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-form3)', gap: '15px' }}>
            {[['Alerte jours restants', 'joursAlerte'], ['Nb chantiers affichés', 'nbChantiersAffiche'], ['Période stats (mois)', 'periodeStats']].map(([label, key]) => (
              <div key={key} style={{ background: V1.bleuFond, border: `1px solid ${V1.bleu}22`, borderRadius: '12px', padding: '15px' }}>
                <label style={labelStyle}>{label}</label>
                <input type="number" value={parametres.parametres?.[key] || ''} placeholder="5"
                  onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, [key]: parseFloat(e.target.value) } })}
                  style={{ ...inputStyle, ...mono(18, V1.bleu, 700), borderColor: V1.bleu, borderWidth: '2px' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {onglet === 'chantiers' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Paramètres des Chantiers</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-form2)', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '12px' }}>Statuts disponibles</div>
              {['À chiffrer', 'Devis envoyé', 'Validé', 'En préparation', 'Planifié', 'En cours', 'Suspendu', 'Attente paiement', 'Terminé', 'Facturé', 'Clôturé'].map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: { 'En cours': C.warning, 'Attente paiement': C.orange, 'Terminé': C.secondaire, 'Planifié': C.info, 'Suspendu': C.danger, 'Facturé': V1.bleuMoyen }[s] || C.primaire }} />
                  <span style={{ fontSize: '14px' }}>{s}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '12px' }}>Priorités</div>
              {['Basse', 'Normale', 'Haute', 'Urgente'].map(p => (
                <div key={p} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '14px', color: 'var(--text-secondary)' }}>{p}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {onglet === 'devis' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Paramètres des Devis</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--g6)', gap: '15px' }}>
            {[['Marge cible (%)', 'margeCible'], ['Seuil min. (%)', 'seuilRentabiliteMin'], ['Plafond crédibilité (%)', 'plafondCredi'], ['Frais généraux (%)', 'tauxFraisGeneraux'], ['Coeff. MO', 'coefficientMainOeuvre'], ['TVA (%)', 'tauxTVA']].map(([label, key]) => (
              <ChampFinancier
                key={key}
                label={label}
                fieldKey={key}
                isTVA={key === 'tauxTVA'}
                value={parametres.parametres?.[key]}
                onCommit={(k, v) => sauv({ ...parametres, parametres: { ...parametres.parametres, [k]: v } })}
              />
            ))}
          </div>

          {/* Trésorerie — solde bancaire SAISI et HORODATÉ (jamais calculé automatiquement) */}
          <div className="ds-card-title" style={{ margin: '24px 0 12px' }}>Trésorerie</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Le solde bancaire est saisi manuellement (l'app ne voit pas salaires/charges/achats directs).
            La surveillance de trésorerie s'active uniquement avec un solde à jour (≤ 14 jours).
            <strong> La projection est optimiste : elle ajoute les encaissements attendus mais ne
            soustrait AUCUNE sortie (salaires, charges sociales, fournisseurs — non modélisées).</strong>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--g6)', gap: '15px' }}>
            <div>
              <label style={labelStyle}>Solde bancaire (CHF)</label>
              <input
                type="number"
                value={parametres.parametres?.soldeBancaire ?? ''}
                placeholder="ex. 45000"
                onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, soldeBancaire: e.target.value } })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Solde au (date, obligatoire)</label>
              <input
                type="date"
                value={parametres.parametres?.soldeBancaireDate ?? ''}
                onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, soldeBancaireDate: e.target.value } })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Seuil alerte trésorerie (CHF)</label>
              <input
                type="number"
                value={parametres.parametres?.seuilTresorerie ?? ''}
                placeholder="20000"
                onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, seuilTresorerie: e.target.value } })}
                style={inputStyle}
              />
            </div>
          </div>
        </div>
      )}


      {onglet === 'travaux' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Types de travaux</div>
          {/* Le prix/m² n'est PAS figé ici : il est un RÉSULTAT du devis réel (surface + prix saisis).
              La liste des types (nom + unité) reste la colonne vertébrale Devis/Chantiers/analyses. */}
          <table className="table-cards" style={{ width: '100%', marginBottom: '20px' }}>
            <thead><tr>
              {['Type de travaux', 'Unité', 'Action'].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {parametres.typesTravaux.map(t => (
                <tr key={t.id}>
                  <td style={tdStyle}><input value={t.nom} onChange={e => { const u = parametres.typesTravaux.map(tr => tr.id === t.id ? { ...tr, nom: e.target.value } : tr); sauv({ ...parametres, typesTravaux: u }); }} style={{ ...inputStyle, width: '200px' }} /></td>
                  <td style={tdStyle}><select value={t.unite} onChange={e => { const u = parametres.typesTravaux.map(tr => tr.id === t.id ? { ...tr, unite: e.target.value } : tr); sauv({ ...parametres, typesTravaux: u }); }} style={{ ...inputStyle, width: '100px' }}>{['m²', 'ml', 'unité', 'forfait'].map(u => <option key={u}>{u}</option>)}</select></td>
                  <td style={tdStyle}><button onClick={() => { if (window.confirm('Supprimer ce type de travaux ?')) sauv({ ...parametres, typesTravaux: parametres.typesTravaux.filter(tr => tr.id !== t.id) }); }} style={btnDanger}>Suppr</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '12px', marginTop: '24px' }}>Ajouter un type</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-3a)', gap: '10px', alignItems: 'end' }}>
            <div><label style={labelStyle}>Nom</label><input placeholder="Ex: Bardage" value={nouveauTravail.nom} onChange={e => setNouveauTravail({ ...nouveauTravail, nom: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Unité</label>
              <select value={nouveauTravail.unite} onChange={e => setNouveauTravail({ ...nouveauTravail, unite: e.target.value })} style={inputStyle}>
                {['m²', 'ml', 'unité', 'forfait'].map(u => <option key={u}>{u}</option>)}
              </select></div>
            <button onClick={() => {
              if (nouveauTravail.nom) {
                sauv({ ...parametres, typesTravaux: [...parametres.typesTravaux, { ...nouveauTravail, id: Date.now() }] });
                setNouveauTravail({ nom: '', unite: 'm²' });
              }
            }} style={btnPrimaire}>+ Ajouter</button>
          </div>
        </div>
      )}


      {onglet === 'societe' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: 8 }}>Coordonnées légales</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
            Ces informations apparaissent sur toutes les factures PDF. Obligatoires pour la conformité légale suisse.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 15 }}>
            <div style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 15 }}>
              <label style={labelStyle}>Nom de la société</label>
              <input type="text" placeholder="CYNA Sàrl"
                value={parametres.parametres?.nomSociete || ''}
                onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, nomSociete: e.target.value } })}
                style={inputStyle} />
            </div>
            <div style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: 15 }}>
              <label style={{ ...labelStyle, color: '#10b981' }}>N° TVA AFC (obligatoire)</label>
              <input type="text" placeholder="CHE-123.456.789 TVA"
                value={parametres.parametres?.nTVA || ''}
                onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, nTVA: e.target.value } })}
                style={{ ...inputStyle, borderColor: '#10b981', fontWeight: 700 }} />
              <div style={{ fontSize: 11, color: '#10b981', marginTop: 6 }}>Format : CHE-XXX.XXX.XXX TVA</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 15, marginBottom: 15 }}>
            <div style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 15 }}>
              <label style={labelStyle}>Adresse</label>
              <input type="text" placeholder="Cardinal-Journet 5"
                value={parametres.parametres?.adresseSoc || ''}
                onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, adresseSoc: e.target.value } })}
                style={inputStyle} />
            </div>
            <div style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 15 }}>
              <label style={labelStyle}>Code postal + Ville</label>
              <input type="text" placeholder="1217 Meyrin"
                value={parametres.parametres?.cpSoc || ''}
                onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, cpSoc: e.target.value } })}
                style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 15 }}>
            {[['Téléphone 1', 'tel1Soc', '078 747 14 48'], ['Téléphone 2', 'tel2Soc', '079 480 94 41'], ['Email', 'emailSoc', 'info@cyna.ch']].map(([label, key, ph]) => (
              <div key={key} style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 15 }}>
                <label style={labelStyle}>{label}</label>
                <input type="text" placeholder={ph}
                  value={parametres.parametres?.[key] || ''}
                  onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, [key]: e.target.value } })}
                  style={inputStyle} />
              </div>
            ))}
          </div>

          {/* ── Confidentialité — Assistant IA ─────────────────────────── */}
          <div className="ds-card-title" style={{ margin: '28px 0 8px' }}>Confidentialité — Assistant IA</div>
          <div style={{ background: iaActivee ? 'rgba(245,158,11,0.06)' : 'var(--bg-glass-2)', border: `2px solid ${iaActivee ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`, borderRadius: 12, padding: 18 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={iaActivee} onChange={e => toggleIA(e.target.checked)}
                style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0, cursor: 'pointer' }} />
              <span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Assistant IA (données anonymisées avant envoi)</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                  <strong>Activé.</strong> Avant chaque envoi, les <strong>noms de chantier, clients, employés, adresses et villes
                  sont remplacés par des étiquettes neutres</strong> ; seuls des montants et indicateurs sans nom sont transmis à
                  l'API Anthropic, et les vrais noms sont restaurés dans la réponse. Décoche pour couper complètement l'Assistant IA
                  (plus aucun appel réseau).
                </span>
              </span>
            </label>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={effacerMemoireIA}
                style={{ ...DS.btnDanger, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                Effacer la mémoire IA
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {memoireVidee ? 'Mémoire IA effacée.' : isDemo ? 'Supprime les insights accumulés localement (localStorage). N\'affecte aucune donnée métier.' : 'Efface la mémoire de l’Assistant IA sur tous vos appareils. Aucune donnée métier n’est touchée.'}
              </span>
            </div>
          </div>
        </div>
      )}

      {onglet === 'paiements' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Paramètres Paiements</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-form3)', gap: '15px' }}>
            {[['Délai paiement (jours)', 'delaiPaiement', 30], ['Alerte retard (jours)', 'alerteRetardPaiement', 7], ['Acompte standard (%)', 'acompteStandard', 30]].map(([label, key, defaut]) => (
              <div key={key} style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '15px' }}>
                <label style={labelStyle}>{label}</label>
                <input type="number" value={parametres.parametres?.[key] || defaut}
                  onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, [key]: parseFloat(e.target.value) } })}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: '18px', color: C.primaire, borderColor: C.primaire, borderWidth: '2px' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {onglet === 'rapport' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Paramètres du Rapport</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-form3)', gap: '15px' }}>
            {[['Seuil alerte chantier (jours)', 'joursAlerte', 5], ['Marge minimale alerte (%)', 'margeMinAlerte', 15], ['Montant retard alerte (CHF)', 'montantRetardAlerte', 1000]].map(([label, key, defaut]) => (
              <div key={key} style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '15px' }}>
                <label style={labelStyle}>{label}</label>
                <input type="number" value={parametres.parametres?.[key] || defaut}
                  onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, [key]: parseFloat(e.target.value) } })}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: '18px', color: C.primaire, borderColor: C.primaire, borderWidth: '2px' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {onglet === 'agents' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '8px' }}>Agent Alerte Chantier — Seuils</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 22 }}>
            Configure les seuils déclenchant les alertes automatiques sur les chantiers actifs.
            Les modifications sont prises en compte à la prochaine exécution de l'agent.
          </div>

          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 12 }}>Seuils de marge</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-form2)', gap: 15 }}>
              <div style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 15 }}>
                <label style={labelStyle}>Seuil ATTENTION (%)</label>
                <input type="number" min="0" max="100" value={agentConf.seuilMargeAttention}
                  onChange={e => sauvAgentConf('seuilMargeAttention', e.target.value)}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: 18, color: C.warning, borderColor: C.warning, borderWidth: 2 }} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Alerte orange si marge réelle en dessous</div>
              </div>
              <div style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 15 }}>
                <label style={labelStyle}>Seuil DANGER (%)</label>
                <input type="number" min="0" max="100" value={agentConf.seuilMargeDanger}
                  onChange={e => sauvAgentConf('seuilMargeDanger', e.target.value)}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: 18, color: C.danger, borderColor: C.danger, borderWidth: 2 }} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Alerte rouge si marge réelle en dessous</div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 12 }}>Seuils de retard</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-form2)', gap: 15 }}>
              <div style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 15 }}>
                <label style={labelStyle}>Seuil ATTENTION (jours)</label>
                <input type="number" min="0" max="100" value={agentConf.seuilRetardAttention}
                  onChange={e => sauvAgentConf('seuilRetardAttention', e.target.value)}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: 18, color: C.warning, borderColor: C.warning, borderWidth: 2 }} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Alerte orange à partir de ce nombre de jours</div>
              </div>
              <div style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 15 }}>
                <label style={labelStyle}>Seuil CRITIQUE (jours)</label>
                <input type="number" min="0" max="100" value={agentConf.seuilRetardCritique}
                  onChange={e => sauvAgentConf('seuilRetardCritique', e.target.value)}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: 18, color: C.danger, borderColor: C.danger, borderWidth: 2 }} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Alerte rouge au-delà de ce nombre de jours</div>
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 12 }}>Seuils de dépassement budget</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-form2)', gap: 15 }}>
              <div style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 15 }}>
                <label style={labelStyle}>Seuil ATTENTION (%)</label>
                <input type="number" min="0" max="100" value={agentConf.seuilBudgetAttention}
                  onChange={e => sauvAgentConf('seuilBudgetAttention', e.target.value)}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: 18, color: C.warning, borderColor: C.warning, borderWidth: 2 }} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Alerte orange au-delà de ce % de dépassement</div>
              </div>
              <div style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 15 }}>
                <label style={labelStyle}>Seuil DANGER (%)</label>
                <input type="number" min="0" max="100" value={agentConf.seuilBudgetDanger}
                  onChange={e => sauvAgentConf('seuilBudgetDanger', e.target.value)}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: 18, color: C.danger, borderColor: C.danger, borderWidth: 2 }} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Alerte rouge au-delà de ce % de dépassement</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => sauv({ ...parametres })} style={btnSucces}>Sauvegarder</button>
            <button
              onClick={() => sauv({ ...parametres, agentsConfig: { ...(parametres.agentsConfig || {}), alerteChantier: { ...AGENT_DEFAULTS } } })}
              style={btnPrimaire}
            >Réinitialiser aux valeurs par défaut</button>
          </div>
        </div>
      )}

        </div>{/* end content panel */}
      </div>{/* end 260/1fr grid */}
    </div>
  );
}

export default Parametres;
