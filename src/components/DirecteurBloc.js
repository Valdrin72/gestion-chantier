/**
 * CYNA — Le bloc « Directeur » de l'Accueil (Plan directeur, règle IA2).
 *
 * Les TROIS rendez-vous au même endroit, sans surcharger l'Accueil :
 * un seul bloc, trois petits onglets, et le rendez-vous DU MOMENT affiché par
 * défaut (matin avant 14 h → briefing ; ensuite → débrief du soir ; le bilan
 * hebdo est à un clic, mis en avant le lundi).
 *
 * Règle IA3 : ces vues LISENT les données (pointages, factures, états C8) via
 * les fonctions pures de src/calculs/directeur.js — recalcul à l'affichage,
 * 100 % local. Le briefing du matin existant (DirecteurMatin) est rendu tel
 * quel, aucun comportement modifié.
 */
import React, { useMemo, useState } from 'react';
import { Sunrise, Sunset, CalendarRange } from 'lucide-react';
import DirecteurMatin from './DirecteurMatin';
import { useApp } from '../context/AppContext';
import { fmtN } from '../donnees';
import { construireDebriefSoir, construireBilanHebdo, rendezVousParDefaut } from '../calculs/directeur';

const CARD = {
  background: 'var(--dash-card, #ffffff)',
  border: '1px solid var(--dash-border, #e2e8f0)',
  borderLeft: '4px solid #0d3d6e',
  borderRadius: 14,
  padding: '16px 18px',
  marginBottom: 16,
  boxShadow: 'var(--ds-card-shadow, 0 2px 8px rgba(0,0,0,0.06))',
};
const LABEL_SECTION = { fontSize: 10, fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 };
const LIGNE = { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-primary, #0f172a)' };

function Entete({ Icone, titre }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <Icone size={15} color="#0d3d6e" strokeWidth={2.2} />
      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '1px' }}>{titre}</span>
    </div>
  );
}

// ── DÉBRIEF DU SOIR — la journée en 30 secondes ─────────────────────────────
export function DebriefSoir({ debrief, naviguer = () => {} }) {
  const d = debrief;
  const rien = d.heuresTotal === 0 && d.paiementsRecus.total === 0 && d.facturesEmises.length === 0 && d.changements.length === 0 && d.pointagesManquants.length === 0;
  return (
    <div data-testid="debrief-soir">
      <Entete Icone={Sunset} titre="Débrief du soir" />

      {/* C4 — l'alerte la plus utile du soir : le chef n'a pas encore pointé */}
      {d.pointagesManquants.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#dc2626', marginBottom: 4 }}>
            Pointage manquant aujourd'hui — {d.pointagesManquants.length} chantier{d.pointagesManquants.length > 1 ? 's' : ''} en cours sans heures
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)' }}>
            {d.pointagesManquants.map(m => m.nom).join(' · ')} — le chef n'a pas encore pointé.
          </div>
          <button onClick={() => naviguer('pointages')} style={{ marginTop: 8, background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#dc2626', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Saisir les heures
          </button>
        </div>
      )}

      {/* Heures du jour, par chantier et par qui */}
      <div style={{ marginBottom: 12 }}>
        <div style={LABEL_SECTION}>Heures pointées aujourd'hui — {fmtN(d.heuresTotal)}h</div>
        {d.parChantier.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted, #64748b)' }}>Aucune heure pointée pour l'instant.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {d.parChantier.map(c => (
              <div key={String(c.chantierId ?? 'atelier')} style={LIGNE}>
                <span style={{ fontWeight: 700 }}>{c.nom}</span>
                <span style={{ color: 'var(--text-muted, #64748b)' }}>
                  — {fmtN(c.heures)}h ({c.parEmploye.map(e => `${e.nom} ${fmtN(e.heures)}h`).join(', ')})
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* L'argent du jour */}
      {(d.paiementsRecus.total > 0 || d.facturesEmises.length > 0) && (
        <div style={{ marginBottom: 12 }}>
          <div style={LABEL_SECTION}>L'argent du jour</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {d.paiementsRecus.liste.map((p, i) => (
              <div key={`p${i}`} style={LIGNE}>
                <span style={{ color: '#059669', fontWeight: 700 }}>+ CHF {fmtN(p.montant)}</span>
                <span style={{ color: 'var(--text-muted, #64748b)' }}>reçu — {p.factureNumero}{p.chantierNom ? ` · ${p.chantierNom}` : ''}</span>
              </div>
            ))}
            {d.facturesEmises.map((f, i) => (
              <div key={`f${i}`} style={LIGNE}>
                <span style={{ fontWeight: 700 }}>CHF {fmtN(f.montantTTC)}</span>
                <span style={{ color: 'var(--text-muted, #64748b)' }}>facturé — {f.numero}{f.chantierNom ? ` · ${f.chantierNom}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Changements notables (états C8) */}
      {d.changements.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <div style={LABEL_SECTION}>Aujourd'hui sur les chantiers</div>
          {d.changements.map((c, i) => (
            <div key={i} style={{ ...LIGNE, marginBottom: 3 }}>{c.texte}</div>
          ))}
        </div>
      )}

      {rien && (
        <p style={{ fontSize: 13, color: 'var(--text-muted, #64748b)', margin: 0 }}>
          Journée calme : rien à signaler pour l'instant.
        </p>
      )}
    </div>
  );
}

// ── BILAN HEBDO — la semaine écoulée + celle qui vient ──────────────────────
export function BilanHebdo({ bilan, naviguer = () => {} }) {
  const b = bilan;
  return (
    <div data-testid="bilan-hebdo">
      <Entete Icone={CalendarRange} titre="Bilan de la semaine" />

      {/* La semaine écoulée en 4 chiffres */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'Heures pointées', val: `${fmtN(b.heuresSemaine)}h`, sub: b.deltaHeuresPct !== null ? `${b.deltaHeuresPct >= 0 ? '+' : ''}${b.deltaHeuresPct}% vs sem. préc.` : null },
          { label: 'CA encaissé', val: `CHF ${fmtN(b.caEncaisseSemaine)}`, sub: 'paiements reçus' },
          { label: 'Facturé', val: `CHF ${fmtN(b.montantEmisSemaine)}`, sub: `${b.nbFacturesEmises} facture${b.nbFacturesEmises !== 1 ? 's' : ''}` },
          { label: 'Chantiers finis', val: `${b.chantiersFinis.length}`, sub: b.chantiersFinis.map(c => c.nom).join(', ') || '—' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--bg-glass, #f8fafc)', border: '1px solid var(--dash-border, #e2e8f0)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted, #64748b)', marginBottom: 3 }}>{k.label}</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text-primary, #0f172a)' }}>{k.val}</div>
            {k.sub && <div style={{ fontSize: 10, color: 'var(--text-muted, #64748b)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Points durs */}
      {(b.impayesVieillis.length > 0 || b.attentesQuiTrainent.length > 0) && (
        <div style={{ marginBottom: 12 }}>
          <div style={LABEL_SECTION}>Points durs de la semaine</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {b.impayesVieillis.map((f, i) => (
              <div key={`i${i}`} style={LIGNE}>
                <span style={{ color: '#dc2626', fontWeight: 700 }}>⚠</span>
                <span>Facture {f.numero} a franchi {f.seuil} j de retard — CHF {fmtN(f.restant)} restants</span>
              </div>
            ))}
            {b.attentesQuiTrainent.map((c, i) => (
              <div key={`a${i}`} style={LIGNE}>
                <span style={{ color: '#b45309', fontWeight: 700 }}>⏳</span>
                <span>« {c.nom} » fini depuis {c.jours} j — CHF {fmtN(Math.round(c.resteDu))} toujours pas encaissés</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* La semaine qui vient — actions du matin, vue à 7 jours */}
      {b.actionsSemaine.length > 0 && (
        <div>
          <div style={LABEL_SECTION}>À faire cette semaine</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {b.actionsSemaine.map((a, i) => (
              <div key={i} style={LIGNE}>
                <span style={{ flexShrink: 0 }}>{typeof a.icone === 'string' ? a.icone : '•'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{typeof a.action === 'string' ? a.action : ''}</span>
                  {a.detail && <span style={{ color: 'var(--text-muted, #64748b)' }}> — {typeof a.detail === 'string' ? a.detail : ''}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── LE BLOC — un seul emplacement, trois rendez-vous ────────────────────────
export default function DirecteurBloc({ naviguer = () => {}, maintenant }) {
  const { chantiers = [], factures = [], pointages = [], parametres = {}, agentState } = useApp();
  // Instant de référence stable pour tout le rendu (surchargeable en test).
  const now = useMemo(() => maintenant || new Date(), [maintenant]);
  const [rdv, setRdv] = useState(() => rendezVousParDefaut(now));
  const estLundi = now.getDay() === 1;

  const debrief = useMemo(
    () => construireDebriefSoir({ chantiers, factures, pointages, parametres, date: now.toISOString().slice(0, 10) }),
    [chantiers, factures, pointages, parametres, now],
  );
  const bilan = useMemo(
    () => construireBilanHebdo({ chantiers, factures, pointages, briefing: agentState?.briefingMatin, date: now.toISOString().slice(0, 10) }),
    [chantiers, factures, pointages, agentState, now],
  );

  const ONGLETS = [
    { id: 'matin', label: 'Matin', Icone: Sunrise },
    { id: 'soir', label: 'Soir', Icone: Sunset },
    { id: 'hebdo', label: 'Hebdo', Icone: CalendarRange, badge: estLundi },
  ];

  // Onglets discrets superposés en haut à droite de la carte du rendez-vous
  // affiché (DirecteurMatin garde sa propre carte, rendu inchangé).
  const onglets = (
    <div style={{ position: 'absolute', top: 12, right: 14, display: 'flex', gap: 4, zIndex: 2 }}>
      {ONGLETS.map(o => (
        <button key={o.id} onClick={() => setRdv(o.id)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 10px', borderRadius: 16, fontSize: 10, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
          background: rdv === o.id ? '#0d3d6e' : 'var(--dash-card, #fff)',
          color: rdv === o.id ? '#fff' : 'var(--text-muted, #64748b)',
          border: rdv === o.id ? '1px solid #0d3d6e' : '1px solid var(--dash-border, #e2e8f0)',
        }}>
          <o.Icone size={10} /> {o.label}
          {o.badge && rdv !== o.id && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ position: 'relative' }} data-testid="directeur-bloc">
      {onglets}
      {rdv === 'matin' && (
        // Le briefing existant, rendu TEL QUEL (sa carte, son contenu — zéro changement).
        <DirecteurMatin briefing={agentState?.briefingMatin} scoreSante={agentState?.scoreGlobal ?? null} naviguer={naviguer} />
      )}
      {rdv === 'soir' && <div style={CARD}><DebriefSoir debrief={debrief} naviguer={naviguer} /></div>}
      {rdv === 'hebdo' && <div style={CARD}><BilanHebdo bilan={bilan} naviguer={naviguer} /></div>}
    </div>
  );
}
