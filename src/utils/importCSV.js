// Parses a CSV text (semicolon or comma separated, with optional BOM)
// Returns { headers: string[], rows: string[][] }
export function parseCSV(text) {
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = clean.split('\n').filter(l => l.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };

  // Auto-detect separator (semicolon preferred for Swiss locale)
  const sep = lines[0].includes(';') ? ';' : ',';

  const parseRow = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === sep && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);
  return { headers, rows };
}

// Maps parsed CSV rows to client objects
// Accepts the export format: Nom;Prénom;Entreprise;Type;Téléphone;Email;Ville;Canton
// Also accepts variations in column names (case-insensitive)
export function mapClientsFromCSV(headers, rows) {
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

  const COL_MAP = {
    nom:         ['nom', 'name', 'last name', 'lastname'],
    prenom:      ['prenom', 'prenom', 'first name', 'firstname', 'given name'],
    entreprise:  ['entreprise', 'societe', 'societe', 'company', 'firma'],
    type:        ['type'],
    telephone:   ['telephone', 'telephone', 'tel', 'phone', 'mobile'],
    email:       ['email', 'e-mail', 'mail', 'courriel'],
    adresse:     ['adresse', 'address', 'rue', 'street'],
    ville:       ['ville', 'city', 'localite', 'localite'],
    canton:      ['canton', 'region', 'region', 'state'],
    notes:       ['notes', 'remarques', 'commentaires', 'comments'],
  };

  // Find column index for each field
  const colIdx = {};
  for (const [field, aliases] of Object.entries(COL_MAP)) {
    const idx = headers.findIndex(h => aliases.includes(norm(h)));
    if (idx !== -1) colIdx[field] = idx;
  }

  const TYPES_VALIDES = ['Entreprise', 'Particulier', 'Architecte', "Bureau d'études", 'Promoteur'];

  return rows
    .filter(row => row.some(cell => cell.trim() !== ''))
    .map(row => {
      const get = (field) => (colIdx[field] !== undefined ? row[colIdx[field]] || '' : '').trim();
      const type = get('type');
      return {
        id: Date.now() + Math.random(),
        nom:        get('nom'),
        prenom:     get('prenom'),
        entreprise: get('entreprise'),
        type:       TYPES_VALIDES.includes(type) ? type : 'Entreprise',
        telephone:  get('telephone'),
        email:      get('email'),
        adresse:    get('adresse'),
        ville:      get('ville'),
        canton:     get('canton'),
        notes:      get('notes'),
      };
    })
    .filter(c => c.nom || c.entreprise); // skip empty rows
}
