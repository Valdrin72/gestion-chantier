import React from 'react';
import { useApp } from '../../context/AppContext';
import useActionConfirmee from '../../hooks/useActionConfirmee';
import { copieOrigine, aEteModifieAilleurs } from '../../utils/gardeEdition';
import { TYPES_CORBEILLE, corbeille, estSupprime, restaurerDeLaCorbeille, referentsALaCorbeille, referenceCorbeille, retirerDefinitivement } from '../../utils/corbeille';
import { DS } from '../../ds';
const libelle = x => [x.numero, x.prenom, x.nom || x.entreprise].filter(Boolean).join(' ') || String(x.id);
const labels = { devis: 'Devis', clients: 'Clients', chantiers: 'Chantiers' };
const conflit = 'Cet élément a été modifié sur un autre appareil. Vérifiez les données puis recommencez.';
export default function Corbeille() {
 const { listesCompletes = {}, setDonneesListes, confirmer, afficherNotif, modeStockage, consultationMobile } = useApp();
 const agir = useActionConfirmee(afficherNotif);
 const restaurer = async (type, element) => {
  const origine = copieOrigine(element);
  const refs = referentsALaCorbeille(type, origine, listesCompletes).map(r => ({ ...r, element: copieOrigine(r.element) }));
  // CORB-01 / CORB-06 — le groupe entier ou rien : un devis ou un chantier ne redevient jamais
  // actif en laissant son client (ou son devis) à la corbeille, sinon une facture créée ensuite
  // perdrait le nom de son client. Fermer la fenêtre = Annuler.
  if (refs.length && !await confirmer(
    `${libelle(origine)} dépend d'éléments à la corbeille : ${refs.map(r => `${labels[r.type]} ${libelle(r.element)}`).join(', ')}.\n\nIls seront restaurés avec lui.`,
    { labelOui: 'Restaurer tout', labelNon: 'Annuler', danger: false })) return;
  const groupe = [{ type, element: origine }, ...refs];
  agir(setDonneesListes, prev => {
   if (groupe.some(r => {
    const actuel = prev[r.type].find(x => String(x.id) === String(r.element.id));
    return !estSupprime(actuel) || aEteModifieAilleurs(r.element, actuel);
   })) return { erreur: conflit };
   const next = { ...prev };
   for (const r of groupe) next[r.type] = next[r.type].map(x => String(x.id) === String(r.element.id) ? restaurerDeLaCorbeille(x) : x);
   return { valeur: next };
  }, 'Élément restauré');
 };
 const detruire = async (type, element) => {
  const origine = copieOrigine(element);
  if (!await confirmer(`Supprimer définitivement ${libelle(origine)} ? Cette action est irréversible.`, { labelOui: 'Supprimer définitivement' })) return;
  agir(setDonneesListes, prev => {
   const actuel = prev[type].find(x => String(x.id) === String(origine.id));
   if (!estSupprime(actuel) || aEteModifieAilleurs(origine, actuel)) return { erreur: conflit };
   const reference = referenceCorbeille(type, actuel, prev);
   if (reference) return { erreur: `Élément encore utilisé par des données restantes. ${reference}` };
   const next = retirerDefinitivement(prev, [{ type, element: actuel }], modeStockage === 'org');
   return next === prev ? { erreur: 'Impossible de supprimer définitivement le dernier élément' } : { valeur: next };
  }, 'Élément supprimé définitivement');
 };
 return <section style={DS.card}>
  <h2>Corbeille</h2>
  <p>Les éléments non référencés sont purgés après 30 jours.</p>
  {TYPES_CORBEILLE.map(type => <section key={type} aria-label={labels[type]}>
   <h3>{labels[type]}</h3>
   {corbeille(listesCompletes[type]).length === 0 && <p>Aucun élément</p>}
   {corbeille(listesCompletes[type]).map(x => {
    const date = new Date(x.supprime_le);
    const jours = Math.max(0, Math.ceil(30 - (Date.now() - date.getTime()) / 86400000));
    return <div key={x.id} style={{ padding: 12, borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
     <strong>{libelle(x)}</strong>
     <span>{date.toLocaleDateString('fr-CH')} {date.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}</span>
     <span>{x.supprime_par}</span><span>{jours} jours restants</span>
     {!consultationMobile && <><button style={DS.btnPrimary} onClick={() => restaurer(type, x)}>Restaurer</button>
     <button style={DS.btnDanger} onClick={() => detruire(type, x)}>Supprimer définitivement</button></>}
    </div>;
   })}
  </section>)}
 </section>;
}
