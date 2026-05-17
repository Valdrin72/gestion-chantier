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

function promptChatLibre(d: any): string {
  return `Tu es un expert BTP à Genève, Suisse, avec 20 ans d'expérience dans le secteur de la construction.
Tu maîtrises parfaitement :
- La réglementation suisse et genevoise du bâtiment (LCI, normes SIA)
- Les coûts et tarifs BTP genevois (main d'œuvre ≈ CHF 650-900/jour chargé)
- La CCT Romande du Second Œuvre (salaires, heures supplémentaires, congés)
- Les charges sociales genevoises (AVS 5.3%, LPP, allocations familiales GE 2.94%, etc.)
- La TVA suisse (8.1% standard pour travaux BTP)
- Les marges saines BTP Genève (≥ 20% rentable, < 15% danger)
- La gestion de chantiers, devis, facturation et planification

Réponds en français, de façon claire et pratique. Si la question touche à des montants, utilise les francs suisses (CHF).

QUESTION :
${d.question}`;
}

function promptGenererEmail(d: any): string {
  const typeLabels: Record<string, string> = {
    relance: 'email de relance pour facture impayée',
    avis_travaux: 'avis de démarrage / avancement des travaux',
    devis: 'envoi ou suivi d\'un devis',
    remerciement: 'email de remerciement après chantier terminé',
  };
  const typeLabel = typeLabels[d.type] ?? d.type;
  const montantStr = d.montant != null ? `\nMONTANT CONCERNÉ : CHF ${Number(d.montant).toFixed(2)}` : '';

  return `Tu es un assistant de communication professionnelle pour une entreprise BTP à Genève, Suisse.
Génère un email professionnel en français suisse (vouvoiement, ton sérieux mais courtois).

TYPE D'EMAIL : ${typeLabel}
DESTINATAIRE : ${d.destinataire}
CONTEXTE : ${d.contexte}${montantStr}

Génère l'email complet dans ce format exact :

**Objet :** [objet de l'email]

**Corps :**

[corps de l'email — paragraphes bien structurés, 150-250 mots]

**Formule de politesse :**
[formule adaptée au contexte BTP suisse]

Consignes :
- Vouvoiement systématique
- Ton professionnel, direct, sans familiarité
- Références légales si pertinent (délai paiement 30 jours net, art. CO)
- Pour les relances : mentionner les intérêts moratoires légaux suisses (5% l'an) si pertinent
- Signature type : "Avec nos meilleures salutations, / L'équipe CYNA SÀRL"`;
}

function promptComparerDevis(d: any): string {
  const criteresStr = d.criteres ? `\nCRITÈRES PRIORITAIRES : ${d.criteres}` : '';

  return `Tu es un expert en appels d'offres et comparaison de devis BTP à Genève, Suisse.
Compare objectivement ces deux offres et recommande la meilleure option.

DEVIS 1 — ${d.devis1?.nom ?? 'Option A'}
- Montant HT : CHF ${Number(d.devis1?.montant ?? 0).toFixed(2)}
- Description : ${d.devis1?.description ?? 'Non précisée'}

DEVIS 2 — ${d.devis2?.nom ?? 'Option B'}
- Montant HT : CHF ${Number(d.devis2?.montant ?? 0).toFixed(2)}
- Description : ${d.devis2?.description ?? 'Non précisée'}
${criteresStr}

Réponds en 4 sections :

**1. Comparaison chiffrée**
- Écart de prix : CHF ... (... %)
- TVA 8.1% sur chaque option

**2. Analyse Devis 1 — ${d.devis1?.nom ?? 'Option A'}**
- ✅ Points forts (liste)
- ⚠️ Points de vigilance (liste)

**3. Analyse Devis 2 — ${d.devis2?.nom ?? 'Option B'}**
- ✅ Points forts (liste)
- ⚠️ Points de vigilance (liste)

**4. Recommandation**
Indique clairement quel devis est préférable et pourquoi, en tenant compte du rapport qualité/prix et des risques BTP genevois.`;
}

function promptAnalyserPdfTexte(d: any): string {
  return `Tu es un juriste et expert technique BTP à Genève, Suisse, spécialisé dans l'analyse de documents contractuels et techniques.
Analyse ce document extrait d'un PDF et identifie les points essentiels.

TYPE DE DOCUMENT : ${d.typeDoc ?? 'Document BTP'}

TEXTE DU DOCUMENT :
${d.texte}

Fournis une analyse structurée en sections :

**1. Résumé exécutif** (3-4 phrases)
Ce que contient ce document et son objet principal.

**2. Informations clés**
- Parties impliquées (si mentionnées)
- Montants (HT, TTC, acomptes, retenues de garantie)
- Délais et dates importantes
- Périmètre des travaux / prestations

**3. Points de risque** ⚠️
Liste les clauses ou éléments qui méritent attention (délais serrés, pénalités, responsabilités, exclusions).

**4. Conformité BTP Suisse**
Vérification rapide : TVA correcte (8.1%) ? Délais de paiement conformes (30 jours) ? Retenue de garantie mentionnée (5%) ? Références SIA ou normes suisses ?

**5. Questions à clarifier**
Liste 2-4 points à éclaircir avec le co-contractant avant signature / exécution.`;
}

// ── Handler principal ──────────────────────────────────────────

const SONNET_ACTIONS = new Set(['chat_libre', 'generer_email', 'comparer_devis', 'analyser_pdf_texte']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Vérification basique : l'Authorization header doit être présent (envoyé par supabase.functions.invoke)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, data } = await req.json();

    let prompt = '';
    switch (action) {
      case 'analyser_chantier':    prompt = promptAnalyserChantier(data);    break;
      case 'suggerer_devis':       prompt = promptSuggererDevis(data);        break;
      case 'expliquer_alertes':    prompt = promptExpliquerAlertes(data);     break;
      case 'analyse_portefeuille': prompt = promptAnalysePortefeuille(data);  break;
      case 'chat_libre':           prompt = promptChatLibre(data);            break;
      case 'generer_email':        prompt = promptGenererEmail(data);         break;
      case 'comparer_devis':       prompt = promptComparerDevis(data);        break;
      case 'analyser_pdf_texte':   prompt = promptAnalyserPdfTexte(data);     break;
      default:
        return new Response(JSON.stringify({ error: `Action inconnue: ${action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const model = SONNET_ACTIONS.has(action) ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';
    const maxTokens = SONNET_ACTIONS.has(action) ? 2048 : 1500;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
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
