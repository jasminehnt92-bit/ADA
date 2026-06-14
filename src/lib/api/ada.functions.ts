import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  extractKeywords,
  scrapeProductPage,
  searchVinted,
} from "./scraping.server";
import { predictPrice } from "./pricing.server";

const OLLAMA_URL = () => process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = () => process.env.OLLAMA_MODEL ?? "llama3";

// ---------- Types ----------

// Two shapes, discriminated by `mode`:
//   - "link"   : a real scraped product + real Vinted alternatives + price model (3 columns)
//   - "search" : a free-text query → a list of real Vinted listings (NO LLM, NO phantom links)
export type LinkAnalysis = {
  query: string;
  mode: "link";
  original: {
    brand: string;
    name: string;
    price: number;
    originalPrice: number;
    status: "WAIT" | "BUY";
    promoMessage: string;
    link: string;
    imageCategory: string;
    image: string | null; // real product photo; null → fall back to imageCategory
  };
  vinted: {
    title: string;
    price: number;
    originalPrice: number;
    condition: string;
    link: string;
    discount: number;
    imageCategory: string;
    image: string | null;
    real: boolean;
  };
  // Second real Vinted listing.
  outlet?: {
    brand: string;
    price: number;
    originalPrice: number;
    link: string;
    discount: number;
    imageCategory: string;
    image: string | null;
    title?: string;
    condition?: string;
  };
};

export type VintedSearch = {
  query: string;
  mode: "search";
  imageCategory: string; // placeholder image fallback for listings without a photo
  items: ChatAlternative[]; // real Vinted listings
  searchLink: string; // open the full query on Vinted
};

export type SearchResult = LinkAnalysis | VintedSearch;

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
  opts: {
    format?: "json";
    temperature?: number;
    numPredict?: number;
    stop?: string[];
    repeatPenalty?: number;
    topP?: number;
  } = {},
): Promise<string> {
  const options: Record<string, unknown> = { temperature: opts.temperature ?? 0.7 };
  if (opts.numPredict !== undefined) options.num_predict = opts.numPredict;
  if (opts.stop) options.stop = opts.stop;
  if (opts.repeatPenalty !== undefined) options.repeat_penalty = opts.repeatPenalty;
  if (opts.topP !== undefined) options.top_p = opts.topP;

  const body: Record<string, unknown> = {
    model: OLLAMA_MODEL(),
    messages,
    stream: false,
    options,
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

const CHAT_SYSTEM = `Tu es ADA (Accessible Design Advisor), conseillère shopping mode française. Tu réponds de façon ULTRA concise, comme un SMS.

TA MÉTHODE = UN ENTONNOIR. Tu cernes le besoin AVANT de conseiller :
- Tant que tu n'as pas, pour le produit recherché, ces trois infos — (a) le TYPE de produit, (b) l'USAGE/occasion (ville, sport, mariage, travail…), (c) le BUDGET approximatif — tu poses UNE seule question courte pour la prochaine info manquante, et tu NE conclus PAS encore.
- Une question de plus vaut mieux qu'une reco à côté de la plaque.
- Quand tu as les trois infos, tu arrêtes de questionner, tu donnes ton ANGLE, et tu ajoutes le tag [SEARCH:...].

RÈGLES ABSOLUES :
1. Réponds en UNE phrase, deux maximum. Jamais de liste, jamais de markdown, aucun emoji. Une seule question à la fois.
2. NE CITE AUCUNE MARQUE ni nom de produit dans ta phrase. L'app affiche déjà les vrais produits sous ta réponse. Quand tu conclus, donne seulement L'ANGLE : acheter neuf maintenant, attendre une promo précise (nomme-la : soldes d'hiver, French Days, soldes d'été, Black Friday), ou viser la seconde main — plus UNE raison courte.
3. La demande explicite de l'utilisateur PRIME sur son profil.
4. MÉMOIRE STRICTE : le produit recherché ne change pas quand l'utilisateur ajoute un détail ("une veste" puis "pour un mariage" = une veste habillée). Relis tout le fil, ne te contredis jamais, ne redemande pas un critère déjà donné.
5. N'invente jamais de prix chiffré, de stock ni de lien.

LE TAG [SEARCH:...] (uniquement quand tu conclus) doit contenir des mots-clés produits précis : type + caractéristiques (couleur, matière, occasion), et la marque/modèle SEULEMENT si l'utilisateur les a cités.
Exemples : [SEARCH:jupe midi plissée beige femme casual] · [SEARCH:trench coat beige femme classique] · [SEARCH:sac tote cuir noir bureau]

Exemple d'entonnoir :
- "Une veste" → "Tu la veux pour quel usage, plutôt ville, sport ou une occasion habillée ?"
- "Pour un mariage" → "Ok une veste habillée pour un mariage, tu mets quel budget environ ?"
- "Autour de 100€" → "À ce budget je viserais la seconde main, tu fais une belle affaire sans rogner sur la qualité. [SEARCH:veste blazer habillée femme mariage]"`;

// Client-side guardrail: strip markdown/lists the model may emit despite the prompt.
function tidyReply(text: string): string {
  return String(text || "")
    .replace(/\*\*?|__|`/g, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export type ChatAlternative = {
  id: string;
  title: string;
  price: number;
  url: string;
  image: string | null;
  condition: string | null;
};

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

    const raw = await ollamaChat(ollamaMessages, {
      temperature: 0.4,
      topP: 0.9,
      numPredict: 120, // hard cap → ~2 sentences, prevents rambling
      repeatPenalty: 1.3,
    });

    const searchMatch = raw.match(/\[SEARCH:(.*?)\]/);
    const searchQuery = searchMatch ? searchMatch[1].trim() : null;
    const text = tidyReply(raw.replace(/\[SEARCH:[^\]]*\]/g, ""));

    // When ADA concludes (a [SEARCH:...] term), pull real Vinted listings to show
    // inline under her reply — the "previous site" funnel behavior.
    let alternatives: ChatAlternative[] = [];
    if (searchQuery) {
      try {
        const items = await searchVinted(extractKeywords(searchQuery), null, { limit: 3 });
        alternatives = items.map((it) => ({
          id: it.id,
          title: it.title,
          price: it.price,
          url: it.url,
          image: it.image,
          condition: it.condition,
        }));
      } catch {
        /* Vinted unavailable → just no inline suggestions */
      }
    }

    return { text, searchQuery, alternatives };
  });

// ---------- searchProducts ----------

export const searchProducts = createServerFn({ method: "POST" })
  .inputValidator(z.object({ query: z.string(), profile: ProfileSchema }))
  .handler(async ({ data }): Promise<VintedSearch> => {
    // Text search is now Vinted-only — NO LLM, NO phantom links. We hit the live
    // Vinted API and return the real listings; classifyQuery only gives us a
    // placeholder image category for listings without a photo.
    const meta = classifyQuery(data.query);
    const searchLink = `https://www.vinted.fr/catalog?search_text=${encodeURIComponent(data.query)}`;

    let items: ChatAlternative[] = [];
    try {
      const found = await searchVinted(extractKeywords(data.query), null, { limit: 8 });
      items = found.map((it) => ({
        id: it.id,
        title: it.title,
        price: it.price,
        url: it.url,
        image: it.image,
        condition: it.condition,
      }));
    } catch {
      /* Vinted unavailable → empty list; the UI shows the "open on Vinted" link */
    }

    return {
      query: data.query,
      mode: "search",
      imageCategory: meta.imageCategory,
      items,
      searchLink,
    };
  });

// ---------- analyzeProductLink (NO LLM — real scrape + Vinted + price model) ----------
// This is the link-search path: it mirrors the previous project's /api/analyze.
// The product comes from the real page, the alternatives from the live Vinted API,
// and the BUY/WAIT call from the deterministic price model — no Ollama involved.

export const analyzeProductLink = createServerFn({ method: "POST" })
  .inputValidator(z.object({ url: z.string() }))
  .handler(async ({ data }): Promise<LinkAnalysis> => {
    let hostname = "";
    let pathname = "";
    try {
      const u = new URL(data.url);
      hostname = u.hostname;
      pathname = u.pathname;
    } catch {
      hostname = "boutique";
    }

    // Real page scrape, with URL heuristics as fallback.
    const scraped = data.url.startsWith("http") ? await scrapeProductPage(data.url) : null;
    const name = scraped?.nom?.trim() || nameFromPathname(pathname);
    const brand = scraped?.marque?.trim() || brandFromHostname(hostname);
    const price = scraped?.prix_actuel ? Number(scraped.prix_actuel) : 0;
    const meta = classifyQuery(`${pathname} ${hostname} ${name} ${brand}`);

    // Real Vinted alternatives + deterministic price prediction (both no-LLM).
    const keywords = extractKeywords(name, brand);
    const [vintedRes] = await Promise.allSettled([
      searchVinted(keywords, price > 0 ? price : null, {
        min: price > 0 ? price * 0.2 : 0,
        max: price > 0 ? price : Infinity,
        limit: 4,
      }),
    ]);
    const items = vintedRes.status === "fulfilled" ? vintedRes.value : [];
    const prediction = price > 0 ? predictPrice({ prix_actuel: price, marque: brand, nom: name }) : null;

    const discountVs = (p: number) =>
      price > 0 ? Math.max(0, Math.round((1 - p / price) * 100)) : 0;

    const v0 = items[0];
    const v1 = items[1];

    return {
      query: name,
      mode: "link",
      original: {
        brand,
        name,
        price,
        originalPrice: price,
        status: prediction ? (prediction.statut === "attendre" ? "WAIT" : "BUY") : "BUY",
        promoMessage: prediction?.raison_prediction ?? "",
        link: data.url,
        imageCategory: meta.imageCategory,
        image: scraped?.image ?? null,
      },
      vinted: v0
        ? {
            title: v0.title,
            price: v0.price,
            originalPrice: price || v0.price,
            condition: v0.condition || "Bon état",
            link: v0.url,
            discount: discountVs(v0.price),
            imageCategory: meta.imageCategory,
            image: v0.image,
            real: true,
          }
        : {
            title: `Vinted — ${name}`,
            price: price > 0 ? Math.round(price * 0.4) : 0,
            originalPrice: price,
            condition: "Bon état",
            link: `https://www.vinted.fr/catalog?search_text=${encodeURIComponent(keywords.join(" "))}`,
            discount: price > 0 ? 60 : 0,
            imageCategory: meta.imageCategory,
            image: null,
            real: false,
          },
      outlet: v1
        ? {
            brand: "Vinted",
            price: v1.price,
            originalPrice: price || v1.price,
            link: v1.url,
            discount: discountVs(v1.price),
            imageCategory: meta.imageCategory,
            image: v1.image,
            title: v1.title,
            condition: v1.condition || "Bon état",
          }
        : undefined,
    };
  });

// ---------- URL heuristics (shared fallback for link analysis) ----------

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

