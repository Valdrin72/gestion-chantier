import React from 'react';
import { listerCopies } from '../../utils/copiesRejetees';
import { telechargerTexte } from '../../utils/importControle';
export default function CopiesSecours({ userId, restaurer }) {
  let copies = [];
  try { copies = listerCopies(localStorage, userId); } catch {}
  return <section><h2>Copies de secours — Télécharger ou restaurer</h2>
    {!copies.length && <p>Aucune copie de secours sur cet appareil.</p>}
    {copies.map(c => <article key={c.cle} style={{padding:16,border:'1px solid var(--border)',marginBottom:12}}>
      <h3>{c.type} — {c.date}</h3><p>{c.cle}</p>
      {!c.contenu ? <p>Copie illisible</p> : <p>{Object.entries(c.comptes).map(([k,n]) => `${k} : ${n}`).join(' · ')}</p>}
      {c.contenu && !c.complete && <p>Copie partielle (un élément) : téléchargez-la pour la consulter</p>}
      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}><button onClick={() => { try { telechargerTexte(c.texte, `${c.cle}-${c.date.replace(/[^0-9A-Za-z-]/g,'-')}.json`); } catch { window.alert('Téléchargement impossible. La copie est conservée.'); } }}>Télécharger</button>
      {c.complete && <button onClick={() => restaurer(c.contenu, new Blob([c.texte]).size)}>Restaurer</button>}
      </div>
    </article>)}
  </section>;
}
