import React, { useEffect, useRef, useState } from 'react';
import { telechargerTexte } from '../utils/importControle';

// Lot 2b — vrais boutons (cibles ≥ 44 px, espacés). « Ajouter » est l'action principale ;
// « Ne pas ajouter » demande une confirmation, car il range les valeurs en copie de secours.
const base = { minHeight: 44, padding: '10px 18px', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', border: '1px solid transparent' };
export const STYLE_BOUTONS_REPRISE = {
  principal: { ...base, background: '#0D3D6E', color: '#fff' },
  secondaire: { ...base, background: '#fff', color: '#0D3D6E', border: '1px solid #0D3D6E' },
  discret: { ...base, background: 'transparent', color: '#475569', border: '1px solid #CBD5E1' },
};

export default function RepriseLocale({ projet, email, decider, fermer }) {
  const [occupe, setOccupe] = useState(false);
  const [confirmerRefus, setConfirmerRefus] = useState(false);
  const dialogue = useRef(null);
  useEffect(() => { dialogue.current?.focus(); }, []);
  useEffect(() => {
    const ecouter = e => { if (e.key === 'Escape' && !occupe) fermer(); };
    document.addEventListener('keydown', ecouter);
    return () => document.removeEventListener('keydown', ecouter);
  }, [fermer, occupe]);
  const choisir = async ajouter => { setOccupe(true); try { await decider(ajouter); } finally { setOccupe(false); setConfirmerRefus(false); } };
  const valeurs = Object.fromEntries(Object.entries(projet.propositions).map(([cle, capture]) => [cle, capture.valeur]));
  const desactive = b => (occupe ? { ...b, opacity: 0.6, cursor: 'wait' } : b);
  return <div style={{ position:'fixed', inset:0, zIndex:15000, background:'rgba(0,0,0,.6)', display:'grid', placeItems:'center', padding:16 }} onClick={e => { if (e.target === e.currentTarget && !occupe) fermer(); }}>
    <section ref={dialogue} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Données trouvées sur ce navigateur" style={{ position:'relative', background:'var(--bg-card,white)', color:'var(--text-primary)', padding:24, borderRadius:12, maxWidth:650, maxHeight:'90vh', overflow:'auto' }}>
      <button aria-label="Fermer" title="Décider plus tard" disabled={occupe} onClick={fermer}
        style={{ position:'absolute', top:8, right:8, width:44, height:44, borderRadius:22, border:'1px solid #CBD5E1', background:'#fff', color:'#475569', fontSize:22, lineHeight:1, cursor:'pointer' }}>×</button>
      <h2 style={{ marginTop:0, paddingRight:48 }}>Données trouvées sur ce navigateur</h2>
      <ul>{Object.entries(valeurs).map(([cle, v]) => <li key={cle}>{cle === 'objectifs' ? `Objectifs (CA annuel ${v?.caAnnuel ?? 'non défini'})` : cle === 'evenementsCalendrier' ? `${v.length} événements de calendrier` : `Mémoire IA (${v.length} caractères)`}</li>)}</ul>
      <p>Les ajouter au compte <strong>{email}</strong> ?</p>
      <p>Le serveur garde les données déjà présentes. Les autres valeurs locales seront conservées dans une copie de secours.</p>
      {projet.erreur && <p role="alert" style={{ color:'#B91C1C' }}>{projet.erreur}</p>}
      {!confirmerRefus ? <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginTop:16 }}>
        <button disabled={occupe} style={desactive(STYLE_BOUTONS_REPRISE.principal)} onClick={() => choisir(true)}>Ajouter à mon compte</button>
        <button disabled={occupe} style={desactive(STYLE_BOUTONS_REPRISE.secondaire)} onClick={() => setConfirmerRefus(true)}>Ne pas ajouter</button>
        <button disabled={occupe} style={desactive(STYLE_BOUTONS_REPRISE.discret)} onClick={() => telechargerTexte(JSON.stringify(valeurs, null, 2), 'donnees-locales.json')}>Télécharger</button>
      </div> : <div role="group" aria-label="Confirmer le refus" style={{ marginTop:16, padding:12, border:'1px solid #CBD5E1', borderRadius:8 }}>
        <p style={{ marginTop:0 }}>Ne pas ajouter ces données à votre compte ? Elles seront rangées dans une copie de secours (Paramètres → Copies de secours), d'où vous pourrez les restaurer plus tard.</p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
          <button disabled={occupe} style={desactive(STYLE_BOUTONS_REPRISE.secondaire)} onClick={() => choisir(false)}>Oui, ne pas ajouter</button>
          <button disabled={occupe} style={desactive(STYLE_BOUTONS_REPRISE.principal)} onClick={() => setConfirmerRefus(false)}>Retour</button>
        </div>
      </div>}
      {occupe && <p role="status">Enregistrement…</p>}
    </section>
  </div>;
}
