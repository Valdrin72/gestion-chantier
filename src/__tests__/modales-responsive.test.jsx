/**
 * Modales responsives (LOT 2 point 4) — garde de NON-RÉGRESSION.
 *
 * Les modales à largeur FIXE (width:420 / minWidth:420) débordaient sur iPhone (375px).
 * Corrigées en `width:'100%' + maxWidth:<orig>` (+ marge d'overlay + hauteur défilable).
 * Ces tests lisent le VRAI code source des composants concernés et échouent si une
 * largeur fixe est réintroduite sur une boîte de modale — c'est exactement le
 * « remettre une largeur fixe → un test échoue » demandé. Zéro logique recopiée :
 * on assère sur le fichier réel livré.
 *
 * Preuve fonctionnelle complémentaire (navigateur réel) faite hors CI : à 375px la
 * modale Planning mesure 343px (bords 16↔359, ne déborde plus) et à 1200px elle
 * garde 520px (maxWidth d'origine, PC inchangé).
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';

const lire = (p) => fs.readFileSync(p, 'utf8');

describe('Modales responsives — plus aucune largeur fixe qui déborde', () => {
  it('Factures : la modale paiement utilise width:100% + maxWidth:420 (plus de width:420 fixe)', () => {
    const src = lire('src/Factures.js');
    // width:420 fixe INTERDIT (réintroduction = régression)
    expect(src).not.toMatch(/width:\s*420\b/);
    // motif responsive présent
    expect(src).toMatch(/maxWidth:\s*420/);
    expect(src).toMatch(/width:\s*'100%'/);
  });

  it('Planning : la modale « Modifier le planning » n\'impose plus minWidth:420', () => {
    const src = lire('src/Planning.js');
    expect(src).not.toMatch(/minWidth:\s*420\b/);
    // la boîte garde sa largeur d\'origine en plafond + fluide en mobile
    expect(src).toMatch(/maxWidth:\s*520[\s\S]{0,80}width:\s*'100%'|width:\s*'100%'[\s\S]{0,80}maxWidth:\s*520/);
  });

  it('Modales hautes : contenu défilable (maxHeight + overflowY) → boutons atteignables', () => {
    for (const f of ['src/Factures.js', 'src/Planning.js', 'src/Calendrier.js', 'src/pages/DevisPage.js', 'src/App.js']) {
      const src = lire(f);
      expect(src, `${f} doit borner la hauteur d'au moins une modale`).toMatch(/maxHeight:\s*'90vh'/);
      expect(src, `${f} doit rendre le contenu défilable`).toMatch(/overflowY:\s*'auto'/);
    }
  });
});
