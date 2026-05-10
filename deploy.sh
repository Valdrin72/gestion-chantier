#!/usr/bin/env bash
# CYNA — Déploiement en une commande
# Usage : bash deploy.sh
set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CYNA SÀRL — Déploiement"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Build
echo "▸ Build en cours..."
npm run build --silent
echo "  ✓ Build terminé"

# Déploiement sur Netlify
echo ""
echo "▸ Déploiement sur Netlify..."
echo "  (Si première fois : entrez votre email Netlify)"
echo ""
netlify deploy --prod --dir=build

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Déployé. Ouvrez l'URL sur votre téléphone."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
