// ============================================================
// CYNA — SOUMISSION ASSISTÉE
// Calcul automatique : temps, MO, coût total, prix de vente
// ============================================================
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Calculator, Plus, Trash2, FileText, Upload, TrendingUp, Users, Clock, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { C } from './donnees';
import { extraireDonneesPDF } from './ImportPDF';
import { DS } from './ds';

// ── Styles partagés ──────────────────────────────────────────
const inputS = { ...DS.input, padding: '7px 10px', fontSize: '13px' };
const labelS = { ...DS.label, textTransform: 'none', letterSpacing: 0, fontSize: '12px', fontWeight: 500 };
const carteS = DS.cardCompact;
const btnPrim = {
  background: C.primaire, color: '#fff', padding: '9px 18px', border: 'none',
  borderRadius: '9px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
  display: 'inline-flex', alignItems: 'center', gap: '7px',
  boxShadow: '0 2px 8px rgba(51,130,194,0.28)',
};
const btnSec = {
  background: 'transparent', color: C.primaire, padding: '8px 14px',
  border: `1.5px solid ${C.primaire}`, borderRadius: '9px', cursor: 'pointer',
  fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px',
};
const btnDng = {
  background: 'rgba(239,68,68,0.12)', color: C.danger,
  border: '1px solid rgba(239,68,68,0.28)',
  borderRadius: '8px', padding: '5px 9px', cursor: 'pointer', fontSize: '12px',
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  fontFamily: 'inherit',
};

// ── Table des métiers : mots-clés → { rendement (u/jour), unite }
// Les entrées avec des mots-clés plus longs sont plus spécifiques et
// priment sur les mots-clés courts (tri automatique par longueur desc.)
// ────────────────────────────────────────────────────────────────────
const METIERS = [
  // ── Carrelage / revêtement sol ──────────────────────────────
  { motsCles: ['carrelage sol'],           rendement: 8,   unite: 'm²' },
  { motsCles: ['carrelage'],               rendement: 8,   unite: 'm²' },
  { motsCles: ['revêtement sol', 'revetement sol'], rendement: 12, unite: 'm²' },
  { motsCles: ['faïence mur', 'faienc mur', 'faience mur'], rendement: 10, unite: 'm²' },
  { motsCles: ['faïence', 'faienc', 'faience'], rendement: 10, unite: 'm²' },
  { motsCles: ['parquet'],                 rendement: 12,  unite: 'm²' },
  { motsCles: ['moquette'],                rendement: 20,  unite: 'm²' },
  { motsCles: ['chape'],                   rendement: 20,  unite: 'm²' },
  // ── Peinture ────────────────────────────────────────────────
  { motsCles: ['peinture plafond'],        rendement: 25,  unite: 'm²' },
  { motsCles: ['peinture mur'],            rendement: 30,  unite: 'm²' },
  { motsCles: ['peinture'],                rendement: 18,  unite: 'm²' },
  // ── Plafonds / cloisons ──────────────────────────────────────
  { motsCles: ['faux plafond', 'plafond suspendu', 'faux-plafond'], rendement: 10, unite: 'm²' },
  { motsCles: ['cloison', 'placo', 'gyproc'], rendement: 12, unite: 'm²' },
  // ── Isolation ───────────────────────────────────────────────
  { motsCles: ['isolation', 'laine', 'phonique', 'thermique'], rendement: 20, unite: 'm²' },
  // ── Enduit / finitions ───────────────────────────────────────
  { motsCles: ['enduit', 'lissage', 'ratissage'], rendement: 18, unite: 'm²' },
  // ── Menuiserie / portes ──────────────────────────────────────
  { motsCles: ['menuiserie', 'cadre'],     rendement: 6,   unite: 'pce' },
  { motsCles: ['porte'],                   rendement: 5,   unite: 'pce' },
  { motsCles: ['pièce', 'piece', 'pce'],   rendement: 5,   unite: 'pce' },
  // ── Finitions linéaires ──────────────────────────────────────
  { motsCles: ['plinthe', 'plinthes'],     rendement: 25,  unite: 'ml' },
  { motsCles: ['silicone', 'joint'],       rendement: 80,  unite: 'ml' },
  // ── Étanchéité / démolition ──────────────────────────────────
  { motsCles: ['étanchéité', 'etancheite', 'étanch'], rendement: 15, unite: 'm²' },
  { motsCles: ['démolition', 'demolition', 'dépose'], rendement: 12, unite: 'm²' },
  // ── Régie / main-d'œuvre ─────────────────────────────────────
  { motsCles: ["main-d'œuvre", "main d'oeuvre", 'régie', 'regie', 'mo'], rendement: 1, unite: 'h' },
];

// Pré-trier une fois par longueur décroissante du mot-clé le plus long
// (les entrées les plus spécifiques passent en premier)
const METIERS_TRIES = [...METIERS].sort(
  (a, b) => Math.max(...b.motsCles.map(k => k.length)) - Math.max(...a.motsCles.map(k => k.length))
);

function detecterMetier(description) {
  const desc = (description || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // retire les accents pour la comparaison
  for (const metier of METIERS_TRIES) {
    const matchKeys = metier.motsCles.map(k =>
      k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );
    if (matchKeys.some(k => desc.includes(k))) return metier;
  }
  return { rendement: 10, unite: 'm²' }; // défaut neutre
}


// ── Phases chantier ──────────────────────────────────────────

// Ordre logique BTP (séquence travaux second œuvre)
const PHASES_ORDRE = ['demolition', 'gros_oeuvre', 'cloison', 'technique', 'plafond', 'sol', 'peinture', 'finition'];

const PHASES_CONFIG = {
  demolition:  { label: 'Démolition',      couleur: '#78909c' },
  gros_oeuvre: { label: 'Gros œuvre',      couleur: '#8d6e63' },
  cloison:     { label: 'Cloisons',        couleur: '#7e57c2' },
  technique:   { label: 'Technique',       couleur: '#26a69a' },
  plafond:     { label: 'Plafonds',        couleur: '#5c6bc0' },
  sol:         { label: 'Revêtement sol',  couleur: '#ef6c00' },
  peinture:    { label: 'Peinture',        couleur: '#ec407a' },
  finition:    { label: 'Finitions',       couleur: '#66bb6a' },
};

// Mots-clés → phase (entrées longues en premier = priorité au plus spécifique)
const PHASES_DETECT = [
  { motsCles: ['faux plafond', 'plafond suspendu', 'faux-plafond'],                          phase: 'plafond' },
  { motsCles: ['revêtement sol', 'revetement sol'],                                           phase: 'sol' },
  { motsCles: ['peinture plafond', 'peinture mur'],                                           phase: 'peinture' },
  { motsCles: ['maçonnerie', 'maconnerie'],                                                    phase: 'gros_oeuvre' },
  { motsCles: ['démolition', 'demolition', 'dépose', 'depose'],                               phase: 'demolition' },
  { motsCles: ['cloison', 'placo', 'gyproc'],                                                 phase: 'cloison' },
  { motsCles: ['électricité', 'electricite', 'electricité', 'plomberie', 'chauffage', 'cvs'], phase: 'technique' },
  { motsCles: ['béton', 'beton'],                                                              phase: 'gros_oeuvre' },
  { motsCles: ['carrelage', 'parquet', 'moquette', 'chape', 'faïence', 'faienc', 'faience'],  phase: 'sol' },
  { motsCles: ['peinture', 'enduit', 'lissage'],                                              phase: 'peinture' },
  { motsCles: ['isolation', 'laine'],                                                          phase: 'cloison' },
  { motsCles: ['plinthe', 'silicone', 'joint', 'porte', 'menuiserie', 'finition'],            phase: 'finition' },
];

// Pré-trier par longueur décroissante (même logique que METIERS_TRIES)
const PHASES_DETECT_TRIES = [...PHASES_DETECT].sort(
  (a, b) => Math.max(...b.motsCles.map(k => k.length)) - Math.max(...a.motsCles.map(k => k.length))
);

function detecterPhase(description) {
  const desc = (description || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const entry of PHASES_DETECT_TRIES) {
    const keys = entry.motsCles.map(k =>
      k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );
    if (keys.some(k => desc.includes(k))) return entry.phase;
  }
  return 'finition'; // phase par défaut
}

/**
 * Construit le planning à partir des lignes et des paramètres.
 * @param {Array}  lignes
 * @param {Array}  calcules   - résultats calcLigne (heuresBrutes en jours·équipe)
 * @param {object} params     - nbEmployes, heuresParJour
 * @returns {Array<{ phase, label, couleur, joursNet, jourDebut, jourFin }>}
 */
function calculerPlanning(lignes, calcules, params) {
  const nbEmp = Math.max(parseFloat(params.nbEmployes) || 1, 0.01);

  // Agréger les jours·équipe par phase
  const joursByPhase = {};
  lignes.forEach((l, i) => {
    const phase = detecterPhase(l.description);
    const jours = (calcules[i]?.heuresBrutes || 0); // déjà en jours·équipe
    joursByPhase[phase] = (joursByPhase[phase] || 0) + jours;
  });

  // Construire la liste ordonnée (uniquement les phases présentes + durée > 0)
  let jourCumulatif = 0;
  return PHASES_ORDRE
    .filter(p => joursByPhase[p] > 0)
    .map(p => {
      const cfg = PHASES_CONFIG[p];
      const joursNet = joursByPhase[p] / nbEmp; // divisé par nb d'équipes
      const jourDebut = jourCumulatif;
      jourCumulatif += joursNet;
      return {
        phase: p,
        label: cfg.label,
        couleur: cfg.couleur,
        joursNet,
        jourDebut,
        jourFin: jourCumulatif,
      };
    });
}

// ── Composant Planning ───────────────────────────────────────
function PlanningChantier({ planning, totalJours }) {
  if (planning.length === 0) return null;
  const totalReel = planning.reduce((s, p) => s + p.joursNet, 0);

  return (
    <div style={{ ...carteS }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={15} strokeWidth={2} /> Planning chantier
        </span>
        <span style={{ fontSize: 12, background: C.primaire, color: '#fff', borderRadius: '20px', padding: '3px 12px', fontWeight: 700 }}>
          Durée totale : {totalReel.toFixed(1)} jour{totalReel > 1 ? 's' : ''}
        </span>
      </div>

      {/* Barre Gantt simplifiée */}
      <div style={{ marginBottom: 18, display: 'flex', borderRadius: 8, overflow: 'hidden', height: 14 }}>
        {planning.map(p => (
          <div
            key={p.phase}
            title={`${p.label} — ${p.joursNet.toFixed(1)} j`}
            style={{
              width: `${(p.joursNet / totalReel) * 100}%`,
              background: p.couleur,
              transition: 'width 0.4s ease',
              minWidth: p.joursNet > 0 ? 3 : 0,
            }}
          />
        ))}
      </div>

      {/* Tableau */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {['Phase', 'Durée', 'Début', 'Fin'].map(h => (
                <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {planning.map((p, i) => (
              <tr key={p.phase} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg)' }}>
                {/* Phase */}
                <td style={{ padding: '9px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.couleur, flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{p.label}</span>
                  </div>
                </td>
                {/* Durée */}
                <td style={{ padding: '9px 12px', fontSize: 13, fontWeight: 700, color: p.couleur, whiteSpace: 'nowrap' }}>
                  {p.joursNet < 1
                    ? `${Math.round(p.joursNet * 8)} h`
                    : `${p.joursNet.toFixed(1)} j`}
                </td>
                {/* Début */}
                <td style={{ padding: '9px 12px', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  J+{Math.ceil(p.jourDebut)}
                </td>
                {/* Fin */}
                <td style={{ padding: '9px 12px', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  J+{Math.ceil(p.jourFin)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
        J0 = premier jour de chantier · les phases commencent à la suite · durée en jours ouvrables
      </div>
    </div>
  );
}

// ── Ligne vide ───────────────────────────────────────────────
let _nextId = 1;
function nouvelleLigne(override = {}) {
  return {
    id: _nextId++,
    description: '',
    quantite: '',
    unite: 'm²',
    rendement: 10,
    prixFournisseur: '',
    ...override,
  };
}

function ligneDepuisPDF(l) {
  const desc = l.description || 'Poste';
  const metier = detecterMetier(desc);
  return nouvelleLigne({
    description: desc,
    quantite: l.quantite || l.surface || '',
    unite: metier.unite,
    rendement: metier.rendement,
    prixFournisseur: l.prix || '',
  });
}

// ── Calcul pour une ligne ────────────────────────────────────
function calcLigne(l, tarifH) {
  const qte = parseFloat(String(l.quantite).replace(',', '.')) || 0;
  const rend = parseFloat(String(l.rendement).replace(',', '.')) || 1;
  const fournisseur = parseFloat(String(l.prixFournisseur).replace(',', '.')) || 0;
  const tarif = parseFloat(String(tarifH).replace(',', '.')) || 0;

  // heures = quantité / rendement   (rendement = unités par jour × heures/jour pris en compte ailleurs)
  // Ici on calcule en heures directement : rendement = unités/heure
  // Pour garder la cohérence avec le panneau paramètres, rendement est en unités/jour
  // → heures = qte / rendement * heuresParJour  (géré au niveau totaux)
  // mais pour le coût MO ligne on a besoin de heures :
  // heuresLigne = qte / (rendement / heuresParJour)  => simplifié ici en heuresLigne brutes (ajustées dans totaux)
  const heuresBrutes = rend > 0 ? qte / rend : 0; // en "jours"
  const coutMO = heuresBrutes * tarif;             // tarifH ici = tarif/jour simplifié
  const coutTotal = coutMO + fournisseur;
  return { qte, rend, fournisseur, heuresBrutes, coutMO, coutTotal };
}

// ── Badge rentabilité ────────────────────────────────────────
function BadgeRentabilite({ marge }) {
  const pct = Math.round(marge * 100);
  if (pct >= 15) return <span style={{ background: 'rgba(16,185,129,0.14)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '3px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>Rentable +{pct}%</span>;
  if (pct >= 0)  return <span style={{ background: 'rgba(245,158,11,0.14)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', padding: '3px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>Limite {pct}%</span>;
  return <span style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.28)', padding: '3px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>Perte {pct}%</span>;
}

// ── Composant principal ──────────────────────────────────────
export default function SoumissionAssistee({ parametres, onCreerDevis, naviguer }) {
  const paramsGlobaux = parametres?.parametres || {};

  const [lignes, setLignes] = useState([nouvelleLigne()]);
  const [params, setParams] = useState({
    nbEmployes:   1,
    heuresParJour: paramsGlobaux.heuresJour || 8,
    tarifHoraire:  paramsGlobaux.tarifHoraire || 85,
    margeCible:    paramsGlobaux.margeCible || 25,
    fraisGeneraux: paramsGlobaux.fraisGeneraux || 10,
  });
  const [titreProjet, setTitreProjet] = useState('');
  const [importEnCours, setImportEnCours] = useState(false);
  const [messageImport, setMessageImport] = useState('');
  const [panneauOuvert, setPanneauOuvert] = useState(true);
  const fileRef = useRef(null);

  const setParam = useCallback((key, val) => {
    setParams(p => ({ ...p, [key]: val }));
  }, []);

  // ── Modifier une ligne ──────────────────────────────────────
  const majLigne = useCallback((id, field, val) => {
    setLignes(ls => ls.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: val };
      // Auto-détecter rendement et unité si la description change
      if (field === 'description') {
        const m = detecterMetier(val);
        updated.rendement = m.rendement;
        updated.unite = m.unite;
      }
      return updated;
    }));
  }, []);

  const ajouterLigne = useCallback(() => {
    setLignes(ls => [...ls, nouvelleLigne()]);
  }, []);

  const supprimerLigne = useCallback((id) => {
    setLignes(ls => ls.filter(l => l.id !== id));
  }, []);

  // ── Calculs ─────────────────────────────────────────────────
  const totaux = useMemo(() => {
    const tarifJournalier = parseFloat(params.tarifHoraire) * parseFloat(params.heuresParJour);
    const calcules = lignes.map(l => calcLigne(l, tarifJournalier));

    const totalJoursMO = calcules.reduce((s, c) => s + c.heuresBrutes, 0);
    const totalHeures = totalJoursMO * (parseFloat(params.heuresParJour) || 8);
    const totalJours = params.nbEmployes > 0
      ? totalJoursMO / parseFloat(params.nbEmployes)
      : totalJoursMO;
    const coutMOTotal = calcules.reduce((s, c) => s + c.coutMO, 0);
    const totalAchats = calcules.reduce((s, c) => s + c.fournisseur, 0);
    const coutSansFreis = coutMOTotal + totalAchats;
    const coutAvecFreis = coutSansFreis * (1 + (parseFloat(params.fraisGeneraux) || 0) / 100);
    const prixVente = coutAvecFreis * (1 + (parseFloat(params.margeCible) || 0) / 100);
    const margeReelle = prixVente > 0 ? (prixVente - coutAvecFreis) / prixVente : 0;

    return {
      calcules, totalHeures, totalJours, coutMOTotal,
      totalAchats, coutSansFreis, coutAvecFreis, prixVente, margeReelle,
    };
  }, [lignes, params]);

  // ── Planning ─────────────────────────────────────────────────
  const planning = useMemo(
    () => calculerPlanning(lignes, totaux.calcules, params),
    [lignes, totaux.calcules, params]
  );

  // ── Import PDF ───────────────────────────────────────────────
  const handleFichier = useCallback(async (fichier) => {
    if (!fichier) return;
    setImportEnCours(true);
    setMessageImport('Lecture du PDF…');
    try {
      // Utiliser pdfjs via dynamic import (même approche que ImportPDF.js)
      const pdfjsLib = await import('pdfjs-dist/webpack');
      const buffer = await fichier.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

      let texteComplet = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const p = await pdf.getPage(i);
          const content = await p.getTextContent();
          const buckets = new Map();
          for (const item of content.items) {
            if (!item.str) continue;
            const y = item.transform ? Math.round(item.transform[5] / 2) * 2 : 0;
            if (!buckets.has(y)) buckets.set(y, []);
            buckets.get(y).push({ x: item.transform ? item.transform[4] : 0, str: item.str });
          }
          const lignesPage = [...buckets.entries()]
            .sort((a, b) => b[0] - a[0])
            .map(([, items]) => items.sort((a, b) => a.x - b.x).map(it => it.str.trim()).filter(Boolean).join(' '))
            .filter(Boolean);
          if (lignesPage.length) texteComplet += `\n--- Page ${i} ---\n${lignesPage.join('\n')}`;
        } catch {
          // page illisible, on continue
        }
      }

      const analyse = extraireDonneesPDF(texteComplet);
      if (analyse.lignes && analyse.lignes.length > 0) {
        setLignes(analyse.lignes.map(ligneDepuisPDF));
        setMessageImport(`${analyse.lignes.length} poste(s) importé(s) depuis le PDF`);
      } else {
        setLignes([nouvelleLigne()]);
        setMessageImport('Aucun poste détecté — remplissez le tableau manuellement');
      }
      if (!titreProjet && fichier.name) {
        setTitreProjet(fichier.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '));
      }
    } catch (err) {
      setMessageImport('Erreur de lecture PDF : ' + (err.message || 'fichier invalide'));
    } finally {
      setImportEnCours(false);
    }
  }, [titreProjet]);

  // ── Générer devis ─────────────────────────────────────────────
  const genererDevis = useCallback(() => {
    if (!onCreerDevis) return;
    const notesLignes = lignes
      .filter(l => l.description)
      .map(l => {
        const c = totaux.calcules[lignes.indexOf(l)];
        const qte = l.quantite ? `${l.quantite} ${l.unite}` : '';
        return `• ${l.description}${qte ? ' — ' + qte : ''}${c?.coutTotal > 0 ? ' — CHF ' + Math.round(c.coutTotal).toLocaleString('fr-CH') : ''}`;
      })
      .join('\n');

    onCreerDevis({
      prixPropose: String(Math.round(totaux.prixVente)),
      surface: String(lignes.reduce((s, l) => {
        const v = parseFloat(String(l.quantite).replace(',', '.')) || 0;
        return l.unite === 'm²' ? s + v : s;
      }, 0)),
      lignes: lignes.filter(l => l.description).map(l => ({
        description: l.description,
        prix: Math.round((totaux.calcules[lignes.indexOf(l)]?.coutTotal || 0) * 100) / 100,
      })),
      source: titreProjet || 'Soumission assistée',
      notes: `Soumission : ${titreProjet || 'sans titre'}\n\nPostes :\n${notesLignes}`,
    });
  }, [lignes, totaux, titreProjet, onCreerDevis]);

  const tarifJournalier = parseFloat(params.tarifHoraire) * parseFloat(params.heuresParJour);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 0 60px' }}>

      {/* ── En-tête ── */}
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Calculator size={22} strokeWidth={2} /> Soumission assistée
          </div>
        </div>
        <div className="page-actions-group">
          <button style={btnSec} onClick={() => fileRef.current?.click()} disabled={importEnCours}>
            <Upload size={14} /> {importEnCours ? 'Lecture…' : 'Importer PDF'}
          </button>
          <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }}
            onChange={e => { handleFichier(e.target.files?.[0]); e.target.value = ''; }} />
          <button style={btnPrim} onClick={genererDevis} disabled={lignes.every(l => !l.description)}>
            <FileText size={14} /> Générer devis
          </button>
        </div>
      </div>

      {/* ── Message import ── */}
      {messageImport && (
        <div className={`alert-banner ${messageImport.startsWith('[ok]') ? 'alert-banner-success' : messageImport.startsWith('[err]') ? 'alert-banner-danger' : 'alert-banner-warning'}`}
          style={{ marginBottom: 16 }}>
          {messageImport}
        </div>
      )}

      {/* ── Titre projet ── */}
      <div style={{ ...carteS, padding: '14px 20px' }}>
        <label style={labelS}>Nom du projet / soumission</label>
        <input style={inputS} value={titreProjet} onChange={e => setTitreProjet(e.target.value)} placeholder="ex: Villa Dupont — Carrelage salon" />
      </div>

      {/* ── Paramètres (repliable) ── */}
      <div style={carteS}>
        <button
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: C.primaire, fontWeight: 700, fontSize: 14, padding: 0, width: '100%', justifyContent: 'space-between' }}
          onClick={() => setPanneauOuvert(v => !v)}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={16} strokeWidth={2} /> Paramètres de chantier
          </span>
          {panneauOuvert ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {panneauOuvert && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginTop: 16 }}>
            {[
              { key: 'nbEmployes',    label: 'Nb employés',      unite: 'pers.' },
              { key: 'heuresParJour', label: 'Heures / jour',    unite: 'h' },
              { key: 'tarifHoraire',  label: 'Tarif horaire',    unite: 'CHF/h' },
              { key: 'margeCible',    label: 'Marge cible',      unite: '%' },
              { key: 'fraisGeneraux', label: 'Frais généraux',   unite: '%' },
            ].map(({ key, label, unite }) => (
              <div key={key}>
                <label style={labelS}>{label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({unite})</span></label>
                <input
                  type="number" min="0" style={inputS}
                  value={params[key]}
                  onChange={e => setParam(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Tableau des postes ── */}
      <div style={carteS}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={15} strokeWidth={2} /> Postes de travail
          </span>
          <button style={btnSec} onClick={ajouterLigne}>
            <Plus size={13} /> Ajouter ligne
          </button>
        </div>

        {/* En-têtes */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['Description', 'Qté', 'Unité', 'Rend. /j', 'Heures', 'Prix fourn. CHF', 'Coût MO CHF', 'Total ligne CHF', ''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, idx) => {
                const c = totaux.calcules[idx] || {};
                const heuresLigne = (c.heuresBrutes || 0) * (parseFloat(params.heuresParJour) || 8);
                return (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '6px 8px', minWidth: 180 }}>
                      <input style={{ ...inputS, minWidth: 160 }} value={l.description}
                        onChange={e => majLigne(l.id, 'description', e.target.value)}
                        placeholder="ex: Carrelage sol…" />
                    </td>
                    <td style={{ padding: '6px 8px', width: 80 }}>
                      <input style={{ ...inputS, textAlign: 'right' }} type="number" min="0" value={l.quantite}
                        onChange={e => majLigne(l.id, 'quantite', e.target.value)} placeholder="0" />
                    </td>
                    <td style={{ padding: '6px 8px', width: 80 }}>
                      <select style={{ ...inputS, paddingRight: 6 }} value={l.unite}
                        onChange={e => majLigne(l.id, 'unite', e.target.value)}>
                        {['m²', 'ml', 'pce', 'h', 'u', 'forfait'].map(u => <option key={u}>{u}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px 8px', width: 90 }}>
                      <input style={{ ...inputS, textAlign: 'right' }} type="number" min="0.1" step="0.5" value={l.rendement}
                        onChange={e => majLigne(l.id, 'rendement', e.target.value)} />
                    </td>
                    <td style={{ padding: '6px 8px', width: 80, textAlign: 'right', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {heuresLigne > 0 ? heuresLigne.toFixed(1) + ' h' : '—'}
                    </td>
                    <td style={{ padding: '6px 8px', width: 130 }}>
                      <input style={{ ...inputS, textAlign: 'right' }} type="number" min="0" value={l.prixFournisseur}
                        onChange={e => majLigne(l.id, 'prixFournisseur', e.target.value)} placeholder="0" />
                    </td>
                    <td style={{ padding: '6px 8px', width: 110, textAlign: 'right', fontSize: 13, fontWeight: 500, color: C.primaire, whiteSpace: 'nowrap' }}>
                      {c.coutMO > 0 ? c.coutMO.toLocaleString('fr-CH', { maximumFractionDigits: 0 }) : '—'}
                    </td>
                    <td style={{ padding: '6px 8px', width: 120, textAlign: 'right', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {c.coutTotal > 0 ? c.coutTotal.toLocaleString('fr-CH', { maximumFractionDigits: 0 }) : '—'}
                    </td>
                    <td style={{ padding: '6px 8px', width: 36 }}>
                      {lignes.length > 1 && (
                        <button style={btnDng} onClick={() => supprimerLigne(l.id)} title="Supprimer">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Résumé global ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
        {[
          { label: 'Total heures',     val: totaux.totalHeures.toFixed(1) + ' h',                               couleur: C.primaire },
          { label: 'Total jours',      val: totaux.totalJours.toFixed(1) + ' j',                                couleur: C.info },
          { label: 'Coût main-d\'œuvre', val: 'CHF ' + totaux.coutMOTotal.toLocaleString('fr-CH', { maximumFractionDigits: 0 }), couleur: C.violet },
          { label: 'Total achats',     val: 'CHF ' + totaux.totalAchats.toLocaleString('fr-CH', { maximumFractionDigits: 0 }), couleur: C.warning },
          { label: 'Coût total',       val: 'CHF ' + totaux.coutAvecFreis.toLocaleString('fr-CH', { maximumFractionDigits: 0 }), couleur: '#546e7a' },
          { label: 'Prix de vente',    val: 'CHF ' + totaux.prixVente.toLocaleString('fr-CH', { maximumFractionDigits: 0 }),    couleur: C.secondaire },
        ].map(({ label, val, couleur }) => (
          <div key={label} style={{ background: couleur, color: '#fff', borderRadius: '12px', padding: '14px 18px', position: 'relative', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.13)' }}>
            <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* ── Badge rentabilité + info tarif ── */}
      <div style={{ ...carteS, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Clock size={15} strokeWidth={2} /> Rentabilité estimée
          </span>
          <BadgeRentabilite marge={totaux.margeReelle} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Tarif journalier : CHF {tarifJournalier.toLocaleString('fr-CH', { maximumFractionDigits: 0 })} / jour · {params.nbEmployes} employé(s) · marge {params.margeCible}% · frais {params.fraisGeneraux}%
        </div>
      </div>

      {/* ── Planning chantier ── */}
      <PlanningChantier planning={planning} totalJours={totaux.totalJours} />

      {/* ── Actions bas ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button style={btnSec} onClick={() => setLignes([nouvelleLigne()])} >
          Réinitialiser
        </button>
        <button style={btnPrim} onClick={genererDevis} disabled={lignes.every(l => !l.description)}>
          <FileText size={14} /> Générer devis
        </button>
      </div>

    </div>
  );
}
