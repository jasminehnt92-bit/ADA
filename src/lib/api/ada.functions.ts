import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const OLLAMA_URL = () => process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = () => process.env.OLLAMA_MODEL ?? "mistral";

// ---------- Types ----------

export type SearchResult = {
  query: string;
  original: {
    brand: string;
    name: string;
    price: number;
    originalPrice: number;
    status: "WAIT" | "BUY";
    promoMessage: string;
    link: string;
    imageCategory: string;
  };
  vinted: {
    price: number;
    originalPrice: number;
    condition: string;
    link: string;
    discount: number;
    imageCategory: string;
  };
  outlet: {
    brand: string;
    price: number;
    originalPrice: number;
    link: string;
    discount: number;
    imageCategory: string;
  };
};

export type ParsedProduct = {
  name: string;
  brand: string;
  price: number;
  originalPrice: number;
  imageCategory: string;
};

type OllamaMessage = { role: "system" | "user" | "assistant"; content: string };

// ---------- Query classification (runs BEFORE the LLM call) ----------

type QueryMeta = {
  imageCategory: string;
  productType: string;
  brands: string;          // injected into the prompt
  outletUrl: string;
  priceMin: number;
  priceMax: number;
};

function classifyQuery(query: string): QueryMeta {
  const q = query.toLowerCase();

  // ── Sport brands / sneakers ──────────────────────────────────────
  if (
    /asics|gel[\s-]?(kayano|nimbus|cumulus|kinsei|quantum|pulse|rocket|trabuco)|nike|adidas|puma|reebok|new balance|nb[\s\d]|vans|converse|skechers|fila|jordan|hoka|salomon|brooks|mizuno|under armour|on running|cloudfoam|ultraboost|air max|air force|stan smith|forum|campus|gazelle|samba|handball spezial/i.test(
      q,
    )
  ) {
    return {
      imageCategory: "shoes",
      productType: "sneakers / chaussures de sport",
      brands: "Nike, Adidas, Asics, New Balance, Puma, Reebok, Converse, Vans, Hoka, Salomon",
      outletUrl: "https://www.veepee.fr/club/ventes-privees/chaussures",
      priceMin: 60,
      priceMax: 200,
    };
  }

  // ── Chaussures (générique) ────────────────────────────────────────
  if (
    /chaussure|basket|sneaker|loafer|mocassin|derby|oxford|escarpin|botte|boot|sandale|mule|ballerine|sabot|slip.?on|penny loafer|wedge/i.test(
      q,
    )
  ) {
    return {
      imageCategory: "shoes",
      productType: "chaussures",
      brands: "Minelli, San Marina, André, Eram, Jonak, Bocage, Unisa, Mango, Zara",
      outletUrl: "https://www.veepee.fr/club/ventes-privees/chaussures",
      priceMin: 30,
      priceMax: 160,
    };
  }

  // ── Manteaux / outerwear ──────────────────────────────────────────
  if (
    /manteau|trench|parka|doudoune|anorak|imperméable|overcoat|peacoat|duffle.?coat|cape|poncho/i.test(
      q,
    )
  ) {
    return {
      imageCategory: "coat",
      productType: "manteau / veste d'extérieur",
      brands: "Zara, Mango, Sézane, Ba&sh, A.P.C., Uniqlo, Arket, COS, Bershka",
      outletUrl: "https://www.veepee.fr/club/ventes-privees/mode-femme",
      priceMin: 60,
      priceMax: 350,
    };
  }

  // ── Jupes ─────────────────────────────────────────────────────────
  if (/jupe|skirt|mini.?skirt|midi.?skirt|maxi.?skirt/i.test(q)) {
    return {
      imageCategory: "skirt",
      productType: "jupe",
      brands: "Sézane, Rouje, Mango, Zara, H&M, Uniqlo, & Other Stories, Jacquemus",
      outletUrl: "https://www.veepee.fr/club/ventes-privees/mode-femme",
      priceMin: 20,
      priceMax: 130,
    };
  }

  // ── Robes ─────────────────────────────────────────────────────────
  if (/robe|dress|combinaison|combi(?!naison|né)/i.test(q)) {
    return {
      imageCategory: "dress",
      productType: "robe",
      brands: "Rouje, Sézane, Mango, Zara, Ba&sh, Reformation, & Other Stories, Jacquemus",
      outletUrl: "https://www.veepee.fr/club/ventes-privees/mode-femme",
      priceMin: 35,
      priceMax: 280,
    };
  }

  // ── Sacs / maroquinerie ───────────────────────────────────────────
  if (
    /sac\b|bag|pochette|tote|backpack|sac[\s-]?à[\s-]?dos|clutch|besace|cartable|baguette|sac[\s-]?main|cabas/i.test(
      q,
    )
  ) {
    return {
      imageCategory: "bag",
      productType: "sac / maroquinerie",
      brands: "Polène, Manu Atelier, A.P.C., Sézane, Mango, Zara, Coccinelle, Longchamp",
      outletUrl: "https://www.veepee.fr/club/ventes-privees/maroquinerie",
      priceMin: 25,
      priceMax: 500,
    };
  }

  // ── Jeans / denim ─────────────────────────────────────────────────
  if (/jean|denim|501|skinny.?jean|wide.?leg.?jean|mom.?jean|boyfriend.?jean/i.test(q)) {
    return {
      imageCategory: "jeans",
      productType: "jean denim",
      brands: "Levi's, Sézane, Uniqlo, Mango, Zara, AGOLDE, Arket, Pull&Bear",
      outletUrl: "https://www.veepee.fr/club/ventes-privees/mode-femme",
      priceMin: 25,
      priceMax: 180,
    };
  }

  // ── Vestes / blazers ──────────────────────────────────────────────
  if (/veste|blazer|cardigan|gilet structuré|smoking|tailleur/i.test(q)) {
    return {
      imageCategory: "jacket",
      productType: "veste / blazer",
      brands: "Zara, Mango, Sézane, H&M, Uniqlo, COS, & Other Stories, Jacquemus",
      outletUrl: "https://www.veepee.fr/club/ventes-privees/mode-femme",
      priceMin: 30,
      priceMax: 220,
    };
  }

  // ── Hauts / tops ──────────────────────────────────────────────────
  if (
    /\btop\b|t-shirt|tshirt|chemise|blouse|pull|sweat|hoodie|tricot|polo|débardeur|crop.?top|bustier|body\b/i.test(
      q,
    )
  ) {
    return {
      imageCategory: "top",
      productType: "haut / top",
      brands: "Sézane, Uniqlo, Mango, Zara, Arket, COS, & Other Stories, Monoprix",
      outletUrl: "https://www.veepee.fr/club/ventes-privees/mode-femme",
      priceMin: 15,
      priceMax: 120,
    };
  }

  // ── Pantalons (hors jeans) ────────────────────────────────────────
  if (/pantalon|jogger|legging|jogging|cargo|palazzo|wide.?leg|flare|trousers/i.test(q)) {
    return {
      imageCategory: "jeans",
      productType: "pantalon",
      brands: "Zara, Mango, Uniqlo, H&M, COS, Arket, Sézane",
      outletUrl: "https://www.veepee.fr/club/ventes-privees/mode-femme",
      priceMin: 20,
      priceMax: 150,
    };
  }

  // ── Accessoires (bijoux, ceinture, chapeau…) ──────────────────────
  if (
    /bijou|collier|bracelet|bague|montre|ceinture|chapeau|bonnet|écharpe|foulard|lunette|casquette|accessoire/i.test(
      q,
    )
  ) {
    return {
      imageCategory: "accessories",
      productType: "accessoire",
      brands: "Sézane, Mango, Zara, H&M, ASOS, & Other Stories, Monoprix",
      outletUrl: "https://www.veepee.fr/club/ventes-privees/mode-femme",
      priceMin: 10,
      priceMax: 150,
    };
  }

  // ── Fallback ──────────────────────────────────────────────────────
  return {
    imageCategory: "accessories",
    productType: "article de mode",
    brands: "Zara, Mango, Sézane, Uniqlo, Arket, COS, H&M",
    outletUrl: "https://www.veepee.fr/club/ventes-privees/mode-femme",
    priceMin: 20,
    priceMax: 200,
  };
}

// ---------- Ollama HTTP wrapper ----------

async function ollamaChat(
  messages: OllamaMessage[],
  opts: { format?: "json"; temperature?: number } = {},
): Promise<string> {
  const body: Record<string, unknown> = {
    model: OLLAMA_MODEL(),
    messages,
    stream: false,
    options: { temperature: opts.temperature ?? 0.7 },
  };
  if (opts.format === "json") body.format = "json";

  let res: Response;
  try {
    res = await fetch(`${OLLAMA_URL()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      `Ollama inaccessible sur ${OLLAMA_URL()}. Lance-le avec : ollama serve`,
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (text.includes("model") && text.includes("not found")) {
      throw new Error(
        `Modèle "${OLLAMA_MODEL()}" introuvable. Installe-le avec : ollama pull ${OLLAMA_MODEL()}`,
      );
    }
    throw new Error(`Ollama erreur ${res.status}: ${text.slice(0, 120)}`);
  }

  const json = await res.json();
  return (json?.message?.content as string) ?? "";
}

function extractJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

// ---------- Zod schemas ----------

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const ProfileSchema = z.object({
  name: z.string(),
  age: z.string().optional(),
  sex: z.string().optional(),
  preferences: z.record(z.string()),
});

// ---------- chatWithAda ----------

const CHAT_SYSTEM = `Tu es ADA (Accessible Design Advisor), une assistante mode française bienveillante et précise.

MISSION : Aider l'utilisateur à trouver exactement ce qu'il cherche via un entonnoir de questions.

PROCESSUS :
1. Question ouverte si l'utilisateur est vague ("Qu'est-ce que tu recherches ?")
2. Si l'utilisateur mentionne un article précis (marque, modèle, type) → passe directement à l'étape 3
3. Questions de précision (2-3 max) : occasion, couleur, budget, taille/pointure, urgence
4. Après 2 échanges minimum : propose la recherche avec [SEARCH:terme précis]
5. Si refus → affine encore

FORMAT DU [SEARCH:...] — inclus toujours :
- La marque exacte si connue (ex: Asics, Nike, Sézane)
- Le modèle exact si mentionné (ex: Gel Kayano, Air Max 90)
- Le type de produit en clair (ex: chaussures running, jupe midi, trench beige)
- Caractéristiques importantes (couleur, matière, occasion)

Exemples de [SEARCH:...] bien formés :
[SEARCH:Asics Gel Kayano chaussures running femme]
[SEARCH:jupe midi plissée beige femme casual]
[SEARCH:trench coat beige femme classique imperméable]
[SEARCH:sac tote cuir noir femme bureau]

RÈGLES :
- Toujours en français, max 2-3 phrases par réponse
- Ne jamais inventer des préférences non mentionnées
- Tenir compte du profil utilisateur pour suggérer le bon budget/style`;

export const chatWithAda = createServerFn({ method: "POST" })
  .inputValidator(z.object({ messages: z.array(MessageSchema), profile: ProfileSchema }))
  .handler(async ({ data }) => {
    const profileDesc = [
      data.profile.name && `Prénom: ${data.profile.name}`,
      data.profile.age && `Âge: ${data.profile.age} ans`,
      data.profile.sex && `Genre: ${data.profile.sex}`,
      data.profile.preferences["budget"] === "left" && "Budget serré (étudiant, max ~60€)",
      data.profile.preferences["budget"] === "right" && "Budget aisé",
      data.profile.preferences["source"] === "left" && "Préfère la seconde main (Vinted en priorité)",
      data.profile.preferences["origin"] === "left" && "Préfère Made in France/Europe",
      data.profile.preferences["style"] === "left" && "Style minimaliste/classique",
      data.profile.preferences["style"] === "right" && "Style bold/tendance",
      data.profile.preferences["frequency"] === "right" && "Achats fréquents/impulsifs",
    ]
      .filter(Boolean)
      .join(", ");

    const systemContent = `${CHAT_SYSTEM}\n\nProfil: ${profileDesc || "Non renseigné"}`;

    const ollamaMessages: OllamaMessage[] = [
      { role: "system", content: systemContent },
      ...data.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const text = await ollamaChat(ollamaMessages, { temperature: 0.75 });
    const searchMatch = text.match(/\[SEARCH:(.*?)\]/);

    return {
      text: text.replace(/\[SEARCH:[^\]]*\]/g, "").trim(),
      searchQuery: searchMatch ? searchMatch[1].trim() : null,
    };
  });

// ---------- searchProducts ----------

export const searchProducts = createServerFn({ method: "POST" })
  .inputValidator(z.object({ query: z.string(), profile: ProfileSchema }))
  .handler(async ({ data }): Promise<SearchResult> => {
    const meta = classifyQuery(data.query);

    const profileDesc = [
      data.profile.preferences["budget"] === "left" && "budget serré — privilégie les marques abordables",
      data.profile.preferences["budget"] === "right" && "budget aisé — marques premium OK",
      data.profile.preferences["source"] === "left" && "préfère la seconde main",
      data.profile.preferences["origin"] === "left" && "préfère Made in France/Europe",
    ]
      .filter(Boolean)
      .join(", ");

    const vinteLink = `https://www.vinted.fr/catalog?search_text=${encodeURIComponent(data.query)}`;

    // The prompt pre-fills all fixed values (imageCategory, URLs) so the model
    // only has to fill in brand, name, prices and short text fields.
    const userMessage = `Génère des résultats pour la recherche suivante et retourne UNIQUEMENT le JSON complété.

RECHERCHE : "${data.query}"
TYPE DE PRODUIT : ${meta.productType}
MARQUES APPROPRIÉES : ${meta.brands}
FOURCHETTE DE PRIX : ${meta.priceMin}€ – ${meta.priceMax}€
${profileDesc ? `PROFIL : ${profileDesc}` : ""}

Complète ce JSON en remplaçant les <balises> par les vraies valeurs.
Ne change PAS les valeurs déjà renseignées (imageCategory, liens Vinted/outlet).

{
  "query": "${data.query}",
  "original": {
    "brand": "<meilleure marque parmi : ${meta.brands}>",
    "name": "<nom exact du produit ${meta.productType} correspondant à la recherche>",
    "price": <prix réaliste entre ${meta.priceMin} et ${meta.priceMax}>,
    "originalPrice": <même valeur ou légèrement plus élevée>,
    "status": "<WAIT si des soldes/promotions sont probables dans les 4 prochaines semaines, sinon BUY>",
    "promoMessage": "<une phrase de conseil sur le bon moment d'achat ou les promotions prévues>",
    "link": "<URL réelle de la page de recherche sur le site officiel de la marque>",
    "imageCategory": "${meta.imageCategory}"
  },
  "vinted": {
    "price": <entre 50% et 70% moins cher que original.price>,
    "originalPrice": <copie exacte de original.price>,
    "condition": "<Très bon état, Bon état, ou Neuf avec étiquette>",
    "link": "${vinteLink}",
    "discount": <pourcentage de réduction entre 50 et 70>,
    "imageCategory": "${meta.imageCategory}"
  },
  "outlet": {
    "brand": "<site outlet pertinent : Veepee, Zalando Privé, BrandAlley, ou La Redoute Soldes>",
    "price": <entre 30% et 50% moins cher que original.price>,
    "originalPrice": <copie exacte de original.price>,
    "link": "${meta.outletUrl}",
    "discount": <pourcentage de réduction entre 30 et 50>,
    "imageCategory": "${meta.imageCategory}"
  }
}`;

    const text = await ollamaChat(
      [{ role: "user", content: userMessage }],
      { format: "json", temperature: 0.2 },
    );

    try {
      const parsed = JSON.parse(extractJson(text)) as SearchResult;
      const originalPrice = Number(parsed.original?.price) || meta.priceMin;

      // imageCategory is always from our classification — never trust the model for this
      return {
        query: data.query,
        original: {
          brand: parsed.original?.brand || meta.brands.split(",")[0].trim(),
          name: parsed.original?.name || data.query,
          price: originalPrice,
          originalPrice: Number(parsed.original?.originalPrice) || originalPrice,
          status: parsed.original?.status === "WAIT" ? "WAIT" : "BUY",
          promoMessage: parsed.original?.promoMessage || "",
          link: parsed.original?.link || "#",
          imageCategory: meta.imageCategory,  // always from classifyQuery
        },
        vinted: {
          price: Number(parsed.vinted?.price) || Math.round(originalPrice * 0.4),
          originalPrice: originalPrice,
          condition: parsed.vinted?.condition || "Bon état",
          link: vinteLink,  // always the correct Vinted search URL
          discount: Number(parsed.vinted?.discount) || 60,
          imageCategory: meta.imageCategory,
        },
        outlet: {
          brand: parsed.outlet?.brand || "Veepee",
          price: Number(parsed.outlet?.price) || Math.round(originalPrice * 0.65),
          originalPrice: originalPrice,
          link: meta.outletUrl,  // always the correct outlet URL
          discount: Number(parsed.outlet?.discount) || 35,
          imageCategory: meta.imageCategory,
        },
      };
    } catch {
      throw new Error("Impossible de parser les résultats — réessaie ou reformule la recherche.");
    }
  });

// ---------- parseProductLink (no LLM — instant URL parsing) ----------

const DOMAIN_BRANDS: Record<string, string> = {
  sezane: "Sézane", zara: "Zara", uniqlo: "Uniqlo", mango: "Mango",
  hm: "H&M", "h&m": "H&M", apc: "A.P.C.", arket: "Arket", cos: "COS",
  bash: "Ba&sh", rouje: "Rouje", jacquemus: "Jacquemus", balzac: "Balzac Paris",
  claudiepierlot: "Claudie Pierlot", sandro: "Sandro", maje: "Maje",
  nike: "Nike", adidas: "Adidas", asics: "Asics", puma: "Puma",
  reebok: "Reebok", newbalance: "New Balance", vans: "Vans", converse: "Converse",
  hoka: "Hoka", salomon: "Salomon", vinted: "Vinted",
  vestiaire: "Vestiaire Collective", veepee: "Veepee",
  zalando: "Zalando", asos: "ASOS", shein: "Shein", primark: "Primark",
  monoprix: "Monoprix", galeries: "Galeries Lafayette", printemps: "Printemps",
  bershka: "Bershka", pullandbear: "Pull&Bear", stradivarius: "Stradivarius",
  tiktok: "TikTok", instagram: "Instagram",
};

function brandFromHostname(hostname: string): string {
  const clean = hostname.replace("www.", "").toLowerCase();
  const root = clean.split(".")[0];
  for (const [key, brand] of Object.entries(DOMAIN_BRANDS)) {
    if (root.includes(key) || clean.includes(key)) return brand;
  }
  return root.charAt(0).toUpperCase() + root.slice(1);
}

function nameFromPathname(pathname: string): string {
  const slug = pathname
    .split("/")
    .filter(Boolean)
    // drop locale segments and common route words
    .filter((s) => !/^(fr|en|de|es|it|us|uk|product|produit|item|article|p|shop|boutique|catalog|categorie|category|collection|c|detail|pd|pdp|\d{4,})$/.test(s))
    .join(" ")
    .replace(/[-_]/g, " ")
    .replace(/\.\w+$/, "") // strip extension
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!slug) return "Article importé";
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export const parseProductLink = createServerFn({ method: "POST" })
  .inputValidator(z.object({ url: z.string() }))
  .handler(({ data }): ParsedProduct => {
    let hostname = "";
    let pathname = "";
    try {
      const parsed = new URL(data.url);
      hostname = parsed.hostname;
      pathname = parsed.pathname;
    } catch {
      hostname = "boutique";
    }

    const brand = brandFromHostname(hostname);
    const name = nameFromPathname(pathname);
    const meta = classifyQuery(`${pathname} ${hostname} ${name}`);

    return { name, brand, price: 0, originalPrice: 0, imageCategory: meta.imageCategory };
  });
