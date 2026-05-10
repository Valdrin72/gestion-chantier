import React, { useState, useRef } from 'react';
import { C } from './donnees';
import { DS } from './ds';


const CATEGORIES = [
  { id: 'avant', label: 'Avant travaux', couleur: C.info, bg: 'rgba(59,130,246,0.12)' },
  { id: 'pendant', label: 'Pendant travaux', couleur: C.warning, bg: 'rgba(245,158,11,0.12)' },
  { id: 'apres', label: 'Après travaux', couleur: C.secondaire, bg: 'rgba(16,185,129,0.12)' },
  { id: 'probleme', label: 'Problème / Imprévu', couleur: C.danger, bg: 'rgba(239,68,68,0.12)' },
  { id: 'autre', label: 'Autre', couleur: C.violet, bg: 'rgba(139,92,246,0.12)' },
];

export default function Photos({ chantiers, photosData, setPhotosData }) {
  const [chantierSelectionne, setChantierSelectionne] = useState(null);
  const [categorieActive, setCategorieActive] = useState('avant');
  const [photoSelectionnee, setPhotoSelectionnee] = useState(null);
  const [chargement, setChargement] = useState(false);
  const fileRef = useRef();
  const cameraRef = useRef();

  // ===== RÉCUPÉRER PHOTOS =====
  const getPhotos = (chantierId, categorie = null) => {
    const photos = photosData[chantierId] || [];
    if (categorie) return photos.filter(p => p.categorie === categorie);
    return photos;
  };

  const getTotalPhotos = (chantierId) => (photosData[chantierId] || []).length;

  // ===== AJOUTER PHOTO =====
  const ajouterPhoto = async (fichiers, chantierId, categorie) => {
    setChargement(true);
    const photosExistantes = photosData[chantierId] || [];
    const nouvelles = [];

    for (const fichier of Array.from(fichiers)) {
      if (!fichier.type.startsWith('image/')) continue;

      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onerror = () => resolve(null);
        reader.onload = (e) => {
          // Compresser l'image
          const img = new Image();
          img.onerror = () => resolve(null);
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const maxSize = 800;
              let width = img.width;
              let height = img.height;
              if (width > height) {
                if (width > maxSize) { height = height * maxSize / width; width = maxSize; }
              } else {
                if (height > maxSize) { width = width * maxSize / height; height = maxSize; }
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', 0.7));
            } catch {
              resolve(null);
            }
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(fichier);
      });
      if (!base64) continue;

      nouvelles.push({
        id: Date.now() + Math.random(),
        base64,
        categorie,
        description: '',
        date: new Date().toLocaleDateString('fr-CH'),
        heure: new Date().toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }),
        nom: fichier.name,
        taille: (fichier.size / 1024).toFixed(0) + ' KB',
      });
    }

    setPhotosData({ ...photosData, [chantierId]: [...photosExistantes, ...nouvelles] });
    setChargement(false);
  };

  // ===== SUPPRIMER PHOTO =====
  const supprimerPhoto = (chantierId, photoId) => {
    const photos = (photosData[chantierId] || []).filter(p => p.id !== photoId);
    setPhotosData({ ...photosData, [chantierId]: photos });
    setPhotoSelectionnee(null);
  };

  // ===== MODIFIER DESCRIPTION =====
  const modifierDescription = (chantierId, photoId, desc) => {
    const photos = (photosData[chantierId] || []).map(p => p.id === photoId ? { ...p, description: desc } : p);
    setPhotosData({ ...photosData, [chantierId]: photos });
  };

  // ===== VUE GALERIE CHANTIER =====
  if (chantierSelectionne) {
    const c = chantierSelectionne;
    const photos = getPhotos(c.id);
    const photosCategorie = getPhotos(c.id, categorieActive);
    const categorieInfo = CATEGORIES.find(cat => cat.id === categorieActive);

    return (
      <div>
        <div className="page-header-row" style={{ marginBottom: '20px' }}>
          <div className="page-title-block">
            <div className="page-title-main" style={{ fontSize: 20 }}>{c.nom}</div>
            <div className="page-title-sub">{photos.length} photo{photos.length > 1 ? 's' : ''} au total</div>
          </div>
          <div className="page-actions-group">
            <button onClick={() => { setChantierSelectionne(null); setPhotoSelectionnee(null); }} style={{ ...DS.btnGhost }}>← Retour</button>
            <button onClick={() => fileRef.current?.click()} style={{ ...DS.btnPrimary }}>Importer</button>
            <button onClick={() => cameraRef.current?.click()} style={{ ...DS.btnPrimary }}>Photo</button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
            onChange={e => e.target.files?.length && ajouterPhoto(e.target.files, c.id, categorieActive)} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
            onChange={e => e.target.files?.length && ajouterPhoto(e.target.files, c.id, categorieActive)} />
        </div>

        {/* ONGLETS CATÉGORIES */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => {
            const nb = getPhotos(c.id, cat.id).length;
            return (
              <button key={cat.id} onClick={() => setCategorieActive(cat.id)}
                style={{ background: categorieActive === cat.id ? cat.couleur + '28' : 'rgba(255,255,255,0.04)', color: categorieActive === cat.id ? cat.couleur : 'var(--text-secondary)', border: `1px solid ${categorieActive === cat.id ? cat.couleur + '60' : 'rgba(255,255,255,0.08)'}`, padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: categorieActive === cat.id ? 700 : 500, fontFamily: 'inherit', transition: 'all 0.18s' }}>
                {cat.label} {nb > 0 && <span style={{ background: 'rgba(255,255,255,0.3)', borderRadius: '10px', padding: '1px 7px', marginLeft: '5px' }}>{nb}</span>}
              </button>
            );
          })}
        </div>

        {/* ZONE DE DROP */}
        <div onClick={() => fileRef.current?.click()}
          style={{ border: `2px dashed rgba(59,130,246,0.4)`, borderRadius: '14px', padding: '20px', textAlign: 'center', background: 'rgba(59,130,246,0.05)', cursor: 'pointer', marginBottom: '20px', transition: 'border-color 0.18s' }}>
          {chargement ? (
            <div style={{ color: categorieInfo.couleur, fontWeight: 'bold' }}>Chargement des photos...</div>
          ) : (
            <>
              <div style={{ fontSize: '30px', color: 'var(--text-muted)' }}>◎</div>
              <div style={{ color: categorieInfo.couleur, fontWeight: 'bold', marginTop: '5px' }}>
                Cliquez pour ajouter des photos — {categorieInfo.label}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>JPG, PNG, HEIC acceptés · Compression automatique</div>
            </>
          )}
        </div>

        {/* GALERIE */}
        {photosCategorie.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '30px', color: 'var(--text-muted)' }}>◎</div>
            <div style={{ marginTop: '10px' }}>Aucune photo dans cette catégorie</div>
            <div style={{ fontSize: '13px', marginTop: '5px' }}>Cliquez sur la zone ci-dessus pour en ajouter</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
            {photosCategorie.map(photo => (
              <div key={photo.id} style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.025) 100%)', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.3)', cursor: 'pointer', border: photoSelectionnee?.id === photo.id ? `1px solid rgba(59,130,246,0.5)` : `1px solid rgba(255,255,255,0.08)`, transition: 'border-color 0.18s' }}
                onClick={() => setPhotoSelectionnee(photoSelectionnee?.id === photo.id ? null : photo)}>
                <div style={{ position: 'relative' }}>
                  <img src={photo.base64} alt={photo.description || photo.nom}
                    style={{ width: '100%', height: '150px', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                    <button onClick={(e) => { e.stopPropagation(); supprimerPhoto(c.id, photo.id); }}
                      style={{ background: 'rgba(183,28,28,0.85)', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px' }}>×</button>
                  </div>
                  <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', padding: '8px', color: 'white', fontSize: '11px' }}>
                    {photo.date} {photo.heure}
                  </div>
                </div>
                <div style={{ padding: '10px' }}>
                  <input value={photo.description || ''}
                    placeholder="Ajouter une description..."
                    onChange={e => { e.stopPropagation(); modifierDescription(c.id, photo.id, e.target.value); }}
                    onClick={e => e.stopPropagation()}
                    style={{ width: '100%', border: 'none', fontSize: '12px', color: 'var(--text-primary)', outline: 'none', background: 'transparent', boxSizing: 'border-box' }} />
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '3px' }}>{photo.taille}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* VUE AGRANDIE */}
        {photoSelectionnee && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setPhotoSelectionnee(null)}>
            <div style={{ maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }}>
              <img src={photoSelectionnee.base64} alt={photoSelectionnee.description}
                style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px' }} />
              <div style={{ background: 'rgba(22,27,34,0.95)', padding: '12px 20px', borderRadius: '0 0 8px 8px', textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold', color: '#3b82f6' }}>{photoSelectionnee.description || 'Sans description'}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{photoSelectionnee.date} à {photoSelectionnee.heure} · {photoSelectionnee.taille}</div>
                <button onClick={(e) => { e.stopPropagation(); supprimerPhoto(c.id, photoSelectionnee.id); }}
                  style={{ ...DS.btnDanger, marginTop: '8px' }}>
                  Supprimer
                </button>
              </div>
              <button onClick={() => setPhotoSelectionnee(null)}
                style={{ position: 'absolute', top: '-15px', right: '-15px', background: 'var(--bg-card)', color: 'var(--text-primary)', border: 'none', borderRadius: '50%', width: '35px', height: '35px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>×</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== VUE LISTE =====
  return (
    <div>
      <div className="page-title-main" style={{ marginBottom: 24 }}>Photos des chantiers</div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
        {[
          { label: 'Chantiers avec photos', val: Object.keys(photosData).filter(id => photosData[id]?.length > 0).length, couleur: '#3b82f6' },
          { label: 'Photos totales', val: Object.values(photosData).reduce((t, p) => t + (p?.length || 0), 0), couleur: '#10b981' },
          { label: 'Avant travaux', val: Object.values(photosData).reduce((t, p) => t + (p?.filter(ph => ph.categorie === 'avant').length || 0), 0), couleur: '#3b82f6' },
          { label: 'Après travaux', val: Object.values(photosData).reduce((t, p) => t + (p?.filter(ph => ph.categorie === 'apres').length || 0), 0), couleur: '#10b981' },
        ].map(s => (
          <div key={s.label} style={{ background: `linear-gradient(145deg, ${s.couleur}0a 0%, rgba(255,255,255,0.025) 100%)`, border: `1px solid ${s.couleur}28`, borderRadius: '16px', padding: '20px', flex: 1, minWidth: '150px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '8px' }}>{s.label}</div>
            <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* LISTE CHANTIERS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {chantiers.map(c => {
          const total = getTotalPhotos(c.id);
          const parCategorie = CATEGORIES.map(cat => ({
            ...cat, nb: getPhotos(c.id, cat.id).length
          }));
          const premierePhoto = getPhotos(c.id)[0];

          return (
            <div key={c.id} style={{ ...DS.card, padding: 0, overflow: 'hidden', cursor: 'pointer', marginBottom: 0, transition: 'transform 0.18s, box-shadow 0.18s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
              onClick={() => setChantierSelectionne(c)}>
              <div style={{ display: 'flex', alignItems: 'stretch' }}>
                {/* MINIATURE */}
                <div style={{ width: '120px', minHeight: '100px', background: 'var(--bg-hover)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {premierePhoto ? (
                    <img src={premierePhoto.base64} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <div style={{ fontSize: '30px', color: 'var(--text-muted)' }}>◎</div>
                      <div style={{ fontSize: '11px' }}>Aucune photo</div>
                    </div>
                  )}
                </div>

                {/* INFOS */}
                <div style={{ padding: '15px 20px', flex: 1 }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{c.nom}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '3px' }}>{c.ville} · {c.statut}</div>

                  {/* CATÉGORIES */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                    {parCategorie.map(cat => (
                      <div key={cat.id} style={{ background: cat.nb > 0 ? cat.couleur + '18' : 'var(--bg-hover)', border: `1px solid ${cat.nb > 0 ? cat.couleur : 'var(--border)'}`, borderRadius: '12px', padding: '3px 10px', fontSize: '12px', color: cat.nb > 0 ? cat.couleur : 'var(--text-secondary)', fontWeight: cat.nb > 0 ? 600 : 'normal' }}>
                        {cat.label.split(' ')[0]} {cat.nb}
                      </div>
                    ))}
                  </div>
                </div>

                {/* TOTAL */}
                <div style={{ padding: '15px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderLeft: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px', color: total > 0 ? '#3b82f6' : 'var(--text-muted)' }}>{total}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>photo{total > 1 ? 's' : ''}</div>
                  <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '5px' }}>Voir →</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
