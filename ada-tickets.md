# ADA — Tickets Claude Code

## Ticket 1 — Vecteur de préférences dynamique

Tu travailles sur ADA. Objectif : remplacer le scoring statique par un vecteur de
préférences dynamique qui s'enrichit à chaque interaction utilisateur.

### Concept
Un vecteur de style = un objet de dimensions pondérées (ex: `{ casual: 0.8, bold: 0.2,
minimaliste: 0.6, prix_sensibilite: 0.7, seconde_main_affinite: 0.9, ... }`).
À chaque interaction, on met à jour ce vecteur par weighted update (pas de reset brutal).
Les recommandations sont triées par similarité cosinus entre le vecteur utilisateur
et un vecteur produit.

### Ce que tu dois faire

**`src/lib/ada-store.ts`**
- Ajoute un type `StyleVector` : objet avec des dimensions flottantes 0-1.
  Dimensions : `casual`, `bold`, `minimaliste`, `romantique`, `streetwear`,
  `prix_sensibilite`, `seconde_main_affinite`, `luxe_affinite`, `sport`, `vintage`
- Ajoute `styleVector: StyleVector` au type `Profile` (initialisé à 0.5 partout = neutre)
- Crée une fonction `updateStyleVector(current: StyleVector, signal: Partial<StyleVector>,
  weight = 0.15): StyleVector` qui fait une mise à jour pondérée :
  `newVal = current[k] * (1 - weight) + signal[k] * weight`
- Crée une fonction `cosineSimilarity(a: StyleVector, b: StyleVector): number`
- Expose un hook `useStyleVector()` qui retourne `{ vector, updateVector }`
- Ajoute une fonction `inferSignalFromSwipe(preference: string): Partial<StyleVector>`
  qui mappe les préférences de swipe existantes vers des dimensions du vecteur
- Ajoute une fonction `inferSignalFromCart(item: CartItem): Partial<StyleVector>`
  qui infère un signal depuis une source (`vinted` → `seconde_main_affinite`,
  prix → `prix_sensibilite`, etc.)

**`src/routes/onboarding.tsx`**
- À la fin du flow, quand les préférences de swipe sont validées, appelle
  `updateVector` avec les signaux inférés depuis les préférences choisies

**`src/lib/ada-store.ts`** — hook `useCart`
- Quand `add()` est appelé, appelle `updateStyleVector` avec un signal inféré
  depuis l'item ajouté (source, prix)

**`src/lib/api/ada.functions.ts`** — `chatWithAda`
- Injecte un résumé lisible du vecteur dans le prompt système si le vecteur
  existe et n'est pas neutre (toutes les dims à 0.5)
- Format : `"Profil de style appris : casual 80%, seconde main 90%, prix-sensible 70%"`
- N'injecte que les dimensions au-dessus de 0.65 ou en-dessous de 0.35
  (les dimensions neutres n'apportent rien au prompt)

### Contraintes
- Pas de dépendance externe (math pur, pas de lib ML)
- Tout reste en localStorage, zéro backend
- La mise à jour est douce (weight 0.15) pour éviter qu'une action isolée écrase tout le profil
- Lis tous les fichiers concernés avant d'écrire quoi que ce soit
- Ne casse aucun comportement existant

---

## Ticket 2 — Moodboard → Chat

Tu travailles sur ADA. Objectif : quand l'utilisateur clique sur une image du
moodboard (page "/"), il est redirigé vers "/chat" avec un message pré-rempli
contextualisé à l'image cliquée.

### Ce que tu dois faire

**`src/lib/ada-store.ts`**
- Lis la structure des données de moodboard (images par catégorie/esthétique)
- Assure-toi que chaque image a accès à ses métadonnées : esthétique
  (`streetwear`, `bold`, `minimaliste`, `romantique`) + catégorie (`robe`, `manteau`, etc.)
- Ces métadonnées serviront à construire le message pré-rempli

**`src/routes/index.tsx`** — section moodboard
- Rends chaque image du moodboard cliquable
- Au clic : navigue vers `/chat?prefill=...` avec un message construit depuis
  les métadonnées de l'image
- Le message doit être naturel, pas hardcodé :
  ex. `"J'adore ce look streetwear, tu peux m'aider à trouver quelque chose dans ce style ? Notamment pour la pièce veste."`
- La construction du message doit être une fonction pure `buildMoodboardPrompt(
  esthetique: string, categorie: string): string` avec au moins 4 templates
  à rotation aléatoire pour que ça ne sonne pas robotique

**`src/routes/chat.tsx`**
- Au montage du composant, lis le query param `prefill` via `useSearch`
- Si présent, pré-remplis l'input du chat avec cette valeur
- Marque le prefill comme "consommé" pour ne pas le ré-injecter si
  l'utilisateur navigue ailleurs puis revient

### Note à laisser dans le code
Ajoute ce commentaire au-dessus de `buildMoodboardPrompt` :
```
// TODO: remplacer buildMoodboardPrompt par un appel FashionCLIP/BLIP-2
// quand un backend ML sera disponible — les métadonnées statiques sont un
// placeholder fonctionnel pour la démo.
```

### Contraintes
- Les templates prennent les métadonnées en paramètre, pas de strings hardcodées
- Lis `index.tsx` et `chat.tsx` avant d'écrire quoi que ce soit
- Ne touche pas à la logique de chat existante, juste le prefill à l'init

---

## Ticket 3 — Extension Chrome générique

Tu travailles sur ADA. Objectif : rendre l'extension Chrome générique — elle doit
fonctionner sur n'importe quel site e-commerce, pas seulement thenorthface.fr.

### Ce que tu dois faire

**`extension/manifest.json`**
- Remplace `host_permissions` par `"<all_urls>"`
- Garde les mêmes permissions existantes

**`extension/content.js`** — stratégie multi-fallback dans cet ordre

1. **JSON-LD** : cherche `<script type="application/ld+json">` dont le contenu
   contient `"@type": "Product"`. Extrait `name`, `image`, `offers.price`.

2. **OpenGraph** : si JSON-LD échoue ou incomplet, lit les meta tags :
   - `og:title` → nom
   - `og:price:amount` ou `product:price:amount` → prix
   - `og:image` → image

3. **Sélecteurs DOM heuristiques** : si OpenGraph incomplet, essaie dans l'ordre :
   - Nom : `h1`, `[class*="product-title"]`, `[class*="product-name"]`, `[itemprop="name"]`
   - Prix : `[class*="price"][class*="current"]`, `[class*="price--sale"]`,
     `[itemprop="price"]`, `[class*="price"]:first-of-type`
   - Image : `[class*="product"] img:first-of-type`, `[class*="gallery"] img:first-of-type`

4. **Mapping produit** : si l'URL ou le nom contient un mot-clé connu
   (antora, air max, wilson, clash...) → mappe vers l'id produit correspondant.
   Sinon : crée un produit générique avec les données extraites et id `"unknown"`.

**`extension/popup.js`**
- Affiche le nom et le prix extraits dans le popup avant de sauvegarder
  (confirmation visuelle que l'extraction a marché)
- Bouton "Ajouter au Super-Panier" → stocke dans `localStorage` clé `"extension_product"`
- En cas d'échec total d'extraction : affiche `"Impossible de lire ce produit"`
  au lieu de planter silencieusement

### Contraintes
- Lis tous les fichiers existants dans `/extension` avant d'écrire quoi que ce soit
- Ne touche pas à `src/` — l'extension est dans `/extension` uniquement
- `LinkInput.jsx` écoute déjà `localStorage "extension_product"`, ne pas changer ça
