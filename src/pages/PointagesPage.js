import React from 'react';
import { ClipboardCheck } from 'lucide-react';
import { DS } from '../ds';
import { useApp } from '../context/AppContext';
import PointageFormulaire from '../components/pointages/PointageFormulaire';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short' });
}

function totalHeuresProd(pointage) {
  return (pointage.repartitions || [])
    .filter(r => ['production', 'atelier'].includes(r.categorie))
    .reduce((s, r) => s + (r.heures || 0), 0);
}

/**
 * Page /pointages — saisie riche par employé/jour.
 * Complément de /heures (vue grille hebdomadaire chef de chantier).
 */
export default function PointagesPage() {
  const { pointages, parametres, chantiers } = useApp();
  const employes = parametres?.employes ?? [];

  // Derniers pointages — 20 max, triés du plus récent au plus ancien
  const recents = [...pointages]
    .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
    .slice(0, 20);

  const nomEmploye = (id) => {
    const e = employes.find(e => String(e.id) === String(id));
    return e ? `${e.prenom} ${e.nom}` : `Employé #${id}`;
  };

  const nomChantier = (chantierId) => {
    const c = chantiers.find(c => String(c.id) === String(chantierId));
    return c?.nom ?? chantierId;
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <ClipboardCheck size={24} color="#0d3d6e" />
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Pointages
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
            Saisie riche par employé/jour — multi-chantier, absences, déplacements
          </p>
        </div>
      </div>

      {/* Disposition : formulaire (gauche) + historique (droite) */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Formulaire */}
        <div style={{ flex: '1 1 400px', minWidth: '320px' }}>
          <PointageFormulaire />
        </div>

        {/* Historique récent */}
        <div style={{ flex: '0 1 360px', minWidth: '280px' }}>
          <div style={{ ...DS.cardCompact, padding: '16px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 14px' }}>
              Pointages récents
            </h2>
            {recents.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                Aucun pointage enregistré
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recents.map(p => {
                  const heuresProd = totalHeuresProd(p);
                  const premierChantier = p.repartitions.find(r => r.chantierId);
                  const nbChantiers = new Set(p.repartitions.filter(r => r.chantierId).map(r => r.chantierId)).size;
                  return (
                    <div key={p.id} style={{
                      ...DS.cardInset,
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {nomEmploye(p.employeId)}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {formatDate(p.date)}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {premierChantier ? nomChantier(premierChantier.chantierId) : '—'}
                        {nbChantiers > 1 && <span style={{ color: 'var(--text-muted)' }}> +{nbChantiers - 1}</span>}
                        {heuresProd > 0 && (
                          <span style={{ marginLeft: '8px', fontWeight: 600, color: '#0d3d6e' }}>
                            {heuresProd}h
                          </span>
                        )}
                      </div>
                      {p.deplacement && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          🚗 Trajet {p.deplacement.duree_h}h
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
