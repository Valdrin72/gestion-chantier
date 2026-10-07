import { it, expect, vi } from 'vitest';
import { exportCSV } from '../utils/exportCSV';
it('neutralise formules string, garde nombres et ?chappements', () => {
  let blob; URL.createObjectURL = vi.fn(b => { blob=b; return 'blob:test'; }); URL.revokeObjectURL = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(() => {});
  const NativeBlob = globalThis.Blob; let contenu;
  globalThis.Blob = class { constructor(parts) { contenu=parts.join(''); } };
  try { exportCSV('test.csv',['titre'],[['=SUM(A1)','+1','-2+3','@x','\ttest','\rtest',-150,'normal','a";b']]); } finally { globalThis.Blob=NativeBlob; click.mockRestore(); }
  expect(contenu).toContain("'=SUM(A1);'+1;'-2+3;'@x;'\ttest;\"'\rtest\";-150;normal;\"a\"\";b\""); expect(blob).toBeTruthy();
});
