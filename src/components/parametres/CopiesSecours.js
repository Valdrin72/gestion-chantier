import React from 'react';
import { listerCopies } from '../../utils/copiesRejetees';
import { telechargerTexte } from '../../utils/importControle';
import { donneeRestaurable, LIBELLES_REPRISE } from '../../utils/repriseLocale';
import { STYLE_BOUTONS_REPRISE } from '../RepriseLocale';
export default function CopiesSecours({ userId, restaurer, restaurerDonnee }) {
  let copies = [];
  try { copies = listerCopies(localStorage, userId); } catch {}
  return <section><h2>Copies de secours — Télécharger ou restaurer</h2>
    {!copies.length && <p>Aucune copie de secours sur cet appareil.</p>}
    {copies.map(c => {
      const donnee = c.type === 'reprise locale' ? donneeRestaurable(c.contenu) : null;
      return <article key={c.cle} style={{padding:16,border:'1px solid var(--border)',marginBottom:12}}>
        <h3>{c.type} — {c.date}</h3><p>{c.cle}</p>
        {donnee && <p>Contenu : {LIBELLES_REPRISE[donnee.cle]}</p>}
        {!c.contenu ? <p>Copie illisible</p> : !donnee && <p>{Object.entries(c.comptes).map(([k,n]) => `${k} : ${n}`).join(' · ')}</p>}
        {c.contenu && !c.complete && !donnee && <p>Copie partielle (un élément) : téléchargez-la pour la consulter</p>}
        {c.type === 'reprise locale' && <details><summary>Voir le contenu exact</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{c.texte}</pre></details>}
        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:12}}>
          <button style={STYLE_BOUTONS_REPRISE.discret} onClick={() => { try { telechargerTexte(c.texte, `${c.cle}-${c.date.replace(/[^0-9A-Za-z-]/g,'-')}.json`); } catch { window.alert('Téléchargement impossible. La copie est conservée.'); } }}>Télécharger</button>
          {c.complete && <button style={STYLE_BOUTONS_REPRISE.secondaire} onClick={() => restaurer(c.contenu, new Blob([c.texte]).size)}>Restaurer</button>}
          {donnee && restaurerDonnee && <button style={STYLE_BOUTONS_REPRISE.principal} onClick={() => restaurerDonnee(donnee.cle, donnee.valeur)}>Restaurer cette donnée</button>}
        </div>
      </article>;
    })}
  </section>;
}
