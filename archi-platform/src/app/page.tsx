import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="font-semibold text-lg">Archi Platform</div>
          <div className="flex gap-3">
            <Button asChild variant="ghost"><Link href="/login">Connexion</Link></Button>
            <Button asChild><Link href="/register">Créer un compte</Link></Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-20">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            La plateforme des architectes & professionnels du bâtiment
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Gestion documentaire avec versioning, validations, partage externe, commentaires
            sur PDF, chiffrage paramétrable et suivi du cycle de vie des éléments —
            de la conception à la maintenance.
          </p>
          <div className="mt-10 flex gap-3">
            <Button asChild size="lg"><Link href="/register">Démarrer</Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/login">J'ai déjà un compte</Link></Button>
          </div>
        </div>

        <div className="mt-20 grid md:grid-cols-3 gap-6">
          {[
            { t: "GED & validation", d: "Drive-like, versioning, partage par lien, workflows de validation, commentaires PDF avec mentions." },
            { t: "Chiffrage paramétrable", d: "Catalogue d'éléments (fenêtres, murs…), métré, états existants, coûts détaillés." },
            { t: "Cycle de vie", d: "À la livraison, le propriétaire suit chaque élément avec alertes fin de vie et maintenance." },
          ].map((b) => (
            <div key={b.t} className="rounded-xl border p-6">
              <div className="font-semibold">{b.t}</div>
              <p className="mt-2 text-sm text-muted-foreground">{b.d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
