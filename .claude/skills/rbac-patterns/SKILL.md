---
name: rbac-patterns
description: Skill RBAC (contrôle d'accès par rôle) — patterns pour gérer les permissions par rôle dans CYNA (admin, chef de chantier, comptable, ouvrier). Invoque avec /rbac-patterns pour implémenter ou vérifier des restrictions d'accès.
---

# RBAC — Contrôle d'accès CYNA SÀRL

## Rôles définis

| Rôle | Code | Description |
|------|------|-------------|
| Administrateur | `admin` | Accès total, gestion utilisateurs |
| Chef de chantier | `chef_chantier` | Ses chantiers, journal, équipes |
| Comptable | `comptable` | Devis, factures, finances |
| Ouvrier | `ouvrier` | Saisie heures uniquement |
| Lecture seule | `lecture` | Consultation sans modification |

## Matrice des permissions

| Page/Action | admin | chef_chantier | comptable | ouvrier |
|-------------|-------|--------------|-----------|---------|
| Dashboard | ✅ | ✅ | ✅ | ❌ |
| Devis (lecture) | ✅ | ✅ | ✅ | ❌ |
| Devis (écriture) | ✅ | ❌ | ✅ | ❌ |
| Chantiers (lecture) | ✅ | ses chantiers | ✅ | ❌ |
| Chantiers (écriture) | ✅ | ses chantiers | ❌ | ❌ |
| Journal heures | ✅ | ✅ | ❌ | ses heures |
| Factures | ✅ | ❌ | ✅ | ❌ |
| Clients | ✅ | lecture | ✅ | ❌ |
| Employés | ✅ | lecture | ❌ | ❌ |
| Paramètres | ✅ | ❌ | ❌ | ❌ |
| Finances | ✅ | ❌ | ✅ | ❌ |

## Implémentation dans l'app CYNA

### Navigation filtrée
```js
// Navigation autorisée selon le rôle
const navAutorisees = NAV_ITEMS.filter(item =>
  item.roles.includes(profil.role) || profil.role === 'admin'
);
```

### Guard de page
```js
// Vérifier l'accès en début de composant
const peutEditer = profil?.role === 'admin' ||
  (profil?.role === 'chef_chantier' && chantier.chefId === profil.id);

if (!peutEditer) {
  return <div>Accès refusé</div>;
}
```

### Guard de bouton/action
```js
// Masquer les actions non autorisées
{profil?.role === 'admin' || profil?.role === 'comptable' ? (
  <button onClick={creerFacture}>Créer facture</button>
) : null}
```

### Comparaisons de rôle (insensibles à la casse)
```js
// ✅ Robuste
const estAdmin = profil?.role?.toLowerCase() === 'admin';

// ❌ Fragile
const estAdmin = profil?.role === 'Admin';
```

## Règles de sécurité RBAC

1. **Validation côté serveur** : les restrictions UI ne suffisent pas — Supabase RLS doit aussi filtrer
2. **Principe du moindre privilège** : donner le minimum de droits nécessaires
3. **Vérification systématique** : chaque action modifiante doit vérifier le rôle
4. **Audit trail** : logger les actions sensibles (suppression, facturation)

## Supabase RLS — Exemples
```sql
-- Politique : les chefs voient seulement leurs chantiers
CREATE POLICY "chefs_own_chantiers"
ON chantiers FOR SELECT
USING (
  auth.uid() = chef_id OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
```

## Ce que tu ne dois PAS faire
- Cacher les données seulement côté UI (sans RLS Supabase)
- Comparer les rôles sans `.toLowerCase()`
- Donner les droits `admin` par défaut
- Laisser un utilisateur modifier ses propres droits
