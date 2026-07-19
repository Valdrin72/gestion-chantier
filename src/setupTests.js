// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// ── Oracle de complétude Phase 7c (garde-fou pointages) ──────────────────────
// Actif UNIQUEMENT si CYNA_GARDE_LOG est défini : chaque console.error contenant
// "GARDE-POINTAGES" est appendé (atomique O_APPEND) au fichier pointé. On compte
// ensuite les lignes → nombre d'appels moteurs sans pointages dans toute la suite.
// Zéro impact sur les runs normaux (env non défini).
if (process.env.CYNA_GARDE_LOG) {
  const fs = require('fs');
  const logPath = process.env.CYNA_GARDE_LOG;
  const origError = console.error;
  console.error = (...args) => {
    try {
      const msg = args.map(a => (typeof a === 'string' ? a : '')).join(' ');
      if (msg.includes('GARDE-POINTAGES')) fs.appendFileSync(logPath, msg + '\n');
    } catch { /* ignore */ }
    return origError.apply(console, args);
  };
}
