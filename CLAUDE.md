@ARCHITECTURE_V2.md
# CLAUDE.md — ADA (Accessible Design Advisor)

## Instructions permanentes
- Lis `ARCHITECTURE_V2.md` avant chaque session pour ne pas casser la structure globale
- À chaque fin de tâche, mets à jour la section "Prochaine étape" ci-dessous
- Si tu n'es pas sûr de quelque chose, pose une question plutôt qu'inventer

## Contexte projet
Application web mobile-first de recommandation vestimentaire. L'utilisateur passe par un
onboarding swipe, interagit avec un chat IA (ADA), recherche des produits comparés
Original / Vinted / Outlet, et gère un "Super-Panier" avec calcul d'économies.
Le LLM est Ollama local (mistral), appelé uniquement côté serveur. Zéro API cloud.

## Stack — ne jamais dévier de ça
- TanStack Start (SSR) + TanStack Router (file-based routing)
- React 19, Tailwind CSS v4, Radix UI (shadcn-style), Framer Motion
- TanStack Query pour le data fetching
- Zod pour la validation
- Ollama (mistral par défaut) via Server Functions
- Bun (pas npm, pas yarn)

## Règles absolues

### Données & état
- Tout l'état persistant vit dans `src/lib/ada-store.ts` via localStorage
- Clés localStorage : `ada-profile-v2`, `ada-cart-v2`, `ada-conversation-v2`
- Pas de base de données, pas de fetch client-side vers des APIs externes
- Les Server Functions (`createServerFn`) sont le seul endroit où appeler Ollama ou Vinted

### Fichiers
- Routes dans `src/routes/` (file-based, ne pas créer manuellement `routeTree.gen.ts`)
- Composants métier dans `src/components/ada/`
- Composants UI génériques dans `src/components/ui/`
- State + hooks dans `src/lib/ada-store.ts`
- Server Functions dans `src/lib/api/ada.functions.ts`
- Config serveur dans `src/lib/config.server.ts` (jamais exposée au client)

### Code
- TypeScript strict partout — pas de `any`, pas de cast sauvage
- Imports toujours en haut du fichier
- Un composant = un fichier
- Pas de console.log dans le code final

## Ce que tu fais quand je te donne une tâche
1. Tu lis tous les fichiers concernés avant d'écrire la moindre ligne
2. Tu fais uniquement ce qui est demandé — pas de refactor global, pas d'"améliorations" non demandées
3. Tu ne touches pas à `routeTree.gen.ts` (généré automatiquement)
4. Tu ne changes jamais le schéma localStorage sans assurer la rétrocompatibilité
   (champs optionnels avec valeurs par défaut, pas de migration cassante)
5. Tu ne touches pas à `src/lib/config.server.ts` sauf si la tâche le concerne explicitement

## Architecture des flux principaux (pour contexte)
- **Onboarding** (`/onboarding`) : quiz swipe → profil sauvé dans `ada-profile-v2`
- **Home** (`/`) : dashboard + moodboard + recherche rapide
- **Search** (`/search`) : recherche produit → redirige vers `/analysis`
- **Analysis** (`/analysis`) : deux modes :
  - `?q=...` → LLM (Ollama) + Vinted réel en parallèle
  - `?url=...` → scraping réel + Vinted réel + modèle de prix déterministe, sans LLM
- **Chat** (`/chat`) : conversation avec ADA, supporte `?prefill=...` pour pré-remplir l'input
- **Cart** (`/cart`) : Super-Panier avec calcul d'économies
- **Profile** (`/profile`) : préférences, reset

## Modules serveur clés
- `src/lib/api/scraping.server.ts` : `searchVinted()` + `scrapeProductPage()`
- `src/lib/api/pricing.server.ts` : `predictPrice()` — modèle déterministe, sans LLM
- `src/lib/api/ada.functions.ts` : `chatWithAda`, `searchProducts`, `analyzeProductLink`

## Vecteur de style (StyleVector)
Dimensions 0-1 : `casual`, `bold`, `minimaliste`, `romantique`, `streetwear`,
`prix_sensibilite`, `seconde_main_affinite`, `luxe_affinite`, `sport`, `vintage`.
Mise à jour douce (weight 0.15) à chaque swipe, ajout au panier, interaction chat.
Injecté dans le prompt Ollama uniquement si des dimensions sont non-neutres (< 0.35 ou > 0.65).

## Extension Chrome (`/extension`)
Projet séparé, ne pas mélanger avec `src/`.
Communication vers l'app : `localStorage.setItem("extension_product", JSON.stringify(data))`.
L'extension est générique (JSON-LD → OpenGraph → sélecteurs DOM heuristiques).

## Prochaine étape
Ticket 1 — Vecteur de préférences dynamique (voir ada-tickets.md).
Fichiers concernés : `src/lib/ada-store.ts`, `src/routes/onboarding.tsx`, `src/lib/api/ada.functions.ts`.
