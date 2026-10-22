# Yoga Studio — Tests et amélioration d’une application full-stack JavaScript

Projet 4 de la formation **Lead Developer JavaScript (RNCP niveau 7) - OpenClassrooms**.

Cette application permet de consulter des séances de yoga, de s’inscrire à une séance et de gérer son profil. Un compte administrateur peut créer, modifier et supprimer des séances.

L’objectif du projet est de maintenir une architecture lisible et de vérifier son fonctionnement par des **tests unitaires, des tests d’intégration et des tests end-to-end (E2E)**.

## Technologies

| Frontend                                            | Backend                                                            | Tests                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| React, TypeScript, Vite, Tailwind CSS, React Router | Node.js, Express, TypeScript, Prisma, PostgreSQL, JWT, bcrypt, Zod | Vitest, React Testing Library, MSW, Playwright, `fetch` natif, couverture V8 |

## Organisation du dépôt

```text
.
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   ├── e2e/                       # Tests Playwright
│   ├── playwright.config.ts
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── dto/
│   │   ├── app.ts                 # Configuration Express, sans listen()
│   │   └── server.ts              # Démarrage du serveur
│   ├── prisma/
│   ├── vitest.config.ts
│   └── package.json
└── README.md
```

Le backend suit une séparation **Routes → Controllers → Services → Repositories → Prisma/PostgreSQL**. Les erreurs HTTP sont centralisées dans un middleware.

## Prérequis

- Node.js **22.x** recommandé (avec `npm`) ; `fetch` natif est disponible dans Node.js moderne.
- PostgreSQL accessible localement, ou via un conteneur Docker.
- Un navigateur Chromium installable par Playwright.
- Deux terminaux pour lancer simultanément le backend et le frontend.

## Installation et démarrage

### 1. Installer les dépendances

Depuis la racine du dépôt :

```powershell
cd backend
npm install

cd ../frontend
npm install
```

### 2. Préparer PostgreSQL et les variables d’environnement

Créer les bases nécessaires dans PostgreSQL, par exemple :

- `yoga_studio` pour le développement ;
- **`yoga_studio_e2e` pour les tests d’intégration backend et E2E**.

Créer les fichiers locaux de configuration dans `backend/` (ne jamais les committer) :

**`backend/.env`** — exemple à adapter :

```dotenv
DATABASE_URL="postgresql://UTILISATEUR:MOT_DE_PASSE@localhost:5432/yoga_studio?schema=public"
JWT_SECRET="remplacer-par-un-secret-long-et-aleatoire"
PORT=8080
NODE_ENV=development
```

**`backend/.env.e2e`** — exemple à adapter :

```dotenv
DATABASE_URL="postgresql://UTILISATEUR:MOT_DE_PASSE@localhost:5432/yoga_studio_e2e?schema=public"
JWT_SECRET="remplacer-par-un-autre-secret-long-et-aleatoire"
PORT=8080
NODE_ENV=test
```

**Attention :** le nom de la base de test doit être `yoga_studio_e2e`, car les tests d’intégration vérifient explicitement ce nom avant de se lancer.

Préparer aussi **`frontend/.env.e2e`** :

```dotenv
E2E_BASE_URL=http://127.0.0.1:5173
E2E_API_URL=http://127.0.0.1:5173/api
```

Les requêtes Playwright utilisent ici le proxy `/api` de Vite vers le backend local. Vérifier cette configuration dans `frontend/vite.config.ts` si le port du serveur change.

### 3. Initialiser le schéma et les données

Dans `backend/`, en ciblant la base de développement configurée dans `.env` :

```powershell
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
```

Pour la base **de tests** (à faire une fois au départ, puis après une réinitialisation éventuelle) :

```powershell
npm run e2e:db:status
npm run e2e:db:migrate
npm run e2e:db:seed
```

Le seed des tests fournit notamment les comptes suivants :

| Rôle                   | Email             | Mot de passe |
| ---------------------- | ----------------- | ------------ |
| Administrateur de test | `yoga@studio.com` | `test!1234`  |
| Utilisateur de test    | `user@test.com`   | `test!1234`  |

Ces identifiants sont **réservés à l’environnement local de démonstration et de test**. Ne pas les utiliser en production.

### 4. Lancer l’application en développement

**Terminal 1 — backend :**

```powershell
cd backend
npm run dev
```

Le backend écoute normalement sur `http://localhost:8080` ; vérifier `http://localhost:8080/api/health`.

**Terminal 2 — frontend :**

```powershell
cd frontend
npm run dev
```

Ouvrir `http://localhost:5173` (sauf indication d’un autre port par Vite).

Le script backend `dev` utilise `nodemon` : le fichier `backend/nodemon.json` doit démarrer `src/server.ts`, et non `src/app.ts`.

### 5. Compiler et exécuter le backend

```powershell
cd backend
npm run build
npm start
```

Après la séparation entre `app.ts` et `server.ts`, les scripts de démarrage doivent pointer vers **`dist/server.js`**.

Compiler le frontend :

```powershell
cd frontend
npm run build
```

## Tests du frontend : Vitest + React Testing Library

Dans `frontend/` :

```powershell
npm test
npm run test:coverage
```

Les tests couvrent les pages, la navigation, l’authentification, les séances, le profil et les appels API simulés avec MSW. Le rapport HTML de couverture est généré dans :

```text
frontend/coverage/index.html
```

**Derniers résultats constatés :** 103 tests réussis, dont 31 tests d’intégration frontend.

| Couverture frontend       |    Résultat | Minimum |
| ------------------------- | ----------: | ------: |
| Instructions (statements) | **93,11 %** |    80 % |
| Branches                  | **84,93 %** |    80 % |
| Fonctions                 |   **100 %** |    80 % |
| Lignes                    | **93,64 %** |    80 % |

## Tests du backend : Vitest + `fetch` natif

Les **tests unitaires** isolent les quatre services avec des mocks de repositories. Les **tests d’intégration** démarrent Express sur un port temporaire, exécutent de véritables requêtes HTTP avec `fetch` et interrogent PostgreSQL via Prisma.

Dans `backend/` :

```powershell
npm test
npm run test:coverage
```

Exécuter une suite particulière :

```powershell
npx vitest run src/services/session.service.test.ts
npx vitest run src/controllers/session.controller.integration.test.ts
```

Rapport HTML :

```text
backend/coverage/index.html
```

**Derniers résultats constatés :** 167 tests réussis, soit 89 unitaires et 78 d’intégration (**46,71 % de tests d’intégration**).

| Couverture backend        |    Résultat | Minimum |
| ------------------------- | ----------: | ------: |
| Instructions (statements) | **96,01 %** |    80 % |
| Branches                  | **94,37 %** |    80 % |
| Fonctions                 | **96,10 %** |    80 % |
| Lignes                    | **96,00 %** |    80 % |

Les tests n'exercent pas directement les fichiers DTO ou les schémas Zod : leur comportement est vérifié via les requêtes HTTP et le middleware de validation. Les quatre seuils indiqués concernent la couverture **globale** de chaque partie, et non chaque fichier pris séparément.

## Tests E2E : Playwright

Les tests Playwright utilisent un navigateur Chromium, le frontend Vite et le **vrai backend**, configuré sur la base PostgreSQL `yoga_studio_e2e`.

**Terminal 1 — depuis `backend/` :**

```powershell
npm run build
npm run e2e:start
```

**Terminal 2 — depuis `frontend/` :**

```powershell
npx playwright install chromium
npx playwright test
```

Le fichier `playwright.config.ts` démarre Vite automatiquement sur `127.0.0.1:5173` si nécessaire. La base de test doit avoir été migrée et initialisée avec le seed E2E.

Pour afficher le rapport Playwright :

```powershell
npx playwright show-report
```

Rapport généré dans :

```text
frontend/playwright-report/index.html
```

**Dernier résultat constaté : 23 tests E2E réussis sur 23**, couvrant la connexion, l’inscription, la navigation, le profil, les permissions, le CRUD des séances et les participations.

> **Différence entre les rapports :** Vitest + V8 mesure les pourcentages de couverture du code. Le rapport HTML Playwright présente les résultats des scénarios de bout en bout ; il ne fournit pas automatiquement de pourcentages de couverture instructions/branches/fonctions/lignes.

## Synthèse des tests

| Suite             | Tests réussis | Rapport                                 |
| ----------------- | ------------: | --------------------------------------- |
| Frontend — Vitest | **103 / 103** | `frontend/coverage/index.html`          |
| Backend — Vitest  | **167 / 167** | `backend/coverage/index.html`           |
| E2E — Playwright  |   **23 / 23** | `frontend/playwright-report/index.html` |
| **Total**         | **293 / 293** |                                         |

Les deux parties applicatives dépassent **80 % de couverture globale pour chacun des quatre indicateurs**, et les tests d’intégration représentent plus de 30 % des tests Vitest, côté frontend comme côté backend.

## Précautions et bonnes pratiques

- Utiliser exclusivement une **base de test distincte** pour les tests HTTP et E2E.
- **Ne pas exécuter simultanément Playwright et les tests d’intégration Vitest** sur la base `yoga_studio_e2e` : ils pourraient modifier les mêmes données.
- Les scénarios de création/suppression utilisent des comptes et séances temporaires, nettoyés en fin de test.
- Ne jamais versionner `.env`, `.env.e2e`, les secrets, `node_modules/`, `dist/`, `coverage/`, `test-results/` ou `playwright-report/` ; vérifier les règles `.gitignore`.
- Après une modification du backend, relancer `npm run build`, `npm run test:coverage`, puis les tests E2E si la modification concerne les parcours utilisateur.

## Auteur et contexte

Projet pédagogique réalisé dans le cadre de la formation **OpenClassrooms - Lead Developer JavaScript (RNCP 7)**.
