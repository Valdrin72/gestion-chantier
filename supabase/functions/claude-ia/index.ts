import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Prompts métier CYNA ────────────────────────────────────────

function promptAnalyserChantier(d: any): string {
  return `Tu es un expert en gestion de chantiers BTP à Genève, Suisse.
Analyse ce chantier et donne des recommandations concrètes en français.

DONNÉES DU CHANTIER :
- Nom : ${d.nom}
- CA : CHF ${d.ca?.toFixed(0) ?? 'N/A'}
- Coût réel total : CHF ${d.coutReel?.toFixed(0) ?? 0}
- Marge brute : ${d.margePct?.toFixed(1) ?? 'N/A'}%
- Avancement : ${d.avancement ?? 0}%
- Jours prévus / réels : ${d.joursPrevus ?? 'N/A'} / ${d.joursReels ?? 0}
- Statut : ${d.statut ?? 'N/A'}
- EAC (Coût total estimé à fin) : CHF ${d.eac?.toFixed(0) ?? 'N/A'}
- RAD (Reste à dépenser) : CHF ${d.rad?.toFixed(0) ?? 'N/A'}

SEUILS BTP GENÈVE : marge rentable ≥ 20%, limite 15-20%, danger < 15%.

Réponds en 3 sections courtes :
1. **Diagnostic** (2-3 phrases sur l'état actuel)
2. **Points de vigilance** (liste à puces, max 4 points)
3. **Actions recommandées** (liste à puces, max 3 actions concrètes)`;
}

function promptSuggererDevis(d: any): string {
  return `Tu es un deviseur expert BTP à Genève, Suisse.
Génère un devis chiffré pour les travaux décrits ci-dessous.

DESCRIPTION DES TRAVAUX :
${d.description}

TYPE DE TRAVAUX : ${d.typeTraveaux ?? 'non précisé'}
SURFACE / QUANTITÉ : ${d.surface ?? 'non précisée'}
NIVEAU DE FINITION : ${d.finition ?? 'standard'}

Contexte tarifaire Genève 2024 : main d'œuvre ≈ CHF 650-900/jour (chargée).

Génère une liste de postes avec prix unitaires et totaux. Format :
**POSTE 1 — [Nom]**
- Description : ...
- Quantité : ... unité
- Prix unitaire : CHF ...
- Total : CHF ...

À la fin, donne :
- **Sous-total HT : CHF ...**
- **TVA 8.1% : CHF ...**
- **TOTAL TTC : CHF ...**
- **Marge recommandée** : X% (fourchette selon complexité)
- **Durée estimée** : X jours ouvrables`;
}

function promptExpliquerAlertes(d: any): string {
  const listeAlertes = (d.alertes || [])
    .map((a: any) => `- [${a.niveau}] ${a.message}${a.detail ? ' — ' + a.detail : ''}`)
    .join('\n');

  return `Tu es un conseiller de gestion BTP à Genève. Explique ces alertes à un chef d'entreprise
en langage clair et accessible, et propose des actions concrètes.

ALERTES ACTIVES (${(d.alertes || []).length}) :
${listeAlertes || 'Aucune alerte active.'}

Pour chaque alerte, explique :
1. Ce que ça signifie concrètement
2. Le risque si rien n'est fait
3. L'action recommandée (délai + responsable suggéré)

Commence par les alertes DANGER, puis ATTENTION, puis INFO.
Sois direct et pratique. Pas de jargon technique.`;
}

function promptAnalysePortefeuille(d: any): string {
  const chantiersStr = (d.chantiers || [])
    .map((c: any) => `- ${c.nom} | CA: CHF ${c.ca?.toFixed(0) ?? 0} | Marge: ${c.marge?.toFixed(1) ?? 'N/A'}% | Statut: ${c.statut}`)
    .join('\n');

  return `Tu es un directeur financier spécialisé BTP à Genève.
Analyse ce portefeuille de chantiers et donne un bilan stratégique.

PORTEFEUILLE (${(d.chantiers || []).length} chantiers) :
${chantiersStr}

CA TOTAL : CHF ${d.caTotal?.toFixed(0) ?? 0}
MARGE MOYENNE : ${d.margeMoyenne?.toFixed(1) ?? 'N/A'}%
FACTURÉ : CHF ${d.facture?.toFixed(0) ?? 0}

Réponds en 4 sections :
1. **Bilan en chiffres** (3-4 indicateurs clés commentés)
2. **Chantiers prioritaires** (top 2-3 à surveiller de près)
3. **Tendance** (est-ce que la situation s'améliore ou se dégrade ?)
4. **3 décisions stratégiques** à prendre ce mois`;
}

// ── Handler principal ──────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Vérifier le JWT Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Session expirée' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, data } = await req.json();

    let prompt = '';
    switch (action) {
      case 'analyser_chantier':   prompt = promptAnalyserChantier(data);   break;
      case 'suggerer_devis':      prompt = promptSuggererDevis(data);       break;
      case 'expliquer_alertes':   prompt = promptExpliquerAlertes(data);    break;
      case 'analyse_portefeuille': prompt = promptAnalysePortefeuille(data); break;
      default:
        return new Response(JSON.stringify({ error: `Action inconnue: ${action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errBody}`);
    }

    const result = await response.json();
    const texte = result.content?.[0]?.text ?? '';

    return new Response(JSON.stringify({ texte }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? 'Erreur serveur' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
