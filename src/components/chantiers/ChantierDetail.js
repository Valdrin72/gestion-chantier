import React from 'react';
import {
  HardHat, Pencil, Trash2, AlertTriangle,
  ChevronRight, DollarSign, Clock,
} from 'lucide-react';
import {
  fmtN, calculerDateFinOuvrables,
  getAlerteChantier, getChantierStatus, C,
  assertEtatValide, assertEtatCoherent,
  sommeAvenants, calculerCA, isChantierActif,
} from '../../donnees';
import { DS, couleurStatut as couleurStatutDS } from '../../ds';
import { STATUTS_CLOS } from '../../constants/statuts';
import { Badge, CoutBadge, BarreAvancement, BadgeRentabilite } from '../SharedBadges';
import { useApp } from '../../context/AppContext';
import { useChantierCalculs } from '../../hooks/useChantierCalculs';
import DetailVelocite from './detail/DetailVelocite';
import DetailProjection from './detail/DetailProjection';
import DetailRecommandations from './detail/DetailRecommandations';
import DetailEcarts from './detail/DetailEcarts';
import DetailRentabilite from './detail/DetailRentabilite';

const carteStyle = DS.card;
const btnPrimaire = DS.btnPrimary;
const btnSucces = DS.btnSuccess;
const btnDanger = DS.btnDanger;

function ChantierDetail({ chantier, detailOnglet, setDetailOnglet, modeCompleter, onRetour, onModifier, onSupprimer, onPasserEnCours }) {
  const { factures = [], clients, devis = [], parametres, naviguer, ouvrirSaisieHeures, agentState } = useApp();
  const { etat, couts } = useChantierCalculs(chantier);
  const couleurStatut = couleurStatutDS;

  const c = chantier;
  const patterns = agentState?.patterns || {};
  const patternChantier = c.typeChantier && patterns[c.typeChantier] ? patterns[c.typeChantier] : null;
  assertEtatValide(etat);
  const coherenceDetail = assertEtatCoherent(etat);

  // Source unique : journal des heures (même logique que le dashboard)
  const joursRealises = new Set((c.journal || []).map(e => e.date).filter(Boolean)).size;
  const joursPlannedTotal = c.nombreJours || 0;
  const joursRestants = joursPlannedTotal > 0 ? joursPlannedTotal - joursRealises : null;

  const modeChantier = etat.avancementPct === 0 ? 'INIT'
    : etat.avancementPct >= 95 ? 'FINAL'
    : 'PROJECTION';

  const perfRatio = etat.totalJoursPrevus > 0 && etat.totalJoursReels > 0
    ? etat.totalJoursReels / etat.totalJoursPrevus
    : null;
  const perfConfig = perfRatio === null ? null
    : perfRatio <= 0.9
      ? { label: 'Dans les temps', couleur: C.secondaire,  }
      : perfRatio <= 1.1
        ? { label: 'À surveiller', couleur: C.warning,  }
        : { label: 'En retard', couleur: C.danger,  };
  const perfReco = etat.deriveJours <= 0 ? null
    : etat.deriveJours <= 2 ? 'surveiller'
    : etat.deriveJours <= 5 ? 'ajouter'
    : 'renforcer';
  const perfRecoLabel = perfReco === 'surveiller'
    ? 'Surveiller — possible rattrapage sans action'
    : perfReco === 'ajouter'
      ? 'Ajouter 1 ouvrier pendant quelques jours'
      : perfReco === 'renforcer'
        ? 'Renforcer l\'équipe ou revoir le planning'
        : null;
  const perfNombreEmployes = (c.equipe || []).length;
  const perfResteJours = etat.totalJoursPrevus - etat.totalJoursReels;
  const perfImpact = (() => {
    if (!perfReco || perfReco === 'surveiller') return null;
    if (perfNombreEmployes === 0 || perfResteJours <= 0) return null;
    const nbAjout = perfReco === 'ajouter' ? 1 : 2;
    const gainVitesse = nbAjout / perfNombreEmployes;
    const nouvelleDuree = Math.round(perfResteJours / (1 + gainVitesse));
    const gainJours = Math.round(perfResteJours - nouvelleDuree);
    if (gainJours <= 0) return null;
    const retardResiduel = etat.deriveJours - gainJours;
    const texte = retardResiduel <= 1
      ? `Gain estimé : -${gainJours} jour${gainJours > 1 ? 's' : ''} sur la fin de chantier`
      : `Permettrait de réduire le retard à ~${retardResiduel} jour${retardResiduel > 1 ? 's' : ''}`;
    const conclusion = retardResiduel <= 0
      ? { icone: '', texte: 'Permet de revenir dans les délais', couleur: C.secondaire }
      : retardResiduel <= 2
        ? { icone: 'warning', texte: 'Réduit le retard mais reste sous contrôle', couleur: C.warning }
        : { icone: 'danger', texte: 'Insuffisant — revoir le planning ou ajouter plus de ressources', couleur: C.danger };
    return { texte, conclusion };
  })();
  const perfMessageCourt = (() => {
    if (joursRestants === null) return '';
    if (joursRestants < 0) {
      const r = Math.abs(joursRestants);
      return perfRatio !== null && perfRatio > 1.1
        ? `+${r}j de dépassement — action nécessaire`
        : `+${r}j de dépassement — surveiller`;
    }
    if (joursRestants === 0) return 'Dernier jour prévu';
    return `${joursRestants}j restants`;
  })();
  const perfDetail = `${etat.totalJoursReels} j réalisés sur ${etat.totalJoursPrevus} j prévus`;

  const scoreCriticite = (etat.deriveJours * 2)
    + (etat.projectionDisponible && etat.margeEstimeePct !== null && etat.margeEstimeePct < 0 ? 10 : 0)
    + (couts.ratioEfficacite !== null && couts.ratioEfficacite < 0.8 ? 5 : 0);
  const criticiteConfig = scoreCriticite >= 15
    ? { icone: 'danger', label: 'Chantier critique — action immédiate', couleur: C.danger, fond: 'radial-gradient(ellipse at 6% 50%, rgba(239,68,68,0.13) 0%, rgba(239,68,68,0.04) 100%)' }
    : scoreCriticite >= 8
      ? { icone: 'warning', label: 'Chantier à risque — à traiter aujourd\'hui', couleur: C.warning, fond: 'radial-gradient(ellipse at 6% 50%, rgba(245,158,11,0.13) 0%, rgba(245,158,11,0.04) 100%)' }
      : null;

  // eslint-disable-next-line no-unused-vars
  const al = getAlerteChantier(c);
  const client = clients.find(cl => cl.id === c.clientId);
  const directeurTravaux = c.directeurTravauxId ? parametres.employes.find(e => e.id === parseInt(c.directeurTravauxId)) : null;
  const fmtK = (n) => fmtN(n);
  const facturesLiees = factures.filter(f => String(f.chantierId) === String(c.id));
  const montantFactureLie = facturesLiees.reduce((s, f) => s + (parseFloat(f.montantTTC) || 0), 0);
  const montantPayeLie    = facturesLiees.reduce((s, f) => {
    const viaHistorique = (f.paiementsHistorique || []).reduce((acc, p) => acc + (parseFloat(p.montant) || 0), 0);
    const viaScalaire   = parseFloat(f.montantPaye) || 0;
    return s + (viaHistorique > 0 ? viaHistorique : viaScalaire);
  }, 0);
  const devisTotal = calculerCA(c, devis) || 0;
  const _pctFactureRaw = devisTotal > 0 ? (montantFactureLie / devisTotal) * 100 : 0;
  const pctFacture = isNaN(_pctFactureRaw) ? 0 : Math.min(Math.round(_pctFactureRaw), 100);
  const tresorerieEcart = devisTotal > 0 ? (etat.avancementPct || 0) - pctFacture : 0;
  const tresorerieConfig = tresorerieEcart > 30
    ? { icone: 'warning', label: 'Travail non facturé — risque de trésorerie', couleur: C.danger }
    : tresorerieEcart > 15
      ? { icone: 'warning', label: 'Facturation en retard', couleur: C.warning }
      : null;
  const _pctEncaisseRaw = devisTotal > 0 ? (montantPayeLie / devisTotal) * 100 : 0;
  const pctEncaisse = isNaN(_pctEncaisseRaw) ? 0 : Math.min(Math.round(_pctEncaisseRaw), 100);

  const alertesChantier = (() => {
    const list = [];
    if (joursRestants !== null && joursRestants < 0) {
      const abs = Math.abs(joursRestants);
      list.push({ id: 'delai', texte: `Dépassement de délai — ${abs} jour${abs > 1 ? 's' : ''} de plus que prévu`, gravite: 'critique', icone: 'danger' });
    } else if (joursRestants !== null && joursRestants <= 3 && joursRestants >= 0) {
      list.push({ id: 'fin_proche', texte: `Fin imminente — ${joursRestants === 0 ? "dernier jour aujourd'hui" : `${joursRestants} jour${joursRestants > 1 ? 's' : ''} restant${joursRestants > 1 ? 's' : ''}`}`, gravite: 'warning', icone: 'warning' });
    }
    if (etat.projectionDisponible && etat.margeEstimeePct !== null) {
      if (etat.margeEstimee < 0) {
        list.push({ id: 'perte', texte: `Chantier en perte — déficit estimé CHF ${fmtN(Math.abs(etat.margeEstimee))} (${etat.margeEstimeePct.toFixed(1)}%)`, gravite: 'critique', icone: 'danger' });
      } else if (etat.margeEstimeePct < 15) {
        list.push({ id: 'marge_faible', texte: `Rentabilité faible — marge estimée ${etat.margeEstimeePct.toFixed(1)}% · seuil cible 15%`, gravite: 'warning', icone: 'warning' });
      }
    }
    if (etat.coutMOReel > 0 && etat.coutTotalReel > 0) {
      const pctMO = (etat.coutMOReel / etat.coutTotalReel) * 100;
      if (pctMO > 60) {
        list.push({ id: 'mo_elevee', texte: `Main d'œuvre élevée — ${Math.round(pctMO)}% du coût total (seuil 60%)`, gravite: 'warning', icone: 'warning' });
      }
    }
    // Samedi travaillé sans flag inclusSamedi → la durée affichée peut être sous-estimée
    const datesSamediJournal = (c.journal || []).map(e => e.date).filter(d => d && new Date(d + 'T00:00:00').getDay() === 6);
    if (datesSamediJournal.length > 0 && !c.inclusSamedi) {
      list.push({ id: 'samedi_non_planifie', texte: `${datesSamediJournal.length} samedi(s) travaillé(s) non inclus dans la durée planifiée — activez "Inclus samedi" dans le planning`, gravite: 'warning', icone: 'warning' });
    }
    // Démarrage avant acceptation du devis
    const devisLie = devis.find(d => String(d.id) === String(c.devisId));
    if (c.dateDebut && devisLie?.dateAcceptation && c.dateDebut < devisLie.dateAcceptation) {
      list.push({ id: 'avt_devis', texte: `Démarrage avant signature du devis (${c.dateDebut} < acceptation ${devisLie.dateAcceptation})`, gravite: 'warning', icone: 'warning' });
    }
    return list.sort((a, b) => (b.gravite === 'critique' ? 1 : 0) - (a.gravite === 'critique' ? 1 : 0));
  })();

  const chantierStatusBadge = ['En cours', 'Suspendu'].includes(c.statut) ? getChantierStatus(c) : null;
  const devisSource = devis.find(d => String(d.id) === String(c.devisId));
  const estNouveauPlanifie = modeCompleter && c.statut === 'Planifié';

  // ── Tuiles cockpit ──
  const margeTile = (() => {
    if (etat.projectionDisponible && etat.margeEstimeePct !== null) {
      const v = etat.margeEstimeePct;
      return { val: `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`, label: 'Marge estimée finale', couleur: v >= 15 ? C.secondaire : v >= 5 ? C.warning : C.danger };
    }
    if (couts.margeReelPct !== null && etat.coutTotalReel > 0) {
      const v = couts.margeReelPct;
      return { val: `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`, label: 'Marge actuelle', couleur: v >= 15 ? C.secondaire : v >= 5 ? C.warning : C.danger };
    }
    return devisTotal !== null
      ? { val: '—', label: 'Saisir des heures', couleur: '#78909c' }
      : { val: 'N/A', label: 'Aucun devis lié', couleur: '#78909c' };
  })();

  const avTile = {
    val: `${etat.avancementPct}%`,
    label: etat.totalJoursPrevus > 0
      ? `${etat.totalJoursReels}j réalisés / ${etat.totalJoursPrevus}j prévus`
      : 'Jours prévus non définis',
    couleur: etat.avancementPct === 0 ? '#78909c' : perfConfig ? perfConfig.couleur : C.secondaire,
  };

  const planTile = (() => {
    if (!c.nombreJours)
      return { val: '—', label: 'Pas de durée définie', couleur: '#78909c' };
    if (joursRealises === 0)
      return { val: `${c.nombreJours}j`, label: 'Durée prévue — non démarré', couleur: '#78909c' };
    if (joursRestants !== null && joursRestants > 0)
      return { val: `${joursRestants}j restants`, label: `${etat.avancementPct}% réalisé`, couleur: C.secondaire };
    if (joursRestants === 0)
      return { val: 'Dernier jour', label: `${etat.avancementPct}% réalisé`, couleur: C.warning };
    const retard = Math.abs(joursRestants);
    return { val: `+${retard}j de dépassement`, label: `${etat.avancementPct}% réalisé`, couleur: retard > 5 ? C.danger : C.warning };
  })();

  const critAlert = alertesChantier.find(a => a.gravite === 'critique');
  const actionTile = (() => {
    if (modeChantier === 'FINAL') return { icone: 'info', val: 'Facturer', label: 'Chantier quasi terminé', couleur: C.secondaire };
    if (critAlert)                return { icone: 'danger', val: 'Action urgente', label: critAlert.texte.length > 50 ? critAlert.texte.slice(0, 48) + '…' : critAlert.texte, couleur: C.danger };
    if (perfReco === 'renforcer') return { niveau: 'danger', val: 'Renforcer l\'équipe', label: 'Retard important — revoir planning', couleur: C.danger };
    if (perfReco === 'ajouter')  return { niveau: 'warning', val: '+1 ouvrier', label: 'Réduire le retard en cours', couleur: C.warning };
    if (perfReco === 'surveiller') return { icone: '◎', val: 'Surveiller', label: 'Possible rattrapage sans action', couleur: C.warning };
    if (modeChantier === 'INIT') return { icone: '▶', val: 'Saisir les heures', label: 'Aucune donnée terrain', couleur: '#78909c' };
    return { icone: '', val: 'RAS', label: 'Aucune action requise', couleur: C.secondaire };
  })();

  const tiles = [
    { id: 'renta', icone: 'renta', titre: 'RENTABILITÉ', ...margeTile },
    { id: 'av',    icone: 'av', titre: 'AVANCEMENT',  ...avTile },
    { id: 'plan',  icone: 'plan', titre: 'PLANNING',    ...planTile },
    { id: 'act',   icone: actionTile.icone, titre: 'ACTION', val: actionTile.val, label: actionTile.label, couleur: actionTile.couleur },
  ];

  return (<React.Fragment key="detail">
    <div>
      {modeChantier === 'INIT' && patternChantier && Math.abs(patternChantier.ecartMoyen) >= 1 && (() => {
        const ca = calculerCA(c, devis);
        const budgetSuggere = ca !== null ? Math.round(ca * (1 + patternChantier.ecartMoyen / 100)) : null;
        const positif = patternChantier.ecartMoyen > 0;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: positif ? '#FEF3C7' : '#ECFDF5', border: `1px solid ${positif ? '#FDE68A' : '#6EE7B7'}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
            <AlertTriangle size={18} style={{ color: positif ? '#92400E' : '#065F46', flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 13, color: positif ? '#92400E' : '#065F46' }}>
              <strong>Mémoire IA — {c.typeChantier}</strong> · Historiquement ce type {positif ? 'dépasse' : 'reste sous'} le budget de {Math.abs(patternChantier.ecartMoyen).toFixed(1)}% (sur {patternChantier.count} chantier{patternChantier.count > 1 ? 's' : ''})
              {budgetSuggere !== null && (<> — budget suggéré : <strong>CHF {fmtN(budgetSuggere)}</strong></>)}
            </div>
          </div>
        );
      })()}

      {estNouveauPlanifie && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', border: '1px solid #6ee7b7', borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
          <span style={{ fontSize: 22 }}>🎉</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#065f46', fontSize: 14 }}>Chantier créé avec succès</div>
            <div style={{ fontSize: 12, color: '#047857', marginTop: 2 }}>Complétez les informations (adresse, équipe, dates), puis passez en cours et saisissez les heures.</div>
          </div>
          <button
            onClick={() => onModifier(c)}
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
          ><Pencil size={14} /> Compléter le chantier</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button onClick={onRetour} style={btnPrimaire}><ChevronRight size={15} style={{ transform: 'rotate(180deg)' }} /> Retour</button>
        {!estNouveauPlanifie && (
          <button onClick={() => onModifier(c)} style={btnSucces}><Pencil size={15} /> Modifier</button>
        )}
        {c.devisId && !isChantierActif(c) && !STATUTS_CLOS.includes(c.statut) && (
          <button
            onClick={() => onPasserEnCours(c)}
            style={{ ...btnSucces, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b' }}
          >▶ Passer en cours</button>
        )}
        {isChantierActif(c) && (
          <button
            onClick={() => ouvrirSaisieHeures(c)}
            style={{ ...btnPrimaire, background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: '1px solid #7c3aed55' }}
          ><Clock size={15} /> Saisir heures</button>
        )}
        <button onClick={() => naviguer('finances', { chantierActif: c.id })} style={{ ...DS.btnGhost }}><DollarSign size={15} /> Finances</button>
        <button onClick={() => onSupprimer(c.id)} style={btnDanger}><Trash2 size={14} /> Supprimer</button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {[
          { id: 'vue',       label: 'Vue' },
          { id: 'analyse',   label: 'Analyse' },
          { id: 'financier', label: 'Financier' },
        ].map(o => (
          <button key={o.id} onClick={() => setDetailOnglet(o.id)} style={{
            background: 'transparent', border: 'none',
            borderBottom: detailOnglet === o.id ? '2px solid #3b82f6' : '2px solid transparent',
            color: detailOnglet === o.id ? '#3b82f6' : 'var(--text-secondary)',
            padding: '10px 18px', marginBottom: '-1px',
            cursor: 'pointer', fontSize: 14, fontWeight: detailOnglet === o.id ? 700 : 400,
          }}>{o.label}</button>
        ))}
      </div>

      {!coherenceDetail.ok && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px', borderRadius: 12, marginBottom: 16,
          background: 'rgba(144,164,174,0.08)', border: '1px solid rgba(144,164,174,0.3)',
          borderLeft: '4px solid #90a4ae',
        }}>
          <span style={{ fontSize: 20, lineHeight: 1, color: "var(--text-muted)" }}>○</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#90a4ae' }}>Données invalides — analyse impossible</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Vérifier les données saisies pour ce chantier</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {tiles.map(t => (
          <div key={t.id} style={{
            background: `linear-gradient(145deg, ${t.couleur}12 0%, rgba(255,255,255,0.02) 100%)`,
            border: `1px solid ${t.couleur}30`,
            borderTop: `3px solid ${t.couleur}`,
            borderRadius: 12, padding: '16px 18px',
            boxShadow: `0 2px 12px rgba(0,0,0,0.25), inset 0 1px 0 var(--border-glass)`,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 8 }}>
              {t.icone} {t.titre}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: t.couleur, letterSpacing: '-0.5px', lineHeight: 1.1, marginBottom: 6 }}>
              {t.val}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.35 }}>
              {t.label}
            </div>
          </div>
        ))}
      </div>

      {detailOnglet === 'vue' && <>
      {criticiteConfig && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '16px 22px', borderRadius: 14, marginBottom: 16,
          background: criticiteConfig.fond,
          border: `1px solid ${criticiteConfig.couleur}35`,
          borderLeft: `5px solid ${criticiteConfig.couleur}`,
          boxShadow: `0 2px 16px ${criticiteConfig.couleur}18`,
        }}>
          <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{criticiteConfig.icone}</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: criticiteConfig.couleur, letterSpacing: '-0.2px' }}>{criticiteConfig.label}</span>
        </div>
      )}

      {tresorerieConfig && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 14,
          padding: '14px 20px', borderRadius: 12, marginBottom: 16,
          background: tresorerieConfig.couleur === C.danger
            ? 'radial-gradient(ellipse at 6% 50%, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.03) 100%)'
            : 'radial-gradient(ellipse at 6% 50%, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0.03) 100%)',
          border: `1px solid ${tresorerieConfig.couleur}30`,
          borderLeft: `4px solid ${tresorerieConfig.couleur}`,
        }}>
          <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{tresorerieConfig.icone}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: tresorerieConfig.couleur }}>{tresorerieConfig.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              {etat.avancementPct}% réalisé · {pctFacture}% facturé
            </div>
          </div>
        </div>
      )}

      {alertesChantier.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {alertesChantier.map(a => {
            const isCritique = a.gravite === 'critique';
            const col = isCritique ? C.danger : C.warning;
            return (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 18px', borderRadius: 12,
                background: isCritique
                  ? 'radial-gradient(ellipse at 6% 50%, rgba(239,68,68,0.13) 0%, rgba(239,68,68,0.04) 100%)'
                  : 'radial-gradient(ellipse at 6% 50%, rgba(245,158,11,0.13) 0%, rgba(245,158,11,0.04) 100%)',
                border: `1px solid ${col}30`,
                borderLeft: `4px solid ${col}`,
                boxShadow: `0 2px 12px ${col}14`,
                backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{a.icone}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: col, flex: 1, lineHeight: 1.4 }}>{a.texte}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px',
                  background: col + '16', color: col, border: `1px solid ${col}30`,
                  borderRadius: 20, padding: '3px 11px', flexShrink: 0,
                }}>{isCritique ? 'Critique' : 'Attention'}</span>
              </div>
            );
          })}
        </div>
      )}
      </>}

      {detailOnglet === 'analyse' && <>
      {etat.projectionDisponible && isChantierActif(c) && <DetailVelocite c={c} etat={etat} />}

      {etat.totalJoursReels > 0 && perfConfig && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderRadius: 12, marginBottom: 16,
          background: perfConfig.couleur + '0d',
          border: `1px solid ${perfConfig.couleur}30`,
          borderLeft: `4px solid ${perfConfig.couleur}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
            <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{perfConfig.dot}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: perfConfig.couleur }}>{perfMessageCourt}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, opacity: 0.8 }}>{perfDetail}</div>
              {perfRecoLabel && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13 }}>·</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                      Recommandation : {perfRecoLabel.toLowerCase()}
                    </span>
                  </div>
                  {perfImpact && (
                    <div style={{ marginTop: 4, marginLeft: 20 }}>
                      <div style={{ fontSize: 11, color: C.secondaire, fontWeight: 600 }}>
                        → {perfImpact.texte}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: perfImpact.conclusion.couleur }}>
                        {perfImpact.conclusion.icone} {perfImpact.conclusion.texte}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ ...carteStyle, borderLeft: `4px solid ${couleurStatut(c.statut)}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>{c.numero}</div>
            <h1 style={{ color: 'var(--text-primary)', margin: '4px 0 0', fontSize: 22, fontWeight: 800, letterSpacing: '-0.3px' }}>{c.nom}</h1>
            {client && (
              <div style={{ color: 'var(--text-secondary)', marginTop: '8px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => naviguer('clients', { clientActif: c.clientId })}>
                {client.prenom} {client.nom} — {client.entreprise} · {client.telephone}
                <span style={{ color: C.primaire, textDecoration: 'none', fontSize: '12px', fontWeight: 600, background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: 6 }}>Voir →</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Badge texte={c.priorite} couleur={c.priorite === 'Haute' ? C.danger : C.info} />
            <Badge texte={c.statut} couleur={couleurStatut(c.statut)} />
            {chantierStatusBadge && <Badge texte={chantierStatusBadge.label} couleur={chantierStatusBadge.couleur} glow />}
            {c.devisId && !isChantierActif(c) && !STATUTS_CLOS.includes(c.statut) && (
              <Badge texte="CA non comptabilisé" couleur={C.warning} />
            )}
            <BadgeRentabilite ca={etat.devisTotal} couts={etat.coutTotalReel} />
          </div>
        </div>
        <div style={{ margin: '20px 0' }}>
          <BarreAvancement valeur={etat.avancementPct} />
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>
              {etat.totalJoursPrevus > 0
                ? <><strong style={{ color: 'var(--text-primary)' }}>{etat.totalJoursReels} j réalisés</strong> sur {etat.totalJoursPrevus} j prévus</>
                : etat.totalJoursReels > 0
                  ? <strong style={{ color: 'var(--text-primary)' }}>{etat.totalJoursReels} j réalisés</strong>
                  : <span style={{ color: 'var(--text-muted)' }}>Chantier non démarré</span>
              }
            </span>
            {etat.totalJoursPrevus > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-glass-2)', borderRadius: 20, padding: '2px 10px' }}>
                {etat.avancementPct}%
              </span>
            )}
          </div>
        </div>
        <div className="info-grid">
          {[
            ['Adresse', `${c.adresse || ''}${c.ville ? ', ' + c.ville : ''}${c.canton ? ' (' + c.canton + ')' : ''}`],
            ['Dir. travaux', directeurTravaux ? `${directeurTravaux.nom} — ${directeurTravaux.poste || ''}` : (c.conducteur || '—')],
            ['Début', c.dateDebut],
            ['Fin prévue', c.dateDebut && c.nombreJours ? calculerDateFinOuvrables(c.dateDebut, c.nombreJours, c.inclusSamedi) : '—'],
            ['Jours prévus', c.nombreJours ? `${c.nombreJours} jours` : '—'],
            ['Surface', c.surface ? `${c.surface} m²` : '—'],
            ['Travaux', c.typesTravaux?.join(', ') || '—'],
          ].map(([label, val]) => (
            <div key={label} className="info-item">
              <span className="info-label">{label}</span>
              <span className="info-value">{val || '—'}</span>
            </div>
          ))}
        </div>
        {c.notes && <div style={{ marginTop: '15px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', padding: '12px 16px', borderRadius: '10px', color: 'var(--text-secondary)', fontSize: 13 }}>{c.notes}</div>}
      </div>


      {etat.totalJoursReels === 0 && etat.coutTotalReel === 0 && (
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-hover)', borderRadius: 14, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <HardHat size={28} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: 15, marginBottom: 4 }}>Chantier non démarré</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Déclarez la première journée pour activer le suivi et la projection.</div>
            </div>
          </div>
        </div>
      )}

      {etat.totalJoursReels > 0 && !etat.projectionDisponible && (
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>

          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Projection indisponible — chantier trop tôt</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              {etat.totalJoursReels} j réalisés · projection disponible à partir de 20%
              {etat.totalJoursPrevus > 0 && ` (encore ~${Math.max(0, Math.ceil(etat.totalJoursPrevus * 0.2) - etat.totalJoursReels)} j)`}
            </div>
          </div>
        </div>
      )}

      {etat.projectionDisponible && <DetailProjection etat={etat} fmtK={fmtK} />}
      {etat.projectionDisponible && <DetailRecommandations etat={etat} couts={couts} />}
      <DetailRentabilite c={c} etat={etat} couts={couts} naviguer={naviguer} fmtN={fmtN} fmtK={fmtK} />
      </>}

      {detailOnglet === 'financier' && <>
      <div style={carteStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div className="ds-card-title" style={{ margin: 0 }}>Financier</div>
          {devisSource ? (
            <span
              onClick={() => naviguer('devis')}
              style={{ fontSize: 11, fontWeight: 700, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', padding: '4px 12px', borderRadius: 20, cursor: 'pointer' }}
              title={`CA issu du devis ${devisSource.numero}`}
            >
              {devisSource.numero} · CHF {fmtN(parseFloat(devisSource.montantHT) || 0)}
            </span>
          ) : (
            <span
              onClick={() => naviguer('devis')}
              style={{ fontSize: 11, fontWeight: 700, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', padding: '4px 12px', borderRadius: 20, cursor: 'pointer' }}
            >
              Aucun devis lié — Lier un devis →
            </span>
          )}
        </div>

        {devisTotal === null && (
          <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: '#ef4444', fontSize: 13, marginBottom: 4 }}>Aucun devis lié</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Le chiffre d'affaires est indisponible. Liez un devis accepté pour activer le suivi financier.</div>
            <button onClick={() => onModifier(c)} style={{ marginTop: 10, ...DS.btnGhost, fontSize: 12, padding: '5px 12px' }}>Modifier le chantier</button>
          </div>
        )}

        {devisTotal !== null && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'CA signé', val: `CHF ${fmtK(devisTotal)}`, sub: (() => { const av = sommeAvenants(c); const rg = Array.isArray(devisSource?.heuresRegie) ? devisSource.heuresRegie.reduce((s,r) => s+(parseFloat(r.heures)||0)*(parseFloat(r.tarifHeure)||0),0) : 0; if (av > 0 && rg > 0) return `avenants ${fmtK(av)} + régie ${fmtK(rg)}`; if (av > 0) return `dont avenants CHF ${fmtK(av)}`; if (rg > 0) return `dont régie CHF ${fmtK(rg)}`; return null; })(), couleur: C.primaire },
                { label: 'Facturé', val: `CHF ${fmtK(montantFactureLie)}`, sub: `${pctFacture}% du devis`, couleur: pctFacture >= 100 ? C.secondaire : pctFacture > 0 ? C.info : '#78909c' },
                { label: 'Encaissé', val: `CHF ${fmtK(montantPayeLie)}`, sub: `${pctEncaisse}% du devis`, couleur: pctEncaisse >= 100 ? C.secondaire : pctEncaisse > 0 ? C.warning : '#78909c' },
              ].map(s => (
                <div key={s.label} style={{ background: s.couleur + '12', border: `1px solid ${s.couleur}28`, borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: s.couleur, letterSpacing: '-0.3px' }}>{s.val}</div>
                  {s.sub && <div style={{ fontSize: 11, color: s.couleur, opacity: 0.75, marginTop: 3, fontWeight: 600 }}>{s.sub}</div>}
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748B', marginBottom: 4 }}>
                <span>Facturé</span>
                <span style={{ color: '#10B981', fontWeight: 600 }}>{pctFacture}% · CHF {fmtN(Math.round(montantFactureLie))}</span>
              </div>
              <div style={{ height: 6, background: '#E2E8F0', borderRadius: 3 }}>
                <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(pctFacture, 100)}%`, background: '#10B981', transition: 'width 0.3s ease' }} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748B', marginBottom: 4 }}>
                <span>Encaissé</span>
                <span style={{ color: '#F59E0B', fontWeight: 600 }}>{pctEncaisse}% · CHF {fmtN(Math.round(montantPayeLie))}</span>
              </div>
              <div style={{ height: 6, background: '#E2E8F0', borderRadius: 3 }}>
                <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(pctEncaisse, 100)}%`, background: '#F59E0B', transition: 'width 0.3s ease' }} />
              </div>
            </div>
          </div>
        )}

        {c.imprevus?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: C.danger, marginBottom: 8 }}>Coûts imprévus</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {c.imprevus.map((imp) => (
                <div key={`${imp.description}-${imp.montant}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.danger + '0a', border: `1px solid ${C.danger}22`, borderRadius: 8, padding: '8px 14px' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{imp.description}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.danger }}>CHF {fmtN(imp.montant)}</span>
                </div>
              ))}
              <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: C.danger, marginTop: 2 }}>
                Total imprévus : CHF {fmtN(etat.coutImprevus)}
              </div>
            </div>
          </div>
        )}

        {couts.depassementBudget && (
          <div style={{ background: C.danger + '15', border: `1px solid ${C.danger}50`, borderRadius: 10, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} strokeWidth={2} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <div>
              <span style={{ fontWeight: 700, color: C.danger, fontSize: 13 }}>Dépassement budget</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                Coûts réels (CHF {fmtN(etat.coutTotalReel)}) &gt; Budget prévu (CHF {fmtN(couts.totalCoutsPrevu)})
              </span>
            </div>
          </div>
        )}
        {couts.alerteOrange && (
          <div style={{ background: C.warning + '15', border: `1px solid ${C.warning}50`, borderRadius: 10, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} strokeWidth={2} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <div>
              <span style={{ fontWeight: 700, color: C.warning, fontSize: 13 }}>Attention budget</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                80% du budget consommé alors que l'avancement est à {etat.avancementPct}%
              </span>
            </div>
          </div>
        )}

        {couts.alerteRythmeRouge && (
          <div style={{ background: C.danger + '15', border: `1px solid ${C.danger}50`, borderRadius: 10, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} strokeWidth={2} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <div>
              <span style={{ fontWeight: 700, color: C.danger, fontSize: 13 }}>Rythme de dépense critique</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                Vous dépensez trop vite par rapport à l'avancement — ratio efficacité {couts.ratioEfficacite !== null ? Math.round(couts.ratioEfficacite * 100) : '—'}% (seuil : 70%)
              </span>
            </div>
          </div>
        )}
        {!couts.alerteRythmeRouge && couts.alerteRythmeOrange && (
          <div style={{ background: C.warning + '15', border: `1px solid ${C.warning}50`, borderRadius: 10, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} strokeWidth={2} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <div>
              <span style={{ fontWeight: 700, color: C.warning, fontSize: 13 }}>Rythme de dépense élevé</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                Les coûts progressent plus vite que l'avancement — ratio efficacité {couts.ratioEfficacite !== null ? Math.round(couts.ratioEfficacite * 100) : '—'}% (seuil : 85%)
              </span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <CoutBadge label="Équipe réel" valeur={etat.coutMOReel} couleur={C.secondaire} />
          <CoutBadge label="Matériel réel" valeur={etat.coutMateriel} couleur={C.violet} />
          <CoutBadge label="Imprévus" valeur={etat.coutImprevus} couleur={C.danger} />
          <CoutBadge label="Total coûts" valeur={etat.coutTotalReel} couleur="#455a64" />
        </div>

        {couts.donneesIncompletes && (
          <div style={{ background: C.warning + '12', border: `1px solid ${C.warning}40`, borderRadius: 8, padding: '8px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <AlertTriangle size={15} strokeWidth={2} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: C.warning, fontWeight: 700 }}>Données incomplètes</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Coûts réels manquants : {couts.champsManquants.join(', ')}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>— La marge calculée est indicative.</span>
          </div>
        )}

        {modeChantier === 'FINAL' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: 16 }}>
          {[
            { label: 'Marge directe (%)', valeur: couts.margeReelPct !== null ? `${couts.margeReelPct}%` : '—', couleur: (couts.margeReelPct ?? 0) >= 15 ? C.secondaire : C.danger },
            { label: 'Marge nette', valeur: couts.margeNettePct !== null ? `${couts.margeNettePct}%` : '—', couleur: (couts.margeNettePct ?? 0) >= 10 ? C.secondaire : (couts.margeNettePct ?? 0) >= 0 ? C.warning : C.danger, sub: `FG: CHF ${fmtK(couts.fraisGeneraux)}` },
            { label: 'Coût/m² réel', valeur: couts.coutParM2Reel !== null ? `CHF ${couts.coutParM2Reel}` : '—', couleur: couts.coutParM2Reel !== null ? C.violet : 'var(--text-muted)' },
            { label: 'Prix/m² devis', valeur: couts.prixParM2Devis !== null ? `CHF ${couts.prixParM2Devis}` : '—', couleur: couts.prixParM2Devis !== null ? C.info : 'var(--text-muted)' },
          ].map(s => (
            <div key={s.label} style={{ background: (typeof s.couleur === 'string' && s.couleur.startsWith('#')) ? s.couleur + '12' : 'var(--bg-glass-2)', border: `1px solid ${(typeof s.couleur === 'string' && s.couleur.startsWith('#')) ? s.couleur + '30' : 'var(--border-glass)'}`, borderRadius: '12px', padding: '16px', textAlign: 'center', backdropFilter: 'blur(8px)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: '6px' }}>{s.label}</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: s.couleur, letterSpacing: '-0.3px' }}>{s.valeur}</div>
              {s.sub && <div style={{ fontSize: 10, color: s.couleur, opacity: 0.7, marginTop: 3 }}>{s.sub}</div>}
            </div>
          ))}
        </div>
        )}

        {modeChantier === 'FINAL' && (couts.totalCoutsPrevu > 0 || couts.totalCoutsReel > 0) && <DetailEcarts couts={couts} fmtN={fmtN} />}

        {modeChantier === 'FINAL' && couts.totalCoutsPrevu > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: (couts.budgetRestant >= 0 ? C.secondaire : C.danger) + '10', border: `1px solid ${(couts.budgetRestant >= 0 ? C.secondaire : C.danger)}30`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>Budget restant</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Enveloppe − coûts engagés</div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: couts.budgetRestant >= 0 ? C.secondaire : C.danger }}>
                {couts.budgetRestant >= 0 ? '' : '−'}CHF {fmtK(Math.abs(couts.budgetRestant))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-glass-2)', border: '1px solid var(--border-hover)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>RAD — Coût pour finir</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>À ce rythme, reste à dépenser</div>
              </div>
              {couts.rad !== null ? (
                <div style={{ fontSize: 18, fontWeight: 800, color: couts.rad > couts.budgetRestant ? C.danger : C.secondaire }}>
                  CHF {fmtK(couts.rad)}
                </div>
              ) : (
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>—</div>
              )}
            </div>
          </div>
        )}
      </div>
      </>}

    </div>
  </React.Fragment>);
}

export default ChantierDetail;
