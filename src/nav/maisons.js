/**
 * Configuration du menu — 5 « maisons » regroupant les écrans existants.
 * Ceci NE modifie aucun écran : c'est uniquement le regroupement du menu.
 * Chaque maison a une `page` principale (clic sur l'en-tête) et des `enfants`
 * (autres écrans rangés dessous). Le routage par `page` reste inchangé côté App.
 *
 * Source unique de vérité de la navigation → importée par App ET par les tests,
 * pour qu'un futur changement de mapping soit détecté par le garde-fou.
 */
import {
  LayoutDashboard, HardHat, DollarSign, ClipboardList, Settings,
  Bell, Calendar, Clock, FileText, Users, UserCog, Bot, Calculator,
} from 'lucide-react';

export function construireMaisons({ urgentAlerteCount = 0, nbFacturesRetard = 0 } = {}) {
  return [
    { id: 'accueil', label: 'Accueil', Icon: LayoutDashboard, labelCourt: 'Accueil', page: 'dashboard',
      enfants: [
        { id: 'alertes', label: 'Alertes', Icon: Bell, badge: urgentAlerteCount || null },
      ] },
    { id: 'maison_chantiers', label: 'Chantiers', Icon: HardHat, labelCourt: 'Chantiers', page: 'chantiers',
      enfants: [
        { id: 'planning', label: 'Planning', Icon: Calendar },
        { id: 'heures',   label: 'Heures',   Icon: Clock },
      ] },
    { id: 'maison_finances', label: 'Finances', Icon: DollarSign, labelCourt: 'Finances', page: 'finances', badge: nbFacturesRetard || null,
      enfants: [
        { id: 'devis',    label: 'Devis',    Icon: FileText },
        { id: 'clients',  label: 'Clients',  Icon: Users },
        { id: 'employes', label: 'Employés', Icon: UserCog },
      ] },
    { id: 'maison_analyse', label: 'Analyse & IA', Icon: ClipboardList, labelCourt: 'Analyse', page: 'rapport',
      enfants: [
        { id: 'agents',  label: 'Centre IA', Icon: Bot },
        { id: 'calculs', label: 'Calculs',   Icon: Calculator },
      ] },
    { id: 'parametres', label: 'Paramètres', Icon: Settings, labelCourt: 'Config', page: 'parametres', enfants: [] },
  ];
}

/**
 * Filtre les maisons selon les pages autorisées : une maison n'apparaît que si sa
 * page principale OU au moins un enfant est autorisé ; les enfants non autorisés sont retirés.
 */
export function filtrerMaisons(maisons, pagesAutorisees = []) {
  return maisons
    .map(m => ({ ...m, enfants: (m.enfants || []).filter(e => pagesAutorisees.includes(e.id)) }))
    .filter(m => pagesAutorisees.includes(m.page) || m.enfants.length > 0);
}

/** Tous les écrans atteignables via le menu (page principale + enfants), à plat. */
export function ecransAtteignables(maisons) {
  return maisons.flatMap(m => [m.page, ...(m.enfants || []).map(e => e.id)]);
}

/**
 * Raccourcis de la BARRE MOBILE (bottom-nav), pensés « terrain » : les écrans du
 * quotidien depuis le chantier. Ordre voulu : Accueil · Chantiers · Heures · Planning.
 * (Finances/Analyse restent accessibles via le bouton « Plus » — tiroir complet.)
 *
 * Dérivé de l'arbre `maisons` (source unique : mêmes libellés/icônes/permissions) SANS
 * modifier sa structure ni son ordre → le menu latéral PC reste strictement inchangé.
 * Un raccourci n'apparaît que si sa page est autorisée (présente dans `maisons` filtré).
 */
const RACCOURCIS_MOBILE = ['dashboard', 'chantiers', 'heures', 'planning'];

export function raccourcisMobileTerrain(maisons) {
  const parPage = new Map();
  for (const m of maisons) {
    // page principale de la maison
    parPage.set(m.page, { id: m.id, page: m.page, labelCourt: m.labelCourt, Icon: m.Icon });
    // enfants : la « page » de navigation est leur id
    for (const e of (m.enfants || [])) {
      parPage.set(e.id, { id: e.id, page: e.id, labelCourt: e.label, Icon: e.Icon });
    }
  }
  return RACCOURCIS_MOBILE.map(p => parPage.get(p)).filter(Boolean);
}
