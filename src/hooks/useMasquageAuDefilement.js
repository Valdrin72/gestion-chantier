import { useState, useEffect } from 'react';

/**
 * Cacher/montrer un élément flottant au défilement — MÉCANISME PARTAGÉ.
 * Extrait tel quel de la bottom-nav flottante pour que la topbar mobile et la
 * bottom-nav se comportent EXACTEMENT pareil : même seuil anti-tremblement (10px),
 * même respect de prefers-reduced-motion, même scroller (.app-main sinon window),
 * même nettoyage de l'écouteur.
 *
 * Retourne { cachee, reduceMotion } :
 *  • cachee = true  → l'élément doit se rétracter (défilement vers le BAS) ;
 *  • reduceMotion   → l'utilisateur a désactivé les animations : ne jamais cacher, pas de transition.
 */
export default function useMasquageAuDefilement() {
  const [cachee, setCachee] = useState(false);
  const reduceMotion = typeof window !== 'undefined' && !!window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reduceMotion) return; // animations désactivées → l'élément reste simplement visible
    // Selon la hauteur du contenu, le scroll peut vivre sur .app-main OU sur le document
    // (min-height:100vh partout → pas de hauteur fixe). On lit la position réelle des deux
    // et on écoute les deux, pour que le rétractable marche à coup sûr (topbar ET bottom-nav).
    const lireY = () => {
      const am = document.querySelector('.app-main');
      const amY = am ? am.scrollTop : 0;
      const winY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      return Math.max(amY, winY);
    };
    let lastY = lireY();
    const SEUIL = 10; // anti-tremblement : on ignore les micro-défilements < 10px
    const onScroll = () => {
      const y = lireY();
      if (y <= 0) { setCachee(false); lastY = y; return; } // tout en haut → toujours visible
      const delta = y - lastY;
      if (delta > SEUIL) setCachee(true);        // vers le BAS → cacher
      else if (delta < -SEUIL) setCachee(false); // vers le HAUT → montrer
      lastY = y;
    };
    const am = document.querySelector('.app-main');
    window.addEventListener('scroll', onScroll, { passive: true });
    if (am) am.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (am) am.removeEventListener('scroll', onScroll);
    };
  }, [reduceMotion]);

  return { cachee, reduceMotion };
}
