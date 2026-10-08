import { it, expect } from 'vitest';
import { verifierSauvegarde, instantaneComplet, resumerImport } from '../importControle';
import { donneesImportees } from '../corbeille';
const base = () => ({ chantiers:[], devis:[], factures:[], clients:[], pointages:[], parametres:{} });
it.each([
  ['objectifs', []], ['objectifs', 1], ['objectifs', {caAnnuel:'1,5'}], ['objectifs', {margeCible:false}], ['objectifs', {nbChantiers:{}}],
  ['evenementsCalendrier', {}], ['evenementsCalendrier', [null]], ['evenementsCalendrier', [{}]],
  ['evenementsCalendrier', [{id:1},{id:'1'}]],
  ...['date','label','bg','color','sub','titre','categorie'].map(k => ['evenementsCalendrier', [{id:1,[k]:{}}]]),
  ['memoireIA', null], ['memoireIA', 'x'.repeat(200001)],
])('refuse %s invalide (%#)', (cle, valeur) => {
  const resultat = verifierSauvegarde({...base(), [cle]:valeur});
  expect(resultat.erreurs.length).toBeGreaterThan(0);
});
it('clés connues, export, import ancien conservé et vides explicites', () => {
  const actuel = {...base(), objectifs:{caAnnuel:1}, evenementsCalendrier:[{id:1}], memoireIA:'ancienne'};
  const exporte = instantaneComplet(actuel);
  expect(exporte).toMatchObject({objectifs:actuel.objectifs,evenementsCalendrier:actuel.evenementsCalendrier,memoireIA:'ancienne'});
  const vide = {...base(),objectifs:null,evenementsCalendrier:[],memoireIA:''};
  expect(verifierSauvegarde(vide)).toMatchObject({erreurs:[],ignorees:[],donnees:vide});
  expect(donneesImportees(actuel,base())).toMatchObject({objectifs:actuel.objectifs,evenementsCalendrier:actuel.evenementsCalendrier,memoireIA:'ancienne'});
  expect(donneesImportees(actuel,vide)).toMatchObject({objectifs:null,evenementsCalendrier:[],memoireIA:''});
  expect(resumerImport(actuel,base()).lignes.find(l=>l.label==='Mémoire IA').sauvegarde).toContain('conservée');
});
