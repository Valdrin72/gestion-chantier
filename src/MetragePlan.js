import React, { useState, useRef } from 'react';
import { C } from './donnees';
import { DS } from './ds';

const carteStyle = DS.card;
const inputStyle = DS.input;
const labelStyle = DS.label;

const TYPES_POSTES = [
  { id: 'fp_sureleve', nom: 'Faux-plancher surélevé démontable', unite: 'm²', couleur: '#2196F3', couleurBg: 'rgba(33,150,243,0.12)', icone: '🔵', tarifDefaut: 180, rendementEquipeDefaut: 70, description: 'LIGNA, FORBO Gateway, pose démontable', formats: ['600x600', '600x800', '800x800'] },
  { id: 'fp_non_demontable', nom: 'Faux-plancher non démontable', unite: 'm²', couleur: '#FF9800', couleurBg: 'rgba(255,152,0,0.12)', icone: 'warning', tarifDefaut: 150, rendementEquipeDefaut: 80, description: 'FLOOR and more, pose fixe', formats: ['600x600', '800x800'] },
  { id: 'dallettes_doubles', nom: 'Dallettes doubles / Verbund', unite: 'm²', couleur: '#9C27B0', couleurBg: 'rgba(156,39,176,0.12)', icone: '🟣', tarifDefaut: 220, rendementEquipeDefaut: 40, description: 'Double dallettes, zones techniques', formats: ['600x600', '600x1200'] },
  { id: 'revetement_moquette', nom: 'Revêtement moquette', unite: 'm²', couleur: '#4CAF50', couleurBg: 'rgba(76,175,80,0.12)', icone: 'ok', tarifDefaut: 45, rendementEquipeDefaut: 120, description: 'FORBO Girlles ADILA, pose collée', formats: ['Rouleau', 'Dalle 500x500'] },
  { id: 'revetement_carrelage', nom: 'Revêtement carrelage', unite: 'm²', couleur: '#F44336', couleurBg: 'rgba(244,67,54,0.12)', icone: 'danger', tarifDefaut: 85, rendementEquipeDefaut: 35, description: 'Carrelage sur faux-plancher', formats: ['600x600', '300x600', '300x300'] },
  { id: 'portes_acces', nom: "Portes et trappes d'accès", unite: 'unité', couleur: '#795548', couleurBg: 'rgba(121,85,72,0.12)', icone: '🟤', tarifDefaut: 350, rendementEquipeDefaut: 8, description: "Trappes d'accès, joints de dilatation", formats: ['600x600', '600x1200'] },
  { id: 'depose', nom: 'Dépose / démontage existant', unite: 'm²', couleur: '#607D8B', couleurBg: 'rgba(96,125,139,0.12)', icone: '⚫', tarifDefaut: 25, rendementEquipeDefaut: 150, description: 'Dépose faux-plancher existant', formats: ['-'] },
  { id: 'joint_dilatation', nom: 'Joint de dilatation', unite: 'ml', couleur: '#FF5722', couleurBg: 'rgba(255,87,34,0.12)', icone: '🔸', tarifDefaut: 45, rendementEquipeDefaut: 60, description: 'Joints périphériques et de dilatation', formats: ['-'] },
];

const HAUTEURS_STANDARD = ['80mm', '100mm', '120mm', '128mm', '150mm', '180mm', '200mm', '250mm', '300mm', 'Autre'];

export default function MetragePlan({ parametres, onCreerChantier, onCreerDevis }) {
  const [planImage, setPlanImage] = useState(null);
  const [nomFichier, setNomFichier] = useState('');
  const [echelle, setEchelle] = useState('1:100');
  const [projet, setProjet] = useState({ nom: '', reference: '', batiment: '', niveau: '', date: new Date().toISOString().split('T')[0] });
  const [zones, setZones] = useState([]);
  const [tarifs, setTarifs] = useState(Object.fromEntries(TYPES_POSTES.map(t => [t.id, { tarif: t.tarifDefaut, rendementEquipe: t.rendementEquipeDefaut }])));
  const [afficherTarifs, setAfficherTarifs] = useState(false);
  const [afficherPlan, setAfficherPlan] = useState(true);
  const [equipe, setEquipe] = useState({
    chefEquipe: { nombre: 1, tarif: 450 },
    ouvrier: { nombre: 2, tarif: 350 },
    mainOeuvre: { nombre: 0, tarif: 280 },
  });
  const [margeCible, setMargeCible] = useState(25);
  const [tauxFraisGen, setTauxFraisGen] = useState(12);
  const fileRef = useRef();

  const nbOuvriers = (parseInt(equipe.chefEquipe.nombre) || 0) + (parseInt(equipe.ouvrier.nombre) || 0) + (parseInt(equipe.mainOeuvre.nombre) || 0);
  const coutEquipeJour = ((parseInt(equipe.chefEquipe.nombre) || 0) * (parseFloat(equipe.chefEquipe.tarif) || 0)) +
    ((parseInt(equipe.ouvrier.nombre) || 0) * (parseFloat(equipe.ouvrier.tarif) || 0)) +
    ((parseInt(equipe.mainOeuvre.nombre) || 0) * (parseFloat(equipe.mainOeuvre.tarif) || 0));
  const tarifJourMO = nbOuvriers > 0 ? coutEquipeJour / nbOuvriers : 0;

  const chargerPlan = (fichier) => {
    setNomFichier(fichier.name);
    const reader = new FileReader();
    reader.onload = (e) => setPlanImage(e.target.result);
    reader.readAsDataURL(fichier);
  };

  const ajouterZone = (typeId) => {
    const type = TYPES_POSTES.find(t => t.id === typeId);
    setZones([...zones, {
      id: Date.now(), typeId,
      nom: `${type.nom} — Zone ${zones.filter(z => z.typeId === typeId).length + 1}`,
      quantite: 0, hauteur: '120mm', format: type.formats[0], notes: '', inclus: true,
    }]);
  };

  const modifierZone = (id, champ, valeur) => setZones(zones.map(z => z.id === id ? { ...z, [champ]: valeur } : z));
  const supprimerZone = (id) => setZones(zones.filter(z => z.id !== id));

  const calculerZone = (zone) => {
    const config = tarifs[zone.typeId];
    const type = TYPES_POSTES.find(t => t.id === zone.typeId);
    const quantite = parseFloat(zone.quantite) || 0;
    const coutMateriel = quantite * config.tarif;
    const joursNecessaires = config.rendementEquipe > 0 ? quantite / config.rendementEquipe : 0;
    const coutMO = joursNecessaires * coutEquipeJour;
    const coutTotal = coutMateriel + coutMO;
    return { quantite, coutMateriel, joursNecessaires, coutMO, coutTotal, type };
  };

  const zonesIncluses = zones.filter(z => z.inclus);

  const totauxParType = TYPES_POSTES.map(type => {
    const zonesDuType = zonesIncluses.filter(z => z.typeId === type.id);
    const quantiteTotale = zonesDuType.reduce((t, z) => t + (parseFloat(z.quantite) || 0), 0);
    const calc = zonesDuType.reduce((t, z) => {
      const c = calculerZone(z);
      return { coutMateriel: t.coutMateriel + c.coutMateriel, joursNecessaires: t.joursNecessaires + c.joursNecessaires, coutMO: t.coutMO + c.coutMO, coutTotal: t.coutTotal + c.coutTotal };
    }, { coutMateriel: 0, joursNecessaires: 0, coutMO: 0, coutTotal: 0 });
    return { ...type, quantiteTotale, ...calc };
  }).filter(t => t.quantiteTotale > 0);

  const totalMateriel = totauxParType.reduce((t, p) => t + p.coutMateriel, 0);
  const totalJours = totauxParType.reduce((t, p) => t + p.joursNecessaires, 0);
  const totalMO = totauxParType.reduce((t, p) => t + p.coutMO, 0);
  const totalCouts = totalMateriel + totalMO;
  const fraisGen = totalCouts * (tauxFraisGen / 100);
  const coutRevient = totalCouts + fraisGen;
  const prixVente = coutRevient / (1 - margeCible / 100);
  const marge = prixVente - coutRevient;
  const surfaceTotale = zonesIncluses.filter(z => TYPES_POSTES.find(tp => tp.id === z.typeId)?.unite === 'm²').reduce((t, z) => t + (parseFloat(z.quantite) || 0), 0);
  const rendementFP = tarifs['fp_sureleve'].rendementEquipe;

  return (
    <div>
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Métrage Faux-Plancher</div>
          <div className="page-title-sub">Saisie assistée avec visualisation du plan</div>
        </div>
        <div className="page-actions-group">
          <button onClick={() => setAfficherTarifs(!afficherTarifs)} style={{ ...DS.btnGhost }}>⚙️ Tarifs</button>
          <button onClick={() => fileRef.current?.click()} style={{ ...DS.btnPrimary }}>📄 Charger plan PDF/Image</button>
          <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }}
            onChange={e => e.target.files[0] && chargerPlan(e.target.files[0])} />
        </div>
      </div>

      {/* INFOS PROJET */}
      <div style={carteStyle}>
        <div className="ds-card-title">Informations du projet</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '15px' }}>
          {[
            ['Nom du projet', 'nom', 'Campus Pictet...'],
            ['Référence', 'reference', 'W-24-15137'],
            ['Bâtiment', 'batiment', 'TOUR'],
            ['Niveau / Plan', 'niveau', 'P19'],
            ['Date', 'date', ''],
          ].map(([label, key, ph]) => (
            <div key={key}>
              <label style={labelStyle}>{label}</label>
              <input type={key === 'date' ? 'date' : 'text'} placeholder={ph} value={projet[key]}
                onChange={e => setProjet({ ...projet, [key]: e.target.value })} style={inputStyle} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '15px', marginTop: '15px', alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>Échelle du plan</label>
            <select value={echelle} onChange={e => setEchelle(e.target.value)} style={{ ...inputStyle, width: '120px' }}>
              {['1:50', '1:100', '1:200', '1:500'].map(e => <option key={e}>{e}</option>)}
            </select>
          </div>
          {nomFichier && (
            <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '6px 14px', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>
              📄 {nomFichier}
            </div>
          )}
        </div>
      </div>

      {/* TARIFS ET PARAMÈTRES */}
      {afficherTarifs && (
        <div style={carteStyle}>
          <div className="ds-card-title">Paramètres du chantier</div>

          <div style={{ background: 'var(--bg-hover)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '15px', fontSize: '15px' }}>Composition de l'équipe</div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px', background: 'var(--bg-card)', borderRadius: '10px', overflow: 'hidden' }}>
              <thead>
                <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
                  {['Rôle', 'Nombre', 'Tarif/jour (CHF)', 'Coût/jour total', 'Coût/semaine (5j)'].map(h => (
                    <th key={h} style={{ padding: '10px 15px', textAlign: 'left', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { key: 'chefEquipe', label: "Chef d'équipe", couleur: '#10b981' },
                  { key: 'ouvrier', label: 'Ouvrier qualifié', couleur: C.secondaire },
                  { key: 'mainOeuvre', label: "Main d'œuvre", couleur: C.warning },
                ].map(r => (
                  <tr key={r.key} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 15px', fontWeight: 'bold', color: r.couleur }}>{r.label}</td>
                    <td style={{ padding: '12px 15px' }}>
                      <input type="number" min="0" value={equipe[r.key].nombre}
                        onChange={e => setEquipe({ ...equipe, [r.key]: { ...equipe[r.key], nombre: parseInt(e.target.value) || 0 } })}
                        style={{ ...inputStyle, width: '70px', fontWeight: 'bold', fontSize: '16px', borderColor: r.couleur, borderWidth: '2px', textAlign: 'center' }} />
                    </td>
                    <td style={{ padding: '12px 15px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <input type="number" value={equipe[r.key].tarif}
                          onChange={e => setEquipe({ ...equipe, [r.key]: { ...equipe[r.key], tarif: parseFloat(e.target.value) || 0 } })}
                          style={{ ...inputStyle, width: '90px', fontWeight: 'bold', borderColor: r.couleur }} />
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>CHF/j</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 15px', fontWeight: 'bold', color: r.couleur }}>
                      CHF {((parseInt(equipe[r.key].nombre) || 0) * (parseFloat(equipe[r.key].tarif) || 0)).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 15px', color: 'var(--text-secondary)' }}>
                      CHF {((parseInt(equipe[r.key].nombre) || 0) * (parseFloat(equipe[r.key].tarif) || 0) * 5).toLocaleString()}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: 'rgba(16,185,129,0.10)', fontWeight: 'bold' }}>
                  <td style={{ padding: '12px 15px', color: '#10b981' }}>TOTAL ÉQUIPE</td>
                  <td style={{ padding: '12px 15px', color: '#10b981', fontSize: '16px' }}>{nbOuvriers} pers.</td>
                  <td style={{ padding: '12px 15px', color: 'var(--text-secondary)', fontSize: '12px' }}>Moy. CHF {Math.round(tarifJourMO)}/j/pers.</td>
                  <td style={{ padding: '12px 15px', color: '#10b981', fontSize: '16px' }}>CHF {coutEquipeJour.toLocaleString()}</td>
                  <td style={{ padding: '12px 15px', color: '#10b981' }}>CHF {(coutEquipeJour * 5).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              {[
                { label: 'Marge cible (%)', val: margeCible, set: setMargeCible },
                { label: 'Frais généraux (%)', val: tauxFraisGen, set: setTauxFraisGen },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg-card)', borderRadius: '10px', padding: '15px' }}>
                  <label style={labelStyle}>{s.label}</label>
                  <input type="number" value={s.val} onChange={e => s.set(parseFloat(e.target.value) || 0)}
                    style={{ ...inputStyle, fontWeight: 'bold', fontSize: '18px', color: '#10b981', borderColor: '#10b981', borderWidth: '2px' }} />
                </div>
              ))}
            </div>

            <div style={{ marginTop: '15px', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              {[
                { label: 'Rendement fp/jour', val: `${rendementFP} m²/jour`, couleur: '#10b981' },
                { label: 'Coût équipe/jour', val: `CHF ${coutEquipeJour.toLocaleString()}`, couleur: C.warning },
                { label: '📆 Pour 1000 m²', val: `${Math.ceil(1000 / rendementFP)} jours`, couleur: C.secondaire },
                { label: '📆 Pour 1500 m²', val: `${Math.ceil(1500 / rendementFP)} jours`, couleur: C.violet },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg-hover)', borderRadius: '8px', padding: '10px 15px', flex: 1, borderLeft: `3px solid ${s.couleur}` }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.label}</div>
                  <div style={{ fontWeight: 'bold', color: s.couleur, fontSize: '16px' }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '10px' }}>Tarifs et rendements par type de poste</div>
          <div style={{ background: 'var(--bg-hover)', border: `1px solid var(--border)`, borderRadius: '8px', padding: '10px 15px', marginBottom: '15px', fontSize: '13px', color: 'var(--text-primary)' }}>
            <strong>Rendement équipe</strong> = m² posés par jour par toute l'équipe. Ex: 70 m²/jour avec 3 ouvriers.
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Type de poste', 'Tarif matériel (CHF/unité)', 'Rendement équipe/jour', 'Simulation'].map(h => (
                <th key={h} style={DS.th}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {TYPES_POSTES.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: t.couleurBg }}>
                  <td style={{ padding: '10px 15px' }}>
                    <strong style={{ color: t.couleur }}>{t.icone} {t.nom}</strong>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t.description}</div>
                  </td>
                  <td style={{ padding: '10px 15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="number" value={tarifs[t.id].tarif}
                        onChange={e => setTarifs({ ...tarifs, [t.id]: { ...tarifs[t.id], tarif: parseFloat(e.target.value) || 0 } })}
                        style={{ ...inputStyle, width: '90px', borderColor: t.couleur }} />
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>CHF/{t.unite}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="number" value={tarifs[t.id].rendementEquipe}
                        onChange={e => setTarifs({ ...tarifs, [t.id]: { ...tarifs[t.id], rendementEquipe: parseFloat(e.target.value) || 1 } })}
                        style={{ ...inputStyle, width: '80px', borderColor: t.couleur, fontWeight: 'bold' }} />
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t.unite}/jour</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 15px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    1000 {t.unite} → <strong style={{ color: t.couleur }}>{Math.ceil(1000 / tarifs[t.id].rendementEquipe)} jours</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: planImage && afficherPlan ? '1fr 1fr' : '1fr', gap: '20px' }}>
        {planImage && afficherPlan && (
          <div style={carteStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <div className="ds-card-title" style={{ margin: 0 }}>Plan — {echelle}</div>
              <button onClick={() => setAfficherPlan(false)}
                style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer' }}>✕</button>
            </div>
            <img src={planImage} alt="Plan" style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--border)' }} />
            <div style={{ marginTop: '15px' }}>
              <div style={{ fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '13px' }}>Légende :</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {TYPES_POSTES.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', background: t.couleurBg, border: `1px solid ${t.couleur}`, borderRadius: '5px', padding: '3px 8px', color: 'var(--text-primary)' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: t.couleur }} />
                    {t.icone} {t.nom.substring(0, 22)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div>
          {/* RÉSUMÉ ÉQUIPE RAPIDE */}
          <div style={{ background: 'rgba(16,185,129,0.10)', border: '2px solid #10b981', borderRadius: '12px', padding: '15px 20px', marginBottom: '15px' }}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
              
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '15px' }}>
                  {equipe.chefEquipe.nombre > 0 && `${equipe.chefEquipe.nombre} chef · `}
                  {equipe.ouvrier.nombre > 0 && `${equipe.ouvrier.nombre} ouvrier${equipe.ouvrier.nombre > 1 ? 's' : ''} · `}
                  {equipe.mainOeuvre.nombre > 0 && `${equipe.mainOeuvre.nombre} MO · `}
                  {rendementFP} m²/jour fp
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                  Coût équipe/jour : CHF {coutEquipeJour.toLocaleString()} · {nbOuvriers} personne{nbOuvriers > 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[500, 1000, 1500, 2000].map(m => (
                  <div key={m} style={{ textAlign: 'center', background: 'var(--bg-card)', borderRadius: '8px', padding: '6px 10px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{m} m²</div>
                    <div style={{ fontWeight: 'bold', color: '#10b981', fontSize: '14px' }}>{Math.ceil(m / rendementFP)}j</div>
                  </div>
                ))}
              </div>
              <button onClick={() => setAfficherTarifs(!afficherTarifs)}
                style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                ✏️ Modifier
              </button>
            </div>
          </div>

          {/* BOUTONS ZONES */}
          <div style={carteStyle}>
            <div className="ds-card-title">Ajouter des zones de métrage</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {TYPES_POSTES.map(type => (
                <button key={type.id} onClick={() => ajouterZone(type.id)}
                  style={{ background: 'var(--bg-hover)', color: type.couleur, border: `2px solid ${type.couleur}`, borderRadius: '10px', padding: '12px 15px', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ fontWeight: 'bold', color: type.couleur, fontSize: '13px' }}>{type.icone} {type.nom}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                    CHF {tarifs[type.id].tarif}/{type.unite} · {tarifs[type.id].rendementEquipe} {type.unite}/jour équipe
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ZONES */}
          {zones.length > 0 && (
            <div style={carteStyle}>
              <div className="ds-card-title">Zones saisies ({zones.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {zones.map(zone => {
                  const type = TYPES_POSTES.find(t => t.id === zone.typeId);
                  const calc = calculerZone(zone);
                  return (
                    <div key={zone.id} style={{ background: 'var(--bg-card)', border: `2px solid ${zone.inclus ? type.couleur : 'var(--border)'}`, borderRadius: '10px', padding: '15px', opacity: zone.inclus ? 1 : 0.6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input type="checkbox" checked={zone.inclus} onChange={e => modifierZone(zone.id, 'inclus', e.target.checked)} />
                          <span style={{ fontWeight: 'bold', color: type.couleur }}>{type.icone} {type.nom}</span>
                        </div>
                        <button onClick={() => supprimerZone(zone.id)}
                          style={{ ...DS.btnDanger, padding: '3px 8px', fontSize: '12px' }}>Suppr</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={labelStyle}>Description zone</label>
                          <input value={zone.nom} onChange={e => modifierZone(zone.id, 'nom', e.target.value)} style={{ ...inputStyle, padding: '6px 10px' }} />
                        </div>
                        <div>
                          <label style={labelStyle}>Quantité ({type.unite})</label>
                          <input type="number" placeholder="0" value={zone.quantite || ''}
                            onChange={e => modifierZone(zone.id, 'quantite', e.target.value)}
                            style={{ ...inputStyle, padding: '6px 10px', fontWeight: 'bold', fontSize: '16px', borderColor: type.couleur, borderWidth: '2px' }} />
                        </div>
                        <div>
                          <label style={labelStyle}>Hauteur DKF</label>
                          <select value={zone.hauteur} onChange={e => modifierZone(zone.id, 'hauteur', e.target.value)}
                            style={{ ...inputStyle, padding: '6px 10px' }}>
                            {HAUTEURS_STANDARD.map(h => <option key={h}>{h}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Format dalles</label>
                          <select value={zone.format} onChange={e => modifierZone(zone.id, 'format', e.target.value)}
                            style={{ ...inputStyle, padding: '6px 10px' }}>
                            {type.formats.map(f => <option key={f}>{f}</option>)}
                          </select>
                        </div>
                      </div>
                      {zone.quantite > 0 && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                          {[
                            { label: 'Matériel', val: `CHF ${Math.round(calc.coutMateriel).toLocaleString()}` },
                            { label: 'MO', val: `CHF ${Math.round(calc.coutMO).toLocaleString()}` },
                            { label: 'Durée', val: `${calc.joursNecessaires.toFixed(1)} jours` },
                            { label: 'Total', val: `CHF ${Math.round(calc.coutTotal).toLocaleString()}`, bold: true },
                          ].map(s => (
                            <div key={s.label} style={{ background: 'var(--bg-hover)', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', border: s.bold ? `1px solid ${type.couleur}` : '1px solid var(--border)' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>{s.label} : </span>
                              <strong style={{ color: s.bold ? type.couleur : 'var(--text-primary)' }}>{s.val}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                      <input placeholder="Notes..." value={zone.notes || ''}
                        onChange={e => modifierZone(zone.id, 'notes', e.target.value)}
                        style={{ ...inputStyle, padding: '5px 10px', fontSize: '12px', background: 'var(--bg-hover)', marginTop: '8px' }} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RÉCAPITULATIF */}
      {zones.length > 0 && (
        <div style={{ ...carteStyle, borderLeft: '4px solid #3b82f6' }}>
          <div className="ds-card-title">
            Récapitulatif — {projet.nom || 'Projet'} {projet.niveau}
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '12px' }}>
              {nbOuvriers} pers. · CHF {coutEquipeJour.toLocaleString()}/jour
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px' }}>
            <thead>
              <tr>
                {['Type de poste', 'Quantité', 'Rend. équipe', 'Durée', 'Coût matériel', 'Coût MO', 'Total HT', 'CHF/m²'].map(h => (
                  <th key={h} style={DS.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {totauxParType.map((t, i) => (
                <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: t.couleurBg }}>
                  <td style={{ padding: '10px 12px' }}><strong style={{ color: t.couleur }}>{t.icone} {t.nom}</strong></td>
                  <td style={{ padding: '10px 12px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{t.quantiteTotale.toFixed(1)} {t.unite}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{tarifs[t.id].rendementEquipe} {t.unite}/j</td>
                  <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#10b981' }}>{t.joursNecessaires.toFixed(1)} j</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>CHF {Math.round(t.coutMateriel).toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>CHF {Math.round(t.coutMO).toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 'bold', color: t.couleur }}>CHF {Math.round(t.coutTotal).toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {t.unite === 'm²' && t.quantiteTotale > 0 ? `CHF ${(t.coutTotal / t.quantiteTotale).toFixed(0)}/m²` : '-'}
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                <td style={{ padding: '12px' }}>TOTAL</td>
                <td style={{ padding: '12px' }}>{surfaceTotale.toFixed(1)} m²</td>
                <td style={{ padding: '12px' }}>-</td>
                <td style={{ padding: '12px', fontSize: '16px' }}>{totalJours.toFixed(1)} jours</td>
                <td style={{ padding: '12px' }}>CHF {Math.round(totalMateriel).toLocaleString()}</td>
                <td style={{ padding: '12px' }}>CHF {Math.round(totalMO).toLocaleString()}</td>
                <td style={{ padding: '12px', fontSize: '16px' }}>CHF {Math.round(totalCouts).toLocaleString()}</td>
                <td style={{ padding: '12px' }}>{surfaceTotale > 0 ? `CHF ${(totalCouts / surfaceTotale).toFixed(0)}/m²` : '-'}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <div className="ds-card-title">Cascade financière</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { label: 'Coûts matériaux', val: totalMateriel, couleur: C.info, bg: 'rgba(59,130,246,0.1)' },
                  { label: `Main d'œuvre (${nbOuvriers} pers. × CHF ${Math.round(tarifJourMO)}/j moy.)`, val: totalMO, couleur: C.warning, bg: 'rgba(245,158,11,0.1)' },
                  { label: '= Coûts directs', val: totalCouts, couleur: '#455a64', bg: 'var(--bg-hover)', bold: true },
                  { label: `Frais généraux (${tauxFraisGen}%)`, val: fraisGen, couleur: C.violet, bg: 'rgba(139,92,246,0.1)' },
                  { label: '= Prix de revient', val: coutRevient, couleur: C.danger, bg: 'rgba(239,68,68,0.1)', bold: true },
                  { label: `Marge (${margeCible}%)`, val: marge, couleur: C.secondaire, bg: 'rgba(16,185,129,0.1)' },
                  { label: '= PRIX DE VENTE HT', val: prixVente, couleur: '#10b981', bg: 'rgba(16,185,129,0.1)', bold: true, big: true },
                ].map((s, i) => (
                  <div key={i} style={{ background: s.bg, borderRadius: '8px', padding: s.big ? '15px 18px' : '10px 15px', display: 'flex', justifyContent: 'space-between', border: s.bold ? `2px solid ${s.couleur}` : '1px solid var(--border)' }}>
                    <span style={{ fontWeight: s.bold ? 'bold' : 'normal', color: s.bold ? s.couleur : 'var(--text-primary)', fontSize: s.big ? '15px' : '13px' }}>{s.label}</span>
                    <strong style={{ color: s.couleur, fontSize: s.big ? '18px' : '14px' }}>CHF {Math.round(s.val).toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="ds-card-title">Prix de vente par m²</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {[
                  { label: 'Prix minimum', val: Math.round(coutRevient * 1.1 / Math.max(surfaceTotale, 1)), total: Math.round(coutRevient * 1.1), desc: 'Marge 10% — Risqué', couleur: C.danger, bg: 'rgba(239,68,68,0.1)' },
                  { label: 'Prix conseillé', val: Math.round(prixVente / Math.max(surfaceTotale, 1)), total: Math.round(prixVente), desc: `Marge ${margeCible}% — Recommandé`, couleur: C.secondaire, bg: 'rgba(16,185,129,0.1)' },
                  { label: '💎 Prix premium', val: Math.round(prixVente * 1.15 / Math.max(surfaceTotale, 1)), total: Math.round(prixVente * 1.15), desc: 'Marge +15% — Haut de gamme', couleur: C.violet, bg: 'rgba(139,92,246,0.1)' },
                ].map((s, i) => (
                  <div key={i} style={{ background: s.bg, border: `2px solid ${s.couleur}`, borderRadius: '10px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', color: s.couleur }}>{s.label}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.desc}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: s.couleur }}>CHF {s.val}/m²</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total : CHF {s.total.toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ background: 'rgba(16,185,129,0.10)', border: '2px solid #10b981', borderRadius: '10px', padding: '15px' }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '10px' }}>Résumé global</div>
                {[
                  ['Surface totale', `${surfaceTotale.toFixed(1)} m²`],
                  ["Chef d'équipe", `${equipe.chefEquipe.nombre} × CHF ${equipe.chefEquipe.tarif}/j`],
                  ['Ouvriers qualifiés', `${equipe.ouvrier.nombre} × CHF ${equipe.ouvrier.tarif}/j`],
                  ["Main d'œuvre", `${equipe.mainOeuvre.nombre} × CHF ${equipe.mainOeuvre.tarif}/j`],
                  ['Coût équipe/jour', `CHF ${coutEquipeJour.toLocaleString()}`],
                  ['Durée totale', `${Math.ceil(totalJours)} jours ouvrables`],
                  ['Jours-homme total', `${Math.ceil(totalJours * nbOuvriers)} jours-homme`],
                  ['Nb de zones', `${zones.filter(z => z.inclus).length}`],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(16,185,129,0.1)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
                    <strong style={{ color: '#10b981' }}>{val}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* BOUTONS CRÉER */}
          <div style={{ marginTop: '25px', display: 'flex', gap: '15px' }}>
            <button onClick={() => {
              if (onCreerChantier) onCreerChantier({
                nom: projet.nom || 'Nouveau chantier',
                numero: projet.reference || `CH-${new Date().getFullYear()}-00${Date.now()}`,
                surface: surfaceTotale,
                nombreJours: Math.ceil(totalJours),
                montantDevis: Math.round(prixVente),
                ville: projet.batiment || '',
                typesTravaux: [...new Set(zonesIncluses.map(z => TYPES_POSTES.find(t => t.id === z.typeId)?.nom).filter(Boolean))],
                notes: `Métrage depuis plan — ${nomFichier}\n${projet.batiment} ${projet.niveau}\n` +
                  totauxParType.map(t => `${t.icone} ${t.nom} : ${t.quantiteTotale.toFixed(1)} ${t.unite} — CHF ${Math.round(t.coutTotal).toLocaleString()}`).join('\n'),
                equipe: [],
              });
            }}
              style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '18px 30px', borderRadius: '12px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', flex: 1 }}>
              Créer un chantier avec ces données
            </button>
            <button onClick={() => {
              if (onCreerDevis) onCreerDevis({
                surface: surfaceTotale,
                prixPropose: Math.round(prixVente),
                notes: `Métrage depuis plan — ${nomFichier} · ${projet.batiment} ${projet.niveau}`,
              });
            }}
              style={{ background: '#10b981', color: 'white', border: 'none', padding: '18px 30px', borderRadius: '12px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', flex: 1 }}>
              Créer un devis avec ces données
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
