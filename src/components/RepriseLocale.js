import React, { useEffect, useRef, useState } from 'react';
import { telechargerTexte } from '../utils/importControle';

export default function RepriseLocale({ projet, email, decider, fermer }) {
  const [occupe, setOccupe] = useState(false);
  const dialogue = useRef(null);
  useEffect(() => { dialogue.current?.focus(); }, []);
  useEffect(() => {
    const ecouter = e => { if (e.key === 'Escape' && !occupe) fermer(); };
    document.addEventListener('keydown', ecouter);
    return () => document.removeEventListener('keydown', ecouter);
  }, [fermer, occupe]);
  const choisir = async ajouter => { setOccupe(true); try { await decider(ajouter); } finally { setOccupe(false); } };
  const valeurs = Object.fromEntries(Object.entries(projet.propositions).map(([cle, capture]) => [cle, capture.valeur]));
  return <div style={{ position:'fixed', inset:0, zIndex:15000, background:'rgba(0,0,0,.6)', display:'grid', placeItems:'center' }} onClick={e => { if (e.target === e.currentTarget && !occupe) fermer(); }}>
    <section ref={dialogue} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Données trouvées sur ce navigateur" style={{ background:'var(--bg-card,white)', color:'var(--text-primary)', padding:24, borderRadius:12, maxWidth:650, maxHeight:'90vh', overflow:'auto' }}>
      <button aria-label="Fermer" disabled={occupe} onClick={fermer}>×</button>
      <h2>Données trouvées sur ce navigateur</h2>
      <ul>{Object.entries(valeurs).map(([cle, v]) => <li key={cle}>{cle === 'objectifs' ? `Objectifs (CA annuel ${v?.caAnnuel ?? 'non défini'})` : cle === 'evenementsCalendrier' ? `${v.length} événements de calendrier` : `Mémoire IA (${v.length} caractères)`}</li>)}</ul>
      <p>Les ajouter au compte <strong>{email}</strong> ?</p>
      <p>Le serveur garde les données déjà présentes. Les autres valeurs locales seront conservées dans une copie de secours.</p>
      {projet.erreur && <p role="alert">{projet.erreur}</p>}
      <button disabled={occupe} onClick={() => choisir(true)}>Ajouter à mon compte</button>
      <button disabled={occupe} onClick={() => choisir(false)}>Ne pas ajouter</button>
      <button disabled={occupe} onClick={() => telechargerTexte(JSON.stringify(valeurs, null, 2), 'donnees-locales.json')}>Télécharger</button>
      {occupe && <p role="status">Enregistrement…</p>}
    </section>
  </div>;
}
