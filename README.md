## Wylbe

Editeur de flyers avec dessin de zones interactives, placements d'images et export PNG, propulsé par Next.js 15 et Konva.

Depuis octobre 2025, les données sont stockées à distance dans Appwrite (plus de persistance locale dans IndexedDB).

## Prérequis

- Node.js 20+
- pnpm 8+
- Un projet Appwrite accessible depuis le client (anonyme ou authentifié)

## Variables d'environnement

Créez un fichier `.env.local` basé sur les clés suivantes :

```
NEXT_PUBLIC_APPWRITE_ENDPOINT="https://cloud.appwrite.io/v1"
NEXT_PUBLIC_APPWRITE_PROJECT="<ID du projet>"
NEXT_PUBLIC_APPWRITE_DATABASE_ID="<ID de la base>"
NEXT_PUBLIC_APPWRITE_FLYERS_COLLECTION_ID="<ID de la collection flyers>"
NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID="<ID du bucket des flyers>"
```

> Ces variables sont requises au runtime. L'application ne démarre pas si elles sont manquantes.

### OAuth 2.0 (Google)

1. Activez le provider **Google** dans la console Appwrite.
2. Ajoutez l'URL autorisée suivante :
   - `https://<votre-domaine>/` (succès)
   - `https://<votre-domaine>/auth/error` (échec)
   - En local : `http://localhost:3000/` et `http://localhost:3000/auth/error`
3. Assurez-vous que les clés Google OAuth correspondent à l'URL de redirection.

## Schéma Appwrite

### Collection « flyers » (base : la vôtre)

| Attribut      | Type     | Description                                                         |
| ------------- | -------- | ------------------------------------------------------------------- |
| `name`        | string   | Nom du flyer.                                                       |
| `fileName`    | string   | Nom original du fichier importé.                                    |
| `width`       | integer  | Largeur du flyer (px).                                              |
| `height`      | integer  | Hauteur du flyer (px).                                              |
| `createdAt`   | string   | Timestamp ISO de création (conservé tel quel côté client).          |
| `updatedAt`   | string   | Dernière mise à jour (ISO).                                         |
| `flyerFileId` | string   | Identifiant du fichier stocké dans le bucket Appwrite.              |
| `zones`       | object[] | Tableau JSON des zones (voir interface `Zone` dans `lib/types.ts`). |

- Permissions recommandées : lecture/écriture réservées aux utilisateurs authentifiés (ou session anonyme selon votre stratégie).
- Aucun stockage des placements d'images : ils restent locaux au navigateur.

### Bucket de fichiers

- Créez un bucket dédié (`flyerBucketId`).
- Autorisez la lecture au même périmètre que la collection (publique ou privée).
- Les fichiers sont créés/écrasés avec l'identifiant du flyer.

## Démarrage

```bash
pnpm install
pnpm dev
```

L'application est accessible sur [http://localhost:3000](http://localhost:3000).

## Flux principal

1. Import d'un flyer, dessin de zones ➜ sauvegarde distante via Appwrite.
2. Ouverture d'un flyer ➜ récupération du blob depuis le bucket + zones depuis la collection.
3. Ajout d'images dans les zones ➜ usage éphémère pour l'export, rien n'est stocké côté serveur.

## Tests & qualité

```bash
pnpm lint
```

Ajoutez vos propres tests selon les besoins du projet.
