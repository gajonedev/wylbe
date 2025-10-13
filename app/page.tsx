"use client";

import { CornerDownRight, LogIn, LogOut } from "lucide-react";

import { ThemeToggler } from "@/components/ThemeToggler";
import FlyerList from "@/components/dashboard/FlyerList";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { user, isLoading, isProcessing, error, signInWithGoogle, signOut } =
    useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background via-background to-muted/30">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="h-15 w-15 animate-spin rounded-full border-4 border-border border-t-primary" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-background to-muted/40">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(125,211,252,0.15),transparent_55%)]" />
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-16">
          <div className="mx-auto w-full max-w-lg rounded-3xl border border-border/70 bg-card/70 p-10 shadow-xl backdrop-blur">
            <div className="mb-8 space-y-2 text-center">
              <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
                Accès sécurisé
              </span>
              <h1 className="text-3xl font-semibold">
                Connectez-vous pour retrouver vos flyers
              </h1>
              <p className="text-sm text-muted-foreground">
                Wylbe sécurise vos layouts et zones avec Appwrite.
                Authentifiez-vous avec votre compte Google pour continuer.
              </p>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-border/50 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <CornerDownRight className="h-4 w-4" />
                  Conservez vos zones, importez vos photos et exportez vos
                  visuels en quelques clics.
                </p>
                <p className="mt-2 flex items-center gap-2">
                  <CornerDownRight className="h-4 w-4" />
                  Nous ne stockons pas les photos de placement—juste vos zones
                  pour les réutiliser.
                </p>
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={() => void signInWithGoogle()}
              >
                <LogIn className="mr-2 h-4 w-4" />
                Continuer avec Google
              </Button>

              {error ? (
                <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="fixed bottom-5 right-6 z-10">
          <ThemeToggler />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Bienvenue
            </p>
            <p className="text-sm font-medium">
              {user.name || user.email || "Créateur"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isProcessing}
              onClick={() => void signOut()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Se déconnecter
            </Button>
            <ThemeToggler />
          </div>
        </div>
      </header>

      <main>
        <FlyerList />
      </main>
    </div>
  );
}
