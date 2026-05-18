// Génère un téléchargement CSV côté client sans dépendance externe
export function exportCSV(nomFichier, entetes, lignes) {
  const echapper = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n\r;]/.test(s) ? `"${s}"` : s;
  };
  const lignesCsv = [entetes, ...lignes].map(row => row.map(echapper).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + lignesCsv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}
