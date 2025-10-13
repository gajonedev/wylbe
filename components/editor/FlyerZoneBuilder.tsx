/**
 * Composant FlyerZoneBuilder
 * -------------------------
 * Objectif : Permettre l'import d'une image de flyer et le dessin de zones interactives dessus
 *
 * Fonctionnalités principales :
 * 1. Import d'image via drag-and-drop (react-dropzone)
 * 2. Dessin de zones polygonales sur l'image (Konva)
 * 3. Gestion des états de l'éditeur (dessin, zones, etc.)
 * 4. Sauvegarde du layout (image + zones)
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { useDropzone } from "react-dropzone";

import FlyerStage from "@/components/editor/canvas/FlyerStage";
import { useFlyerEditorState } from "@/components/editor/hooks/useFlyerEditorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadImageDimensions } from "@/lib/images";
import { MIN_POINTS } from "@/lib/geometry";
import type { FlyerLayout, Zone } from "@/lib/types";
import { cn } from "@/lib/utils";
import { saveFlyerLayout } from "@/lib/storage/flyers";
import { toast } from "sonner";

/**
 * Interface décrivant un layout existant
 * @property id - Identifiant unique du layout
 * @property name - Nom donné au layout
 * @property flyerBlob - Données binaires de l'image
 * @property width/height - Dimensions de l'image
 * @property fileName - Nom du fichier original
 * @property zones - Tableau des zones définies sur l'image
 * @property createdAt - Date de création
 * @property placements - Optionnel : positions des photos dans les zones
 */
interface ExistingLayout {
  id: string;
  name: string;
  flyerBlob: Blob;
  width: number;
  height: number;
  fileName: string;
  zones: Zone[];
  createdAt: string;
  placements?: FlyerLayout["placements"];
}

interface FlyerZoneBuilderProps {
  existingLayout?: ExistingLayout;
}

export function FlyerZoneBuilder({ existingLayout }: FlyerZoneBuilderProps) {
  /**
   * États React pour la gestion du composant
   * --------------------------------------
   * router : Navigation programmatique
   * isEditing : Mode édition vs création
   * layoutName : Nom du layout
   * isSaving : État de sauvegarde en cours
   * uploadError : Message d'erreur d'upload
   * feedback : Messages de retour utilisateur
   */
  const router = useRouter();
  const isEditing = Boolean(existingLayout);

  const [layoutName, setLayoutName] = useState(existingLayout?.name ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  /**
   * Références React
   * ---------------
   * flyerBlobRef : Stocke le Blob de l'image active
   * revokeFlyerUrlRef : URL temporaire pour l'affichage de l'image
   */
  const flyerBlobRef = useRef<Blob | null>(existingLayout?.flyerBlob ?? null);
  const revokeFlyerUrlRef = useRef<string | null>(null);

  /**
   * État de l'éditeur Konva
   * ----------------------
   * Géré par le hook useFlyerEditorState qui fournit :
   * - flyer : métadonnées de l'image
   * - zones : tableau des zones dessinées
   * - currentPoints : points en cours de dessin
   * - isDrawing : mode dessin actif
   * - isTracing : dessin en cours
   * - showGuides : affichage de la grille
   * - Méthodes de contrôle : toggle, cancel, setters...
   */
  const editorState = useFlyerEditorState(null, [], [], {
    allowPlacements: false,
  });

  const {
    flyer,
    zones,
    currentPoints,
    isDrawing,
    isTracing,
    showGuides,
    toggleDrawMode,
    cancelDrawing,
    setShowGuides,
    setFlyerImage,
    setZones,
    setSelectedZoneId,
  } = editorState;

  /**
   * Effet de chargement initial
   * --------------------------
   * En mode édition :
   * 1. Crée une URL pour l'image existante
   * 2. Configure l'éditeur avec l'image et ses zones
   * 3. Nettoie l'URL à la destruction
   */
  useEffect(() => {
    if (!existingLayout) return;

    const url = URL.createObjectURL(existingLayout.flyerBlob);
    revokeFlyerUrlRef.current = url;

    setFlyerImage({
      url,
      width: existingLayout.width,
      height: existingLayout.height,
      fileName: existingLayout.fileName,
    });

    setZones(existingLayout.zones);

    return () => {
      if (revokeFlyerUrlRef.current) {
        URL.revokeObjectURL(revokeFlyerUrlRef.current);
        revokeFlyerUrlRef.current = null;
      }
    };
  }, [existingLayout, setFlyerImage, setZones]);

  useEffect(() => {
    return () => {
      if (revokeFlyerUrlRef.current) {
        URL.revokeObjectURL(revokeFlyerUrlRef.current);
        revokeFlyerUrlRef.current = null;
      }
    };
  }, []);

  /**
   * Gestionnaire de drop d'image
   * ---------------------------
   * 1. Réinitialise les erreurs
   * 2. Vérifie et traite le fichier
   * 3. Crée une URL temporaire
   * 4. Extrait les dimensions
   * 5. Met à jour l'état de l'éditeur
   * 6. Gère les erreurs potentielles
   */
  const handleFlyerDrop = useCallback(
    async (accepted: File[]) => {
      setUploadError(null);
      setFeedback(null);
      const file = accepted.at(0);
      if (!file) return;

      try {
        // Crée une URL temporaire pour l'image et en extrait les dimensions
        const url = URL.createObjectURL(file);
        const { width, height } = await loadImageDimensions(url);

        // Révoque l'ancienne URL et ajoute un nouveau si une image était déjà chargée
        if (revokeFlyerUrlRef.current) {
          URL.revokeObjectURL(revokeFlyerUrlRef.current);
        }
        revokeFlyerUrlRef.current = url;

        // Stocke le Blob de l'image active
        flyerBlobRef.current = file;

        // Si le nom n'est pas encore défini, utilise le nom du fichier sans extension
        if (!layoutName) {
          setLayoutName(file.name.replace(/\.[^/.]+$/, ""));
        }

        // Configure l'éditeur avec la nouvelle image et réinitialise les zones
        setFlyerImage({ url, width, height, fileName: file.name });
        setZones([]);
        setSelectedZoneId(null);
      } catch (error) {
        console.error("Import flyer failed: ", error);
        setUploadError("Impossible de charger ce fichier.");
        setFeedback({
          type: "error",
          message: "L'import du flyer a échoué.",
        });
      }
    },
    [layoutName, setFlyerImage, setSelectedZoneId, setZones]
  );

  /**
   * Configuration react-dropzone
   * --------------------------
   * accept : Filtre les types de fichiers acceptés (images)
   * multiple : Désactive le multi-fichiers
   * onDrop : Lie le gestionnaire de drop
   */
  const flyerDropzone = useDropzone({
    accept: { "image/*": [] },
    multiple: false,
    onDrop: handleFlyerDrop,
  });

  /**
   * Message d'aide contextuel
   * ------------------------
   * Génère un message adapté selon :
   * - Présence d'une image
   * - Mode dessin actif
   * - Nombre de points tracés
   * - Nombre de zones définies
   */
  const helperMessage = useMemo(() => {
    if (!flyer) return "Ajoutez un flyer pour commencer.";

    if (isDrawing) {
      if (isTracing) {
        return "Relâchez le clic pour fermer la zone librement dessinée.";
      }

      if (currentPoints.length === 0) {
        return "Cliquez puis faites glisser pour dessiner le contour de la zone.";
      }

      if (currentPoints.length < MIN_POINTS) {
        return "Tracez une zone fermée avec au moins trois points distincts.";
      }

      return "Dessinez une forme fermée d'un seul geste pour enregistrer la zone.";
    }

    if (zones.length === 0) {
      return "Aucune zone définie. Activez le mode dessin pour délimiter un emplacement.";
    }

    return "Tracez ou ajustez vos zones avant de passer à l'insertion des photos.";
  }, [currentPoints.length, flyer, isDrawing, isTracing, zones.length]);

  /**
   * Gestionnaire de sauvegarde
   * -------------------------
   * 1. Valide les données requises
   * 2. Construit l'objet layout
   * 3. Persiste les données
   * 4. Gère le retour utilisateur
   * 5. Redirige si nécessaire
   */
  const handleSaveLayout = useCallback(async () => {
    if (!flyer || !flyerBlobRef.current) return;

    const trimmedName = layoutName.trim();
    if (!trimmedName) return;

    if (zones.length === 0) return;

    setIsSaving(true);
    setFeedback(null);

    try {
      const id = existingLayout?.id ?? crypto.randomUUID();
      const now = new Date().toISOString();

      const layout: FlyerLayout = {
        meta: {
          id,
          name: trimmedName,
          fileName: flyer.fileName,
          width: flyer.width,
          height: flyer.height,
          createdAt: existingLayout?.createdAt ?? now,
          updatedAt: now,
        },
        flyerBlob: flyerBlobRef.current,
        zones,
        placements: existingLayout?.placements ?? [],
      };

      console.log("Saving layout", layout);

      await saveFlyerLayout(layout);
      toast.success("Zones enregistrées avec succès.");

      if (isEditing) {
        setFeedback({
          type: "success",
          message: "Zones mises à jour avec succès.",
        });
      } else {
        router.push(`/layouts/${id}/placements`);
      }
    } catch (error) {
      toast.error("L'enregistrement a échoué: " + error);
      console.error("Erreur lors de l'enregistrement du flyer", error);
      setFeedback({
        type: "error",
        message: "L'enregistrement a échoué.",
      });
    } finally {
      setIsSaving(false);
    }
  }, [existingLayout, flyer, isEditing, layoutName, router, zones]);

  const canSave =
    Boolean(flyer && flyerBlobRef.current) &&
    layoutName.trim().length > 0 &&
    zones.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      {/* Structure du rendu
         ------------------
         1. Header : titre + état + navigation
         2. Contenu principal :
            - Zone d'import (react-dropzone)
            - Canevas de dessin (Konva)
         3. Sidebar :
            - Informations et contrôles
            - Liste des zones définies */}
      <header className="flex flex-col gap-2 border-b border-border/40 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">
            {isEditing ? "Zones" : "Nouveau flyer"}
          </p>
          <h1 className="text-2xl font-semibold">
            {isEditing ? existingLayout?.name : "Définir les zones"}
          </h1>
          {feedback && (
            <p
              className={cn(
                "text-sm",
                feedback.type === "success"
                  ? "text-emerald-500"
                  : "text-destructive"
              )}
            >
              {feedback.message}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isEditing && existingLayout && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/layouts/${existingLayout.id}/placements`}>
                Retour aux placements
              </Link>
            </Button>
          )}
        </div>
      </header>
      <div className="flex flex-col gap-10 lg:flex-row">
        <div className="flex-1 space-y-4">
          <section className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center gap-3">
              <div className="grow">
                <h2 className="text-lg font-semibold">Flyer</h2>
                <p className="text-sm text-muted-foreground">
                  Glissez-déposez un flyer ou cliquez pour en sélectionner un.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={flyerDropzone.open}>
                Importer
              </Button>
            </div>
            <div
              {...flyerDropzone.getRootProps({
                className: cn(
                  "mt-4 flex min-h-[220px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 text-center transition-colors",
                  flyerDropzone.isDragActive
                    ? "border-primary bg-primary/10"
                    : "bg-muted/30"
                ),
              })}
            >
              <input {...flyerDropzone.getInputProps()} />
              {flyer ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium">{flyer.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {flyer.width} × {flyer.height}px
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Déposez un nouveau fichier pour remplacer.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {flyerDropzone.isDragActive
                      ? "Relâchez pour importer"
                      : "Déposez votre flyer ici"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Formats supportés : PNG, JPG, SVG
                  </p>
                </div>
              )}
              {uploadError && (
                <p className="text-xs text-destructive">{uploadError}</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center gap-3">
              <div className="grow">
                <h2 className="text-lg font-semibold">Canevas</h2>
                <p className="text-sm text-muted-foreground">{helperMessage}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <Button
                  variant={isDrawing ? "secondary" : "default"}
                  size="sm"
                  disabled={!flyer}
                  onClick={toggleDrawMode}
                >
                  {isDrawing ? "Terminer" : "Définir une zone"}
                </Button>
                {isDrawing && (
                  <Button variant="outline" size="sm" onClick={cancelDrawing}>
                    Annuler
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!flyer}
                  onClick={() => setShowGuides((prev) => !prev)}
                >
                  {showGuides ? "Masquer les repères" : "Afficher les repères"}
                </Button>
              </div>
            </div>

            <FlyerStage
              state={editorState}
              className="mt-4"
              allowPlacements={false}
            />
          </section>
        </div>

        <aside className="w-full max-w-md space-y-6">
          <section className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur">
            <h2 className="text-lg font-semibold">Informations</h2>
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-xs font-medium uppercase text-muted-foreground">
                  Nom du flyer
                </label>
                <Input
                  value={layoutName}
                  onChange={(event) => {
                    setLayoutName(event.target.value);
                    setFeedback(null);
                  }}
                  placeholder="Nommer cette disposition"
                  className="mt-1"
                  disabled={isSaving}
                />
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                <p>
                  {zones.length} zone{zones.length > 1 ? "s" : ""} définie
                  {zones.length > 1 ? "s" : ""}.
                </p>
                <p>
                  {flyer
                    ? `${flyer.width} × ${flyer.height}px`
                    : "Aucun flyer importé."}
                </p>
              </div>
            </div>
            <Button
              className="mt-4 w-full"
              onClick={handleSaveLayout}
              disabled={!canSave || isSaving}
            >
              <Save className="mr-2 size-4" />
              {isSaving
                ? "Enregistrement en cours…"
                : isEditing
                  ? "Sauvegarder les zones"
                  : "Enregistrer et passer à l'insertion"}
            </Button>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur">
            <header className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Zones définies</h2>
                <p className="text-sm text-muted-foreground">
                  {zones.length}
                  {zones.length > 1 ? " zones" : " zone"} enregistrée
                  {zones.length > 1 ? "s" : ""}.
                </p>
              </div>
            </header>
            <div className="mt-4 space-y-3">
              {zones.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Pas encore de zone. Activez le mode dessin puis cliquez sur le
                  canevas pour en créer une.
                </p>
              ) : (
                zones.map((zone) => (
                  <div
                    key={zone.id}
                    className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{zone.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {zone.points.length} point
                        {zone.points.length > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default FlyerZoneBuilder;
