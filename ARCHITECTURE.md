# Architecture — ADA (Accessible Design Advisor)

## Vue d'ensemble

ADA est une application web mobile-first construite avec **TanStack Start** (React 19 +
React Router/TanStack Router, SSR via Nitro/Vite). Elle aide l'utilisateur à trouver des
vêtements adaptés à son profil (style, budget, valeurs...) via :

- un **onboarding** par swipe (préférences),
- un **chat IA** (assistant conversationnel "ADA"),
- une **recherche produit** avec comparaison Original / Vinted / Outlet,
- un **panier** ("Super-Panier") qui calcule les économies.

Le moteur de génération de texte/JSON est un **LLM local via Ollama** (pas d'API cloud),
appelé uniquement côté serveur.

## Stack technique

| Domaine | Techno |
| --- | --- |
| Framework | TanStack Start (SSR) + TanStack Router (file-based routing) |
| UI | React 19, Tailwind CSS v4, Radix UI (`src/components/ui/*`, shadcn-style), Framer Motion |
| Data fetching | TanStack Query |
| Validation | Zod |
| LLM | Ollama (modèle configurable, par défaut `mistral`), appelé depuis des Server Functions |
| Build/dev | Vite, Bun (bun.lock) |
| Runtime serveur | Nitro (`src/server.ts`, `src/start.ts`) |

## Arborescence principale

```
src/
├── start.ts            # Config TanStack Start + middleware d'erreurs serveur
├── server.ts           # Entrée Nitro/Workers : fetch handler, normalisation des erreurs SSR
├── router.tsx           # Création du router + QueryClient
├── routeTree.gen.ts      # Généré automatiquement (ne pas éditer)
├── styles.css
├── routes/               # File-based routing (1 fichier = 1 route)
│   ├── __root.tsx        # Layout global (Outlet, Toaster, gestion 404/erreurs)
│   ├── index.tsx          # "/"        — Home (dashboard, moodboard, recherche rapide)
│   ├── onboarding.tsx      # "/onboarding" — Quiz swipe de préférences
│   ├── search.tsx          # "/search"  — Recherche produit + inspirations
│   ├── chat.tsx            # "/chat"    — Chat avec ADA (LLM)
│   ├── analysis.tsx         # "/analysis" — Résultats comparés (original/vinted/outlet)
│   ├── cart.tsx             # "/cart"    — Super-Panier + économies
│   └── profile.tsx          # "/profile" — Profil utilisateur, préférences, reset
├── components/
│   ├── ada/               # Composants métier (AppShell, BottomNav, SafeImage, AnimatedNumber)
│   └── ui/                 # Composants UI génériques (shadcn/Radix)
├── lib/
│   ├── ada-store.ts        # État applicatif côté client (localStorage) : profil, panier,
│   │                         conversation, données moodboard/curation, hooks (useProfile,
│   │                         useCart, useDashboardStats...)
│   ├── api/
│   │   ├── ada.functions.ts   # Server Functions : chatWithAda, searchProducts, parseProductLink
│   │   └── example.functions.ts
│   ├── config.server.ts    # Config serveur (variables d'env, jamais exposées au client)
│   ├── error-page.ts / error-capture.ts / lovable-error-reporting.ts
│   └── utils.ts
└── hooks/use-mobile.tsx
```

## Navigation

`AppShell` + `BottomNav` (`src/components/ada/`) fournissent la coquille mobile et la barre
de navigation basse, commune à toutes les pages :

`/` (Home) · `/search` · `/chat` · `/cart` · `/profile`

`/onboarding` est hors navigation (flow initial obligatoire avant utilisation).

## Gestion d'état (client)

Tout l'état persistant est géré côté client dans `src/lib/ada-store.ts`, stocké en
**localStorage** (pas de base de données) :

- `Profile` (clé `ada-profile-v2`) : identité, préférences de swipe, statut onboarding.
- `CartItem[]` (clé `ada-cart-v2`) : panier "Super-Panier" avec calcul des économies.
- `ConversationMessage[]` (clé `ada-conversation-v2`) : historique du chat ADA.

Le fichier expose aussi des hooks React (`useProfile`, `useCart`, `useDashboardStats`) et
des données statiques (moodboards, images par catégorie, items "hardcodés" de démo).

## Server Functions (`src/lib/api/ada.functions.ts`)

Toutes les fonctions sont des `createServerFn` TanStack Start (exécutées uniquement côté
serveur, appelées depuis le client comme des fonctions async). Elles s'appuient sur deux
modules serveur dédiés :

- `src/lib/api/scraping.server.ts` : `searchVinted()` (recherche réelle sur l'API
  catalogue Vinted via un token "guest" auto-renouvelé) et `scrapeProductPage()`
  (scraping niveau 1 — fetch + cheerio — JSON-LD → OpenGraph → sélecteurs DOM, avec
  détection de blocage anti-bot).
- `src/lib/api/pricing.server.ts` : `predictPrice()`, un **modèle de prix déterministe
  (sans LLM)** — calendrier des soldes FR, facteurs par marque, saisonnalité par
  catégorie, génère un historique 12 mois reproductible et calcule une recommandation
  acheter/attendre.

### 1. `chatWithAda`
- Entrée : historique de messages + profil utilisateur.
- Construit un prompt système ("ADA, conseillère mode") enrichi du profil.
- Appelle Ollama (`/api/chat`).
- Extrait un éventuel tag `[SEARCH:...]` dans la réponse.
- **Nouveau** : si un `[SEARCH:...]` est détecté, lance en plus une recherche réelle sur
  Vinted (`searchVinted`) et renvoie jusqu'à 3 `ChatAlternative` (vraies annonces avec
  photo/prix/lien) affichées directement dans le chat.

### 2. `searchProducts` (mode "search")
- Entrée : requête texte + profil.
- `classifyQuery()` : classification **déterministe** (regex) de la requête en catégorie
  produit (chaussures, manteau, jupe, robe, sac, etc.), avec marques pertinentes, URL
  outlet, fourchette de prix — fait **avant** l'appel LLM pour fiabiliser les résultats.
- Lance **en parallèle** (`Promise.allSettled`) :
  - un appel Ollama (mode `format: "json"`) qui complète un JSON pré-rempli pour la
    colonne `original` (et l'avis outlet) ;
  - une recherche **réelle Vinted** (`searchVinted`) pour la colonne `vinted`.
- La colonne `vinted` utilise l'annonce Vinted réelle si trouvée (`real: true`, avec
  photo/lien/prix authentiques), sinon une estimation synthétique de repli
  (`real: false`).
- Les champs critiques (catégorie d'image, liens Vinted/outlet) restent **toujours**
  calculés côté serveur, jamais laissés au LLM.

### 3. `analyzeProductLink` (mode "link" — **sans LLM**)
- Remplace l'ancien `parseProductLink`.
- Scrape la vraie page produit (`scrapeProductPage`), avec heuristiques d'URL en repli
  (marque/nom depuis hostname/pathname si le scraping échoue).
- Cherche de vraies alternatives sur **Vinted** (`searchVinted`) à partir de mots-clés
  extraits du nom/marque.
- Calcule une prédiction de prix/recommandation acheter-attendre via `predictPrice()`
  (modèle déterministe, pas de LLM).
- Toute la chaîne "link" (analyse d'un lien collé par l'utilisateur) est donc 100%
  déterministe : scraping réel + Vinted réel + modèle de prix maison.

`SearchResult` distingue désormais `mode: "search" | "link"` pour indiquer au front si
les données viennent du flux LLM+Vinted ou du flux scraping+Vinted+pricing.

## Intégration LLM (Ollama)

- `OLLAMA_URL` (défaut `http://localhost:11434`) et `OLLAMA_MODEL` (défaut `mistral`),
  configurables via variables d'environnement (`.env`, voir `.env.example`).
- Appels HTTP directs à l'API Ollama (`/api/chat`), avec gestion d'erreurs dédiée
  (Ollama non démarré, modèle non installé).
- Le LLM n'est utilisé que pour : le chat conversationnel, et la colonne "original" /
  l'avis outlet en mode recherche. Les alternatives Vinted, le scraping de lien et la
  prédiction de prix sont tous **déterministes**, sans LLM.
- Aucune clé API cloud requise ; le SDK `@anthropic-ai/sdk` est présent dans les
  dépendances mais n'est pas utilisé dans le flux actuel (LLM = Ollama local).

## Gestion des erreurs

- `start.ts` : middleware serveur qui catch toute exception et renvoie une page d'erreur
  HTML statique (`renderErrorPage`).
- `server.ts` : entrée Nitro qui catch également les réponses 500 "avalées" par h3
  (réécrites en page d'erreur lisible) et les exceptions non gérées.
- `lib/error-capture.ts` / `lib/lovable-error-reporting.ts` : capture/reporting d'erreurs
  côté client (intégration Lovable).

## Assets

- `styles/` et `public/styles/` : jeux d'images de moodboard par esthétique
  (`streatwear`, `bold`, `minimalist`, `romantic`), utilisés par `ada-store.ts` pour
  composer les moodboards personnalisés selon les préférences de l'utilisateur.

## Points notables / dette technique

- Pas de base de données : tout l'état utilisateur vit en `localStorage` (perdu si
  l'utilisateur change de navigateur/appareil).
- La colonne "original" (et l'avis outlet) en mode recherche reste **générée par le LLM**
  (noms, prix, marques) — cohérente avec la classification déterministe mais pas garantie
  exacte. Les alternatives Vinted, elles, sont désormais réelles (API Vinted live).
- Le scraping (`scrapeProductPage`) et l'accès Vinted (`searchVinted`) dépendent de sites
  externes : risque de blocage anti-bot (détecté et géré par repli sur heuristiques) et de
  rupture si Vinted change son API/token.
- `src/lib/api/example.functions.ts` semble être un reste de boilerplate (à vérifier/retirer
  si inutilisé).
