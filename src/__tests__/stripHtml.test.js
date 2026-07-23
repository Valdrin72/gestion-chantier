/**
 * #8 — stripHtml : sanitisation des champs texte libre AVANT export PDF client.
 * Teste la VRAIE fonction exportée (aucun logic-mirror). Enjeu : ce qui part chez
 * le client (architecte, régie) ne doit pas contenir de balises HTML, MAIS le
 * vocabulaire de chantier (« ép. <5mm », « < 2 jours ») doit être PRÉSERVÉ.
 */
import { describe, it, expect } from 'vitest';
import { stripHtml } from '../ExportPDF';

describe('stripHtml — retire les balises, préserve le vocabulaire chantier', () => {
  it('MORDANT : une balise <b> est retirée (ouvrante ET fermante)', () => {
    expect(stripHtml('<b>urgent</b>')).toBe('urgent');
    expect(stripHtml('texte <br/> suite')).toBe('texte  suite');
    expect(stripHtml('<div class="x">a</div>')).toBe('a');
  });

  it('MORDANT : « ép. <5mm » PRÉSERVÉ (le < suivi d\'un chiffre n\'est pas une balise)', () => {
    expect(stripHtml('ép. <5mm')).toBe('ép. <5mm');
    expect(stripHtml('tolérance <0.1mm sur la dalle')).toBe('tolérance <0.1mm sur la dalle');
  });

  it('MORDANT : « < 2 jours » PRÉSERVÉ (le < suivi d\'un espace n\'est pas une balise)', () => {
    expect(stripHtml('délai < 2 jours')).toBe('délai < 2 jours');
    expect(stripHtml('marge < 15% = danger')).toBe('marge < 15% = danger');
  });

  it('MORDANT : balise réelle ET mesure technique dans la même chaîne', () => {
    // Le <b> saute, le <5mm reste.
    expect(stripHtml('<b>Note</b> : joint <5mm requis')).toBe('Note : joint <5mm requis');
  });

  it('MORDANT : entités HTML décodées (&amp; &lt; &gt; &nbsp; &quot;)', () => {
    expect(stripHtml('Dupont &amp; Fils')).toBe('Dupont & Fils');
    expect(stripHtml('a &lt;tag&gt; b')).toBe('a <tag> b');
    expect(stripHtml('x&nbsp;y')).toBe('x y');
    expect(stripHtml('il a dit &quot;ok&quot;')).toBe('il a dit "ok"');
  });

  it('non-string renvoyé tel quel (null, number, undefined) — pas de crash', () => {
    expect(stripHtml(null)).toBe(null);
    expect(stripHtml(undefined)).toBe(undefined);
    expect(stripHtml(42)).toBe(42);
  });

  it('texte normal sans HTML → inchangé', () => {
    expect(stripHtml('Travaux à prévoir en 2 semaines.')).toBe('Travaux à prévoir en 2 semaines.');
  });
});
