import React, { useState, useRef } from 'react';
import FormulaireMotDePasse from './FormulaireMotDePasse';
export default function NouveauMotDePasse({ terminerRecuperation, deconnecter }) {
  const [enCours, setEnCours] = useState(false);
  const enCoursRef = useRef(false);
  const [erreur, setErreur] = useState('');
  return <main><h1>Choisir un nouveau mot de passe</h1>
    <FormulaireMotDePasse onSucces={() => { window.alert('Mot de passe modifié'); terminerRecuperation(); }} />
    {erreur && <p role="alert">{erreur}</p>}
    <button disabled={enCours} onClick={async () => {
      if (enCoursRef.current) return;
      enCoursRef.current = true; setEnCours(true); setErreur('');
      try {
        const resultat = await deconnecter();
        if (!resultat?.ok) setErreur('La déconnexion a échoué. Vérifiez votre connexion et réessayez.');
      } catch {
        setErreur('La déconnexion a échoué. Vérifiez votre connexion et réessayez.');
      } finally { enCoursRef.current = false; setEnCours(false); }
    }}>Se déconnecter</button>
  </main>;
}
