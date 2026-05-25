import { FINANCIER_RULES } from './financier.js';
import { TRESORERIE_RULES } from './tresorerie.js';
import { PLANNING_RULES } from './planning.js';
import { RH_RULES } from './rh.js';
import { QUALITE_RULES } from './qualite.js';
import { SECURITE_RULES } from './securite.js';

export const ALL_RULES = [
  ...FINANCIER_RULES,
  ...TRESORERIE_RULES,
  ...PLANNING_RULES,
  ...RH_RULES,
  ...QUALITE_RULES,
  ...SECURITE_RULES,
];
