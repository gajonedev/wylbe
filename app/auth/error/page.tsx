"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background via-background to-muted/30 px-6 py-16 text-center">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-border/60 bg-card/70 p-10 shadow-xl backdrop-blur">
        <div className="flex flex-col items-center gap-4">
          <span className="inline-flex items-center justify-center rounded-full bg-destructive/10 p-3">
            <ShieldAlert className="h-6 w-6 text-destructive" />
          </span>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Connexion interrompue</h1>
            <p className="text-sm text-muted-foreground">
              Nous n’avons pas pu terminer l’authentification avec Google.
              Réessayez dans quelques instants ou revenez à l’accueil.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Button asChild size="lg" className="w-full">
            <Link href="/">Retourner à l’accueil</Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            Si le problème persiste, vérifiez que votre adresse e-mail est
            autorisée sur Appwrite ou contactez l’administrateur de Wylbe.
          </p>
        </div>
      </div>
    </div>
  );
}
