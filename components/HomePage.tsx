"use client";

import React from "react";
import { useAuth } from "./auth/AuthProvider";
import Loader from "./Loader";
import { Card } from "./ui/card";
import { CornerDownRight, LogIn } from "lucide-react";
import { Button } from "./ui/button";
import FlyerList from "./dashboard/FlyerList";

export default function HomePage() {
  const { user, isLoading, isProcessing, error, signInWithGoogle } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative z-10 flex min-h-screen flex-col items-center p-6 mt-8">
        <Card className="rounded-none mx-auto w-full max-w-lg border border-border/70 bg-card/70 p-10 shadow-xl backdrop-blur">
          <div className="mb-4 space-y-2 text-center">
            <h1 className="text-3xl font-semibold">Connectez-vous continuer</h1>
            <p className="text-sm text-muted-foreground">
              Wylbe stocke vos layouts et zones pour vous permettre de les
              modifier et de les supprimer. Authentifiez-vous rapidement avec
              votre compte Google pour continuer
            </p>
          </div>

          <div className="space-y-6">
            <div className="border border-border/50 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <CornerDownRight className="h-4 w-4" />
                Conservez vos zones (sélections sur vos flyers), importez vos
                photos et exportez vos visuels en quelques clics.
              </p>
              <p className="mt-4 flex items-center gap-2">
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
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full p-4 sm:p-6 lg:p-8 gap-4">
      <main className="flex w-full min-h-screen flex-col">
        <FlyerList />
      </main>
    </div>
  );
}
