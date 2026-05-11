-- Activer le temps réel sur la table devis
-- Coller dans : Supabase Dashboard > SQL Editor > New query

-- 1. Activer REPLICA IDENTITY FULL (nécessaire pour les updates en temps réel)
ALTER TABLE public.devis REPLICA IDENTITY FULL;

-- 2. Ajouter la table à la publication supabase_realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.devis;

-- Vérification
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'devis';
-- Résultat attendu : 1 ligne avec schemaname=public, tablename=devis
