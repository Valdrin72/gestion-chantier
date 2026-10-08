import React, { useState, useEffect, useRef } from 'react';
export default function ResumeImport({ resume, anomalies, ignorees, confirmer, fermer, occupe }) {
  const dialogue = useRef(null);
  useEffect(() => { dialogue.current?.focus(); }, []);
  const [mot, setMot] = useState('');
  useEffect(() => {
    const ecouter = e => { if (e.key === 'Escape' && !occupe) fermer(); };
    document.addEventListener('keydown', ecouter);
    return () => document.removeEventListener('keydown', ecouter);
  }, [fermer, occupe]);
  const exigeMot = !resume.ancienFormat && resume.heuresActuelles > 0;
  return <div style={{position:'fixed',inset:0,zIndex:15000,background:'rgba(0,0,0,.6)',display:'grid',placeItems:'center'}} onClick={e => { if (e.target === e.currentTarget && !occupe) fermer(); }}>
    <section ref={dialogue} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Résumé de l’import" style={{background:'var(--bg-card, white)',color:'var(--text-primary)',padding:24,borderRadius:12,maxWidth:650,maxHeight:'90vh',overflow:'auto'}}>
      <button aria-label="Fermer" disabled={occupe} onClick={fermer}>×</button>
      <h2>Résumé de l’import</h2><p>Sauvegarde du {resume.date}</p>
      <table><thead><tr><th>Données</th><th>Actuel</th><th>Sauvegarde</th></tr></thead><tbody>
        {resume.lignes.map(l => <tr key={l.label}><th>{l.label}</th><td>{l.actuel}</td><td>{l.sauvegarde}</td></tr>)}
      </tbody></table>
      <p>{resume.ancienFormat ? `Ancien format : vos ${resume.heuresActuelles} h sont conservées` : `${resume.heuresImportees} h remplaceront vos ${resume.heuresActuelles} h`}</p>
      {anomalies.slice(0, 20).map((a,i) => <p key={i}>Avertissement : {a}</p>)}
      {anomalies.length > 20 && <p>… et {anomalies.length - 20} autres</p>}
      {!!ignorees.length && <p>Ignoré : {ignorees.join(', ')}</p>}
      {exigeMot && <label>Tapez REMPLACER<input aria-label="Tapez REMPLACER" value={mot} onChange={e => setMot(e.target.value)} disabled={occupe}/></label>}
      <button disabled={occupe || (exigeMot && mot !== 'REMPLACER')} onClick={confirmer}>Importer</button>
      <button disabled={occupe} onClick={fermer}>Annuler</button>
      {occupe && <p role="status">Enregistrement…</p>}
    </section>
  </div>;
}
